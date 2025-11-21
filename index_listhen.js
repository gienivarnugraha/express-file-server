import { listen } from "listhen";
import { createStorage } from "unstorage";
import { createStorageServer } from "unstorage/server";

const storage = createStorage();
const storageServer = createStorageServer(storage, {
    authorize(req) {
        // req: { key, type, event }
        if (req.type === "read" && req.key.startsWith("private:")) {
            throw new Error("Unauthorized Read");
        }
    },
});

// Alternatively we can use `storageServer.handle` as a middleware
await listen(storageServer.handle);
