const axios = require('axios');
const pool = require('../config/db');

async function sendPushNotification(username, title, body) {
  console.log('[Push] Attempting to send notification...');
  console.log('[Push] Inputs:', { username, title, body });

  try {
    // Step 1: Get user_id from username
    const [userRows] = await pool.query(
      'SELECT user_id FROM users WHERE username = ?',
      [username]
    );

    if (!userRows.length) {
      console.warn(`[Push] No user found with username: ${username}`);
      return;
    }

    const userId = userRows[0].user_id;
    console.log('[Push] Fetched user_id:', userId);

    // Step 2: Get push token from user_id
    const [tokenRows] = await pool.query(
      'SELECT expo_push_token FROM user_push_tokens WHERE user_id = ?',
      [userId]
    );

    console.log('[Push] Fetched tokens from DB:', tokenRows);

    if (!tokenRows.length) {
      console.warn(`[Push] No push token found for user_id: ${userId}`);
      return;
    }

    const expoPushToken = tokenRows[0].expo_push_token;
    console.log('[Push] Found expo token:', expoPushToken);

    if (!expoPushToken || !expoPushToken.startsWith('ExponentPushToken')) {
      console.warn('[Push] Invalid or missing Expo token. Aborting.');
      return;
    }

    // Step 3: Send notification
    const payload = {
      to: expoPushToken,
      title,
      body,
      sound: 'default',
    };

    console.log('[Push] Sending notification payload:', payload);

    const response = await axios.post('https://exp.host/--/api/v2/push/send', payload, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
    });

    console.log('[Push] Push notification response:', response.data);
  } catch (error) {
    console.error('[Push] Failed to send push notification:', error.message);
    if (error.response) {
      console.error('[Push] Response error:', error.response.data);
    }
  }
}

module.exports = { sendPushNotification };
