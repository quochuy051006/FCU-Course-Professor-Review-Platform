/**
 * routes/votes.js
 *
 * POST /api/reviews/:id/vote
 *
 * - Yêu cầu: authenticateToken + requireVerified
 * - Body:    { "value": 1 | -1 }
 * - Logic:
 *     + review phải tồn tại và đang visible (không vote vào review đã ẩn / xóa)
 *     + value phải là 1 hoặc -1
 *     + user không được vote review của chính mình
 *     + nếu (user_id, review_id) đã có vote -> UPDATE value
 *     + nếu chưa có -> INSERT
 * - Response trả kèm upvote_count / downvote_count để client không phải query lại.
 */

import express from 'express';
import db from '../db.js';
import { authenticateToken, requireVerified } from '../middleware/auth.js';

const router = express.Router();

// -----------------------------------------------------------------------------
// Promise wrappers cho sqlite3 callback API
// -----------------------------------------------------------------------------
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

async function getVoteCounts(reviewId) {
  const row = await get(
    `SELECT
       (SELECT COUNT(*) FROM review_votes WHERE review_id = ? AND value =  1) AS upvote_count,
       (SELECT COUNT(*) FROM review_votes WHERE review_id = ? AND value = -1) AS downvote_count`,
    [reviewId, reviewId]
  );
  return {
    upvote_count: row?.upvote_count ?? 0,
    downvote_count: row?.downvote_count ?? 0,
  };
}

// -----------------------------------------------------------------------------
// POST /api/reviews/:id/vote
// -----------------------------------------------------------------------------
router.post('/:id/vote', authenticateToken, requireVerified, async (req, res) => {
  const reviewId = parseId(req.params.id);
  if (!reviewId) {
    return res.status(400).json({ message: 'Invalid review id' });
  }

  const body = req.body || {};
  const rawValue = body.value;

  // value phải là số nguyên 1 hoặc -1
  if (
    rawValue === undefined ||
    rawValue === null ||
    !Number.isInteger(Number(rawValue)) ||
    (Number(rawValue) !== 1 && Number(rawValue) !== -1)
  ) {
    return res.status(400).json({
      message: 'value must be either 1 or -1',
    });
  }
  const value = Number(rawValue);

  try {
    // 1) Review phải tồn tại, không vote vào review đã hidden / deleted
    const review = await get(
      `SELECT id, user_id, status FROM reviews WHERE id = ?`,
      [reviewId]
    );

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (review.status !== 'visible') {
      return res.status(400).json({
        message: 'Cannot vote on a hidden or deleted review',
      });
    }

    // 2) Không cho vote review của chính mình
    if (review.user_id === req.user.id) {
      return res.status(403).json({
        message: 'You cannot vote on your own review',
      });
    }

    // 3) Nếu (user_id, review_id) đã tồn tại -> UPDATE, ngược lại INSERT
    //    Dùng INSERT ... ON CONFLICT để gọn và an toàn với UNIQUE (user_id, review_id).
    await run(
      `INSERT INTO review_votes (review_id, user_id, value)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id, review_id) DO UPDATE SET
         value = excluded.value,
         created_at = CURRENT_TIMESTAMP`,
      [reviewId, req.user.id, value]
    );

    // 4) Trả về count mới nhất
    const counts = await getVoteCounts(reviewId);

    return res.json({
      message: 'Vote saved successfully',
      review_id: reviewId,
      value,
      ...counts,
    });
  } catch (error) {
    console.error('POST /api/reviews/:id/vote failed:', error.message);
    return res.status(500).json({
      message: 'Unable to save vote',
    });
  }
});

export default router;