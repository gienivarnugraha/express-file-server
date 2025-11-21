import http from 'http';
import fs from 'fs';
import path from 'path';
import assert from 'assert';

// --- Configuration ---
const PORT = process.env.PORT || 3000;
const HOST = 'localhost';
const STORAGE_ROUTE = process.env.STORAGE_ROUTE || '/storage';
const UPLOAD_DIR = 'public'; // This should match the 'base' in your fsDriver

const TEST_SUB_DIR = 'documents/test-pdf';
// const TEST_FILE_NAME = 'unstorage-test-file.txt';
const TEST_FILE_NAME = 'test-pdf.pdf';
// unstorage keys use colons for separators, but let's test a path-like key
const TEST_KEY = `${TEST_SUB_DIR}/${TEST_FILE_NAME}`;
const TEST_FILE_CONTENT = 'Hello from unstorage!';
const UPDATED_FILE_CONTENT = 'The content has been updated.';

const makeRequest = (options, body) => {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
        });
        req.on('error', (err) => reject(err));
        if (body) {
            req.write(body);
        }
        req.end();
    });
};

async function runTests() {
    const testUrlPath = `${STORAGE_ROUTE}/${TEST_KEY}`;

    try {
        // === 1. CREATE (PUT) ===
        console.log('--- 1. Testing CREATE (PUT) ---');
        console.log(`Creating item at ${testUrlPath}`);

        let res = await makeRequest({
            hostname: HOST,
            port: PORT,
            path: testUrlPath,
            method: 'PUT',
            headers: {
                // 'Content-Type': 'text/plain',
                // 'Content-Length': Buffer.byteLength(TEST_FILE_CONTENT),
                'Content-Type': 'application/pdf',
            },
            // }, TEST_FILE_CONTENT);
        }, fs.readFileSync(path.join('tests', 'test-pdf.pdf')));

        // unstorage/server returns 204 No Content for setItem
        assert.strictEqual(res.statusCode, 200, `CREATE failed with status ${res.statusCode}`);
        console.log('CREATE successful (Status 204)');

        // // === 2. READ (GET and Verify) ===
        // console.log('\n--- 2. Testing READ (GET) ---');
        // res = await makeRequest({
        //     hostname: HOST,
        //     port: PORT,
        //     path: testUrlPath,
        //     method: 'GET',
        // });

        // assert.strictEqual(res.statusCode, 200, `READ failed with status ${res.statusCode}`);
        // assert.strictEqual(res.body, TEST_FILE_CONTENT, 'READ content mismatch');
        // console.log('READ successful (Status 200)');

        // // === 3. UPDATE (PUT again) ===
        // console.log('\n--- 3. Testing UPDATE (PUT) ---');
        // res = await makeRequest({
        //     hostname: HOST,
        //     port: PORT,
        //     path: testUrlPath,
        //     method: 'PUT',
        //     headers: {
        //         'Content-Type': 'text/plain',
        //         'Content-Length': Buffer.byteLength(UPDATED_FILE_CONTENT),
        //     },
        // }, UPDATED_FILE_CONTENT);

        // assert.strictEqual(res.statusCode, 200, `UPDATE failed with status ${res.statusCode}`);
        // console.log('UPDATE successful (Status 200)');

        // // Verify update by reading again
        // res = await makeRequest({
        //     hostname: HOST,
        //     port: PORT,
        //     path: testUrlPath,
        //     method: 'GET',
        // });
        // assert.strictEqual(res.body, UPDATED_FILE_CONTENT, 'UPDATE content verification failed');
        // console.log('UPDATE content verified');

        // // === 4. DELETE ===
        // console.log('\n--- 4. Testing DELETE ---');
        // res = await makeRequest({
        //     hostname: HOST,
        //     port: PORT,
        //     path: testUrlPath,
        //     method: 'DELETE',
        // });

        // // unstorage/server returns 204 No Content for removeItem
        // assert.strictEqual(res.statusCode, 200, `DELETE failed with status ${res.statusCode}`);
        // console.log('DELETE successful (Status 200)');

        // // Verify deletion by trying to read again (should be 404)
        // res = await makeRequest({
        //     hostname: HOST,
        //     port: PORT,
        //     path: testUrlPath,
        //     method: 'GET',
        // });
        // assert.strictEqual(res.statusCode, 404, 'DELETE verification failed (item still exists)');
        // console.log('DELETE verified (Status 404)');

        // console.log('\n✅ All CRUD tests passed for unstorage server!');

    } catch (error) {
        console.error('\n❌ Test failed:');
        console.error(error);
        process.exit(1); // Exit with error code
    } finally {
        // --- Cleanup ---
        let __dirname = path.dirname(new URL(import.meta.url).pathname);
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