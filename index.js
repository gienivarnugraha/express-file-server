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
const storageServer = createStorageServer(storage);


function runPythonScript(input, output) {
    const PYTHON_SCRIPT_PATH = resolve(join(process.cwd(), 'scripts', 'convert.py'));

    console.log(PYTHON_SCRIPT_PATH)

    return new Promise((resolve, reject) => {

        const pythonExecutable = process.platform === 'win32' ? 'python.exe' : 'python3';

        const python = spawn(pythonExecutable, [PYTHON_SCRIPT_PATH, input, output], {
            cwd: process.cwd(),
            env: { ...process.env },
        });

        const out = [];
        const err = [];

        python.stdout.on('data', (data) => {
            console.log(`Python stdout: ${data}`);
            out.push(data.toString());
        });

        python.stderr.on('data', (data) => {
            console.error(`Python stderr: ${data}`);
            err.push(data.toString());
        });

        python.on('error', (error) => {
            console.error('Failed to start subprocess.', error);
            reject(new Error('Failed to start Python script.'));
        });

        python.on('close', (code) => {
            if (code === 0) {
                console.log(`Python script completed successfully for input: ${input}`);
                resolve(out.join(''));
            } else {
                console.error(`Python script exited with code ${code} for input: ${input}`);
                reject(new Error(`Python script failed with code ${code}: ${err.join('')}`));
            }
        });
    });
}


// --- Express Setup ---

const app = express();
const PORT = process.env.PORT || 3000;
const STORAGE_ROUTE = process.env.STORAGE_ROUTE || '/storage';
const ALLOWED_TYPES = process.env.ALLOWED_TYPES ? process.env.ALLOWED_TYPES.split(',') : ['.pdf', '.txt', '.pptx', '.docx', '.xlsx', '.xls'];

app.use(morgan('combined')); // Log requests to the console

// This makes the unstorage API available at the specified route path
app.use(STORAGE_ROUTE, async (req, res, next) => {
    // const key = req.url.substring(1); // remove leading '/'

    // // For PUT requests, we handle file storage and then trigger the script
    // if (req.method === 'PUT') {
    //     try {
    //         const chunks = [];
    //         for await (const chunk of req) {
    //             chunks.push(chunk);
    //         }
    //         const body = Buffer.concat(chunks);

    //         await storage.setItemRaw(key, body);

    //         const split = key.split('/');
    //         const type = split[0];
    //         const filename = split[split.length - 1];
    //         const extension = extname(filename);

    //         if (type === 'documents' && ALLOWED_TYPES.includes(extension)) {
    //             const output_filename = split[split.length - 2] + '.md';
    //             const filepath = split.slice(0, -1).join('/');
    //             const input = resolve(join(BASE_DIR, filepath, filename));
    //             const output = resolve(join(BASE_DIR, filepath, output_filename));

    //             console.log('Input for script: ', input);
    //             console.log('Output for script: ', output);

    //             // Wait for the python script to finish
    //             await runPythonScript(input, output);

    //             res.statusCode = 200;
    //             res.end('File uploaded and processed successfully.');
    //         } else {
    //             res.statusCode = 200;
    //             res.end('File uploaded successfully.');
    //         }
    //     } catch (err) {
    //         console.error("Error during PUT and script execution:", err);
    //         res.statusCode = 500;
    //         res.end('Internal Server Error');
    //     }
    // } else {
    //     // For all other methods (GET, DELETE, etc.), use the default unstorage handler
    //     storageServer.handle(req, res);
    // }
    storageServer.handle(req, res);
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