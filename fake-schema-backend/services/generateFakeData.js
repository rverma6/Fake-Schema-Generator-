require('dotenv').config({ path: '../.env' });
const { faker } = require('@faker-js/faker');
const OpenAI = require('openai');
const redisClient = require('../redisClient');


const { Pool } = require('pg');

// to do - create caching for faster generation

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    organization: "org-Dxwr0ny8EWkm8hlzHhw2Njdl",
    project: "proj_z6qXSriksXQfJ5WPbSxJ78x4",
});


// Function to retrieve the table schema and identify primary key columns
const getTableSchema = async (tableName) => {

    const cacheKey = `tableschema:${tableName}`;
    try {
        // Check if schema is cached
        const cachedSchema = await redisClient.get(cacheKey);
        if (cachedSchema) {
            console.log(`Cache hit for table schema: ${tableName}`);
            return JSON.parse(cachedSchema);
        }


    const query = `
        SELECT
            column_name, 
            data_type,
            character_maximum_length,
            column_default,
            is_nullable,
            EXISTS (
                SELECT 1 
                FROM information_schema.table_constraints tc 
                JOIN information_schema.constraint_column_usage ccu 
                ON ccu.constraint_name = tc.constraint_name 
                WHERE tc.table_name = $1 
                AND tc.constraint_type = 'PRIMARY KEY'
                AND ccu.column_name = columns.column_name
            ) AS is_primary_key
        FROM information_schema.columns AS columns
        WHERE table_name = $1;
    `;

    const result = await pool.query(query, [tableName]);

    await redisClient.set(cacheKey, JSON.stringify(result.rows), { EX: 3600 }); // Cache for 1 hour
        return result.rows;

    } catch (error) {
        console.error('Error getting table schema:', error.message);
        throw error;
    }
};

// Function to get AI-generated script for handling specific columns
const getAIScriptForColumn = async (column_name, data_type) => {

    const cacheKey = `aiscript:${column_name}:${data_type}`;
    try {
        // Check if the script is already cached in Redis
        const cachedScript = await redisClient.get(cacheKey);
        if (cachedScript) {
            console.log(`Cache hit for AI script: ${cacheKey}`);
            return cachedScript;
        }

    
        const prompt = `You are an expert in generating realistic data for databases. 
        Please provide a concise JSON object that specifies how to generate realistic data for a column in a PostgreSQL database. 
        The column is named "${column_name}" and has the data type "${data_type}".

        The JSON should have the following structure:
        {
            "customFunction": "provide a JavaScript function that generates the data"
        }

        The custom function should use common sense and domain knowledge to create data that fits the likely context of the column.
        Avoid unnecessary explanations or additional text, and focus on providing the custom function within the JSON object.`;


        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'user', content: prompt }
            ],
            max_tokens: 300,
            temperature: 0,
        });

        const content = response.choices[0].message.content.trim();
        console.log('AI suggestion for column:', column_name, '\n', content);

        await redisClient.set(cacheKey, content, { EX: 3600 }); // Cache for 1 hour

        return content;

    } catch (error) {
        console.error('Error getting AI script for column:', error.message);
        return null;
    }
};

// Function to insert a single row of data into the table
const insertSingleRow = async (tableName, rowData) => {
    const columns = Object.keys(rowData).join(", ");
    const values = Object.values(rowData);
    const placeholders = values.map((_, idx) => `$${idx + 1}`).join(", ");

    const sql = `
        INSERT INTO ${tableName} (${columns})
        VALUES (${placeholders});
    `;

    try {
        await pool.query(sql, values);
    } catch (error) {
        console.error('Error inserting row:', error.message);
        throw error;
    }
};

