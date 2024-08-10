// testConnection.js
const { Pool } = require('pg');
require('dotenv').config();

console.log('Database URL:', process.env.DATABASE_URL);


const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Connection error:', err.message);
    } else {
        console.log('Connection successful:', res.rows);
    }
    pool.end();
});
