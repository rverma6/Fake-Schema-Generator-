const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const executeSQL = async (sql) => {
    console.log('This is a test log');
    try {
        const res = await pool.query(sql);
        console.log('Table created successfully:', res);
    } catch (err) {
        console.error('Error executing SQL:', err.message);
        throw err;
    } 
};

process.on('exit', async () => {
    await pool.end();
})

module.exports = { executeSQL };

// post man: Stacompsci15Snowball73