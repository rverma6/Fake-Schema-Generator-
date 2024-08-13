require('dotenv').config({ path: '../.env' });
const { faker } = require('@faker-js/faker');
const OpenAI = require('openai');
const redisClient = require('../redisClient');
const { Pool } = require('pg');

// Initialize PostgreSQL pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// primary key cannot just be id must be more descriptive
// mention that in prompt

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    organization: "org-Dxwr0ny8EWkm8hlzHhw2Njdl",
    project: "proj_z6qXSriksXQfJ5WPbSxJ78x4",
});

// Retrieve table schema from database
const getTableSchema = async (tableName) => {
    const cacheKey = `tableschema:${tableName}`;
    console.log(`Retrieved cache key: ${cacheKey} for table named: ${tableName}`);

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
        console.log(`Specified query is: ${query} with table name: ${tableName}`);
        const result = await pool.query(query, [tableName]);

        await redisClient.set(cacheKey, JSON.stringify(result.rows), { EX: 3600 }); // Cache for 1 hour
        return result.rows;
    } catch (error) {
        console.error('Error getting table schema:', error.message);
        throw error;
    }
};

// Retrieve foreign key data from source table
const getForeignKeyData = async (sourceTableName, column) => {
    try {
        const query = `SELECT ${column} FROM ${sourceTableName};`;
        console.log(`Executing query: ${query}`);
        const result = await pool.query(query);
        console.log(`Foreign key data retrieved from ${sourceTableName}:`, result.rows);
        return result.rows.map(row => row[column]);
    } catch (error) {
        console.error(`Error retrieving foreign key data from ${sourceTableName}:`, error.message);
        throw error;
    }
};

// Validate and insert foreign key data
const checkAndInsertForeignKey = async (tableName, foreignKeyColumn, value) => {
    try {
        const selectQuery = `SELECT ${foreignKeyColumn} FROM ${tableName} WHERE ${foreignKeyColumn} = $1;`;
        const selectResult = await pool.query(selectQuery, [value]);

        if (selectResult.rows.length === 0) {
            const insertQuery = `
                INSERT INTO ${tableName} (${foreignKeyColumn}) 
                VALUES ($1) 
                ON CONFLICT (${foreignKeyColumn}) DO NOTHING 
                RETURNING ${foreignKeyColumn};
            `;
            const insertResult = await pool.query(insertQuery, [value]);

            if (insertResult.rows.length === 0) {
                console.log(`Foreign key value ${value} already existed in ${tableName}`);
            } else {
                console.log(`Inserted new value ${value} into ${tableName}`);
            }
        } else {
            console.log(`Foreign key value ${value} already exists in ${tableName}`);
        }
        return value;
    } catch (error) {
        console.error(`Error in checkAndInsertForeignKey:`, error.message);
        throw error;
    }
};

