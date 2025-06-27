const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const pool = require('../config/db');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { generateId } = require('../utils/idGenerator');
const sgMail = require('@sendgrid/mail');


require('dotenv').config();

// Set SendGrid API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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

  try {
    // Delete any existing OTP for the email
    await pool.query('DELETE FROM otps WHERE email = ?', [email]);

    // Store the new OTP
    await pool.query(
      'INSERT INTO otps (email, otp, expires_at) VALUES (?, ?, ?)',
      [email, otp, expiresAt]
    );

    // Send the OTP email
    const msg = {
      to: email,
      from: process.env.FROM_EMAIL,
      subject: 'Your TaskApp OTP Code',
      text: `Your OTP for TaskApp is ${otp}. It expires in 5 minutes.`,
      html: `<strong>Your OTP for TaskApp is ${otp}</strong><br/><p>It expires in 5 minutes.</p>`,
    };

    await sgMail.send(msg);
    console.log(`OTP sent to ${email}: ${otp}`);
    res.status(200).json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Error sending OTP:', error.response?.body || error.message);
    res.status(500).json({ message: 'Failed to send OTP' });
  }
});


// Login
router.post('/login', async (req, res) => {
  console.log('Received login request:', req.body); // Add log
  const { username, password } = req.body;

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

    const token = jwt.sign({ userId: user.user_id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '1h' });

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

// Signup
router.post('/signup', async (req, res) => {
  const { username, email, phoneNumber, role, password, otp, inviteCode, accountType } = req.body;
  console.log('Received signup request:', req.body);

  if (!['User', 'Super Admin'].includes(accountType)) {
    return res.status(400).json({ message: 'Invalid account type' });
  }

  try {
    // Validate OTP
    const [otpRows] = await pool.query(
      'SELECT * FROM otps WHERE email = ? AND otp = ? AND expires_at > NOW()',
      [email, otp]
    );
    if (otpRows.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
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

