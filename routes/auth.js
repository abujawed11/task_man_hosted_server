const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const pool = require('../config/db');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { generateId } = require('../utils/idGenerator');
const axios = require('axios');
const crypto = require('crypto');


require('dotenv').config();


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
  
  console.log(`Generated OTP for ${email}: ${otp}`);

  try {
    // Delete any existing OTP for the email
    await pool.query('DELETE FROM otps WHERE email = ?', [email]);

    // Store the new OTP using MySQL's NOW() and INTERVAL for consistent timezone
    await pool.query(
      'INSERT INTO otps (email, otp, created_at, expires_at) VALUES (?, ?, NOW(), NOW() + INTERVAL 5 MINUTE)',
      [email, otp]
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

// Forgot Password - Send reset token to email
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    return res.status(400).json({ message: 'Valid email is required' });
  }

  try {
    // Check if user exists
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(400).json({ message: 'Email not registered. Please check your email or sign up.' });
    }

    const otp = generateOtp();

    console.log(`Generated password reset OTP for ${email}: ${otp}`);

    // Delete any existing OTP for the email
    await pool.query('DELETE FROM otps WHERE email = ?', [email]);

    // Store the new OTP using MySQL's NOW() and INTERVAL for consistent timezone
    await pool.query(
      'INSERT INTO otps (email, otp, created_at, expires_at) VALUES (?, ?, NOW(), NOW() + INTERVAL 5 MINUTE)',
      [email, otp]
    );

    console.log(`Stored password reset OTP in database for ${email}: ${otp}`);

    // Send the password reset OTP email via Brevo
    await sendEmailWithBrevo(
      email,
      'Password Reset OTP - TaskApp',
      `Your password reset OTP for TaskApp is ${otp}. It expires in 5 minutes.`,
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; text-align: center;">Password Reset Request</h2>
          <p>You requested a password reset for your TaskApp account.</p>
          <p>Use the OTP below to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <div style="background-color: #FCD34D; color: #000; padding: 20px; border-radius: 8px; font-weight: bold; font-size: 24px; letter-spacing: 3px; display: inline-block;">
              ${otp}
            </div>
          </div>
          <p><strong>This OTP expires in 5 minutes.</strong></p>
          <p>If you didn't request this password reset, please ignore this email.</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">This is an automated email from TaskApp. Please do not reply.</p>
        </div>
      `
    );

    console.log(`Password reset OTP sent to ${email}: ${otp}`);
    res.status(200).json({ message: 'If the email exists, an OTP has been sent' });
  } catch (error) {
    console.error('Error in forgot password:', error.response?.body || error.message);
    res.status(500).json({ message: 'Failed to process password reset request' });
  }
});

// Reset Password - Verify OTP and update password
router.post('/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.status(400).json({ message: 'Email, OTP, and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long' });
  }

  try {
    console.log(`Validating password reset OTP - Email: ${email}, OTP: ${otp}`);
    
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

    // Check if user exists
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(400).json({ message: 'User not found' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    await pool.query('UPDATE users SET password = ? WHERE email = ?', [
      hashedPassword,
      email
    ]);

    // Delete OTP after successful reset
    await pool.query('DELETE FROM otps WHERE email = ?', [email]);

    console.log(`Password reset successful for email: ${email}`);
    res.status(200).json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Error in reset password:', error);
    res.status(500).json({ message: 'Failed to reset password' });
  }
});

module.exports = router;

