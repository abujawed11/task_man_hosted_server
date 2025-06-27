const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const pool = require('../config/db'); // adjust this path if your db connection is elsewhere

// ✅ Get all unread notifications for the logged-in user
router.get('/', authMiddleware, async (req, res) => {
  const username = req.user.username;

  try {
    const [rows] = await pool.query(
      `SELECT * FROM notifications 
       WHERE receiver = ? 
       ORDER BY created_at DESC`,
      [username]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


// ✅ Mark all notifications as read
router.post('/mark-read', authMiddleware, async (req, res) => {
  const username = req.user.username;

  try {
    await pool.query(
      `UPDATE notifications 
       SET is_read = 1 
       WHERE receiver = ?`,
      [username]
    );
    res.json({ message: 'Notifications marked as read' });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;