/**
 * routes/offerings.js
 *
 * GET    /api/offerings                  (public)
 * GET    /api/offerings/search?q=keyword (public)
 * GET    /api/offerings/:id              (public) - offering = (course + professor + semester)
 * GET    /api/offerings/:id/reviews      (public) - chi reviews co status = 'visible'
 * POST   /api/offerings/:id/reviews      (authenticateToken + requireVerified)
 *
 * Kien truc (CHOT):
 *   - reviews KHONG co offering_id. Review FK theo (scr_selcode, cls_id) -> classes.
 *   - offerings la lop SEARCH/DETAIL, moi offering tuong ung 1 class (course + professor + semester).
 *   - Khi client goi /:id/reviews (GET) -> lookup offering -> lay scr_selcode, cls_id
 *     -> query reviews theo 2 cot do.
 *   - Khi client POST /:id/reviews -> server lookup scr_selcode, cls_id tu offering,
 *     INSERT reviews voi 2 cot do. KHONG bao gio ghi offering_id vao reviews.
 */

import express from 'express';
import db from '../db.js';
import { authenticateToken, requireVerified } from '../middleware/auth.js';

const router = express.Router();

// -----------------------------------------------------------------------
// Helper: build offering payload
// -----------------------------------------------------------------------
function shapeOffering(row) {
  const avg = row.avg_rating == null ? null : Number(Number(row.avg_rating).toFixed(2));
  return {
    offering_id: row.offering_id,
    course_id: row.course_id,
    course_code: row.course_code,
    course_name_en: row.course_name_en,
    course_name_zh: row.course_name_zh,
    course_credits: row.course_credits,
    professor_id: row.professor_id,
    professor_name_en: row.professor_name_en,
    professor_name_zh: row.professor_name_zh,
    semester: row.semester,
    scr_selcode: row.scr_selcode,
    cls_id: row.cls_id,
    class_name: row.class_name,
    department_id: row.department_id,
    schedule: row.schedule,
    capacity: row.capacity,
    review_count: row.review_count ?? 0,
    average_rating: avg,
  };
}

// SELECT offerings + thong ke reviews (theo scr_selcode, cls_id)
const OFFERING_SELECT = `
  SELECT
    o.id          AS offering_id,
    o.semester    AS semester,
    o.scr_selcode AS scr_selcode,
    o.cls_id      AS cls_id,
    o.course_id   AS course_id,
    c.code        AS course_code,
    c.name_en     AS course_name_en,
    c.name_zh     AS course_name_zh,
    c.credits     AS course_credits,
    o.professor_id,
    p.name_en     AS professor_name_en,
    p.name_zh     AS professor_name_zh,
    cl.cls_name   AS class_name,
    cl.dept_id    AS department_id,
    cl.scr_period AS schedule,
    cl.scr_precnt AS capacity,
    (SELECT COUNT(*)
       FROM reviews r
      WHERE r.scr_selcode = o.scr_selcode
        AND r.cls_id      = o.cls_id
        AND r.status      = 'visible') AS review_count,
    (SELECT AVG(
              (r.rating_teaching_quality
             + r.rating_grading_fairness
             + r.rating_workload
             + r.rating_exam_difficulty
             + r.rating_interaction
             + r.rating_practical_value) / 6.0)
       FROM reviews r
      WHERE r.scr_selcode = o.scr_selcode
        AND r.cls_id      = o.cls_id
        AND r.status      = 'visible') AS avg_rating
  FROM offerings o
  LEFT JOIN courses     c ON c.sub_id3 = o.course_id
  LEFT JOIN professors  p ON p.id      = o.professor_id
  LEFT JOIN classes    cl ON cl.scr_selcode = o.scr_selcode
                         AND cl.cls_id      = o.cls_id
`;

