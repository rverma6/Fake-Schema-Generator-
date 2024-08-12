const { createClient } = require('redis');

// Create a Redis client
const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379' // Default Redis URL
});

// Connect to Redis
redisClient.connect().then(() => {
    console.log('Connected to Redis');
}).catch(err => {
    console.error('Could not connect to Redis:', err);
});

// Handle errors
redisClient.on('error', (err) => {
    console.error('Redis error:', err);
}); 

module.exports = redisClient;