import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { saveAs } from 'file-saver';
import Papa from 'papaparse';
import 'bootstrap/dist/css/bootstrap.min.css';
import DataDisplay from './DataDisplay';

function SchemaGenerator() {
    const [prompt, setPrompt] = useState('');
    const [sqlCode, setSqlCode] = useState('');
    const [schemaId, setSchemaId] = useState(null);
    const [tableName, setTableName] = useState('');
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [additionalRows, setAdditionalRows] = useState(10);
    const [visibleRows, setVisibleRows] = useState(10);
    const [isEditable, setIsEditable] = useState(false);
    const [isDataGenerated, setIsDataGenerated] = useState(false);
    const [isFakeDataGenerated, setIsFakeDataGenerated] = useState(false);
    const [columnMapping, setColumnMapping] = useState({});
    const [operationType, setOperationType] = useState('');
    const [oldColumn, setOldColumn] = useState('');
    const [newColumn, setNewColumn] = useState('');
    const [columnType, setColumnType] = useState('');
    const [columnNames, setColumnNames] = useState([]);
    const [foreignKeySourceTable, setForeignKeySourceTable] = useState(''); // New state for foreign key source table
    const [foreignKeyColumn, setForeignKeyColumn] = useState(''); // New state for foreign key column
    const [foreignKeyDetails, setForeignKeyDetails] = useState([]);


    const textareaRef = useRef(null);

    const sqlDataTypes = [
        "VARCHAR(50)",
        "VARCHAR(100)",
        "VARCHAR(250)",
        "TEXT",
        "INTEGER",
        "SERIAL",
        "BOOLEAN",
        "DATE",
        "TIMESTAMP",
        "DECIMAL(10, 2)",
        "FLOAT",
        "DOUBLE PRECISION",
    ];

    const resetState = () => {
        setPrompt('');
        setSqlCode('');
        setSchemaId(null);
        setTableName('');
        setData([]);
        setIsDataGenerated(false);
        setIsFakeDataGenerated(false);
        setColumnMapping({});
        setOperationType('');
        setOldColumn('');
        setNewColumn('');
        setColumnType('');
        setColumnNames([]);
        setForeignKeySourceTable(''); // Reset foreign key source table
        setForeignKeyColumn(''); // Reset foreign key column
        setIsEditable(false);
    };

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [sqlCode]);

    const extractForeignKeyInfo = (sqlCode) => {
        const foreignKeys = [];
        
        // Regular expression to capture the current column name, source table, and source column
        const regex = /(\w+)\s+\w+.*?REFERENCES\s+(\w+)\s*\((\w+)\)/gi;
        
        let match;
        
        while ((match = regex.exec(sqlCode)) !== null) {
            foreignKeys.push({
                columnName: match[1],    // Current table's column name
                sourceTable: match[2],   // Referenced table name
                sourceColumn: match[3],  // Referenced column name in the source table
            });
        }
        return foreignKeys;
    };
    
    

    const handleGenerateSchema = async () => {
        setLoading(true);
        setError(null);
    
        try {
            const response = await axios.post('http://localhost:3001/api/generate-schema', { prompt });
            let sqlCode = response.data.sql_code;
            const schemaId = response.data.schema_id;
            setSchemaId(schemaId);
    
            const extractedTableName = sqlCode.match(/CREATE TABLE (\w+)/i)[1];
            setTableName(extractedTableName);
    
            sqlCode = sqlCode.replace(/```sql/g, '').replace(/```/g, '').trim();
    
            console.log('Generated SQL Code:', sqlCode);
            setSqlCode(sqlCode);
    
            const columns = Array.from(sqlCode.matchAll(/^\s*(\w+)\s+\w+/gm)).map(match => match[1]);
            setColumnNames(columns);
    
            const detectedForeignKeys = extractForeignKeyInfo(sqlCode);
            console.log('Foreign Keys Detected:', detectedForeignKeys); // Logging detected foreign keys
    
            if (detectedForeignKeys.length > 0) {
                // If foreign keys are detected, store them for later use
                setForeignKeyDetails(detectedForeignKeys);
            }
    
        } catch (error) {
            setError('Failed to generate schema. Please try again.');
        } finally {
            setLoading(false);
        }
    };
    

    const handleRenameInputChange = (oldColumnName, newColumnName) => {
        setOldColumn(oldColumnName);
        setNewColumn(newColumnName);
        setColumnMapping((prevMapping) => ({
            ...prevMapping,
            [oldColumnName]: newColumnName
        }));
    };

    const handleSaveChanges = async () => {
        setLoading(true);
        setError(null);
    
        try {
            let updatedSqlCode = sqlCode;
            let mapping = {};
    
            if (operationType === 'foreignKey') {
                mapping[oldColumn] = { foreignKeySourceTable, foreignKeyColumn };
    
                // No SQL code update needed as the foreign key is already part of the schema
            } else if (operationType === 'rename') {
                mapping[oldColumn] = newColumn;
    
                updatedSqlCode = sqlCode.replace(
                    new RegExp(`\\b${oldColumn}\\b`, 'g'),
                    newColumn
                );
            } else if (operationType === 'drop') {
                const columnRegex = new RegExp(`^\\s*${oldColumn}\\s+[^,]+,?\\n`, 'im');
                updatedSqlCode = updatedSqlCode.replace(columnRegex, '');
                updatedSqlCode = updatedSqlCode.replace(/,\s*\)/, ')').trim();
                setColumnNames(columnNames.filter(name => name !== oldColumn));
            }
    
            const response = await axios.put('http://localhost:3001/api/update-schema', {
                schemaId,
                newSqlCode: updatedSqlCode,
                columnMapping: mapping,
            });
    
            if (response.status === 200) {
                alert('Schema updated successfully.');
    
                const { sql_code, table_name } = response.data;
    
                setSqlCode(sql_code);
                setTableName(table_name);
    
                const updatedDataResponse = await axios.post('http://localhost:3001/api/generate-data-with-foreign-keys', {
                    schemaId,
                    foreignKeySourceTable,
                    foreignKeyColumn,
                });
                setData(updatedDataResponse.data.data);
            } else {
                throw new Error('Failed to update schema.');
            }
    
            setOperationType('');
            setIsEditable(false);
    
        } catch (error) {
            setError('Failed to update schema. Please try again.');
        } finally {
            setLoading(false);
        }
    };
    

    const handleGenerateData = async () => {
        setLoading(true);
        setError(null);
    
        try {
            const foreignKeyInfo = foreignKeyDetails.length > 0 ? foreignKeyDetails[0] : null;
            console.log('Foreign Key Info:', foreignKeyInfo);


            let response;
            if (foreignKeyInfo) {
                response = await axios.post('http://localhost:3001/api/generate-data-with-foreign-keys', {
                    schemaId,
                    foreignKeySourceTable: foreignKeyInfo.sourceTable,
                    foreignKeyColumn: foreignKeyInfo.columnName,
                });
            } else {
                response = await axios.post('http://localhost:3001/api/generate-data', { schemaId });
            }

            console.log('Response data:', response.data);

            const generatedData = response.data.data;
            if (Array.isArray(generatedData)) {
                setData(generatedData);
                setVisibleRows(10);
                setIsDataGenerated(true);
                setIsFakeDataGenerated(true);
            } else {
                throw new Error('Unexpected response format: Data is not an array');
            }
        } catch (error) {
            setError('Failed to generate data. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    

    const handleEditSchema = () => {
        setIsEditable(true);
    };

    const handleGenerateMoreData = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await axios.post('http://localhost:3001/api/generate-more-data', {
                schemaId,
                additionalRows,
            });

            setData(prevData => [...prevData, ...response.data.data]);
        } catch (error) {
            setError('Failed to generate additional data. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleShowMore = () => {
        setVisibleRows(prevVisibleRows => prevVisibleRows + 10);
    };

    const handleExportToCSV = () => {
        if (!tableName) {
            alert('Table Name is not defined');
            return;
        }
        const csv = Papa.unparse(data);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const fileName = `${tableName.replace(/\s+/g, '_')}.csv`;

        saveAs(blob, fileName);
    };

    return (
        <div className="schema-generator">
            <div className="form-group">
                <label htmlFor="prompt" className="form-label">Enter a prompt to generate a schema:</label>
                <input
                    type="text"
                    className="form-control"
                    id="prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Create a schema for an ecommerce transactions table"
                />
                <button
                    className="btn btn-primary mt-3"
                    onClick={handleGenerateSchema}
                    disabled={loading}
                >
                    {loading ? 'Generating...' : 'Generate Schema'}
                </button>
            </div>

            {sqlCode && (
                <div className="card mt-4 p-4 shadow-sm">
                    <label htmlFor="prompt" className="form-label">Generated SQL Schema</label>
                    <textarea
                        ref={textareaRef}
                        value={sqlCode}
                        onChange={(e) => setSqlCode(e.target.value)}
                        rows="10"
                        cols="80"
                        className="form-control"
                        disabled={!isEditable}
                    />
                    {!isEditable ? (
                        <>
                            <button
                                className="btn btn-warning mt-3"
                                onClick={handleEditSchema}
                            >
                                Edit Schema
                            </button>
                            {isDataGenerated && (
                                <button
                                    className="btn btn-primary mt-3"
                                    onClick={resetState}
                                    disabled={loading}
                                >
                                    {loading ? 'Resetting...' : 'Generate New Schema'}
                                </button>
                            )}
                            {!isFakeDataGenerated && (
                                <button
                                    className="btn btn-secondary mt-3"
                                    onClick={handleGenerateData}
                                    disabled={loading}
                                >
                                    {loading ? 'Generating Data...' : 'Generate Fake Data'}
                                </button>
                            )}
                        </>
                    ) : (
                        <>
                            {isDataGenerated && (
                                <div className="mt-3">
                                    <label htmlFor="operationType">Select Operation:</label>
                                    <select
                                        id="operationType"
                                        className="form-control"
                                        value={operationType}
                                        onChange={(e) => setOperationType(e.target.value)}
                                    >
                                        <option value="">Select Operation</option>
                                        <option value="rename">Rename Column</option>
                                        <option value="drop">Drop Column</option>
                                    </select>
                                </div>
                            )}

                            {operationType === 'rename' && (
                                <>
                                    <input
                                        type="text"
                                        placeholder="Old Column Name"
                                        className="form-control mt-3"
                                        onChange={(e) => setOldColumn(e.target.value)}
                                    />
                                    <input
                                        type="text"
                                        placeholder="New Column Name"
                                        className="form-control mt-2"
                                        onChange={(e) => handleRenameInputChange(oldColumn, e.target.value)}
                                    />
                                </>
                            )}

                            {operationType === 'drop' && (
                                <select
                                    id="oldColumn"
                                    className="form-control mt-3"
                                    value={oldColumn}
                                    onChange={(e) => setOldColumn(e.target.value)}
                                >
                                    <option value="">Select Column to Drop</option>
                                    {columnNames.map((name) => (
                                        <option key={name} value={name}>
                                            {name}
                                        </option>
                                    ))}
                                </select>
                            )}

                            <button
                                className="btn btn-success mt-3"
                                onClick={handleSaveChanges}
                                disabled={loading}
                            >
                                {loading ? 'Saving...' : 'Save Changes'}
                            </button>

                            {/* Foreign key section */}
                            <div className="mt-3">
                                <label htmlFor="foreignKeySourceTable">Foreign Key Source Table:</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    id="foreignKeySourceTable"
                                    value={foreignKeySourceTable}
                                    onChange={(e) => setForeignKeySourceTable(e.target.value)}
                                    placeholder="Enter source table name"
                                />

                                <label htmlFor="foreignKeyColumn" className="mt-3">Foreign Key Column:</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    id="foreignKeyColumn"
                                    value={foreignKeyColumn}
                                    onChange={(e) => setForeignKeyColumn(e.target.value)}
                                    placeholder="Enter column name in the source table"
                                />
                            </div>
                        </>
                    )}
                </div>
            )}

            {data.length > 0 && (
                <>
                    <DataDisplay
                        data={data}
                        visibleRows={visibleRows}
                        handleShowMore={handleShowMore}
                        loading={loading}
                        additionalRows={additionalRows}
                        setAdditionalRows={setAdditionalRows}
                        handleGenerateMoreData={handleGenerateMoreData}
                    />
                    <button className="btn btn-info mt-3" onClick={handleExportToCSV}>
                        Export to CSV
                    </button>
                </>
            )}

            {error && <p className="text-danger mt-3">{error}</p>}
        </div>
    );
}

export default SchemaGenerator;
