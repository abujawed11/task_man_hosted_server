const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const pool = require('../config/db'); // adjust this path if your db connection is elsewhere

// ✅ Get all unread notifications for the logged-in user
// ✅ Get all notifications with task details


router.get('/', authMiddleware, async (req, res) => {
  const username = req.user.username;

  try {
    const [rows] = await pool.query(
      `SELECT 
         n.notification_id,
         n.task_id,
         n.sender,
         n.receiver,
         n.type,
         n.message,
         n.updates,              -- ✅ make sure you're selecting this
         n.is_read,
         n.created_at,
         t.title AS task_title,
         t.priority,
         t.status,
         t.due_date,
         t.created_by AS task_creator
       FROM notifications n
       LEFT JOIN tasks t ON n.task_id = t.task_id
       WHERE n.receiver = ?
       AND n.is_read = 0
       ORDER BY n.created_at DESC`,
      [username]
    );

    // Optional: Parse JSON safely in backend (recommended if you're not doing it in frontend)
    const parsedRows = rows.map((row) => ({
      ...row,
      updates: row.updates ? JSON.parse(row.updates) : null
    }));

    res.json(parsedRows);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Server error' });
  }
});




//not working code now
// router.get('/', authMiddleware, async (req, res) => {
//   const username = req.user.username;

//   try {
//     const [rows] = await pool.query(
//       `SELECT 
//          n.notification_id,
//          n.task_id,
//          n.sender,
//          n.receiver,
//          n.type,
//          n.message,
//          n.is_read,
//          n.created_at,
//          t.title AS task_title,
//          t.priority,
//          t.status,
//          t.due_date,
//          t.created_by AS task_creator
//        FROM notifications n
//        LEFT JOIN tasks t ON n.task_id = t.task_id
//        WHERE n.receiver = ?
//        AND n.is_read = 0
//        ORDER BY n.created_at DESC`,
//       [username]
//     );
//     res.json(rows);
//   } catch (error) {
//     console.error('Error fetching notifications:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });


//working---------------------------------------
// router.get('/', authMiddleware, async (req, res) => {
//   const username = req.user.username;

//   try {
//     const [rows] = await pool.query(
//       `SELECT * FROM notifications 
//        WHERE receiver = ? 
//        ORDER BY created_at DESC`,
//       [username]
//     );
//     res.json(rows);
//   } catch (error) {
//     console.error('Error fetching notifications:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });


// ✅ Mark all notifications as read
// ✅ Mark a single notification as read
router.post('/mark-read', authMiddleware, async (req, res) => {
  const username = req.user.username;
  const { notificationId } = req.body;

  if (!notificationId) {
    return res.status(400).json({ message: 'Notification ID is required' });
  }

  try {
    const [result] = await pool.query(
      `UPDATE notifications 
       SET is_read = 1 
       WHERE notification_id = ? AND receiver = ?`,
      [notificationId, username]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Notification not found or already read' });
    }

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Server error' });
  }
});



// router.post('/mark-read', authMiddleware, async (req, res) => {
//   const username = req.user.username;

//   try {
//     await pool.query(
//       `UPDATE notifications 
//        SET is_read = 1 
//        WHERE receiver = ?`,
//       [username]
//     );
//     res.json({ message: 'Notifications marked as read' });
//   } catch (error) {
//     console.error('Error marking notifications as read:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });


router.post("/register-token", authMiddleware, async (req, res) => {
  const { expo_push_token } = req.body;
  const user_id = req.user.id; // ✅ From JWT, secure
  
  console.log("📨 Received token registration request");

  if (!expo_push_token) {
    return res.status(400).json({ message: "Missing push token" });
  }

  try {
    const [result] = await pool.query(
    `INSERT INTO user_push_tokens (user_id, expo_push_token)
	VALUES (?, ?)
	ON DUPLICATE KEY UPDATE
	expo_push_token = VALUES(expo_push_token),
	updated_at = CURRENT_TIMESTAMP`,
      [user_id, expo_push_token]
    );
	console.log("✅ Push token saved/updated successfully");
	
    res.status(200).json({ message: "Token saved" });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});




module.exports = router;