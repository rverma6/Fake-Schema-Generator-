const { executeSQL } = require('./executeSQL.js');

// Sample SQL code to create a table
const sqlCode = `
    CREATE TABLE IF NOT EXISTS test_table (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`;

async function testExecuteSQL() {
    try {
        const tableCreated = await executeSQL(sqlCode);
        if (tableCreated) {
            console.log('Table was created successfully.');
        } else {
            console.log('Table already exists. Skipping creation.');
        }
    } catch (error) {
        console.error('Error during test execution:', error.message);
    }
}

testExecuteSQL();
