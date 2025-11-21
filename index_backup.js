const dotenv = require('dotenv');
dotenv.config()

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'public'; // Directory to store files

// --- Helper Functions ---

// Sanitize file paths to prevent directory traversal and invalid characters
const sanitizePath = (filepath) => {
    if (!filepath) return [];

    const extension = path.extname(filepath[filepath.length - 1]);
    // This preserves the directory structure.
    const sanitizedSegments = filepath.map(segment => {
        const decodedSegment = decodeURIComponent(segment);

        const filenameWithoutExt = path.basename(decodedSegment, extension);

        return filenameWithoutExt.trim()
            .replace(/[^a-zA-Z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .replace(/[\s<>:"\\|?*&'%()]+/g, '-') // Replace one or more invalid chars with a hyphen
            .replace(/-+/g, '-'); // Collapse multiple hyphens into one
    });

    return [...sanitizedSegments.slice(0, -1), sanitizedSegments[sanitizedSegments.length - 1] + extension];
};

// Function to determine the destination directory
const getDestination = (req, file, cb) => {
    // Extract subdirectories from path, removing the initial 'upload' part
    const subDir = sanitizePath(req.params.filename);
    let dest;


    if (subDir.length > 0) {
        dest = path.join(UPLOAD_DIR, ...subDir);
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
    }

    console.log('dest', dest)

    cb(null, dest);
};
// --- Multer Configuration (Storage) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Set the destination directory for uploaded files
        getDestination(req, file, cb)
    },
    filename: (req, file, cb) => {
        // Set a unique filename: fieldname-timestamp.ext
        cb(null, file.originalname);
    }
});

const upload = multer({ storage });

// --- Middleware ---
// Ensure the uploads directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR);
}
app.use(express.json());
// Serve static files from the uploads directory (for reading/downloading)
app.use('/files', express.static(path.join(__dirname, UPLOAD_DIR)));


/* --- ROUTES --- */

// 1. **CREATE (Upload File)** - POST /upload/* (e.g., /upload/path/to/file)
app.post('/upload/*filename', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    // The file information is available in req.file
    res.status(201).json({
        message: 'File uploaded successfully!',
        filename: req.file.filename,
        path: req.file.path.replace(/\\/g, '/').replace(UPLOAD_DIR, 'files')
    });
});

// 2. **READ (List All Files)** - GET /files
app.get('/files', (req, res) => {
    fs.readdir(UPLOAD_DIR, (err, files) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Failed to read directory.' });
        }
        // Filter out hidden files (like .DS_Store)
        const fileList = files.filter(name => !name.startsWith('.'));
        res.status(200).json({ files: fileList });
    });
});

// 3. **READ (Download Specific File)** - GET /file/*filename
// NOTE: This is already partially handled by the express.static middleware, 
//       but this route provides a direct download option.
app.get('/file/*filename', (req, res) => {
    const relativePath = sanitizePath(req.params.filename);
    const filePath = path.join(__dirname, UPLOAD_DIR, relativePath);

    // Check if file exists
    if (fs.existsSync(filePath)) {
        // Forcing download with res.download() - filename is the name for the downloaded file
        res.download(filePath, filename, (err) => {
            if (err) {
                // Handle error, but client won't know if error happened during transfer
                console.error('Download error:', err);
            }
        });
    } else {
        res.status(404).send('File not found.');
    }
});


// 4. **UPDATE (Replace File)** - PUT /upload/*filename
// This is done by uploading a new file to the same path to overwrite it.
// We can use the same upload route. For a more explicit update, we can use PUT.
app.put('/upload/*filename', upload.single('file'), (req, res) => {
    const oldFilePath = path.join(__dirname, UPLOAD_DIR, sanitizePath(req.params.filename));

    if (!req.file) {
        return res.status(400).send('No new file uploaded for replacement.');
    }

    // 1. Delete the old file
    if (fs.existsSync(oldFilePath)) {
        // Overwriting is handled by multer's diskStorage, but an explicit message is good.
        res.json({
            message: 'File updated (replaced) successfully!',
            filename: req.file.filename,
            path: req.file.path.replace(/\\/g, '/').replace(UPLOAD_DIR, 'files')
        });
    } else {
        // If old file not found, still keep the new upload and return a warning/info
        res.status(201).json({
            message: 'Old file not found, but new file uploaded successfully.',
            filename: req.file.filename,
            path: req.file.path.replace(/\\/g, '/').replace(UPLOAD_DIR, 'files')
        });
    }
});


// 5. **DELETE (Delete Specific File)** - DELETE /file/*filename
app.delete('/file/*filename', (req, res) => {
    const relativePath = sanitizePath(req.params.filename);
    const filePath = path.join(__dirname, UPLOAD_DIR, relativePath);

    if (fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Failed to delete the file.' });
            }
            res.status(200).send(`File '${relativePath}' deleted successfully.`);
        });
    } else {
        res.status(404).send('File not found.');
    }
});


// --- Start Server ---
app.listen(PORT, () => {
    console.log(`🚀 File backend server running on http://localhost:${PORT}`);
});