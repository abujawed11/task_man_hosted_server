// const express = require('express');
// const bcrypt = require('bcrypt');
// const jwt = require('jsonwebtoken');
// const nodemailer = require('nodemailer');
// const pool = require('../config/db');
// const router = express.Router();
// const authMiddleware = require('../middleware/authMiddleware');


// require('dotenv').config();

// // Configure Nodemailer
// const transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS,
//   },
// });

// // Generate 6-digit OTP
// const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

// // Send OTP
// router.post('/send-otp', async (req, res) => {
//   const { email } = req.body;
//   if (!email || !/\S+@\S+\.\S+/.test(email)) {
//     return res.status(400).json({ message: 'Invalid email' });
//   }

//   const otp = generateOtp();
//   const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

//   try {
//     // Delete existing OTPs for this email
//     await pool.query('DELETE FROM otps WHERE email = ?', [email]);

//     // Store OTP
//     await pool.query('INSERT INTO otps (email, otp, expires_at) VALUES (?, ?, ?)', [
//       email,
//       otp,
//       expiresAt,
//     ]);

//     // Send email
//     const mailOptions = {
//       from: process.env.EMAIL_USER,
//       to: email,
//       subject: 'TaskApp OTP Verification',
//       text: `Your OTP for TaskApp registration is: ${otp}. It expires in 5 minutes.`,
//     };

//     await transporter.sendMail(mailOptions);
//     console.log(`OTP sent to ${email}: ${otp}`);
//     res.status(200).json({ message: 'OTP sent successfully' });
//   } catch (error) {
//     console.error('Error sending OTP:', error);
//     res.status(500).json({ message: 'Failed to send OTP' });
//   }
// });

// // Middleware to verify JWT
// // const authMiddleware = async (req, res, next) => {
// //   const token = req.headers.authorization?.split(' ')[1];
// //   if (!token) return res.status(401).json({ message: 'No token provided' });
// //   try {
// //     const jwt = require('jsonwebtoken');
// //     const decoded = jwt.verify(token, process.env.JWT_SECRET);
// //     req.user = decoded;
// //     next();
// //   } catch (error) {
// //     res.status(401).json({ message: 'Invalid token' });
// //   }
// // };

// // const authMiddleware = (req, res, next) => {
// //   const token = req.headers.authorization?.split(' ')[1];
// //   if (!token) return res.status(401).json({ message: 'No token provided' });

// //   try {
// //     const decoded = jwt.verify(token, process.env.JWT_SECRET);
// //     req.user = { id: decoded.userId }; // ✅ Fix: set `req.user.id` directly
// //     next();
// //   } catch (error) {
// //     res.status(401).json({ message: 'Invalid token' });
// //   }
// // };


// // Login
// router.post('/login', async (req, res) => {
//   console.log('Received login request:', req.body); // Add log
//   const { username, password } = req.body;

//   // Input validation
//   if (!username || !password) {
//     console.log('Validation failed: Missing fields');
//     return res.status(400).json({ message: 'Username and password are required' });
//   }

//   try {
//     // Find user
//     const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
//     if (users.length === 0) {
//       console.log('Login failed: User not found:', username);
//       return res.status(401).json({ message: 'Invalid credentials' });
//     }

//     const user = users[0];

//     // Compare password
//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch) {
//       console.log('Login failed: Invalid password for user:', username);
//       return res.status(401).json({ message: 'Invalid credentials' });
//     }

//     // Generate JWT
//     const token = jwt.sign({ userId: user.id,username: user.username }, process.env.JWT_SECRET, { expiresIn: '1h' });
//     const userData = {
//       id: user.id,
//       username: user.username,
//       email: user.email,
//       phoneNumber: user.phone_number,
//       role: user.role,
//     };

//     console.log('Login successful:', { userId: user.id, username }); // Add log
//     res.status(200).json({ user: userData, token });
//   } catch (error) {
//     console.error('Login error:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// // Signup
// router.post('/signup', async (req, res) => {
//   const { username, email, phoneNumber, role, password, otp, inviteCode, accountType } = req.body;
//   console.log('Received signup request:', req.body);

//   if (!['User', 'Super Admin'].includes(accountType)) {
//     return res.status(400).json({ message: 'Invalid account type' });
//   }

//   try {
//     // Validate OTP
//     const [otpRows] = await pool.query(
//       'SELECT * FROM otps WHERE email = ? AND otp = ? AND expires_at > NOW()',
//       [email, otp]
//     );
//     if (otpRows.length === 0) {
//       return res.status(400).json({ message: 'Invalid or expired OTP' });
//     }

//     // Validate invite code for Super Admin
//     if (accountType === 'Super Admin') {
//       const [codeRows] = await pool.query('SELECT * FROM invite_codes WHERE code = ? AND used = FALSE', [inviteCode]);
//       if (codeRows.length === 0) {
//         return res.status(400).json({ message: 'Invalid or used invite code' });
//       }
//     }

//     // Check for existing user
//     const [existingUsers] = await pool.query(
//       'SELECT * FROM users WHERE username = ? OR email = ?',
//       [username, email]
//     );
//     if (existingUsers.length > 0) {
//       return res.status(400).json({ message: 'Username or email already exists' });
//     }

