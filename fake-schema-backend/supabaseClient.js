// Import the necessary modules
require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');

console.log('Using Supabase URL:', process.env.REACT_APP_SUPABASE_URL); // Add this line
console.log('Using DATABASE_URL:', process.env.DATABASE_URL);
// Initialize Supabase client using environment variables
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Function to test the connection
const testConnection = async () => {
    try {
        // Example query to select data from the 'users' table
        const { data, error } = await supabase
            .from('users') // Using the 'users' table for the test
            .select('*')
            .limit(1);

        if (error) {
            throw error;
        }

        console.log('Connection successful:', data);
    } catch (err) {
        console.error('Connection error:', err.message);
    }
};

// Run the testConnection function when the script is executed
testConnection();

// Export the Supabase client for use in other parts of the backend
module.exports = supabase;
