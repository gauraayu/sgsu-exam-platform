// Integration tests run against a real MongoDB server. Each test file uses its own database.
process.env.AUTH_SECRET ??= "test-secret-test-secret-test-secret-0123456789";
process.env.APP_URL ??= "http://localhost:3000";
process.env.MONGODB_TEST_URI ??= "mongodb://127.0.0.1:27017";
