import React, { useEffect, useState } from 'react';
import axios from 'axios';

function Users() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchUsers() {
            try {
                const response = await axios.get('http://localhost:3001/api/users');
                setUsers(response.data);
                console.log('Users fetched:', response.data); // Optionally log the data for debugging
            } catch (error) {
                setError(error);
            } finally {
                setLoading(false);
            }
        }

        fetchUsers();
    }, []);

    if (loading) return <p>Loading...</p>;
    if (error) return <p>Error fetching users: {error.message}</p>;

    // Do not render users, just return null or keep the fetched data for later use
    return null;
}

export default Users;
