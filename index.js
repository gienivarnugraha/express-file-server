import express from 'express';
import { createStorage } from 'unstorage';
import { createStorageServer } from 'unstorage/server';
import fsDriver from 'unstorage/drivers/fs-lite';

// --- Configuration ---

// 1. Initialize an unstorage instance with a driver
const storage = createStorage({
    driver: fsDriver({ base: './public' }), // Using filesystem driver. Create './data_storage' folder.
});

// 2. Create the unstorage server handler
// The handler maps HTTP requests to unstorage functions (GET -> getItem, PUT -> setItem, etc.)
const storageServer = createStorageServer(storage, {
    // Optional: Add an authorization check for security
    authorize(req) {
        console.log(req)
        // Example: Only allow reads on public keys, or check for an auth header
        // if (req.type === 'read' && req.key.startsWith('private:')) {
        //     throw new Error('Unauthorized Read');
        // }
    },
});


// --- Express Setup ---

const app = express();
const PORT = 4000;
const STORAGE_ROUTE = '/storage';

// 3. Mount the unstorage handler as Express middleware
// This makes the unstorage API available at the specified route path
app.use(STORAGE_ROUTE, async (req, res, next) => {
    try {
        // storageServer.handle is the core logic that processes the request
        await storageServer.handle(req, res);
    } catch (error) {
        // Handle authorization or other storage-related errors
        if (error.message === 'Unauthorized Read') {
            res.status(401).send({ error: 'Unauthorized' });
        } else {
            next(error); // Pass other errors to Express error handler
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