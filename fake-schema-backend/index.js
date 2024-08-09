const express = require('express');
const OpenAI = require('openai');
const supabase = require('./supabaseClient');
const cors = require('cors');
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
            max_tokens: 150,
            temperature: 0,
        });

        const sqlCode = response.choices[0].message.content.trim();

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

// Endpoint to generate fake data based on the SQL schema
app.post('/api/generate-data', async (req, res) => {
    const { sqlCode } = req.body;

    try {
        await supabase.rpc('execute_sql', { sql_statement: sqlCode });

        const fakeData = [];
        for (let i = 1; i <= 100; i++) {
            fakeData.push({ username: `TestUser ${i}` });
        }

        const insertData = await supabase
            .from('users')
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
    const { sqlCode, additionalRows } = req.body;

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


// Other endpoints...
app.listen(port, () => {
    console.log(`Backend server is running on http://localhost:${port}`);
});
