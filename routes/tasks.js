const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/authMiddleware');
const { generateId } = require('../utils/idGenerator');
const { createNotification } = require('../utils/notify');


// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});


const fileFilter = (req, file, cb) => {
  cb(null, true); // accept all types
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).fields([
  { name: 'audio', maxCount: 1 },
  { name: 'file', maxCount: 1 },
]);


// router.get('/all', async (req, res) => {
//   console.log('✅ /all route hit');
//   res.json([]);
// });

// router.get('/all', authMiddleware, async (req, res) => {
//   try {
//     console.log("Getting All Tasks")
//     const [rows] = await pool.query(
//       // `SELECT id, title, description, priority, status, due_date, assigned_to, created_by, audio_path, file_path, created_at
//       //  FROM tasks`
//       `SELECT * FROM tasks`
//     );
//     res.json(rows);
//   } catch (error) {
//     console.error('Error fetching all tasks:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

//fetch all Task for Admin
router.get('/all', authMiddleware, async (req, res) => {
  try {
    console.log("Getting All Tasks");

    const [rows] = await pool.query(
      `SELECT t.task_id, t.title, t.description, t.priority, t.status, t.due_date,
              COALESCE(tu.assigned_to, t.assigned_to) AS assigned_to,
              t.created_by,
              COALESCE(tu.updated_by, t.created_by) AS assigned_by,
              COALESCE(tu.updated_at, t.created_at) AS last_updated_at,
              t.audio_path, t.file_path, t.created_at
       FROM tasks t
       LEFT JOIN (
         SELECT u1.task_id, u1.assigned_to, u1.updated_by, u1.updated_at
         FROM task_updates u1
         JOIN (
           SELECT task_id, MAX(updated_at) as max_time
           FROM task_updates
           WHERE assigned_to IS NOT NULL
           GROUP BY task_id
         ) u2 ON u1.task_id = u2.task_id AND u1.updated_at = u2.max_time
       ) tu ON t.task_id = tu.task_id`
    );

    res.json(rows);
  } catch (error) {
    console.error('Error fetching all tasks:', error);
    res.status(500).json({ message: 'Server error' });
  }
});



