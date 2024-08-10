const express = require('express');
const { executeSQL } = require('./services/executeSQL');
const OpenAI = require('openai');
const supabase = require('./supabaseClient');
const cors = require('cors');
const { generateFakeData } = require('./services/generateFakeData');
require('dotenv').config();

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
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: 'Generate a PostgreSQL CREATE TABLE statement.' },
                { role: 'user', content: `Generate a PostgreSQL CREATE TABLE statement for the following: ${prompt}` }
            ],
            max_tokens: 500,
            temperature: 0,
        });

        const sqlCode = response.choices[0].message.content.trim();


        console.log('OpenAI API Response:', response);


        console.log('Generating SQL Code:', sqlCode);
        console.log('Length of generated SQL Code:',sqlCode.length);


        const schemaData = {
            name: 'Example Schema',
            sql_code: sqlCode,
            created_by: 1,
            description: 'Generated schema for an example table'
        };

     

        const insertSchema = await supabase
            .from('schemas')
            .insert([schemaData]);

        if (insertSchema.error) {
            throw insertSchema.error;
        }

        res.json({ sql_code: sqlCode });
    } catch (error) {
        console.error('Error generating schema:', error);
        res.status(500).json({ error: 'Failed to generate schema. Please try again.' });
    }
});

app.post('/api/execute-schema', async (req, res) => {
    const { schemaId } = req.body;

    try {
        console.log(`Attempting to retrieve schema with ID: ${schemaId}`);
        const { data, error } = await supabase
            .from('schemas')
            .select('sql_code')
            .eq('id', schemaId)
            .single();

        console.log('Length of retrieved SQL Code:', data.length);

        if (error || !data) {
            console.error('Schema not found:', error);
            return res.status(404).json({ error: 'Schema not found. Please provide a valid schema ID.' });
        }

        console.log('Retrieved schema', data);
        const sqlCode = data.sql_code;

        await executeSQL(sqlCode);

        res.json({ message: 'Table created successfully' });
    } catch (error) {
        console.error('Error executing schema:', error);
        res.status(500).json({ error: 'Failed to execute schema. Please try again.' });
    }

});

// Endpoint to generate fake data based on the SQL schema
app.post('/api/generate-data', async (req, res) => {
    const { sqlCode, tableName } = req.body;

    try {
        await executeSQL(sqlCode);

        const fakeData = [];
        for (let i = 1; i <= 100; i++) {
            fakeData.push({ username: `TestUser ${i}` });
        }

        const insertData = await supabase
            .from(tableName)
            .insert(fakeData);

        if (insertData.error) {
            throw insertData.error;
        }

        res.json(fakeData);
    } catch (error) {
        console.error('Error generating data:', error);
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

// Example API endpoint to generate fake data
app.post('/api/generate-fake-data', async (req, res) => {
    const { tableName, rowCount } = req.body;

    try {
        await generateFakeData(tableName, rowCount || 100);
        res.json({ message: `Successfully generated ${rowCount || 100} rows of fake data for ${tableName}` });
    } catch (error) {
        console.error('Error generating fake data:', error);
        res.status(500).json({ error: 'Failed to generate fake data. Please try again.' });
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
