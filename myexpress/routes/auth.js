import crypto from 'crypto';
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

const getUserByEmail = (email) =>
  new Promise((resolve, reject) => {
    db.get(
      `SELECT id, email, password_hash, role, is_verified, is_banned
       FROM users
       WHERE email = ?`,
      [email],
      (error, user) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(user);
      },
    );
  });

const insertUser = (email, passwordHash, verificationToken) =>
  new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO users
         (email, password_hash, role, is_verified, verification_token)
       VALUES (?, ?, 'student', 0, ?)`,
      [email, passwordHash, verificationToken],
      function onInsert(error) {
        if (error) {
          reject(error);
          return;
        }
        resolve(this.lastID);
      },
    );
  });

const verifyUserEmail = (token) =>
  new Promise((resolve, reject) => {
    db.run(
      `UPDATE users
       SET is_verified = 1, verification_token = NULL
       WHERE verification_token = ? AND is_verified = 0`,
      [token],
      function onUpdate(error) {
        if (error) {
          reject(error);
          return;
        }
        resolve(this.changes);
      },
    );
  });

router.post('/register', async (req, res) => {
  const body = req.body || {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const schoolEmailDomain = (process.env.SCHOOL_EMAIL_DOMAIN || '@fcu.edu.tw').toLowerCase();

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  if (!email.endsWith(schoolEmailDomain)) {
    return res.status(400).json({
      message: `Email must use the ${schoolEmailDomain} domain`,
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      message: 'Password must contain at least 6 characters',
    });
  }

  try {
    const existingUser = await getUserByEmail(email);

    if (existingUser) {
      return res.status(409).json({ message: 'Email is already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const userId = await insertUser(email, passwordHash, verificationToken);
    const verificationLink = `${req.protocol}://${req.get('host')}/api/auth/verify-email?token=${verificationToken}`;

    return res.status(201).json({
      message: 'Registration successful. Please verify your email.',
      user: {
        id: userId,
        email,
        role: 'student',
        is_verified: 0,
      },
      verification_link: verificationLink,
    });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT' || error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ message: 'Email is already registered' });
    }

    console.error('Registration failed:', error.message);
    return res.status(500).json({ message: 'Unable to register user' });
  }
});

router.post('/login', async (req, res) => {
  const body = req.body || {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const user = await getUserByEmail(email);

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.is_banned) {
      return res.status(403).json({ message: 'User account is banned' });
    }

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      return res.status(500).json({ message: 'JWT_SECRET is not configured' });
    }

    const token = jwt.sign(
      { userId: user.id },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    );

    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        is_verified: user.is_verified,
      },
    });
  } catch (error) {
    console.error('Login failed:', error.message);
    return res.status(500).json({ message: 'Unable to log in' });
  }
});

router.get('/verify-email', async (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';

  if (!token) {
    return res.status(400).json({ message: 'Verification token is required' });
  }

  try {
    const updatedUsers = await verifyUserEmail(token);

    if (updatedUsers === 0) {
      return res.status(400).json({ message: 'Invalid or already used verification token' });
    }

    return res.json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Email verification failed:', error.message);
    return res.status(500).json({ message: 'Unable to verify email' });
  }
});

router.get('/me', authenticateToken, (req, res) => {
  return res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      is_verified: req.user.is_verified,
    },
  });
});

export default router;