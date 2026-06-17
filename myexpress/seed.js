/**
 * seed.js
 *
 * File seed CHINH THUC cua backend FCU Review Platform.
 *
 * Chay:
 *   node seed.js
 *
 * Lam gi:
 *   1) Dam bao schema (goi runInitSchema() in-process)
 *   2) Seed users demo voi password_hash BCRYPT that:
 *        admin@fcu.edu.tw          / admin123
 *        student1@fcu.edu.tw       / student123
 *        student2@fcu.edu.tw       / student123
 *        unverified@fcu.edu.tw     / student123
 *   3) Seed sample reviews - CHOT theo (scr_selcode, cls_id) (FK -> classes),
 *      KHONG dung offering_id. Chi dung `offerings` nhu lop search de chon
 *      3 class dau tien co offering.
 *   4) Seed review_tags / review_votes / reports mau
 *
 * Idempotent - co the chay nhieu lan.
 */

import sqlite3 from 'sqlite3';
import bcrypt from 'bcrypt';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { runInitSchema } from './initSchema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sqlite3Verbose = sqlite3.verbose();
const db = new sqlite3Verbose.Database(path.join(__dirname, 'database.sqlite'));

db.run('PRAGMA foreign_keys = ON');

const SALT_ROUNDS = 10;

// -----------------------------------------------------------------------------
// Helpers
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
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function ensureUser({ email, password, role, isVerified, isBanned = 0 }) {
  const existing = await get(`SELECT id FROM users WHERE email = ?`, [email]);
  if (existing) {
    console.log(`[seed] user exists: ${email} (id=${existing.id})`);
    return existing.id;
  }
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const res = await run(
    `INSERT INTO users (email, password_hash, role, is_verified, verification_token, is_banned)
     VALUES (?, ?, ?, ?, NULL, ?)`,
    [email, passwordHash, role, isVerified ? 1 : 0, isBanned]
  );
  console.log(`[seed] user created: ${email} (id=${res.lastID}, role=${role}, verified=${isVerified})`);
  return res.lastID;
}

// Map name_en -> tag_id, de review seed khong phu thuoc vao ID tang dan.
async function buildTagMap() {
  const rows = await all(`SELECT id, name_en FROM tags`);
  const m = new Map();
  for (const r of rows) m.set(r.name_en, r.id);
  return m;
}

