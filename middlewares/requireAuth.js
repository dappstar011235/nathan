const jwt = require('jsonwebtoken');
const config = require('../config');
const { createToken, hashPassword, verifyPassword } = require('../utils/authentication');

const requireAuth = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ message: 'Authentication invalid.' });
  }

  try {
    const decodedToken = jwt.verify(token.slice(7), config.jwt.secret, {
      algorithm: 'HS256',
      expiresIn: config.jwt.expiry
    });

    req.user = decodedToken;
    req.password = hashPassword(req.body);
    next();
    
  } catch (error) {
    return res.status(401).json({
      message: error.message
    });
  }
};

module.exports = requireAuth;