//     // Hash password
//     const hashedPassword = await bcrypt.hash(password, 10);

//     // Insert user
//     const [result] = await pool.query(
//       'INSERT INTO users (username, email, phone_number, role, password, account_type) VALUES (?, ?, ?, ?, ?, ?)',
//       [username, email, phoneNumber, role, hashedPassword, accountType]
//     );

//     // Mark invite code as used
//     if (accountType === 'Super Admin') {
//       await pool.query('UPDATE invite_codes SET used = TRUE WHERE code = ?', [inviteCode]);
//     }

//     // Delete OTP
//     await pool.query('DELETE FROM otps WHERE email = ?', [email]);

//     // Generate JWT
//     const user = { id: result.insertId, username, email, role, accountType };
//     const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

//     console.log('Signup successful:', { userId: user.id, username });
//     res.status(201).json({ user, token });
//   } catch (error) {
//     console.error('Signup error:', error);
//     res.status(500).json({ message: 'Registration failed. Please try again.' });
//   }
// });

// // New endpoint: Get current user
// router.get('/me', authMiddleware, async (req, res) => {
//   try {
//     const [rows] = await pool.query(
//       'SELECT id, username, role, account_type AS accountType, email, phone_number FROM users WHERE id = ?',
//       [req.user.id]
//     );
//     if (!rows[0]) {
//       return res.status(404).json({ message: 'User not found' });
//     }
//     res.json(rows[0]);
//   } catch (error) {
//     console.error('Error fetching user:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// module.exports = router;


const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const pool = require('../config/db');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { generateId } = require('../utils/idGenerator');
const axios = require('axios');


require('dotenv').config();

// Configure Nodemailer
// const transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS,
//   },
// });


// Brevo email sending function
const sendEmailWithBrevo = async (to, subject, textContent, htmlContent) => {
  try {
    const payload = {
      sender: {
        name: "TaskApp",
        email: process.env.FROM_EMAIL
      },
      to: [{ email: to }],
      subject: subject,
      htmlContent: htmlContent
    };
    
    // Add textContent only if provided
    if (textContent) {
      payload.textContent = textContent;
    }

    console.log('Sending email with payload:', JSON.stringify(payload, null, 2));
    
    const response = await axios.post('https://api.brevo.com/v3/smtp/email', payload, {
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
        'accept': 'application/json'
      }
    });
    
    console.log('Brevo response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Brevo API error:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('Full error response:', JSON.stringify(error.response.data, null, 2));
    }
    throw new Error(`Brevo email error: ${error.response?.data?.message || error.message}`);
  }
};

// Generate 6-digit OTP
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

// Send OTP route
router.post('/send-otp', async (req, res) => {
  const { email } = req.body;

  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    return res.status(400).json({ message: 'Invalid email' });
  }

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins
  
  console.log(`Current time: ${new Date()}`);
  console.log(`Expires at: ${expiresAt}`);
  
  console.log(`Generated OTP for ${email}: ${otp}`);

  try {
    // Delete any existing OTP for the email
    await pool.query('DELETE FROM otps WHERE email = ?', [email]);

    // Store the new OTP with proper MySQL datetime format
    const expiresAtFormatted = new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    await pool.query(
      'INSERT INTO otps (email, otp, expires_at) VALUES (?, ?, ?)',
      [email, otp, expiresAtFormatted]
    );
    
    console.log(`Stored OTP in database for ${email}: ${otp}`);

    // Send the OTP email via Brevo
    await sendEmailWithBrevo(
      email,
      'Your TaskApp OTP Code',
      `Your OTP for TaskApp is ${otp}. It expires in 5 minutes.`,
      `<strong>Your OTP for TaskApp is ${otp}</strong><br/><p>It expires in 5 minutes.</p>`
    );
    console.log(`OTP sent to ${email}: ${otp}`);
    res.status(200).json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Error sending OTP:', error.response?.body || error.message);
    res.status(500).json({ message: 'Failed to send OTP' });
  }
});




//working locally
// const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

// // Send OTP
// router.post('/send-otp', async (req, res) => {
//   const { email } = req.body;
//   if (!email || !/\S+@\S+\.\S+/.test(email)) {
//     return res.status(400).json({ message: 'Invalid email' });
//   }

//   const otp = generateOtp();
//   const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

//   try {
//     // Delete existing OTPs for this email
//     await pool.query('DELETE FROM otps WHERE email = ?', [email]);

//     // Store OTP
//     await pool.query('INSERT INTO otps (email, otp, expires_at) VALUES (?, ?, ?)', [
//       email,
//       otp,
//       expiresAt,
//     ]);

//     // Send email
//     const mailOptions = {
//       from: process.env.EMAIL_USER,
//       to: email,
//       subject: 'TaskApp OTP Verification',
//       text: `Your OTP for TaskApp registration is: ${otp}. It expires in 5 minutes.`,
//     };