// -----------------------------------------------------------------------
// GET /api/offerings
// -----------------------------------------------------------------------
router.get('/', (req, res) => {
  const requestedLimit = Number.parseInt(req.query.limit, 10);
  const requestedOffset = Number.parseInt(req.query.offset, 10);
  const limit = Number.isInteger(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, 200)
    : 200;
  const offset = Number.isInteger(requestedOffset) && requestedOffset >= 0
    ? requestedOffset
    : 0;
  const sql = OFFERING_SELECT + ` ORDER BY o.id DESC LIMIT ? OFFSET ?`;

  db.get('SELECT COUNT(*) AS total FROM offerings', [], (countErr, countRow) => {
    if (countErr) {
      console.error('GET /api/offerings (count) failed:', countErr.message);
      return res.status(500).json({ message: 'Failed to load offerings' });
    }

    db.all(sql, [limit, offset], (err, rows) => {
      if (err) {
        console.error('GET /api/offerings failed:', err.message);
        return res.status(500).json({ message: 'Failed to load offerings' });
      }

      res.json({
        count: rows.length,
        total: countRow?.total ?? 0,
        limit,
        offset,
        items: rows.map(shapeOffering),
      });
    });
  });
});

// -----------------------------------------------------------------------
// GET /api/offerings/search with optional structured filters
// -----------------------------------------------------------------------
router.get('/search', (req, res) => {
  const readFilter = (name) => (req.query[name] || '').toString().trim();
  const filters = {
    q: readFilter('q'),
    selcode: readFilter('selcode'),
    course_name: readFilter('course_name'),
    professor: readFilter('professor'),
    department: readFilter('department'),
    semester: readFilter('semester'),
    credits: readFilter('credits'),
  };

  if (!Object.values(filters).some(Boolean)) {
    return res.status(400).json({ message: 'At least one search filter is required' });
  }

  const requestedLimit = Number.parseInt(req.query.limit, 10);
  const requestedOffset = Number.parseInt(req.query.offset, 10);
  const limit = Number.isInteger(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, 200)
    : 200;
  const offset = Number.isInteger(requestedOffset) && requestedOffset >= 0
    ? requestedOffset
    : 0;
  const conditions = [];
  const params = [];

  if (filters.q) {
    const like = `%${filters.q}%`;
    conditions.push(`(
      o.course_id LIKE ? OR c.code LIKE ? OR c.name_en LIKE ? OR c.name_zh LIKE ?
      OR o.scr_selcode LIKE ? OR p.name_en LIKE ? OR p.name_zh LIKE ?
      OR cl.scr_teacher LIKE ? OR cl.dept_id LIKE ? OR cl.cls_name LIKE ?
      OR o.semester LIKE ?
    )`);
    params.push(...Array(11).fill(like));
  }

  if (filters.selcode) {
    conditions.push('o.scr_selcode LIKE ?');
    params.push(`%${filters.selcode}%`);
  }

  if (filters.course_name) {
    conditions.push('(c.name_zh LIKE ? OR c.name_en LIKE ? OR c.code LIKE ? OR o.course_id LIKE ?)');
    params.push(...Array(4).fill(`%${filters.course_name}%`));
  }

  if (filters.professor) {
    conditions.push('(p.name_zh LIKE ? OR p.name_en LIKE ? OR cl.scr_teacher LIKE ?)');
    params.push(...Array(3).fill(`%${filters.professor}%`));
  }

  if (filters.department) {
    conditions.push('(cl.dept_id LIKE ? OR cl.cls_name LIKE ? OR c.department LIKE ? OR p.department LIKE ?)');
    params.push(...Array(4).fill(`%${filters.department}%`));
  }

  if (filters.semester) {
    conditions.push('o.semester LIKE ?');
    params.push(`%${filters.semester}%`);
  }

  if (filters.credits) {
    const credits = Number(filters.credits);
    if (!Number.isFinite(credits) || credits < 0) {
      return res.status(400).json({ message: 'credits must be a non-negative number' });
    }
    conditions.push('c.credits = ?');
    params.push(credits);
  }

  const whereSql = `WHERE ${conditions.join(' AND ')}`;
  const sql = OFFERING_SELECT + whereSql + `
    ORDER BY o.id DESC
    LIMIT ? OFFSET ?
  `;
  const countSql = `
    SELECT COUNT(*) AS total
    FROM offerings o
    LEFT JOIN courses    c ON c.sub_id3 = o.course_id
    LEFT JOIN professors p ON p.id      = o.professor_id
    LEFT JOIN classes   cl ON cl.scr_selcode = o.scr_selcode
                          AND cl.cls_id      = o.cls_id
    ${whereSql}
  `;

  db.get(countSql, params, (countErr, countRow) => {
    if (countErr) {
      console.error('GET /api/offerings/search (count) failed:', countErr.message);
      return res.status(500).json({ message: 'Failed to search offerings' });
    }

    db.all(sql, [...params, limit, offset], (err, rows) => {
      if (err) {
        console.error('GET /api/offerings/search failed:', err.message);
        return res.status(500).json({ message: 'Failed to search offerings' });
      }

      res.json({
        query: filters.q,
        filters,
        count: rows.length,
        total: countRow?.total ?? 0,
        limit,
        offset,
        items: rows.map(shapeOffering),
      });
    });
  });
});

