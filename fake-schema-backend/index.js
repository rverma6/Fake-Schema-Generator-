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
const { backupTableData } = require('./services/updateRecords');
const { migrateData } = require('./services/updateRecords');
const { validateSchemaUpdate } = require('./services/updateRecords');
const { extractForeignKeyInfo } = require('./services/executeSQL');
const { getTableSchema } = require('./services/generateFakeData');


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
                    Ensure that the schema title does not contain '.'. It should only use '_' if a non-alphabetic character is needed.
                    Ensure that the id key is specific to the schema. It should have more detail that just id. Make sure that all of the 
                    column names correlate to the prompt as much as possible.
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

/*
app.put('/api/update-schema', async (req, res) => {
    const { schemaId, sqlCode } = req.body;

    try {
        const { data, error } = await supabase
            .from('schemas')
            .update({ sql_code: sqlCode })
            .eq('id', schemaId);

        if (error) {
            throw error;
        }

        res.status(200).json({ message: 'Schema updated successfully.' });
    } catch (error) {
        console.error('Error updating schema:', error.message);
        res.status(500).json({ error: 'Failed to update schema. Please try again.' });
    }
});
*/

// Endpoint to generate fake data based on the SQL schema
app.post('/api/generate-data', async (req, res) => {
    const { schemaId, sqlCode } = req.body; // Accept the sqlCode directly from the request body

    try {
        if (!sqlCode) {
            return res.status(400).json({ error: 'SQL code is required.' });
        }

        console.log(`Received SQL Code: ${sqlCode}`);

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
        const generatedData = await generateFakeData(tableName, 1); // Adjust the number of rows as needed

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

        const foreignKeyDetails = extractForeignKeyInfo(sqlCode); // Assuming you have this function available
        console.log(`Extracted: ${foreignKeyDetails}`)
        let foreignKeyData = {};

        if (foreignKeyDetails.length > 0) {
            for (const foreignKey of foreignKeyDetails) {
                const { sourceTable, columnName } = foreignKey;
                const foreignKeyValues = await getForeignKeyData(sourceTable, columnName);
                foreignKeyData[columnName] = {
                    tableName: sourceTable,
                    columnName,
                    values: foreignKeyValues
                };
            }
        }

        // Generate additional fake data for the existing table
        console.log(`Generating ${additionalRows} more rows of fake data for table: ${tableName}`);
        const additionalData = await generateFakeData(tableName, additionalRows, foreignKeyData); // Generate the specified number of rows

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

        console.log(`Received SQL Code: ${sqlCode}`);


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
        const generatedData = await generateFakeData(tableName, 1, foreignKeyData); 

        res.json({ 
            message: 'Table created and fake data generated successfully', 
            tableName,
            data: generatedData
        });
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

app.put('/api/update-schema', async (req, res) => {
    console.log('Starting update-schema endpoint...'); // Debug log

    const { schemaId, newSqlCode, columnMapping } = req.body;

    try {
        // Fetch the existing schema
        const { data: existingSchema, error: fetchError } = await supabase
            .from('schemas')
            .select('sql_code')
            .eq('id', schemaId)
            .single();

        if (fetchError || !existingSchema) throw new Error('Failed to fetch existing schema');

        const oldSqlCode = existingSchema.sql_code;
        console.log('Old SQL Code:', oldSqlCode); // Debug log

        const tableName = extractTableName(oldSqlCode);
        console.log('Extracted table name:', tableName); // Debug log

        // Correct way to check if the table exists
        const { data: tableExists, error: tableCheckError } = await supabase
            .rpc('table_exists', { p_table_name: tableName }); // Custom Supabase RPC for table existence check

        if (tableCheckError) {
            console.error(`Error checking if table ${tableName} exists:`, tableCheckError);
            throw new Error(`Error checking if table ${tableName} exists.`);
        }

        if (!tableExists) {
            console.log(`Table ${tableName} does not exist. Skipping backup and migration.`);

            // Update the schema in the database
            const { error: updateError } = await supabase
                .from('schemas')
                .update({ sql_code: newSqlCode })
                .eq('id', schemaId);

            if (updateError) throw new Error('Failed to update schema');

            res.status(200).json({
                message: 'Schema updated successfully (table does not exist yet).',
                sql_code: newSqlCode,
                table_name: tableName
            });
        } else {
            console.log(`Table ${tableName} exists. Proceeding with backup and migration.`);

            // Backup existing data before making any changes
            const backupData = await backupTableData(tableName);
            console.log(`Backup completed for table ${tableName}:`, backupData.length ? `${backupData.length} rows` : 'No data to backup.');

            // Invalidate the cache for this table schema
            await redisClient.del(`tableschema:${tableName}`);
            console.log(`Cache invalidated for table schema: ${tableName}`);

            // Update the schema in the database
            const { error: updateError } = await supabase
                .from('schemas')
                .update({ sql_code: newSqlCode })
                .eq('id', schemaId);

            if (updateError) throw new Error('Failed to update schema');

            // Migrate existing data to fit the new schema
            await migrateData(oldSqlCode, newSqlCode, tableName, columnMapping);

            // Invalidate the cache again if necessary
            await redisClient.del(`tableschema:${tableName}`);
            console.log(`Cache invalidated again for table schema: ${tableName}`);

            // Fetch the updated schema after the update
            const { data: updatedSchema } = await supabase
                .from('schemas')
                .select('sql_code')
                .eq('id', schemaId)
                .single();

            res.status(200).json({
                message: 'Schema updated and data migrated successfully.',
                sql_code: updatedSchema.sql_code,
                table_name: tableName
            });
        }
    } catch (error) {
        console.error('Error during schema update:', error.message);
        res.status(500).json({ error: 'Failed to update schema. Please try again.' });
    }
});

app.put('/api/update-individual-record', async (req, res) => {
    const { tableName, columnName, newValue, id } = req.body;

    console.log(`Attempting to update individual record from table ${tableName} in column ${columnName} with value ${newValue}`);

    try {
        // Fetch the table schema
        const schema = await getTableSchema(tableName);

        // Find the primary key column from the schema
        const primaryKeyColumn = schema.find(column => column.is_primary_key);

        if (!primaryKeyColumn) {
            console.error(`Primary key not found for table ${tableName}`);
            return res.status(400).json({ error: 'Primary key not found for the specified table.' });
        }

        console.log(`Primary key column identified: ${primaryKeyColumn.column_name}`);
        console.log(`ID received: ${id}`);

        // Ensure the id is valid
        if (id === undefined || id === null) {
            console.error(`Invalid ID provided: ${id}`);
            return res.status(400).json({ error: 'Invalid ID provided.' });
        }

        // Update the record in the specified table
        const { data, error } = await supabase
            .from(tableName)
            .update({ [columnName]: newValue })
            .eq(primaryKeyColumn.column_name, id);

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