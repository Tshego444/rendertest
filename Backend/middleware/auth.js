// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../Models/User'); // adjust path

const verifyToken = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).send("Missing or invalid Authorization header");
    }
    const token = header.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // optional: load fresh user from DB
    const user = await User.findById(payload.id);
    if (!user) return res.status(401).send("User not found");
    // attach minimal user info
    req.user = { id: user._id.toString(), userType: user.userType, profileId: user.profileId };
    next();
  } catch (err) {
    console.error("verifyToken error:", err);
    return res.status(401).send("Invalid or expired token");
  }
};

const ensureRole = (role) => (req, res, next) => {
  if (!req.user) return res.status(401).send("Not authenticated");
  if (req.user.userType !== role && req.user.userType !== 'admin') {
    return res.status(403).send("Access denied");
  }
  next();
};

module.exports = { verifyToken, ensureRole };
