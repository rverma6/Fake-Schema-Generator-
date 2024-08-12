require('dotenv').config({ path: '../.env' });

const { Pool } = require('pg');

// Step 1: Load environment variables and initialize the pool
console.log('Loaded DATABASE_URL:', process.env.DATABASE_URL);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

console.log('Pool initialized successfully');

// Step 2: Function to extract table name from SQL code
const extractTableName = (sqlCode) => {
    let tableNameMatch = sqlCode.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?("?\w+"?\.?"?\w+"?)/i);
    let tableName = tableNameMatch ? tableNameMatch[1] : null;

    if (!tableName) {
        throw new Error('Failed to extract table name from SQL code.');
    }

    // Force table name to lowercase if it's not quoted
    if (!tableName.startsWith('"')) {
        tableName = tableName.toLowerCase();
    }

    console.log('Extracted table name:', tableName);
    return tableName;
};

// Step 3: Function to check if the table exists in the database
const checkTableExists = async (tableName) => {
    const checkTableExistsQuery = `
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables 
            WHERE table_name = '${tableName.split('.').pop().replace(/"/g, '')}'
        );
    `;

    console.log('Executing query to check if table exists:', checkTableExistsQuery);

    try {
        const result = await pool.query(checkTableExistsQuery);
        const tableExists = result.rows[0].exists;
        console.log('Table exists:', tableExists);
        return tableExists;
    } catch (error) {
        console.error('Error checking if table exists:', error.message);
        throw error;
    }
};

// Step 4: Function to create the table if it doesn't exist
const createTable = async (sqlCode, tableName) => {
    try {
        console.log(`Executing SQL to create table: ${tableName}`);
        await pool.query(sqlCode);
        console.log('Table created successfully');
    } catch (error) {
        console.error('Error executing SQL to create table:', error.message);
        throw error;
    }
};

// Step 5: Full executeSQL function
const executeSQL = async (sqlCode) => {
    try {
        console.log('Using DATABASE_URL:', process.env.DATABASE_URL);

        const tableName = extractTableName(sqlCode);
        const tableExists = await checkTableExists(tableName);

        if (!tableExists) {
            await createTable(sqlCode, tableName);
        } else {
            console.log(`Table ${tableName} already exists. Skipping creation.`);
        }
    } catch (error) {
   
        console.error('Error executing SQL:', error.message);
        throw error;
    }
};

// Example SQL code for testing
const sqlCodeForCreation = `
    CREATE TABLE IF NOT EXISTS test_table (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50),
        age INT
    );
`;

// Run the full executeSQL function
executeSQL(sqlCodeForCreation).catch(error => {
    console.error('Error during SQL execution:', error);
});

module.exports = { extractTableName, executeSQL };