const getFakerMethodForColumn = async (column_name, data_type) => {
    let aiScript;

    try {
        // Handle specific cases
        switch (data_type.toLowerCase()) {
            case 'integer':
            case 'int':
            case 'bigint':
                if (column_name.toLowerCase().includes('age')) return () => faker.number.int({ min: 1, max: 110 });
                return () => faker.number.int({ min: 1, max: 1000000 }); // Adjust the range as needed

            case 'float':
            case 'decimal':
            case 'numeric':
                return () => faker.number.float({ min: 10, max: 1000, multipleOf: 0.01 }); // Adjust the range as needed

                
            case 'character varying':
            case 'varchar':
            case 'text':
                if (column_name.toLowerCase().includes('email')) return faker.internet.email;
                if (column_name.toLowerCase().includes('url')) return faker.internet.url;
                if (column_name.toLowerCase().includes('first_name')) return faker.person.firstName;
                if (column_name.toLowerCase().includes('last_name')) return faker.person.lastName;
                if (column_name.toLowerCase().includes('name')) return faker.person.fullName;

                break; // Exit switch, go to the default AI case below

            case 'date':
                return () => faker.date.past().toISOString().split('T')[0];

            case 'timestamp':
            case 'timestamp without time zone':
            case 'timestamptz':
                return () => faker.date.recent().toISOString();

            case 'boolean':
                return faker.datatype.boolean;

            case 'array':
            case 'ARRAY':
                return () => `{${faker.lorem.words(3).split(' ').join(',')}}`; // Example of converting to PostgreSQL array format

            default:
                break; // Exit switch, go to the AI case below
        }

        // If no specific method is found, call the AI API
        console.log(`No specific faker method found for ${column_name} with data type ${data_type}. Using AI to generate a custom method.`);
        aiScript = await getAIScriptForColumn(column_name, data_type);

        // Extract the JSON part from the AI response
        const jsonStart = aiScript.indexOf('{');
        const jsonEnd = aiScript.lastIndexOf('}') + 1;
        const jsonResponse = aiScript.slice(jsonStart, jsonEnd);

        console.log(`Extracted JSON for ${column_name}:`, jsonResponse);

        const parsedScript = JSON.parse(jsonResponse);
        const { customFunction } = parsedScript;

        if (customFunction) {
            console.log(`Using custom function for ${column_name}: ${customFunction}`);
            return new Function(`return ${customFunction}`)(); // Execute the custom function
        }

        // Fallback if no custom function is provided
        console.log(`No custom function found for ${column_name}, defaulting to fallback.`);
        return () => faker.lorem.word();

    } catch (error) {
        console.error(`Error determining faker method for ${column_name}:`, error.message);
        return () => faker.lorem.word(); // Fallback method
    }
};




const generateFakeData = async (tableName, rowCount = 10) => {
    try {
        const schema = await getTableSchema(tableName);
        const primaryKeyColumns = schema.filter(column => column.is_primary_key).map(column => column.column_name);
        const generatedKeys = {}; // To track generated keys and ensure uniqueness

        for (let i = 0; i < rowCount; i++) {
            const rowData = {};

            for (const column of schema) {
                let { column_name, data_type, character_maximum_length } = column;
                let value;

                if (primaryKeyColumns.includes(column_name)) {
                    // Ensure unique value for primary key
                    do {
                        value = faker.number.int({ min: 1, max: 1000000 });
                    } while (generatedKeys[column_name]?.has(value));

                    if (!generatedKeys[column_name]) {
                        generatedKeys[column_name] = new Set();
                    }
                    generatedKeys[column_name].add(value);
                } else {
                    try {
                        const fakerMethod = await getFakerMethodForColumn(column_name, data_type);
                        value = fakerMethod();

                        if (typeof value === 'string' && character_maximum_length && value.length > character_maximum_length) {
                            value = value.substring(0, character_maximum_length);
                        }

                        // Handle array fields if necessary
                        if (Array.isArray(value) && data_type === 'ARRAY') {
                            value = `{${value.join(',')}}`; // Convert to PostgreSQL array format
                        }
                    } catch (err) {
                        console.error(`Error generating data for column: ${column_name}. Falling back to default faker method.`, err.message);
                        value = faker.lorem.word(); // Fallback to a default method
                    }
                }

                rowData[column_name] = value;
            }

            console.log(`Generated row:`, rowData);
            await insertSingleRow(tableName, rowData);
        }

        console.log(`Generated ${rowCount} rows of fake data for ${tableName}`);
    } catch (err) {
        console.log('Error generating fake data:', err.message);
        throw err;
    }
};
    

module.exports = { generateFakeData, getTableSchema, getAIScriptForColumn };