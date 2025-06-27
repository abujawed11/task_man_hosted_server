// const express = require('express');
// const cors = require('cors');
// const dotenv = require('dotenv');
// const authRoutes = require('./routes/auth');
// const taskRoutes = require('./routes/tasks');
// const notificationRoutes = require('./routes/notification');
// const path = require('path');

// dotenv.config();

// const app = express();

// // 🔽 Add this block to log all requests
// app.use((req, res, next) => {
//   console.log(`👉 ${req.method} ${req.originalUrl}`);
//   next();
// });

// // Middleware
// // app.use(cors({
// //   origin: 'http://134.209.149.12', // Or your domain
// //   credentials: true
// // }));

// app.use(cors({
//   origin: process.env.CORS_ORIGIN || 'http://134.209.149.12',
//   credentials: true
// }));

// app.use(express.json());

// // Serve uploaded files statically
// // app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// // Routes
// app.use('/auth', authRoutes);
// app.use('/tasks', taskRoutes);
// app.use('/notifications', notificationRoutes);
// // app.use('/api/health', require('./routes/healthcheck'));

// // Serve uploaded files statically
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// // Error handling
// app.use((err, req, res, next) => {
//   console.error(err.stack);
//   res.status(500).json({ error: 'Internal server error' });
// });

// // Start server
// const PORT = process.env.PORT || 5000;
// const HOST = process.env.HOST || '0.0.0.0';

// app.listen(PORT, HOST, () => {
//   console.log(`Server running on http://${HOST}:${PORT}`);
//   console.log("DB_HOST:->",process.env.DB_HOST)
// });


const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const notificationRoutes = require('./routes/notification');
const path = require('path');

dotenv.config();

const app = express();

// ✅ Allowed origins
const allowedOrigins = [
  'http://localhost:5173',
  'http://134.209.149.12',
  'http://task.sun-rack.com',
  'https://task.sun-rack.com'  // ✅ Replace with your actual domain
];

// ✅ CORS middleware with dynamic origin check
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed for this origin: ' + origin));
    }
  },
  credentials: true
}));

// Body parser
app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/tasks', taskRoutes);
app.use('/notifications', notificationRoutes);
// app.use('/api/health', require('./routes/healthcheck'));


// // Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// // Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});


// Start server
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running at http://${HOST}:${PORT}`);
});

