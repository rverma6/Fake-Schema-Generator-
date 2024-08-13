require('dotenv').config({ path: './.env' });

const express = require('express');
const { executeSQL } = require('./services/executeSQL'); 
const OpenAI = require('openai');
const supabase = require('./supabaseClient');
const redisClient = require('./redisClient'); // Import the Redis client setup
const cors = require('cors');
const { generateFakeData } = require('./services/generateFakeData');
const { extractTableName } = require('./services/executeSQL');
const { getForeignKeyData } = require('./services/generateFakeData');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    organization: "org-Dxwr0ny8EWkm8hlzHhw2Njdl",
    project: "proj_z6qXSriksXQfJ5WPbSxJ78x4",
});



// Endpoint to generate SQL schema using OpenAI
app.post('/api/generate-schema', async (req, res) => {
    const { prompt } = req.body;

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: 'You are a PostgreSQL expert.' },
                {
                    role: 'user', content: `Generate a clean PostgreSQL CREATE TABLE statement. Do not include any explanations, 
                    and ensure that the code only contains the CREATE TABLE statement without any CREATE SCHEMA or other additional statements. 
                    The table should be for the following structure: ${prompt}.`
                }
            ],
            max_tokens: 500,
            temperature: 0,
        });

        let sqlCode = response.choices[0].message.content.trim();

        sqlCode = sqlCode.replace(/```sql/g, '').replace(/```/g, '').trim();


        

        // Extract the table name from the SQL code
        const tableName = extractTableName(sqlCode);
        console.log('Extracted Table Name:', tableName);

        if (!tableName) {
            return res.status(500).json({ error: 'Failed to extract table name from SQL code.' });
        }

        // Store the schema in Supabase for reference
        const schemaData = {
            name: `Schema for ${tableName}`,
            sql_code: sqlCode,
            created_by: 1,
            description: `Generated schema for the table ${tableName}`
        };

        const { data, error } = await supabase.from('schemas').insert([schemaData]).select('id').single();

        if (error) {
            throw error;
        }

        res.json({ schema_id: data.id, sql_code: sqlCode, table_name: tableName });
    } catch (error) {
        console.error('Error generating schema:', error);
        res.status(500).json({ error: 'Failed to generate schema. Please try again.' });
    }
});

// Endpoint to generate fake data based on the SQL schema
app.post('/api/generate-data', async (req, res) => {
    const { schemaId } = req.body;

    try {
        // Retrieve the SQL code using the schema ID
        console.log(`Attempting to retrieve schema with ID: ${schemaId}`);
        const { data, error } = await supabase.from('schemas').select('sql_code').eq('id', schemaId).single();

        if (error || !data) {
            console.error('Schema not found:', error);
            return res.status(404).json({ error: 'Schema not found. Please provide a valid schema ID.' });
        }

        const sqlCode = data.sql_code;

        // Extract the table name from the SQL code
        const tableName = extractTableName(sqlCode);
        console.log('Extracted Table Name:', tableName);

        if (!tableName) {
            return res.status(500).json({ error: 'Failed to extract table name from SQL code.' });
        }

        // Execute the SQL code to create the table
        await executeSQL(sqlCode);

        // Generate fake data for the newly created table
        console.log(`Generating fake data for table: ${tableName}`);
        const generatedData = await generateFakeData(tableName, 3); // Adjust the number of rows as needed

        // Return the generated data along with the success message
        res.json({
            message: 'Table created and fake data generated successfully',
            tableName,
            data: generatedData // Include the generated data in the response
        });
    } catch (error) {
        console.error('Error in generate-data endpoint:', error.message);
        res.status(500).json({ error: 'Failed to generate data. Please try again.' });
    }
});



