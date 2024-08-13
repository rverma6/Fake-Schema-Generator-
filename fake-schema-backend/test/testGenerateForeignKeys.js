require('dotenv').config({ path: '../.env' });

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

(async () => {
    try {
        // Fetch parent_ids from parent_table
        const parentIds = await pool.query('SELECT parent_id FROM parent_table');
        console.log('Parent IDs:', parentIds.rows);

        // Use these parent_ids to insert data into child_table
        for (let i = 0; i < parentIds.rows.length; i++) {
            const parentId = parentIds.rows[i].parent_id;
            const description = `Child ${i + 1} of Parent ${parentId}`;
            await pool.query('INSERT INTO child_table (parent_id, description) VALUES ($1, $2)', [parentId, description]);
        }

        // Verify the insertion
        const result = await pool.query('SELECT * FROM child_table');
        console.log('Child Table Data:', result.rows);
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
})();