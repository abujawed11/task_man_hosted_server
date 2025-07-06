// const pool = require('../config/db');

// async function createNotification(receiver, message) {
//   await pool.query(
//     'INSERT INTO notifications (receiver, message) VALUES (?, ?)',
//     [receiver, message]
//   );
// }

// module.exports = { createNotification };

// const pool = require('../config/db');
// const { generateId } = require('./idGenerator');

// async function createNotification({ task_id, sender, receiver, type, message }) {
//   const notificationId = await generateId('NOTI', 'notifications', 'notification_id');
//   await pool.query(
//     `INSERT INTO notifications (notification_id, task_id, sender, receiver, type, message) 
//      VALUES (?, ?, ?, ?, ?, ?)`,
//     [notificationId, task_id, sender, receiver, type, message]
//   );
// }

// module.exports = { createNotification };

const pool = require('../config/db');
const { generateId } = require('./idGenerator');

async function createNotification({ task_id, sender, receiver, type, message = null, updates = null }) {
  const notificationId = await generateId('NOTI', 'notifications', 'notification_id');

  // Stringify updates if present
  const updatesJson = updates ? JSON.stringify(updates) : null;

  await pool.query(
    `INSERT INTO notifications 
      (notification_id, task_id, sender, receiver, type, message, updates) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [notificationId, task_id, sender, receiver, type, message, updatesJson]
  );
}

module.exports = { createNotification };


