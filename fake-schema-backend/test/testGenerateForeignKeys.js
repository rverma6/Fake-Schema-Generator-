require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');
const { faker } = require('@faker-js/faker');

// Import the functions from your module
const { generateFakeData, getForeignKeyData } = require('../services/generateFakeData');

// Initialize PostgreSQL pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Function to test the data generation and insertion
const testDataGeneration = async () => {
    try {
        // Define the foreign key data based on your table structure
        const foreignKeyData = {
            // This should match the actual foreign key column in your schema
            testing_author_has_id: {
                tableName: 'bakers',
                columnName: 'baker_id',
                values: await getForeignKeyData('bakers', 'baker_id')
            }
        };

        console.log('Foreign key data for testing:', foreignKeyData);

        // Generate and insert fake data into your target table
        await generateFakeData('cakes', 1, foreignKeyData);

    } catch (error) {
        console.error('Error during test:', error.message);
    }
};

// Call the test function
testDataGeneration();