async function resolveTagIds(tagMap, names) {
  const out = [];
  for (const n of names) {
    const id = tagMap.get(n);
    if (id == null) {
      console.warn(`[seed] tag khong tim thay theo name_en='${n}' (bo qua)`);
    } else {
      out.push(id);
    }
  }
  return out;
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------
(async () => {
  try {
    console.log('[seed] === Step 1: ensure schema ===');
    await runInitSchema();

    console.log('\n[seed] === Step 2: seed users ===');
    const adminId      = await ensureUser({ email: 'admin@fcu.edu.tw',      password: 'admin123',    role: 'admin',   isVerified: true });
    const student1Id   = await ensureUser({ email: 'student1@fcu.edu.tw',   password: 'student123',  role: 'student', isVerified: true });
    const student2Id   = await ensureUser({ email: 'student2@fcu.edu.tw',   password: 'student123',  role: 'student', isVerified: true });
    const unverifiedId = await ensureUser({ email: 'unverified@fcu.edu.tw', password: 'student123',  role: 'student', isVerified: false });

    console.log('\n[seed] === Step 3: seed sample reviews ===');

    // Lay 3 offering dau tien co trong DB (offerings chi de chon class can review).
    // Review that su FK theo (scr_selcode, cls_id) -> classes, KHONG co offering_id.
    const offerings = await all(`SELECT id, scr_selcode, cls_id, course_id, professor_id FROM offerings ORDER BY id LIMIT 3`);
    if (offerings.length === 0) {
      throw new Error('Khong co offerings nao trong DB. Hay chay initSchema.js truoc.');
    }
    console.log(`[seed] using offerings: ${offerings.map(o => o.id).join(', ')}`);

    // Build tag map name_en -> id de khong phu thuoc ID.
    const tagMap = await buildTagMap();

    // Reviews mau: moi student review mot vai class (offering) dau tien.
    // tags duoc luu theo name_en, server resolve sang id ben duoi.
    const reviews = [
      {
        user_id: student1Id, offering: offerings[0], is_anonymous: 0,
        rating_teaching_quality: 5, rating_grading_fairness: 4, rating_workload: 3,
        rating_exam_difficulty: 3, rating_interaction: 5, rating_practical_value: 5,
        comment: 'Giao vien giang rat nhiet tinh, vi du thuc te de hieu.',
        advice:  'Nen di som vi dau gio hay choi tro nho warm-up.',
        tags_en: ['Heavy Workload', 'Friendly Teacher', 'Clear Explanations'],
      },
      {
        user_id: student2Id, offering: offerings[0], is_anonymous: 1,
        rating_teaching_quality: 4, rating_grading_fairness: 4, rating_workload: 4,
        rating_exam_difficulty: 4, rating_interaction: 3, rating_practical_value: 4,
        comment: 'Mon hay, on tap vua du, thi vua phai. Phai lam bai tap lon theo nhom.',
        advice:  'Phai quan ly thoi gian tot, deadline cuoi ky chen nhau.',
        tags_en: ['Moderate Workload', 'Light Workload', 'Easy Exams'],
      },
      {
        user_id: student1Id, offering: offerings[1], is_anonymous: 0,
        rating_teaching_quality: 3, rating_grading_fairness: 3, rating_workload: 2,
        rating_exam_difficulty: 5, rating_interaction: 2, rating_practical_value: 3,
        comment: 'Giang hoi kho theo, can nen tai lieu them o nha.',
        advice:  'Doc truoc slide + xem YouTube de khong bi lac.',
        tags_en: ['Hard Exams', 'Unclear Explanations'],
      },
      {
        user_id: student2Id, offering: offerings[2], is_anonymous: 0,
        rating_teaching_quality: 5, rating_grading_fairness: 5, rating_workload: 2,
        rating_exam_difficulty: 2, rating_interaction: 5, rating_practical_value: 5,
        comment: 'Rat recommend! Thay vi minh hoa cac thuat toan bang code that.',
        advice:  'Lam bai tap tren HackerRank truoc khi den lop.',
        tags_en: ['Friendly Teacher', 'Recommended', 'Practical'],
      },
    ];

    const createdReviewIds = [];
    for (const r of reviews) {
      const { scr_selcode, cls_id } = r.offering;
      if (!scr_selcode || !cls_id) {
        console.warn(`[seed] offering ${r.offering.id} missing scr_selcode/cls_id - skip`);
        continue;
      }

      // Idempotent: check UNIQUE (user_id, scr_selcode, cls_id)
      const existing = await get(
        `SELECT id FROM reviews WHERE user_id = ? AND scr_selcode = ? AND cls_id = ?`,
        [r.user_id, scr_selcode, cls_id]
      );
      let reviewId;
      if (existing) {
        console.log(`[seed] review exists user=${r.user_id} offering=${r.offering.id} (id=${existing.id})`);
        reviewId = existing.id;
      } else {
        try {
          // INSERT reviews theo (scr_selcode, cls_id) - KHONG co offering_id.
          const res = await run(
            `INSERT INTO reviews
               (scr_selcode, cls_id, user_id, is_anonymous,
                rating_teaching_quality, rating_grading_fairness, rating_workload,
                rating_exam_difficulty, rating_interaction, rating_practical_value,
                comment, advice, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'visible')`,
            [
              scr_selcode, cls_id, r.user_id, r.is_anonymous,
              r.rating_teaching_quality, r.rating_grading_fairness, r.rating_workload,
              r.rating_exam_difficulty, r.rating_interaction, r.rating_practical_value,
              r.comment, r.advice,
            ]
          );
          reviewId = res.lastID;
          console.log(`[seed] review created user=${r.user_id} offering=${r.offering.id} (id=${reviewId})`);
        } catch (e) {
          console.error(`[seed] failed to insert review user=${r.user_id} offering=${r.offering.id}:`, e.message);
          continue;
        }
      }
      createdReviewIds.push({ id: reviewId, ownerId: r.user_id });

      // Attach tags (idempotent qua PK). Resolve name_en -> id.
      const tagIds = await resolveTagIds(tagMap, r.tags_en);
      for (const tagId of tagIds) {
        try {
          await run(
            `INSERT OR IGNORE INTO review_tags (review_id, tag_id) VALUES (?, ?)`,
            [reviewId, tagId]
          );
        } catch (e) {
          console.error(`[seed] tag attach failed (review=${reviewId}, tag=${tagId}):`, e.message);
        }
      }
    }

    console.log('\n[seed] === Step 4: seed sample votes ===');
    // Upvote review cua student2 tren offering[0] (review #2 trong created list)
    const targetReview = createdReviewIds[1];
    if (targetReview) {
      await run(
        `INSERT OR IGNORE INTO review_votes (review_id, user_id, value) VALUES (?, ?, 1)`,
        [targetReview.id, student1Id]
      );
      await run(
        `INSERT OR IGNORE INTO review_votes (review_id, user_id, value) VALUES (?, ?, 1)`,
        [targetReview.id, adminId]
      );
      console.log(`[seed] votes seeded on review ${targetReview.id}`);
    }

    console.log('\n[seed] === Step 5: seed sample reports ===');
    if (createdReviewIds[0]) {
      try {
        await run(
          `INSERT INTO reports (review_id, user_id, reason, status) VALUES (?, ?, ?, 'pending')`,
          [createdReviewIds[0].id, student2Id, 'Noi dung khong phu hop voi muc dich danh gia.']
        );
        console.log(`[seed] report seeded on review ${createdReviewIds[0].id}`);
      } catch (e) {
        // UNIQUE conflict = da report roi -> OK
        if (!/UNIQUE/.test(e.message)) console.error('[seed] report failed:', e.message);
      }
    }

    console.log('\n[seed] === Final counts ===');
    const counts = {
      users:           (await get(`SELECT COUNT(*) AS n FROM users`)).n,
      offerings:       (await get(`SELECT COUNT(*) AS n FROM offerings`)).n,
      professors:      (await get(`SELECT COUNT(*) AS n FROM professors`)).n,
      reviews:         (await get(`SELECT COUNT(*) AS n FROM reviews`)).n,
      review_tags:     (await get(`SELECT COUNT(*) AS n FROM review_tags`)).n,
      review_votes:    (await get(`SELECT COUNT(*) AS n FROM review_votes`)).n,
      reports:         (await get(`SELECT COUNT(*) AS n FROM reports`)).n,
      tags:            (await get(`SELECT COUNT(*) AS n FROM tags`)).n,
    };
    console.log(JSON.stringify(counts, null, 2));

    console.log('\n[seed] === Demo accounts ===');
    console.log('admin@fcu.edu.tw          / admin123');
    console.log('student1@fcu.edu.tw       / student123');
    console.log('student2@fcu.edu.tw       / student123');
    console.log('unverified@fcu.edu.tw     / student123');

    db.close();
  } catch (err) {
    console.error('[seed] FAILED:', err.message);
    console.error(err.stack);
    db.close();
    process.exit(1);
  }
})();