// Get AI-generated script for generating realistic data
const getAIScriptForColumn = async (table_name, column_name, data_type) => {
    const cacheKey = `aiscript:${table_name}:${column_name}:${data_type}`;
    console.log(`This is the table name: ${table_name} and col name is ${column_name}`);

    try {
        const cachedScript = await redisClient.get(cacheKey);
        if (cachedScript) {
            console.log(`Cache hit for AI script: ${cacheKey}`);
            return cachedScript;
        }

        const prompt = `You are an expert in generating realistic data for databases.
            Please provide a concise JSON object that specifies how to generate realistic data for a column in a PostgreSQL database.
            The column is named "${column_name}" and has the data type "${data_type}".
            This column belongs to a table named "${table_name}".

            The JSON should have the following structure:
            {
                "customFunction": "provide a JavaScript function that generates the data"
            }

            The custom function should use domain-specific knowledge and context provided by both the column name and table name to create data that fits the likely context of the column.
            Avoid unnecessary explanations or additional text, and focus on providing the custom function within the JSON object.`;

        console.log('Custom prompt for AI:', prompt);

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],
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

// Get the appropriate Faker method or AI-generated script for a column
const getFakerMethodForColumn = async (column_name, data_type, table_name) => {
    console.log(`getFakerMethodForColumn called with column: ${column_name}, data type: ${data_type}, table: ${table_name}`);

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
        aiScript = await getAIScriptForColumn(table_name, column_name, data_type);

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

const generatePrimaryKey = (column_name, generatedKeys) => {
    // Initialize the set for this column if it doesn't already exist
    if (!generatedKeys[column_name]) {
        generatedKeys[column_name] = new Set();
    }

    let value;
    // Generate a value and ensure it's unique
    do {
        value = faker.number.int({ min: 1, max: 1000000 });
    } while (generatedKeys[column_name].has(value));

    // Add the unique value to the set
    generatedKeys[column_name].add(value);

    return value;
};



// Generate column values
const generateColumnValue = async (column_name, data_type, character_maximum_length) => {
    let fakerMethod = await getFakerMethodForColumn(column_name, data_type);


    if (typeof fakerMethod !== 'function') {
        console.warn(`Faker method for ${column_name} is not a function. Using fallback.`);
        fakerMethod = () => faker.lorem.word();
    }

    let value = fakerMethod();

    // Truncate string if necessary
    if (typeof value === 'string' && character_maximum_length && value.length > character_maximum_length) {
        value = value.substring(0, character_maximum_length);
    }

    // Handle array fields if necessary
    if (Array.isArray(value) && data_type === 'ARRAY') {
        value = `{${value.join(',')}}`;
    }

    return value;
};

// Handle foreign keys
const handleForeignKey = async (foreignKeyData, column_name) => {
    const foreignKeyInfo = foreignKeyData[column_name];
    const value = faker.helpers.arrayElement(foreignKeyInfo.values);
    console.log(`Selected foreign key value ${value} for column ${column_name}`);

    const isValidForeignKey = await checkAndInsertForeignKey(foreignKeyInfo.tableName, foreignKeyInfo.columnName, value);
    if (!isValidForeignKey) {
        throw new Error(`Invalid foreign key value ${value} for column ${column_name}`);
    }
    return value;
};



const generateDataForRow = async (schema, primaryKeyColumns, foreignKeyData, generatedKeys) => {
    console.log('Primary Key Columns before includes:', primaryKeyColumns); // Add this line for debugging
    const rowData = {};
    for (const column of schema) {
        const { column_name, data_type, character_maximum_length } = column;
        let value;

        // Use the type check before calling includes
        if (Array.isArray(primaryKeyColumns) && primaryKeyColumns.includes(column_name)) {
            value = generatePrimaryKey(column_name, generatedKeys);
        } else if (foreignKeyData[column_name]) {
            value = await handleForeignKey(foreignKeyData, column_name);
        } else {
            value = await generateColumnValue(column_name, data_type, character_maximum_length);
        }

        rowData[column_name] = value;
    }
    return rowData;
};





// Insert a single row into the database
const insertSingleRow = async (tableName, rowData) => {
    console.log(`Passed parameters are tableName: ${tableName} and rowData: ${JSON.stringify(rowData, null, 2)}`);
    const columns = Object.keys(rowData).join(", ");
    const values = Object.values(rowData);
    const placeholders = values.map((_, idx) => `$${idx + 1}`).join(", ");

    const sql = `
        INSERT INTO ${tableName} (${columns})
        VALUES (${placeholders})
        ON CONFLICT DO NOTHING; 
    `;

    try {
        console.log(`Executing SQL: ${sql} with values: ${JSON.stringify(values)}`);
        await pool.query(sql, values);
    } catch (error) {
        console.error(`Error inserting row into ${tableName}: ${error.message}`);
        throw error;
    }
};

// Main function to generate fake data for a table
const generateFakeData = async (tableName, rowCount = 3, foreignKeyData = {}) => {
    const data = [];
    try {

        console.log(`We have reached this point`);
        const schema = await getTableSchema(tableName);
        const primaryKeyColumns = schema.filter(column => column.is_primary_key).map(column => column.column_name);
        const generatedKeys = {};


        for (let i = 0; i < rowCount; i++) {
            const rowData = await generateDataForRow(schema, primaryKeyColumns, foreignKeyData, generatedKeys, tableName);
            data.push(rowData);
            console.log(`Inserting row into ${tableName}:`, rowData);
            await insertSingleRow(tableName, rowData);
        }

        console.log(`Generated ${rowCount} rows of fake data for ${tableName}`);
        return data;
    } catch (err) {
        console.error('Error generating fake data:', err.message);
        throw err;
    }
};

module.exports = {
    generateFakeData,
    getTableSchema,
    getAIScriptForColumn,
    getForeignKeyData,
    getFakerMethodForColumn,
    insertSingleRow,
    generatePrimaryKey,
    generateColumnValue,
    checkAndInsertForeignKey,
    generateDataForRow
};
