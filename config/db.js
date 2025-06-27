// const mysql = require('mysql2/promise');
// const dotenv = require('dotenv');

// dotenv.config();

// const pool = mysql.createPool({
//   host: process.env.DB_HOST,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0,
// });

// module.exports = pool;


const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

// Validate env vars
['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'].forEach(env => {
  if (!process.env[env]) throw new Error(`Missing ${env} in .env`);
});

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  timezone: 'Z',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
});

// Test connection
pool.getConnection()
  .then(conn => {
    conn.release();
    console.log('Database connected');
  })
  .catch(err => {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  });

module.exports = pool;