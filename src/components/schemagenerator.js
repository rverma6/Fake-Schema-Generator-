import React, { useState, useEffect } from 'react';
import axios from 'axios';

function SchemaGenerator() {
    const [prompt, setPrompt] = useState('');
    const [sqlCode, setSqlCode] = useState('');
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [additionalRows, setAdditionalRows] = useState(10);

    const handleGenerateSchema = async () => {
        setLoading(true);
        setError(null);
    
        try {
            const response = await axios.post('http://localhost:3001/api/generate-schema', { prompt });
            let sqlCode = response.data.sql_code;
    
            // Remove markdown code block delimiters if present
            sqlCode = sqlCode.replace(/```sql/g, '').replace(/```/g, '').trim();
    
            console.log('Generate SQL Code:', sqlCode);
            setSqlCode(sqlCode); // Ensure the cleaned-up sqlCode is set here
            
        } catch (error) {
            setError('Failed to generate schema. Please try again.');
        } finally {
            setLoading(false);
        }
    };
    

    const handleGenerateData = async () => {
        setLoading(true);
        setError(null);

        try {
            console.log('Generating data with SQL Code:', sqlCode);
            const response = await axios.post('http://localhost:3001/api/generate-data', { sqlCode, tableName: 'users' });
            setData(response.data);
        } catch (error) {
            setError('Failed to generate data. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateMoreData = async () => {
        setLoading(true);
        setError(null);

        try {
            console.log('Generating more data with SQL Code:', sqlCode, 'Additional Rows:', additionalRows);
            const response = await axios.post('http://localhost:3001/api/generate-more-data', {
                sqlCode,
                additionalRows,
            });
            setData(prevData => [...prevData, ...response.data]); // Append new rows to existing data
        } catch (error) {
            setError('Failed to generate additional data. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // New: Fetch all users from the backend
    const fetchUsers = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await axios.get('http://localhost:3001/api/users'); // Fetch users data
            setData(response.data);
        } catch (error) {
            setError('Failed to fetch users. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers(); // Fetch users data when component mounts
    }, []);

    return (
        <div>
            <h2>Schema Generator</h2>
            <div>
                <label>
                    Enter a prompt to generate a schema:
                    <input
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Create a schema for an ecommerce transactions table"
                    />
                </label>
                <button onClick={handleGenerateSchema} disabled={loading}>
                    {loading ? 'Generating...' : 'Generate Schema'}
                </button>
            </div>

            {sqlCode && (
                <div>
                    <h3>Generated SQL Schema</h3>
                    <textarea
                        value={sqlCode}
                        onChange={(e) => setSqlCode(e.target.value)}
                        rows="10"
                        cols="80"
                    />
                    <button onClick={handleGenerateData} disabled={loading}>
                        {loading ? 'Generating Data...' : 'Generate Fake Data'}
                    </button>
                </div>
            )}

            {data.length > 0 && (
                <div>
                    <h3>Generated Fake Data</h3>
                    <table border="1">
                        <thead>
                            <tr>
                                {Object.keys(data[0]).map((key) => (
                                    <th key={key}>{key}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((row, index) => (
                                <tr key={index}>
                                    {Object.values(row).map((value, i) => (
                                        <td key={i}>{value}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div>
                        <label>
                            Generate more rows:
                            <input
                                type="number"
                                value={additionalRows}
                                onChange={(e) => setAdditionalRows(e.target.value)}
                                min="1"
                            />
                        </label>
                        <button onClick={handleGenerateMoreData} disabled={loading}>
                            {loading ? 'Generating More Data...' : 'Generate More'}
                        </button>
                    </div>
                </div>
            )}

            {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
    );
}

export default SchemaGenerator;