// -----------------------------------------------------------------------
// GET /api/offerings/departments
// -----------------------------------------------------------------------
router.get('/departments', (req, res) => {
  const sql = `
    SELECT
      d.dept_id,
      d.dept_name,
      COUNT(DISTINCT o.id) AS offering_count
    FROM departments d
    LEFT JOIN classes cl ON cl.dept_id = d.dept_id
    LEFT JOIN offerings o ON o.scr_selcode = cl.scr_selcode
                         AND o.cls_id      = cl.cls_id
    GROUP BY d.dept_id, d.dept_name
    ORDER BY d.dept_id ASC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('GET /api/offerings/departments failed:', err.message);
      return res.status(500).json({ message: 'Failed to load departments' });
    }

    res.json({ count: rows.length, items: rows });
  });
});

// -----------------------------------------------------------------------
// GET /api/offerings/:id
// -----------------------------------------------------------------------
router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ message: 'Invalid offering id' });
  }

  const offeringSql = `
    SELECT
      o.id          AS offering_id,
      o.semester    AS semester,
      o.scr_selcode AS scr_selcode,
      o.cls_id      AS cls_id,
      o.course_id   AS course_id,
      c.code        AS course_code,
      c.name_en     AS course_name_en,
      c.name_zh     AS course_name_zh,
      c.credits     AS course_credits,
      c.department  AS course_department,
      c.description AS course_description,
      o.professor_id,
      p.name_en     AS professor_name_en,
      p.name_zh     AS professor_name_zh,
      p.department  AS professor_department,
      p.email       AS professor_email,
      cl.dept_id    AS department_id,
      cl.cls_name   AS class_name,
      cl.scr_teacher AS original_teacher_name,
      cl.scr_period AS schedule,
      cl.scr_precnt AS capacity
    FROM offerings o
    LEFT JOIN courses     c ON c.sub_id3 = o.course_id
    LEFT JOIN professors  p ON p.id      = o.professor_id
    LEFT JOIN classes    cl ON cl.scr_selcode = o.scr_selcode
                           AND cl.cls_id      = o.cls_id
    WHERE o.id = ?
  `;

  db.get(offeringSql, [id], (err, offering) => {
    if (err) {
      console.error('GET /api/offerings/:id (offering) failed:', err.message);
      return res.status(500).json({ message: 'Failed to load offering' });
    }
    if (!offering) {
      return res.status(404).json({ message: 'Offering not found' });
    }

    const { scr_selcode, cls_id } = offering;
    const summarySql = `
      SELECT
        COUNT(*) AS review_count,
        AVG((rating_teaching_quality
           + rating_grading_fairness
           + rating_workload
           + rating_exam_difficulty
           + rating_interaction
           + rating_practical_value) / 6.0) AS average_rating,
        AVG(rating_teaching_quality)   AS average_teaching_quality,
        AVG(rating_grading_fairness)   AS average_grading_fairness,
        AVG(rating_workload)           AS average_workload,
        AVG(rating_exam_difficulty)    AS average_exam_difficulty,
        AVG(rating_interaction)        AS average_interaction,
        AVG(rating_practical_value)    AS average_practical_value
      FROM reviews
      WHERE scr_selcode = ? AND cls_id = ? AND status = 'visible'
    `;

    db.get(summarySql, [scr_selcode, cls_id], (sumErr, sumRow) => {
      if (sumErr) {
        console.error('GET /api/offerings/:id (summary) failed:', sumErr.message);
        return res.status(500).json({ message: 'Failed to load review summary' });
      }

      const r2 = (v) => (v == null ? null : Number(Number(v).toFixed(2)));
      const summary = {
        review_count:                  sumRow?.review_count ?? 0,
        average_rating:                r2(sumRow?.average_rating),
        average_teaching_quality:      r2(sumRow?.average_teaching_quality),
        average_grading_fairness:      r2(sumRow?.average_grading_fairness),
        average_workload:              r2(sumRow?.average_workload),
        average_exam_difficulty:       r2(sumRow?.average_exam_difficulty),
        average_interaction:           r2(sumRow?.average_interaction),
        average_practical_value:       r2(sumRow?.average_practical_value),
      };

      const tagsSql = `
        SELECT t.id, t.name_zh, t.name_en, COUNT(*) AS count
        FROM review_tags rt
        JOIN reviews r ON r.id = rt.review_id
        JOIN tags    t ON t.id = rt.tag_id
        WHERE r.scr_selcode = ? AND r.cls_id = ? AND r.status = 'visible'
        GROUP BY t.id
        ORDER BY count DESC, t.id ASC
        LIMIT 10
      `;

      db.all(tagsSql, [scr_selcode, cls_id], (tagErr, tagRows) => {
        if (tagErr) {
          console.error('GET /api/offerings/:id (tags) failed:', tagErr.message);
          return res.status(500).json({ message: 'Failed to load popular tags' });
        }

        const popularTags = (tagRows || []).map((t) => ({
          id: t.id, name_zh: t.name_zh, name_en: t.name_en, count: t.count,
        }));

        res.json({
          offering: {
            offering_id:  offering.offering_id,
            semester:     offering.semester,
            scr_selcode:  offering.scr_selcode,
            cls_id:       offering.cls_id,
          },
          course: {
            course_id:   offering.course_id,
            course_code: offering.course_code,
            name_en:     offering.course_name_en,
            name_zh:     offering.course_name_zh,
            credits:     offering.course_credits,
            department:  offering.course_department,
            description: offering.course_description,
          },
          class_information: {
            selection_code: offering.scr_selcode,
            class_id:      offering.cls_id,
            class_name:    offering.class_name,
            department_id: offering.department_id,
            schedule:      offering.schedule,
            capacity:      offering.capacity,
          },
          professor: {
            professor_id:     offering.professor_id,
            name_en:          offering.professor_name_en,
            name_zh:          offering.professor_name_zh,
            professor_department: offering.professor_department,
            professor_email:      offering.professor_email,
            original_name:        offering.original_teacher_name,
          },
          review_summary: summary,
          popular_tags:   popularTags,
        });
      });
    });
  });
});

// -----------------------------------------------------------------------
// GET /api/offerings/:id/reviews  (public, chi visible)
// -----------------------------------------------------------------------
router.get('/:id/reviews', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ message: 'Invalid offering id' });
  }

  db.get(`SELECT scr_selcode, cls_id FROM offerings WHERE id = ?`, [id], (oErr, offering) => {
    if (oErr) {
      console.error('GET /api/offerings/:id/reviews (offering check) failed:', oErr.message);
      return res.status(500).json({ message: 'Failed to load reviews' });
    }
    if (!offering) {
      return res.status(404).json({ message: 'Offering not found' });
    }

    const { scr_selcode, cls_id } = offering;
    const reviewsSql = `
      SELECT
        r.id,
        r.is_anonymous,
        u.email AS user_email,
        r.rating_teaching_quality,
        r.rating_grading_fairness,
        r.rating_workload,
        r.rating_exam_difficulty,
        r.rating_interaction,
        r.rating_practical_value,
        r.comment,
        r.advice,
        r.created_at,
        r.updated_at,
        (SELECT COUNT(*) FROM review_votes v WHERE v.review_id = r.id AND v.value =  1) AS upvote_count,
        (SELECT COUNT(*) FROM review_votes v WHERE v.review_id = r.id AND v.value = -1) AS downvote_count
      FROM reviews r
      LEFT JOIN users u ON u.id = r.user_id
      WHERE r.scr_selcode = ? AND r.cls_id = ? AND r.status = 'visible'
      ORDER BY r.created_at DESC
      LIMIT 100
    `;

    db.all(reviewsSql, [scr_selcode, cls_id], (rErr, reviewRows) => {
      if (rErr) {
        console.error('GET /api/offerings/:id/reviews (list) failed:', rErr.message);
        return res.status(500).json({ message: 'Failed to load reviews' });
      }

      const reviewIds = reviewRows.map((r) => r.id);
      if (reviewIds.length === 0) {
        return res.json({ count: 0, items: [] });
      }

      const placeholders = reviewIds.map(() => '?').join(',');
      const tagsSql = `
        SELECT rt.review_id, t.id, t.name_zh, t.name_en
        FROM review_tags rt
        JOIN tags t ON t.id = rt.tag_id
        WHERE rt.review_id IN (${placeholders})
      `;

      db.all(tagsSql, reviewIds, (tErr, tagRows) => {
        if (tErr) {
          console.error('GET /api/offerings/:id/reviews (tags) failed:', tErr.message);
          return res.status(500).json({ message: 'Failed to load review tags' });
        }

        const tagsByReview = new Map();
        for (const tr of tagRows) {
          if (!tagsByReview.has(tr.review_id)) tagsByReview.set(tr.review_id, []);
          tagsByReview.get(tr.review_id).push({
            id: tr.id, name_zh: tr.name_zh, name_en: tr.name_en,
          });
        }

        const items = reviewRows.map((r) => {
          const isAnon = !!r.is_anonymous;
          let authorName;
          if (isAnon) {
            authorName = '匿名學生';
          } else if (r.user_email) {
            authorName = r.user_email.split('@')[0];
          } else {
            authorName = 'FCU student';
          }

          return {
            id: r.id,
            author_name: authorName,
            is_anonymous: isAnon ? 1 : 0,
            rating_teaching_quality:  r.rating_teaching_quality,
            rating_grading_fairness:  r.rating_grading_fairness,
            rating_workload:          r.rating_workload,
            rating_exam_difficulty:   r.rating_exam_difficulty,
            rating_interaction:       r.rating_interaction,
            rating_practical_value:   r.rating_practical_value,
            comment:  r.comment,
            advice:  r.advice,
            tags:    tagsByReview.get(r.id) || [],
            upvote_count:   r.upvote_count,
            downvote_count: r.downvote_count,
            created_at: r.created_at,
            updated_at: r.updated_at,
          };
        });

        res.json({ count: items.length, items });
      });
    });
  });
});

// -----------------------------------------------------------------------
// POST /api/offerings/:id/reviews
// Can authenticateToken + requireVerified.
// Mot user chi review 1 lan cho 1 class (UNIQUE user_id, scr_selcode, cls_id).
//
// Luu y kien truc:
//   - offerings chi la lop search/detail. Khi user muon review 1 offering,
//     server lookup scr_selcode, cls_id tu offering do va INSERT reviews voi 2 cot day.
//   - reviews KHONG bao gio nhan offering_id.
// -----------------------------------------------------------------------
router.post('/:id/reviews', authenticateToken, requireVerified, (req, res) => {
  const offeringId = parseInt(req.params.id, 10);
  if (Number.isNaN(offeringId)) {
    return res.status(400).json({ message: 'Invalid offering id' });
  }

  const body = req.body || {};
  const comment = (body.comment || '').toString().trim();
  if (!comment) {
    return res.status(400).json({ message: 'comment is required and must not be empty' });
  }

  const ratingFields = [
    'rating_teaching_quality',
    'rating_grading_fairness',
    'rating_workload',
    'rating_exam_difficulty',
    'rating_interaction',
    'rating_practical_value',
  ];
  const ratings = {};
  for (const f of ratingFields) {
    const v = Number(body[f]);
    if (!Number.isInteger(v) || v < 1 || v > 5) {
      return res.status(400).json({
        message: `${f} must be an integer between 1 and 5`,
      });
    }
    ratings[f] = v;
  }

  let isAnonymous;
  if (typeof body.is_anonymous === 'boolean') {
    isAnonymous = body.is_anonymous ? 1 : 0;
  } else if (typeof body.is_anonymous === 'number') {
    isAnonymous = body.is_anonymous ? 1 : 0;
  } else if (typeof body.is_anonymous === 'string') {
    isAnonymous = ['1', 'true', 'yes'].includes(body.is_anonymous.toLowerCase()) ? 1 : 0;
  } else {
    isAnonymous = 0;
  }

  const advice = body.advice == null ? null : String(body.advice);
  const tagIds = Array.isArray(body.tag_ids) ? body.tag_ids.map(Number).filter(Number.isInteger) : [];

  // 1) Offering phai ton tai -> lay scr_selcode, cls_id
  db.get(`SELECT scr_selcode, cls_id FROM offerings WHERE id = ?`, [offeringId], (oErr, offering) => {
    if (oErr) {
      console.error('POST /api/offerings/:id/reviews (offering check) failed:', oErr.message);
      return res.status(500).json({ message: 'Failed to create review' });
    }
    if (!offering) {
      return res.status(404).json({ message: 'Offering not found' });
    }

    const { scr_selcode, cls_id } = offering;
    const userId = req.user.id;

    // 2) User da review class nay chua?
    db.get(
      `SELECT id FROM reviews WHERE user_id = ? AND scr_selcode = ? AND cls_id = ?`,
      [userId, scr_selcode, cls_id],
      (chkErr, existing) => {
        if (chkErr) {
          console.error('POST /api/offerings/:id/reviews (duplicate check) failed:', chkErr.message);
          return res.status(500).json({ message: 'Failed to create review' });
        }
        if (existing) {
          return res.status(400).json({
            message: 'You have already reviewed this class',
            review_id: existing.id,
          });
        }

        // 3) Insert review - theo (scr_selcode, cls_id), KHONG CO offering_id.
        const insertSql = `
          INSERT INTO reviews
            (scr_selcode, cls_id, user_id, is_anonymous,
             rating_teaching_quality, rating_grading_fairness, rating_workload,
             rating_exam_difficulty, rating_interaction, rating_practical_value,
             comment, advice, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'visible')
        `;
        const params = [
          scr_selcode, cls_id, userId, isAnonymous,
          ratings.rating_teaching_quality, ratings.rating_grading_fairness, ratings.rating_workload,
          ratings.rating_exam_difficulty, ratings.rating_interaction, ratings.rating_practical_value,
          comment, advice,
        ];

        db.run(insertSql, params, function (insErr) {
          if (insErr) {
            console.error('POST /api/offerings/:id/reviews (insert) failed:', insErr.message);
            return res.status(500).json({ message: 'Failed to create review' });
          }
          const reviewId = this.lastID;

          const insertTags = () => {
            if (tagIds.length === 0) {
              return res.status(201).json({
                message: 'Review created successfully',
                review_id: reviewId,
              });
            }
            const placeholders = tagIds.map(() => '?').join(',');
            db.all(
              `SELECT id FROM tags WHERE id IN (${placeholders})`,
              tagIds,
              (tgErr, validTags) => {
                if (tgErr) {
                  console.error('POST tag validate failed:', tgErr.message);
                  return res.status(201).json({
                    message: 'Review created, but tag validation failed',
                    review_id: reviewId,
                  });
                }
                const validIds = validTags.map((t) => t.id);
                if (validIds.length === 0) {
                  return res.status(201).json({
                    message: 'Review created (no valid tags)',
                    review_id: reviewId,
                  });
                }
                const stmt = db.prepare(`INSERT OR IGNORE INTO review_tags (review_id, tag_id) VALUES (?, ?)`);
                let inserted = 0;
                let done = 0;
                validIds.forEach((tid) => {
                  stmt.run(reviewId, tid, (rErr) => {
                    done++;
                    if (!rErr) inserted++;
                    if (done === validIds.length) {
                      stmt.finalize();
                      return res.status(201).json({
                        message: 'Review created successfully',
                        review_id: reviewId,
                        tags_attached: inserted,
                      });
                    }
                  });
                });
              }
            );
          };

          insertTags();
        });
      }
    );
  });
});

export default router;
