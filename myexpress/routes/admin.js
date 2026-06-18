/**
 * routes/admin.js
 *
 * Tất cả route dưới đây yêu cầu: authenticateToken + requireAdmin
 *
 *   GET   /api/admin/reports                 - danh sách report status='pending'
 *   PUT   /api/admin/reviews/:id/hide        - ẩn review (status = 'hidden')
 *   PUT   /api/admin/reports/:id/resolve     - đánh dấu report đã xử lý
 *
 * Lưu ý:
 * - reviews FK theo (scr_selcode, cls_id) -> classes.
 *   JOIN: reviews -> classes -> offerings -> courses / professors (LEFT JOIN).
 *   Tất cả các bảng này đều tồn tại trong schema (initSchema.js).
 */

import express from 'express';
import db from '../db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Áp dụng auth cho toàn bộ router
router.use(authenticateToken);
router.use(requireAdmin);

// -----------------------------------------------------------------------------
// Promise wrappers
// -----------------------------------------------------------------------------
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
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

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// -----------------------------------------------------------------------------
// GET /api/admin/reports
// Trả về danh sách report đang pending, JOIN đầy đủ để frontend dùng luôn.
// -----------------------------------------------------------------------------
router.get('/reports', async (req, res) => {
  try {
    const sql = `
      SELECT
        rep.id              AS report_id,
        rep.reason          AS reason,
        rep.status          AS report_status,
        rep.created_at      AS report_created_at,

        -- Reporter
        reporter.id         AS reporter_user_id,
        reporter.email      AS reporter_email,

        -- Review
        rev.id              AS review_id,
        rev.status          AS review_status,
        rev.is_anonymous    AS is_anonymous,
        rev.comment         AS comment,
        rev.advice          AS advice,
        rev.rating_teaching_quality,
        rev.rating_grading_fairness,
        rev.rating_workload,
        rev.rating_exam_difficulty,
        rev.rating_interaction,
        rev.rating_practical_value,
        rev.created_at      AS review_created_at,

        -- Review author
        author.id           AS review_author_user_id,
        author.email        AS review_author_email,

        -- Class relation (FK của reviews)
        rev.scr_selcode     AS scr_selcode,
        rev.cls_id          AS cls_id,

        -- Offering (LEFT JOIN vì có thể không tồn tại)
        off.id              AS offering_id,
        off.semester        AS semester,

        -- Course + Professor (LEFT JOIN)
        c.sub_id3           AS course_id,
        c.code              AS course_code,
        c.name_en           AS course_name_en,
        c.name_zh           AS course_name_zh,
        p.id                AS professor_id,
        p.name_en           AS professor_name_en,
        p.name_zh           AS professor_name_zh
      FROM reports rep
      JOIN reviews     rev      ON rev.id = rep.review_id
      JOIN users       reporter ON reporter.id = rep.user_id
      LEFT JOIN users  author   ON author.id   = rev.user_id
      LEFT JOIN classes cl      ON cl.scr_selcode = rev.scr_selcode
                               AND cl.cls_id      = rev.cls_id
      LEFT JOIN offerings off   ON off.scr_selcode = rev.scr_selcode
                               AND off.cls_id      = rev.cls_id
      LEFT JOIN courses c       ON c.sub_id3 = off.course_id
      LEFT JOIN professors p    ON p.id = off.professor_id
      WHERE rep.status = 'pending'
      ORDER BY rep.created_at DESC, rep.id DESC
    `;

    const rows = await all(sql, []);

    const items = rows.map((r) => ({
      report_id: r.report_id,
      reason: r.reason,
      report_status: r.report_status,
      report_created_at: r.report_created_at,

      reporter: {
        user_id: r.reporter_user_id,
        email: r.reporter_email,
      },

      review: {
        review_id: r.review_id,
        review_status: r.review_status,
        is_anonymous: r.is_anonymous,
        comment: r.comment,
        advice: r.advice,
        rating_teaching_quality: r.rating_teaching_quality,
        rating_grading_fairness: r.rating_grading_fairness,
        rating_workload: r.rating_workload,
        rating_exam_difficulty: r.rating_exam_difficulty,
        rating_interaction: r.rating_interaction,
        rating_practical_value: r.rating_practical_value,
        created_at: r.review_created_at,
      },

      review_author: {
        user_id: r.review_author_user_id,
        email: r.review_author_email,
      },

      class_relation: {
        scr_selcode: r.scr_selcode,
        cls_id: r.cls_id,
      },

      offering: r.offering_id
        ? {
            offering_id: r.offering_id,
            semester: r.semester,
          }
        : null,

      course: r.course_id
        ? {
            course_id: r.course_id,
            course_code: r.course_code,
            name_en: r.course_name_en,
            name_zh: r.course_name_zh,
          }
        : null,

      professor: r.professor_id
        ? {
            professor_id: r.professor_id,
            name_en: r.professor_name_en,
            name_zh: r.professor_name_zh,
          }
        : null,
    }));

    return res.json({
      count: items.length,
      items,
    });
  } catch (error) {
    console.error('GET /api/admin/reports failed:', error.message);
    return res.status(500).json({
      message: 'Unable to load reports',
    });
  }
});

// -----------------------------------------------------------------------------
// PUT /api/admin/reviews/:id/hide
// Set review.status = 'hidden'. Không xóa thật.
// -----------------------------------------------------------------------------
router.put('/reviews/:id/hide', async (req, res) => {
  const reviewId = parseId(req.params.id);
  if (!reviewId) {
    return res.status(400).json({ message: 'Invalid review id' });
  }

  try {
    const review = await get(
      `SELECT id, status FROM reviews WHERE id = ?`,
      [reviewId]
    );

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (review.status === 'hidden') {
      return res.json({
        message: 'Review is already hidden',
        review_id: reviewId,
      });
    }

    if (review.status === 'deleted') {
      return res.status(400).json({
        message: 'Deleted reviews cannot be hidden, only restored by owner',
        review_id: reviewId,
      });
    }

    await run(
      `UPDATE reviews
       SET status = 'hidden',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [reviewId]
    );

    return res.json({
      message: 'Review hidden successfully',
      review_id: reviewId,
    });
  } catch (error) {
    console.error('PUT /api/admin/reviews/:id/hide failed:', error.message);
    return res.status(500).json({
      message: 'Unable to hide review',
    });
  }
});

// -----------------------------------------------------------------------------
// PUT /api/admin/reports/:id/resolve
// Set reports.status = 'resolved'.
// -----------------------------------------------------------------------------
router.put('/reports/:id/resolve', async (req, res) => {
  const reportId = parseId(req.params.id);
  if (!reportId) {
    return res.status(400).json({ message: 'Invalid report id' });
  }

  try {
    const report = await get(
      `SELECT id, status FROM reports WHERE id = ?`,
      [reportId]
    );

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    if (report.status === 'resolved') {
      return res.json({
        message: 'Report is already resolved',
        report_id: reportId,
      });
    }

    await run(
      `UPDATE reports SET status = 'resolved' WHERE id = ?`,
      [reportId]
    );

    return res.json({
      message: 'Report resolved successfully',
      report_id: reportId,
    });
  } catch (error) {
    console.error('PUT /api/admin/reports/:id/resolve failed:', error.message);
    return res.status(500).json({
      message: 'Unable to resolve report',
    });
  }
});

export default router;