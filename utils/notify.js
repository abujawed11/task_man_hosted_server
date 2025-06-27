const pool = require('../config/db');

async function createNotification(receiver, message) {
  await pool.query(
    'INSERT INTO notifications (receiver, message) VALUES (?, ?)',
    [receiver, message]
  );
}

module.exports = { createNotification };
