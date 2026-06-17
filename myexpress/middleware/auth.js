import jwt from 'jsonwebtoken';
import db from '../db.js';

export function authenticateToken(req, res, next) {
  const authorization = req.headers.authorization;
  const token = authorization && authorization.startsWith('Bearer ')
    ? authorization.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({
      message: 'Authentication token is required',
    });
  }

  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    return res.status(500).json({
      message: 'JWT_SECRET is not configured',
    });
  }

  jwt.verify(token, jwtSecret, (error, payload) => {
    if (error) {
      return res.status(401).json({
        message: 'Invalid or expired authentication token',
      });
    }

    db.get(
      `SELECT id, email, role, is_verified, is_banned, created_at
       FROM users
       WHERE id = ?`,
      [payload.userId],
      (databaseError, user) => {
        if (databaseError) {
          console.error('Failed to authenticate user:', databaseError.message);
          return res.status(500).json({
            message: 'Unable to authenticate user',
          });
        }

        if (!user) {
          return res.status(401).json({
            message: 'User account no longer exists',
          });
        }

        if (user.is_banned) {
          return res.status(403).json({
            message: 'User account is banned',
          });
        }

        req.user = user;
        return next();
      }
    );
  });
}

export function requireVerified(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      message: 'Authentication is required',
    });
  }

  if (!req.user.is_verified) {
    return res.status(403).json({
      message: 'Email verification is required',
    });
  }

  return next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      message: 'Authentication is required',
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      message: 'Admin access is required',
    });
  }

  return next();
}