require('dotenv').config({ path: './.env' });

const express = require('express');
const { executeSQL } = require('./services/executeSQL'); 
const OpenAI = require('openai');
const supabase = require('./supabaseClient');
const cors = require('cors');
const { generateFakeData } = require('./services/generateFakeData');
const { extractTableName } = require('./services/executeSQL');

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
                    role: 'user', content: `Generate a clean PostgreSQL CREATE TABLE statement. Do not include any explanations, only the SQL code. The table should be for the following structure: ${prompt}.`
                }
            ],
            max_tokens: 500,
            temperature: 0,
        });

        let sqlCode = response.choices[0].message.content.trim();

        // Remove markdown code block delimiters
        sqlCode = sqlCode.replace(/```sql/g, '').replace(/```/g, '').trim();
        
        console.log('Generated SQL Code:', sqlCode);

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
        await generateFakeData(tableName, 3); // Adjust the number of rows as needed

        res.json({ message: 'Table created and fake data generated successfully', tableName });
    } catch (error) {
        console.error('Error in generate-data endpoint:', error.message);
        res.status(500).json({ error: 'Failed to generate data. Please try again.' });
    }
});


app.post('/api/generate-more-data', async (req, res) => {
    const { additionalRows } = req.body;

    try {
        const fakeData = [];
        for (let i = 1; i <= additionalRows; i++) {
            fakeData.push({ username: `TestUser${Date.now()}_${i}` }); // Unique username to avoid conflicts
        }

        const insertData = await supabase
            .from('users')
            .insert(fakeData);

        if (insertData.error) {
            throw insertData.error;
        }

        res.json(fakeData);
    } catch (error) {
        console.error('Error generating additional data:', error);
        res.status(500).json({ error: 'Failed to generate additional data. Please try again.' });
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



// Other endpoints...
app.listen(port, () => {
    console.log(`Backend server is running on http://localhost:${port}`);
});
