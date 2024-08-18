require('dotenv').config({ path: '../.env' });
const supabase = require('../supabaseClient');
const { executeDirectSQL } = require('./executeSQL');
const { createTable } = require('./executeSQL');
const { extractTableName } = require('./executeSQL');
const { checkTableExists } = require('./executeSQL');






const { Pool } = require('pg');

// Step 1: Load environment variables and initialize the pool
console.log('Loaded DATABASE_URL:', process.env.DATABASE_URL);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const validateSchemaUpdate = (newSchemaSQL, existingSchemaSQL) => {
    const parseColumns = (sql) => {
        const columnPattern = /(\w+)\s+([\w\(\)]+)(?:\s+PRIMARY\s+KEY)?/gi;
        const columns = {};
        let match;
        while ((match = columnPattern.exec(sql)) !== null) {
            const [, columnName, dataType] = match;
            columns[columnName] = dataType;
        }
        return columns;
    };

    // Parse columns from the existing and new schema SQL
    const existingColumns = parseColumns(existingSchemaSQL);
    const newColumns = parseColumns(newSchemaSQL);

    // Track changes in columns
    let warnings = [];

    // Check if any existing columns are being dropped in the new schema
    for (const columnName in existingColumns) {
        if (!(columnName in newColumns)) {
            warnings.push(`Warning: Column "${columnName}" is being dropped.`);
        }
    }

    // Check if any data types of existing columns are being changed
    for (const columnName in newColumns) {
        if (existingColumns[columnName] && existingColumns[columnName] !== newColumns[columnName]) {
            warnings.push(`Warning: Data type of column "${columnName}" is being changed from "${existingColumns[columnName]}" to "${newColumns[columnName]}".`);
        }
    }

    // Log warnings (or send them to the user as part of the response)
    warnings.forEach(warning => console.warn(warning));

    // Optionally return the warnings to the user
    return { isValid: true, warnings };
};


const backupTableData = async (tableName) => {
    // Fetch existing data from the table
    const { data, error } = await supabase
        .from(tableName)
        .select('*');
    
    if (error) {
        throw new Error('Failed to backup data.');
    }

    // Store backup data in another table or a file
    // This could involve saving to a separate table like `${tableName}_backup`
    return data;
};

const migrateData = async (oldSchemaSQL, newSqlCode, tableName, columnMapping) => {
    const parseColumns = (sql) => {
        const columnPattern = /(\w+)\s+([\w\(\)]+)(?:\s+PRIMARY\s+KEY)?/gi;
        const columns = {};
        let match;
        while ((match = columnPattern.exec(sql)) !== null) {
            const [, columnName, dataType] = match;
            columns[columnName] = dataType;
        }
        return columns;
    };

    const oldColumns = parseColumns(oldSchemaSQL);
    const newColumns = parseColumns(newSqlCode);

    const renamedColumns = new Set(); // Track renamed columns

    // Handle renaming columns using explicit mapping
    for (const oldColumn in columnMapping) {
        const newColumn = columnMapping[oldColumn];
        console.log(`Attempting to rename column ${oldColumn} to ${newColumn}`);
        if (newColumns[newColumn] && oldColumns[oldColumn]) {
            console.log(`Renaming column ${oldColumn} to ${newColumn}`);
            await executeDirectSQL(`ALTER TABLE ${tableName} RENAME COLUMN ${oldColumn} TO ${newColumn}`);
            renamedColumns.add(oldColumn);
            renamedColumns.add(newColumn);
        } else {
            console.log(`Renaming failed for ${oldColumn} to ${newColumn}`);
        }
    }

    // Handle other changes (dropping, adding) after renaming
    for (const oldColumn in oldColumns) {
        if (!renamedColumns.has(oldColumn)) {
            if (!newColumns[oldColumn]) {
                console.log(`Dropping column ${oldColumn}`);
                await executeDirectSQL(`ALTER TABLE ${tableName} DROP COLUMN ${oldColumn}`);
            }
        }
    }

    for (const newColumn in newColumns) {
        if (!oldColumns[newColumn] && !renamedColumns.has(newColumn)) {
            console.log(`Adding new column ${newColumn} of type ${newColumns[newColumn]}`);
            await executeDirectSQL(`ALTER TABLE ${tableName} ADD COLUMN ${newColumn} ${newColumns[newColumn]}`);
        }
    }
};



module.exports = { backupTableData, migrateData, validateSchemaUpdate };