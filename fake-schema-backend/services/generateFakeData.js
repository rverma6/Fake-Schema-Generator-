const { faker } = require('@faker-js/faker');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // Use your actual connection string
});

const getTableSchema = async (tableName) => {
    const query = `
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = $1;
    `;

    const result = await pool.query(query, [tableName]);
    return result.rows;
        
};

const generateFakeData = async (tableName, rowCount = 100) => {
    try {
        const schema = await getTableSchema(tableName);

        for (let i = 0; i < rowCount; i++) {
            const rowData = {};

            schema.forEach(column => {
                let { column_name, data_type } = column;

                data_type = data_type.toLowerCase();

                console.log(`Generating data for column: ${column_name} with type: ${data_type}`);

                if (column_name === 'id') return; 

                let value;

                try {
                    switch (data_type) {
                        case 'integer':
                        case 'int':
                        case 'bigint':
                            value = faker.number.int({ min: 1, max: 1000 });
                            break;

                        case 'text':
                        case 'varchar':
                        case 'character varying':
                            value = faker.lorem.words(3);
                            break;
                        
                        case 'float':
                        case 'decimal':
                        case 'numeric':
                            value = faker.finance.amount({min: 1, max: 1000, dec: 2});
                            break;

                        case 'timestamp':
                        case 'timestamptz':
                            value = faker.date.recent().toISOString(); // Generates a recent timestamp
                            break;

                        case 'boolean':
                            value = faker.datatype.boolean();
                            break;

                        default:
                            console.warn(`Unhandled or undefined data type: ${data_type} for column: ${column_name}`);
                            value = null;
                    }

                    // Handle null values with defaults
                    if (value === null) {
                        switch (data_type) {
                            case 'integer':
                            case 'int':
                            case 'bigint':
                                value = 0; // Default integer value
                                break;

                            case 'text':
                            case 'varchar':
                            case 'character varying':
                                value = 'default'; // Default text value
                                break;
                            
                            case 'float':
                            case 'decimal':
                            case 'numeric':
                                value = 0.0; // Default decimal value
                                break;

                            case 'timestamp':
                            case 'timestamptz':
                                value = new Date().toISOString(); // Default to current timestamp
                                break;

                            case 'boolean':
                                value = false; // Default boolean value
                                break;

                            default:
                                value = new Date().toISOString(); // Use current timestamp for any unhandled type
                        }
                    }

                    rowData[column_name] = value;

                } catch (typeError) {
                    console.error(`Error generating data for column: ${column_name} with type: ${data_type}`, typeError.message);
                    rowData[column_name] = null; // Fallback to null if an error occurs
                }
            });

            const columns = Object.keys(rowData).join(", ");
            const values = Object.values(rowData);
            const placeholders = values.map((_, idx) => `$${idx + 1}`).join(", ");

            const sql = `
                INSERT INTO ${tableName} (${columns})
                VALUES (${placeholders});
            `;

            console.log('Generated SQL:', sql);
            console.log('With values:', values);

            try {
                await pool.query(sql, values);
            } catch (dbError) {
                console.error('Error executing SQL:', dbError.message);
                console.error('Generated SQL Statement:', sql);
                console.error('With values:', values);
                throw dbError; // Re-throw error to handle it in the calling context
            }
        }

        console.log(`Inserted ${rowCount} rows of fake data into ${tableName}`)
    } catch (err) {
        console.log('Error generating fake data:', err.message);
        throw err;
    }
};

module.exports = { generateFakeData, getTableSchema };
