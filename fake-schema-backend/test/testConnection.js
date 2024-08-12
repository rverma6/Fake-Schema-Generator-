require('dotenv').config({ path: '../.env' });
const { Client } = require('pg');

console.log('Loaded DATABASE_URL:', process.env.DATABASE_URL);


const client = new Client({
    connectionString: process.env.DATABASE_URL,
});

client.connect()
    .then(() => console.log('Connected successfully'))
    .catch(err => console.error('Connection error', err.stack))
    .finally(() => client.end());