app.post('/api/generate-more-data', async (req, res) => {
    const { schemaId, additionalRows } = req.body;

    try {
        // Retrieve the SQL code using the schema ID
        console.log(`Attempting to retrieve schema with ID: ${schemaId}`);
        const { data, error } = await supabase.from('schemas').select('sql_code').eq('id', schemaId).single();

        if (error || !data) {
            console.error('Schema not found:', error);
            return res.status(404).json({ error: 'Schema not found. Please provide a valid schema ID.' });
        }

        const sqlCode = data.sql_code;

        // Extract the table name from the SQL code
        const tableName = extractTableName(sqlCode);
        console.log('Extracted Table Name:', tableName);

        if (!tableName) {
            return res.status(500).json({ error: 'Failed to extract table name from SQL code.' });
        }

        // Generate additional fake data for the existing table
        console.log(`Generating ${additionalRows} more rows of fake data for table: ${tableName}`);
        const additionalData = await generateFakeData(tableName, additionalRows); // Generate the specified number of rows

        // Return the generated data
        res.json({
            message: `${additionalRows} rows of fake data generated successfully`,
            tableName,
            data: additionalData // Include the additional generated data in the response
        });
    } catch (error) {
        console.error('Error in generate-more-data endpoint:', error.message);
        res.status(500).json({ error: 'Failed to generate additional data. Please try again.' });
    }
});


app.post('/api/generate-data-with-foreign-keys', async (req, res) => {
    const { schemaId, foreignKeySourceTable, foreignKeyColumn } = req.body;

    try {

    

        // Retrieve the SQL code using the schema ID
        const { data, error } = await supabase.from('schemas').select('sql_code').eq('id', schemaId).single();

        if (error || !data) {
            return res.status(404).json({ error: 'Schema not found. Please provide a valid schema ID.' });
        }

        const sqlCode = data.sql_code;

        // Extract the table name from the SQL code
        const tableName = extractTableName(sqlCode);
        console.log('Extracted Table Name:', tableName);

        // Execute the SQL code to create the table
        await executeSQL(sqlCode);

        // Retrieve foreign key data from the source table
        const foreignKeyData = {};
        console.log(`source table: ${foreignKeySourceTable} with foreignKeyCol: ${foreignKeyColumn}`);
        if (foreignKeySourceTable && foreignKeyColumn) {

            const foreignKeyValues = await getForeignKeyData(foreignKeySourceTable, foreignKeyColumn);

            foreignKeyData[foreignKeyColumn] = { 
                tableName: foreignKeySourceTable, 
                columnName: foreignKeyColumn, 
                values: foreignKeyValues 
            };

            console.log('Foreign key data:', foreignKeyData);
            console.log('Foreign key values:', foreignKeyValues);

        }
        console.log(`Calling generateFakeData with tableName: ${tableName}, rowCount: 3, foreignKeyData:`, foreignKeyData);
        // Generate fake data for the newly created table, using foreign key data
        await generateFakeData(tableName, 3, foreignKeyData); 

        res.json({ message: 'Table created and fake data generated successfully', tableName });
    } catch (error) {
        console.error('Error generating data with foreign keys:', error.message);
        res.status(500).json({ error: 'Failed to generate data. Please try again.' });
    }
});

// Endpoint to update a record in a specific table
app.post('/api/update-record', async (req, res) => {
    const { tableName, columnName, newValue, id } = req.body;

    try {
        // Update the record in the specified table
        const { data, error } = await supabase
            .from(tableName)
            .update({ [columnName]: newValue })
            .eq('id', id);

        if (error) {
            console.error('Error updating data:', error.message);
            return res.status(500).json({ error: 'Failed to update data. Please try again.' });
        }

        console.log('Data updated successfully:', data);
        res.json({ message: 'Data updated successfully', data });
    } catch (error) {
        console.error('Error updating record:', error.message);
        res.status(500).json({ error: 'Failed to update record. Please try again.' });
    }
});


app.get('/api/users', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*');

        if (error) {
            throw error;
        }

        res.status(200).json(data);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users. Please try again.' });
    }
});




// Start the Express server and save the server instance
const server = app.listen(port, () => {
    console.log(`Backend server is running on http://localhost:${port}`);
});

// Handle SIGINT (Ctrl+C) for graceful shutdown
process.on('SIGINT', async () => {
    try {
        // Gracefully close Redis connection
        await redisClient.quit();
        console.log('Redis client disconnected');

        // Close the Express server
        server.close(() => {
            console.log('Express server closed');
            process.exit(0);
        });
    } catch (err) {
        console.error('Error during shutdown:', err);
        process.exit(1);
    }
});