//All users in My Task Filter
router.get('/users/all', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT username from users`);

    res.json(rows); // returns array of { username: '...' }
  } catch (error) {
    console.error('Error fetching all task users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get dashboard statistics
// router.get('/dashboard', authMiddleware, async (req, res) => {
//   try {
//     const userName = req.user.username;
//     // console.log(userId)
//     const [[{ assignedToMe }]] = await pool.query(
//       'SELECT COUNT(*) AS assignedToMe FROM tasks WHERE assigned_to = ?',
//       [userName]
//     );

//     const [[{ assignedByMe }]] = await pool.query(
//       'SELECT COUNT(*) AS assignedByMe FROM tasks WHERE created_by = ?',
//       [userName]
//     );

//     const [[{ pending }]] = await pool.query(
//       'SELECT COUNT(*) AS pending FROM tasks WHERE assigned_to = ? AND status = "Pending"',
//       [userName]
//     );

//     const [[{ inProgress }]] = await pool.query(
//       'SELECT COUNT(*) AS inProgress FROM tasks WHERE assigned_to = ? AND status = "In Progress"',
//       [userName]
//     );

//     const [[{ completed }]] = await pool.query(
//       'SELECT COUNT(*) AS completed FROM tasks WHERE assigned_to = ? AND status = "Completed"',
//       [userName]
//     );

//     res.json({
//       stats: { assignedToMe, assignedByMe, pending, inProgress, completed },
//     });
//   } catch (error) {
//     console.error('Error fetching dashboard stats:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const userName = req.user.username;

    // Subquery to get latest assigned_to from task_updates
    const [assignedToMeRow] = await pool.query(`
      SELECT COUNT(DISTINCT t.task_id) AS assignedToMe
      FROM tasks t
      LEFT JOIN (
        SELECT tu.task_id, tu.assigned_to
        FROM task_updates tu
        JOIN (
          SELECT task_id, MAX(updated_at) AS latest
          FROM task_updates
          WHERE assigned_to IS NOT NULL
          GROUP BY task_id
        ) latest_update ON tu.task_id = latest_update.task_id AND tu.updated_at = latest_update.latest
      ) AS latest_assign ON t.task_id = latest_assign.task_id
      WHERE COALESCE(latest_assign.assigned_to, t.assigned_to) = ?
    `, [userName]);

    const [[{ assignedByMe }]] = await pool.query(
      'SELECT COUNT(*) AS assignedByMe FROM tasks WHERE created_by = ?',
      [userName]
    );

    const [statusCounts] = await pool.query(`
      SELECT 
        SUM(CASE WHEN COALESCE(la.assigned_to, t.assigned_to) = ? AND t.status = 'Pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN COALESCE(la.assigned_to, t.assigned_to) = ? AND t.status = 'In Progress' THEN 1 ELSE 0 END) AS inProgress,
        SUM(CASE WHEN COALESCE(la.assigned_to, t.assigned_to) = ? AND t.status = 'Completed' THEN 1 ELSE 0 END) AS completed
      FROM tasks t
      LEFT JOIN (
        SELECT tu.task_id, tu.assigned_to
        FROM task_updates tu
        JOIN (
          SELECT task_id, MAX(updated_at) AS latest
          FROM task_updates
          WHERE assigned_to IS NOT NULL
          GROUP BY task_id
        ) latest_update
        ON tu.task_id = latest_update.task_id AND tu.updated_at = latest_update.latest
      ) la ON t.task_id = la.task_id
    `, [userName, userName, userName]);

    res.json({
      stats: {
        assignedToMe: assignedToMeRow[0].assignedToMe,
        assignedByMe,
        ...statusCounts[0],
      },
    });

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});



router.get('/list', authMiddleware, async (req, res) => {
  try {
    console.log("list fetched");
    const currentUserId = req.user.id;
    // console.log(currentUserId)
    const [rows] = await pool.query(
      'SELECT username FROM users WHERE user_id != ?', [currentUserId]
    );

    // Extract usernames only
    const usernames = rows.map(user => user.username);

    res.json(usernames);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create Task with `due_date`
router.post('/create', authMiddleware, upload, async (req, res) => {
  const { title, description, priority, assigned_to, due_date } = req.body;
  const created_by = req.user.username;

  if (!title || !assigned_to) {
    return res.status(400).json({ message: 'Title and assigned user are required' });
  }

  try {
    const taskId = await generateId('TASK', 'tasks', 'task_id');

    const audioPath = req.files?.audio ? 'uploads/' + req.files.audio[0].filename : null;
    const filePath = req.files?.file ? 'uploads/' + req.files.file[0].filename : null;

    await pool.query(
      `INSERT INTO tasks (task_id, title, description, priority, status, assigned_to, created_by, audio_path, file_path, due_date)
       VALUES (?, ?, ?, ?, 'Pending', ?, ?, ?, ?, ?)`,
      [
        taskId,
        title,
        description || null,
        priority || 'Medium',
        assigned_to,
        created_by,
        audioPath,
        filePath,
        due_date || null,
      ]
    );

    // Insert initial task snapshot into task_updates
    await pool.query(
      `INSERT INTO task_updates 
    (task_id, updated_by, status, title, description, assigned_to, due_date, priority, audio_path, file_path, comment,       assigned_by, is_system_generated) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)`,
      [
        taskId,
        created_by,                 // updated_by
        'Pending',                  // status
        title || null,
        description || null,
        assigned_to || null,
        due_date || null,
        priority || 'Medium',
        audioPath,
        filePath,
        'Initial task assignment',  // comment
        created_by,
        true                  // assigned_by
      ]
    );

    // ...after task insertion
    await createNotification(assigned_to, `New task "${title}" has been assigned to you by ${created_by}`);

    res.status(201).json({ message: 'Task created successfully', taskId }); // Send custom taskId back
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get tasks assigned to the logged-in user
router.get('/assigned', authMiddleware, async (req, res) => {
  try {
    const username = req.user.username;
    console.log('Fetching tasks for user:', username);
    const [rows] = await pool.query(
      `SELECT t.*, 
              COALESCE(tu.assigned_by, t.created_by) AS assigned_by,
              COALESCE(tu.updated_at, t.created_at) AS last_updated_at
        FROM tasks t
        LEFT JOIN (
            SELECT u1.task_id, u1.assigned_to, u1.assigned_by, u1.updated_at
            FROM task_updates u1
            JOIN (
                SELECT task_id, MAX(updated_at) as max_time
                FROM task_updates
                WHERE assigned_to IS NOT NULL
                GROUP BY task_id
            ) u2 ON u1.task_id = u2.task_id AND u1.updated_at = u2.max_time
        ) tu ON t.task_id = tu.task_id
        WHERE COALESCE(tu.assigned_to, t.assigned_to) = ?`,
      [username]
    );


    res.json(rows);
  } catch (error) {
    console.error('Error fetching assigned tasks:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get tasks created by the logged-in user (i.e., assigned by them)
router.get('/created-by-me', authMiddleware, async (req, res) => {
  try {
    const username = req.user.username;
    const [rows] = await pool.query(
      `SELECT task_id, title, description, priority, status, due_date, assigned_to, audio_path, file_path, created_at, updated_at
       FROM tasks WHERE created_by = ?`,
      [username]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching assigned tasks:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


// GET a single task by ID
router.get('/:taskId', authMiddleware, async (req, res) => {
  const taskId = req.params.taskId;

  try {
    const [rows] = await pool.query(
      `SELECT 
         t.task_id, 
         t.title, 
         t.description, 
         t.priority, 
         t.status, 
         t.due_date, 
         t.created_by, 
         t.assigned_to, 
         t.audio_path, 
         t.file_path, 
         t.created_at,
         tu.assigned_by
       FROM tasks t
       LEFT JOIN task_updates tu 
         ON tu.task_id = t.task_id 
        AND tu.id = (
          SELECT MAX(id) FROM task_updates 
          WHERE task_id = t.task_id AND assigned_to IS NOT NULL
        )
       WHERE t.task_id = ?`,
      [taskId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching task by ID:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

router.put('/:taskId/update', authMiddleware, upload, async (req, res) => {
  const taskId = req.params.taskId;
  const username = req.user.username;
  const { status, title, description, due_date, priority, comment, assigned_to } = req.body;

  const audioPath = req.files?.audio ? 'uploads/' + req.files.audio[0].filename : null;
  const filePath = req.files?.file ? 'uploads/' + req.files.file[0].filename : null;

  try {
    // 1. Fetch task + account_type
    const [taskRows] = await pool.query(
      `SELECT t.*, u.account_type 
       FROM tasks t 
       JOIN users u ON u.username = ? 
       WHERE t.task_id = ?`,
      [username, taskId]
    );

    const task = taskRows[0];
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const isPrivilegedUser = (task.created_by === username || task.account_type === 'Super Admin');

    const fieldsToUpdate = [];
    const updateValues = [];

    // 2. Update tasks table if needed
    if (isPrivilegedUser) {
      if (title && title !== task.title) {
        fieldsToUpdate.push('title = ?');
        updateValues.push(title);
      }
      if (description && description !== task.description) {
        fieldsToUpdate.push('description = ?');
        updateValues.push(description);
      }
      if (priority && priority !== task.priority) {
        fieldsToUpdate.push('priority = ?');
        updateValues.push(priority);
      }
      if (status && status !== task.status) {
        fieldsToUpdate.push('status = ?');
        updateValues.push(status);
      }
      if (due_date && due_date !== task.due_date?.toISOString().split('T')[0]) {
        fieldsToUpdate.push('due_date = ?');
        updateValues.push(due_date);
      }
      if (assigned_to && assigned_to !== task.assigned_to) {
        fieldsToUpdate.push('assigned_to = ?');
        updateValues.push(assigned_to);
      }

      if (fieldsToUpdate.length > 0) {
        fieldsToUpdate.push('updated_at = CURRENT_TIMESTAMP');
        await pool.query(
          `UPDATE tasks SET ${fieldsToUpdate.join(', ')} WHERE task_id = ?`,
          [...updateValues, taskId]
        );
      }
    } else {
      if (status && status !== task.status) {
        await pool.query(
          `UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE task_id = ?`,
          [status, taskId]
        );
      }
    }

    // 3. Insert into task_updates table only changed fields
    const columns = ['task_id', 'updated_by'];
    const placeholders = ['?', '?'];
    const values = [taskId, username];

    if (status && status !== task.status) {
      columns.push('status');
      placeholders.push('?');
      values.push(status);
    }
    if (title && title !== task.title) {
      columns.push('title');
      placeholders.push('?');
      values.push(title);
    }
    if (description && description !== task.description) {
      columns.push('description');
      placeholders.push('?');
      values.push(description);
    }
    if (priority && priority !== task.priority) {
      columns.push('priority');
      placeholders.push('?');
      values.push(priority);
    }
    if (due_date && due_date !== task.due_date?.toISOString().split('T')[0]) {
      columns.push('due_date');
      placeholders.push('?');
      values.push(due_date);
    }
    if (assigned_to && assigned_to !== task.assigned_to) {
      columns.push('assigned_to');
      placeholders.push('?');
      values.push(assigned_to);
      columns.push('assigned_by');
      placeholders.push('?');
      values.push(username);
    }
    if (comment) {
      columns.push('comment');
      placeholders.push('?');
      values.push(comment);
    }
    if (audioPath) {
      columns.push('audio_path');
      placeholders.push('?');
      values.push(audioPath);
    }
    if (filePath) {
      columns.push('file_path');
      placeholders.push('?');
      values.push(filePath);
    }

    await pool.query(
      `INSERT INTO task_updates (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`,
      values
    );

    // 4. Notifications
    if (task.created_by && task.created_by !== username) {
      await createNotification(task.created_by, `Task "${task.title}" updated by ${username}`);
    }

    if (assigned_to && assigned_to !== task.assigned_to && assigned_to !== username) {
      await createNotification(assigned_to, `You were assigned task "${task.title}" by ${username}`);
    }

    res.json({ message: 'Task updated and logged successfully' });

  } catch (err) {
    console.error('Update failed:', err);
    res.status(500).json({ message: 'Server error' });
  }
});



// progress
router.get('/:taskId/progress', authMiddleware, async (req, res) => {
  const { taskId } = req.params;

  try {
    // 1. Fetch original task
    const [taskRows] = await pool.query(
      `SELECT title, description, created_by, assigned_to, status, priority, due_date, created_at, audio_path, file_path
       FROM tasks WHERE task_id = ?`,
      [taskId]
    );

    if (taskRows.length === 0) return res.status(404).json({ message: 'Task not found' });

    const originalTask = taskRows[0];
    let previousAssignee = originalTask.assigned_to;

    // 2. Fetch all updates (added missing fields: title, description, due_date, priority)
    const [updates] = await pool.query(
      `SELECT 
          tu.updated_by,
          u1.username AS updated_by_username,
          tu.assigned_to,
          u2.username AS assigned_to_username,
          tu.assigned_by,
          u3.username AS assigned_by_username,
          tu.status,
          tu.comment,
          tu.audio_path,
          tu.file_path,
          tu.title,
          tu.description,
          tu.due_date,
          tu.priority,
          tu.updated_at,
          tu.is_system_generated
       FROM task_updates tu
       LEFT JOIN users u1 ON tu.updated_by = u1.username
       LEFT JOIN users u2 ON tu.assigned_to = u2.username
       LEFT JOIN users u3 ON tu.assigned_by = u3.username
       WHERE tu.task_id = ?
       ORDER BY tu.updated_at ASC`,
      [taskId]
    );

    // 3. Track previous assignee
    const enriched = updates.map((update) => {
      const current = { ...update };
      if (current.assigned_to && current.assigned_to !== previousAssignee) {
        current.previous_assigned_to = previousAssignee;
        previousAssignee = current.assigned_to;
      } else {
        current.previous_assigned_to = null;
      }
      return current;
    });

    res.json({
      task: originalTask,
      updates: enriched,
    });

  } catch (err) {
    console.error('Error fetching task progress:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


module.exports = router;
