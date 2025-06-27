// middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // console.log(decoded)
    req.user = {
      id: decoded.userId,
      username: decoded.username, // ✅ include both
    };
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

module.exports = authMiddleware;


// Middleware to check Super Admin
// const superAdminMiddleware = async (req, res, next) => {
//   if (req.user.accountType !== 'Super Admin') {
//     return res.status(403).json({ message: 'Access denied: Super Admin only' });
//   }
//   next();
// };

// module.exports = {authMiddleware,superAdminMiddleware}
