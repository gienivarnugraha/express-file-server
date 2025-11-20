const http = require('http');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const assert = require('assert');
// --- Configuration ---
const PORT = process.env.PORT || 3000;
const HOST = 'localhost';
const UPLOAD_DIR = 'public';



const TEST_SUB_DIR = 'tests/sub1/sub  __2/sub _-_! 3';
const TEST_FILE_NAME = 'file asd a 123   ___ !@.txt';
const TEST_FILE_PATH = encodeURI(`${TEST_SUB_DIR}/${TEST_FILE_NAME}`);
const TEST_FILE_CONTENT = 'This is the original file content.';
const UPDATED_FILE_CONTENT = 'This is the updated file content.';

const makeRequest = (options, body) => {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
        });
        req.on('error', (err) => reject(err));
        if (body) {
            body.pipe(req);
        } else {
            req.end();
        }
    });
};

async function runTests() {
    try {
        // === 1. CREATE (Upload) ===
        console.log('--- 1. Testing CREATE ---');
        const createForm = new FormData();
        createForm.append('file', Buffer.from(TEST_FILE_CONTENT), TEST_FILE_NAME);

        console.log(`Uploading file to /upload/${TEST_FILE_PATH}`);

        let res = await makeRequest({
            hostname: HOST,
            port: PORT,
            path: `/upload/${TEST_FILE_PATH}`,
            method: 'POST',
            headers: createForm.getHeaders(),
        }, createForm);

        assert.strictEqual(res.statusCode, 201, `CREATE failed with status ${res.statusCode}`);
        console.log('CREATE successful (Status 201)');
        const createBody = JSON.parse(res.body);
        assert.strictEqual(createBody.filename, TEST_FILE_NAME, 'CREATE response filename mismatch');

        // === 2. READ (Download and Verify) ===
        console.log('\n--- 2. Testing READ ---');
        // The static server should serve the file
        const fileUrlPath = createBody.path;
        res = await makeRequest({
            hostname: HOST,
            port: PORT,
            path: `/${fileUrlPath}`,
            method: 'GET',
        });

        assert.strictEqual(res.statusCode, 200, `READ (static) failed with status ${res.statusCode}`);
        assert.strictEqual(res.body, TEST_FILE_CONTENT, 'READ content mismatch');
        console.log('READ successful (Status 200)');

        // === 3. UPDATE (Replace) ===
        console.log('\n--- 3. Testing UPDATE ---');
        const updateForm = new FormData();
        updateForm.append('file', Buffer.from(UPDATED_FILE_CONTENT), TEST_FILE_NAME);

        res = await makeRequest({
            hostname: HOST,
            port: PORT,
            path: `/upload/${TEST_FILE_PATH}`,
            method: 'PUT',
            headers: updateForm.getHeaders(),
        }, updateForm);

        assert.strictEqual(res.statusCode, 200, `UPDATE failed with status ${res.statusCode}`);
        console.log('UPDATE successful (Status 200)');

        // Verify update by reading again
        res = await makeRequest({
            hostname: HOST,
            port: PORT,
            path: `/${fileUrlPath}`,
            method: 'GET',
        });
        assert.strictEqual(res.body, UPDATED_FILE_CONTENT, 'UPDATE content verification failed');
        console.log('UPDATE content verified');

        // === 4. DELETE ===
        console.log('\n--- 4. Testing DELETE ---');
        res = await makeRequest({
            hostname: HOST,
            port: PORT,
            path: `/file/${TEST_FILE_PATH}`,
            method: 'DELETE',
        });

        assert.strictEqual(res.statusCode, 200, `DELETE failed with status ${res.statusCode}`);
        console.log('DELETE successful (Status 200)');

        // Verify deletion by trying to read again (should be 404)
        res = await makeRequest({
            hostname: HOST,
            port: PORT,
            path: `/${fileUrlPath}`,
            method: 'GET',
        });
        assert.strictEqual(res.statusCode, 404, 'DELETE verification failed (file still exists)');
        console.log('DELETE verified (Status 404)');

        console.log('\n✅ All CRUD tests passed!');

    } catch (error) {
        console.error('\n❌ Test failed:');
        console.error(error);
        process.exit(1); // Exit with error code
    } finally {
        // --- Cleanup ---
        const localDirPath = path.join(__dirname, UPLOAD_DIR, TEST_SUB_DIR);
        if (fs.existsSync(localDirPath)) {
            fs.rm(localDirPath, { recursive: true, force: true }, (err) => {
                if (err) console.error('Cleanup failed:', err);
                else console.log('\nCleanup complete.');
            });
        }
    }
}

runTests();