//     await transporter.sendMail(mailOptions);
//     console.log(`OTP sent to ${email}: ${otp}`);
//     res.status(200).json({ message: 'OTP sent successfully' });
//   } catch (error) {
//     console.error('Error sending OTP:', error);
//     res.status(500).json({ message: 'Failed to send OTP' });
//   }
// });

// Login
router.post('/login', async (req, res) => {
  console.log('Received login request:', req.body); // Add log
  const { username, password, device } = req.body;

  const deviceType = device === 'mobile' ? 'mobile' : 'web';

  // Input validation
  if (!username || !password) {
    console.log('Validation failed: Missing fields');
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    // Find user
    const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (users.length === 0) {
      console.log('Login failed: User not found:', username);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = users[0];

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('Login failed: Invalid password for user:', username);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.user_id, username: user.username },
      process.env.JWT_SECRET,
      deviceType === 'mobile' ? { expiresIn: '30d' } : { expiresIn: '1h' }
    );

    const userData = {
      userId: user.user_id,
      username: user.username,
      email: user.email,
      phoneNumber: user.phone_number,
      role: user.role,
      accountType: user.account_type,
    };

    console.log('Login successful:', { userId: user.user_id, username }); // Add log
    res.status(200).json({ user: userData, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
// router.post('/login', async (req, res) => {
//   console.log('Received login request:', req.body); // Add log
//   const { username, password } = req.body;

//   // Input validation
//   if (!username || !password) {
//     console.log('Validation failed: Missing fields');
//     return res.status(400).json({ message: 'Username and password are required' });
//   }

//   try {
//     // Find user
//     const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
//     if (users.length === 0) {
//       console.log('Login failed: User not found:', username);
//       return res.status(401).json({ message: 'Invalid credentials' });
//     }

//     const user = users[0];

//     // Compare password
//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch) {
//       console.log('Login failed: Invalid password for user:', username);
//       return res.status(401).json({ message: 'Invalid credentials' });
//     }

//     const token = jwt.sign({ userId: user.user_id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '1h' });

//     const userData = {
//       userId: user.user_id,
//       username: user.username,
//       email: user.email,
//       phoneNumber: user.phone_number,
//       role: user.role,
//       accountType: user.account_type,
//     };

//     console.log('Login successful:', { userId: user.user_id, username }); // Add log
//     res.status(200).json({ user: userData, token });
//   } catch (error) {
//     console.error('Login error:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// Signup
router.post('/signup', async (req, res) => {
  const { username, email, phoneNumber, role, password, otp, inviteCode, accountType } = req.body;
  console.log('Received signup request:', req.body);

  if (!['User', 'Super Admin'].includes(accountType)) {
    return res.status(400).json({ message: 'Invalid account type' });
  }

  try {
    console.log(`Validating OTP for signup - Email: ${email}, OTP: ${otp}`);
    
    // First, check what OTPs exist for this email
    const [allOtps] = await pool.query('SELECT * FROM otps WHERE email = ?', [email]);
    console.log(`All OTPs in database for ${email}:`, allOtps);
    
    // Validate OTP with timezone-safe comparison
    const [otpRows] = await pool.query(
      'SELECT *, NOW() as db_current_time FROM otps WHERE email = ? AND otp = ?',
      [email, otp]
    );
    console.log(`OTP validation result for ${email}:`, otpRows);
    
    if (otpRows.length === 0) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }
    
    // Check if OTP is expired using JavaScript date comparison
    const otpRecord = otpRows[0];
    const currentTime = new Date();
    const expirationTime = new Date(otpRecord.expires_at);
    
    console.log(`Current time: ${currentTime}`);
    console.log(`OTP expires at: ${expirationTime}`);
    console.log(`Is expired: ${currentTime > expirationTime}`);
    
    if (currentTime > expirationTime) {
      return res.status(400).json({ message: 'Expired OTP' });
    }

    // Validate invite code for Super Admin
    if (accountType === 'Super Admin') {
      const [codeRows] = await pool.query('SELECT * FROM invite_codes WHERE code = ? AND used = FALSE', [inviteCode]);
      if (codeRows.length === 0) {
        return res.status(400).json({ message: 'Invalid or used invite code' });
      }
    }

    // Check for existing user
    const [existingUsers] = await pool.query(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, email]
    );
    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'Username or email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUserId = await generateId('USR', 'users', 'user_id');

    // Insert user
    const [result] = await pool.query(
      'INSERT INTO users (user_id, username, email, phone_number, role, password, account_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [newUserId, username, email, phoneNumber, role, hashedPassword, accountType]
    );

    // Mark invite code as used
    if (accountType === 'Super Admin') {
      await pool.query('UPDATE invite_codes SET used = TRUE WHERE code = ?', [inviteCode]);
    }

    // Delete OTP
    await pool.query('DELETE FROM otps WHERE email = ?', [email]);

    // console.log('Signup successful:', { userId: user.id, username });
    //res.status(201).json({ user, token });
    res.status(201).json({ message: 'Signup successful. Please login.' });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Registration failed. Please try again.' });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT user_id, username, role, account_type AS accountType, email, phone_number AS phoneNumber FROM users WHERE user_id = ?',
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'User not found' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

