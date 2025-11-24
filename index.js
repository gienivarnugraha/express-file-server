import 'dotenv/config';
import express from 'express';
import { createStorage } from 'unstorage';
import { createStorageServer } from 'unstorage/server';
import fsDriver from 'unstorage/drivers/fs-lite';
import { spawn } from 'child_process';
import { resolve, join, extname } from 'path';
import morgan from 'morgan';

// --- Configuration ---
const BASE_DIR = process.env.BASE_DIR || './public';

// 1. Initialize an unstorage instance with a driver
const storage = createStorage({
    driver: fsDriver({ base: BASE_DIR }), // Using filesystem driver.
});


// The handler maps HTTP requests to unstorage functions (GET -> getItem, PUT -> setItem, etc.)
const storageServer = createStorageServer(storage, {
    // Optional: Add an authorization check for security
    authorize(req) {

        // log req: {
        //   type: 'write',
        //   event: H3Event {
        //     __is_event__: true,
        //     node: { req: [IncomingMessage], res: [ServerResponse] },
        //     web: undefined,
        //     context: {},
        //     _method: 'PUT',
        //     _path: '/tests/documents/unstorage-test-file.txt',
        //     _headers: undefined,
        //     _requestBody: undefined,
        //     _handled: false,
        //     _onBeforeResponseCalled: undefined,
        //     _onAfterResponseCalled: undefined
        //   },
        //   key: 'tests:documents:unstorage-test-file.txt'
        // }

        // Example: Only allow reads on public keys, or check for an auth header
        // if (req.type === 'read' && req.key.startsWith('private:')) {
        //     throw new Error('Unauthorized Read');
        // }
    },
});


// --- Express Setup ---

const app = express();
const PORT = process.env.PORT || 3000;
const STORAGE_ROUTE = process.env.STORAGE_ROUTE || '/storage';
const ALLOWED_TYPES = process.env.ALLOWED_TYPES ? process.env.ALLOWED_TYPES.split(',') : ['.pdf', '.txt', '.pptx', '.docx', '.xlsx', '.xls'];

app.use(morgan('combined')); // Log requests to the console

// This makes the unstorage API available at the specified route path
app.use(STORAGE_ROUTE, async (req, res, next) => {
    // e.g., for documents:filedir:file.txt convert to /documents/filedir/file.txt
    const key = req.url;

    try {
        // On a PUT request, check if the item already exists.
        // if (req.method === 'PUT' && await storage.hasItem(key)) {
        //     // Respond with 409 Conflict if the file exists, and stop.
        //     return res.status(409).send({ error: `File already exists at key: ${key}` });
        // }
        // storageServer.handle is the core logic that processes the request e.g storing | delete | fetch files
        storageServer.handle(req, res);

        // A flag to see if this was a new item creation
        // split by "/" into array 
        const split = key.split('/');

        // type is the first element e.g, documents
        const type = split[1];

        // file.txt
        const filename = split[split.length - 1];

        const extension = extname(filename)

        // If a new item was created successfully (PUT returns 200)
        if (req.method === 'PUT' && res.statusCode === 200 && type === 'documents' && ALLOWED_TYPES.includes(extension)) {

            // filedir or filename without extension
            const output_filename = split[split.length - 2] + '.md';

            // convert key to filepath by replacing ":" with "/"
            const filepath = split.slice(0, -1).join('/');

            // absoulte path of input file which is ../../../public/documents/....../filedir/file.txt
            const input = resolve(join(BASE_DIR, filepath, filename));

            // absoulte path of Output file which is ../../../public/documents/...../filedir/file.md
            const output = resolve(join(BASE_DIR, filepath, output_filename));

            console.log('input: ', input)
            console.log('output: ', output)

            const PYTHON_SCRIPT_PATH = resolve(join(process.cwd(), 'scripts', 'convert.py')); // e.g., 'scripts/convert.py'

            const pythonExecutable = process.platform === 'win32' ? 'python.exe' : 'python3';

            return new Promise((resolve, reject) => {

                const python = spawn(pythonExecutable, [PYTHON_SCRIPT_PATH, input, output], {
                    cwd: process.cwd(),
                    env: {
                        ...process.env
                    },
                })
                const err = [];
                const out = []

                python.stdout.on('data', (data) => {
                    console.log(`Python stdout: ${data}`);
                    out.push(data);
                });

                python.stderr.on('data', (data) => {
                    console.error(`Python stderr: ${data}`);
                    err.push(data);
                });

                python.on('error', (err) => {
                    console.error('Failed to start subprocess.', err);
                })

                python.on('close', (code, signal) => {
                    if (code === 0) {
                        console.log(`Python script completed successfully for key: ${key}`);
                        resolve(out.join(', '));
                    } else {
                        console.error(`Python script exited with code ${code} and signal ${signal} for key: ${key}`);
                        reject(new Error(`Python script failed with code ${code} with error: ` + err.join(', ')));
                    }
                });
            })
        }
    } catch (error) {
        // Handle authorization or other storage-related errors
        if (error.message === 'Unauthorized Read') {
            res.status(401).send({ error: 'Unauthorized' });
        } else {
            // Pass other errors to Express's default error handler
            next(error);
        }
    }
});

// Optional: A simple root route for testing Express is running
app.get('/', (req, res) => {
    res.send('Unstorage Server integrated with Express is running.');
});

// Start the Express server
app.listen(PORT, () => {
    console.log(`Express server listening on port ${PORT}`);
    console.log(`Unstorage API available at http://localhost:${PORT}${STORAGE_ROUTE}`);
});