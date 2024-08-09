import React, { useEffect, useState } from 'react';
import axios from 'axios';

function Schemas() {
    const [schemas, setSchemas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchSchemas() {
            try {
                const response = await axios.get('http://localhost:3001/api/schemas');
                setSchemas(response.data);
            } catch (error) {
                setError(error);
            } finally {
                setLoading(false);
            }
        }

        fetchSchemas();
    }, []);

    if (loading) return <p>Loading...</p>;
    if (error) return <p>Error fetching schemas: {error.message}</p>;

    return (
        <div>
            <h1>Schemas</h1>
            <ul>
                {schemas.map(schema => (
                    <li key={schema.id}>
                        <strong>{schema.name}</strong>: {schema.sql_code}
                        <p>{schema.description}</p>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default Schemas;
