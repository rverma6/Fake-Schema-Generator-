import React, { useState } from 'react';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import { FaDatabase } from 'react-icons/fa';
import DataDisplay from './DataDisplay';

function SchemaGenerator() {
    const [prompt, setPrompt] = useState('');
    const [sqlCode, setSqlCode] = useState('');
    const [schemaId, setSchemaId] = useState(null);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [additionalRows, setAdditionalRows] = useState(10);

    const [visibleRows, setVisibleRows] = useState(10);

    const handleGenerateSchema = async () => {
        setLoading(true);
        setError(null);
    
        try {
            const response = await axios.post('http://localhost:3001/api/generate-schema', { prompt });
            let sqlCode = response.data.sql_code;

            const schemaId = response.data.schema_id;
            setSchemaId(schemaId);

            sqlCode = sqlCode.replace(/```sql/g, '').replace(/```/g, '').trim();
    
            console.log('Generated SQL Code:', sqlCode);
            setSqlCode(sqlCode);
            
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
            console.log('Generating data for schema ID:', schemaId);
            const response = await axios.post('http://localhost:3001/api/generate-data', { schemaId });
            const generatedData = response.data.data;  // This assumes the API response contains a 'data' field with your array
    
            if (Array.isArray(generatedData)) {
                setData(generatedData);
                setVisibleRows(10);
            } else {
                throw new Error('Unexpected response format: Data is not an array');
            }
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
                schemaId,
                additionalRows,
            });
            
            // Log the full response to inspect its structure
            console.log(response);
    
            // Update this to correctly append the additional data
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

    return (
        <div className="container mt-5 text-light">
            <h2 className="text-center mb-4">
                <FaDatabase /> Schema Generator
            </h2>
            <div className="card bg-dark p-4 shadow-sm">
                <div className="form-group">
                    <label htmlFor="prompt">Enter a prompt to generate a schema:</label>
                    <input
                        type="text"
                        className="form-control bg-secondary text-light"
                        id="prompt"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Create a schema for an ecommerce transactions table"
                    />
                </div>
                <button
                    className="btn btn-primary mt-3"
                    onClick={handleGenerateSchema}
                    disabled={loading}
                >
                    {loading ? 'Generating...' : 'Generate Schema'}
                </button>
            </div>

            {sqlCode && (
                <div className="card bg-dark mt-4 p-4 shadow-sm">
                    <h3>Generated SQL Schema</h3>
                    <textarea
                        value={sqlCode}
                        onChange={(e) => setSqlCode(e.target.value)}
                        rows="10"
                        cols="80"
                        className="form-control bg-secondary text-light"
                    />
                    <button
                        className="btn btn-success mt-3"
                        onClick={handleGenerateData}
                        disabled={loading}
                    >
                        {loading ? 'Generating Data...' : 'Generate Fake Data'}
                    </button>
                </div>
            )}

            {data.length > 0 && (
                <DataDisplay 
                    data={data}
                    visibleRows={visibleRows}
                    handleShowMore={handleShowMore}
                    loading={loading}
                    additionalRows={additionalRows}
                    setAdditionalRows={setAdditionalRows}
                    handleGenerateMoreData={handleGenerateMoreData}
                />
            )}

            {error && <p className="text-danger mt-3">{error}</p>}
        </div>
    );
}

export default SchemaGenerator;
