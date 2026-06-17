/**
 * routes/professors.js
 *
 * GET /api/professors
 *
 * Tra ve danh sach giang vien.
 * Moi item gom: id, name_en (null neu chua co), name_zh, department, email.
 *
 * API public, khong can auth.
 */

import express from 'express';
import db from '../db.js';

const router = express.Router();

router.get('/', (req, res) => {
  const sql = `
    SELECT
      id,
      name_en,
      name_zh,
      department,
      email
    FROM professors
    ORDER BY name_zh
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('GET /api/professors failed:', err.message);
      return res.status(500).json({ message: 'Failed to load professors' });
    }
    res.json({ count: rows.length, items: rows });
  });
});

export default router;
