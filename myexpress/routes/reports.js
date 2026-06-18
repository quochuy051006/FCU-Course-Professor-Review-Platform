/**
 * routes/reports.js
 *
 * POST /api/reviews/:id/report
 *
 * - Yêu cầu: authenticateToken + requireVerified
 * - Body:    { "reason": "..." }
 * - Logic:
 *     + review phải tồn tại
 *     + reason.trim() không được rỗng
 *     + một user chỉ report một review một lần (UNIQUE user_id, review_id)
 *     + không cho report review của chính mình
 *     + status mặc định: 'pending'
 */

import express from 'express';
import db from '../db.js';
import { authenticateToken, requireVerified } from '../middleware/auth.js';

const router = express.Router();

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// -----------------------------------------------------------------------------
// POST /api/reviews/:id/report
// -----------------------------------------------------------------------------
router.post('/:id/report', authenticateToken, requireVerified, async (req, res) => {
  const reviewId = parseId(req.params.id);
  if (!reviewId) {
    return res.status(400).json({ message: 'Invalid review id' });
  }

  const body = req.body || {};
  const reasonRaw = body.reason;

  if (reasonRaw === undefined || reasonRaw === null) {
    return res.status(400).json({
      message: 'reason is required',
    });
  }

  if (typeof reasonRaw !== 'string') {
    return res.status(400).json({
      message: 'reason must be a string',
    });
  }

  const reason = reasonRaw.trim();
  if (!reason) {
    return res.status(400).json({
      message: 'reason must not be empty',
    });
  }

  try {
    // 1) Review phải tồn tại
    const review = await get(
      `SELECT id, user_id, status FROM reviews WHERE id = ?`,
      [reviewId]
    );

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // 2) Không cho report review của chính mình
    if (review.user_id === req.user.id) {
      return res.status(403).json({
        message: 'You cannot report your own review',
      });
    }

    // 3) Kiểm tra đã report chưa (UNIQUE user_id, review_id)
    const existing = await get(
      `SELECT id, status FROM reports WHERE user_id = ? AND review_id = ?`,
      [req.user.id, reviewId]
    );

    if (existing) {
      return res.status(400).json({
        message: 'You have already reported this review',
        report_id: existing.id,
        report_status: existing.status,
      });
    }

    // 4) Insert report mới
    const result = await run(
      `INSERT INTO reports (review_id, user_id, reason, status)
       VALUES (?, ?, ?, 'pending')`,
      [reviewId, req.user.id, reason]
    );

    return res.status(201).json({
      message: 'Report submitted successfully',
      report_id: result.lastID,
      review_id: reviewId,
    });
  } catch (error) {
    console.error('POST /api/reviews/:id/report failed:', error.message);
    return res.status(500).json({
      message: 'Unable to submit report',
    });
  }
});

export default router;