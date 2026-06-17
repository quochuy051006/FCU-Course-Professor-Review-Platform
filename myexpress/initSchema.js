/**
 * initSchema.js
 *
 * Buoc 4 - Dong bo schema DB theo design chinh thuc.
 *
 * Kien truc (rat quan trong - KHONG doi):
 *   - reviews KHONG co offering_id. Review FK theo (scr_selcode, cls_id) -> classes.
 *   - offerings la lop phuc vu SEARCH va DETAIL.
 *     Moi offering join (course + professor + semester) tu 1 class (scr_selcode, cls_id).
 *     Khi user muon review 1 offering -> server lookup scr_selcode, cls_id cua
 *     offering do va INSERT vao reviews voi 2 cot day. Khong luu offering_id.
 *
 * Bang moi (BUOC 4):
 *   - professors  (da co tu truoc)
 *   - offerings   (da co tu truoc - sinh tu classes)
 *
 * Bang duoc REBUILD theo canonical schema:
 *   - reviews: NOT NULL (scr_selcode, cls_id), UNIQUE (user_id, scr_selcode, cls_id),
 *              FK (scr_selcode, cls_id) -> classes ON DELETE CASCADE,
 *              FK user_id -> users ON DELETE CASCADE,
 *              CHECK rating_* BETWEEN 1-5,
 *              CHECK status IN ('visible','hidden','deleted'),
 *              CHECK is_anonymous IN (0,1).
 *              KHONG co cot offering_id.
 *   - review_tags: PK (review_id, tag_id), FK CASCADE.
 *   - review_votes: PK id, UNIQUE (user_id, review_id), CHECK value IN (-1, 1).
 *   - reports: PK id, UNIQUE (user_id, review_id), CHECK status.
 *
 * Seed trong file nay:
 *   - tags (20 tag mau)
 *   - professors + offerings tu classes.scr_teacher
 *   (Reviews mau do seed.js tao - KHONG lam o day.)
 *
 * Chay:
 *   node initSchema.js          (CLI)
 *   import { runInitSchema } from './initSchema.js'; await runInitSchema();   (programmatic)
 *
 * Idempotent - chay nhieu lan van OK.
 */

import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const sqlite3Verbose = sqlite3.verbose();
const db = new sqlite3Verbose.Database(path.join(__dirname, 'database.sqlite'));

db.run('PRAGMA foreign_keys = ON');

// -----------------------------------------------------------------------------
// Helpers (Promise wrappers)
// -----------------------------------------------------------------------------
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
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
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

// -----------------------------------------------------------------------------
// Main init function (Promise)
// -----------------------------------------------------------------------------
export async function runInitSchema() {
  // ============ 1) professors ============
  await run(`
    CREATE TABLE IF NOT EXISTS professors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_zh TEXT NOT NULL,
      name_en TEXT,
      department TEXT,
      email TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(name_zh, department)
    )
  `);

  // ============ 2) offerings ============
  // offerings la lop SEARCH/DETAIL. Moi offering ung voi 1 class (scr_selcode, cls_id).
  // FK (scr_selcode, cls_id) -> classes dam bao offerings chi duoc tao tu class that.
  // Rebuild neu schema cu thieu NOT NULL hoac FK classes.
  await recreateOfferingsIfNeeded();
  await run(`CREATE INDEX IF NOT EXISTS idx_offerings_course ON offerings(course_id)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_offerings_professor ON offerings(professor_id)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_offerings_semester ON offerings(semester)`);

  // ============ 3) courses: them cot can thiet ============
  await addColumnIfMissing('courses', 'name_zh', 'TEXT');
  await addColumnIfMissing('courses', 'name_en', 'TEXT');
  await addColumnIfMissing('courses', 'department', 'TEXT');
  await addColumnIfMissing('courses', 'description', 'TEXT');
  await addColumnIfMissing('courses', 'code', 'TEXT');
  await run(`UPDATE courses SET code = sub_id3 WHERE code IS NULL OR code = ''`);
  await run(`UPDATE courses SET name_zh = sub_name WHERE name_zh IS NULL OR name_zh = ''`);

  // ============ 4) users: them cot can thiet ============
  // users da co tu Bước 3. CHECK constraint khong the ALTER, nên can recreate neu khong khop.
  await recreateUsersIfNeeded();

  // ============ 5) reviews: REBUILD theo canonical schema ============
  await recreateReviewsIfNeeded();

  // ============ 6) review_tags / review_votes / reports: dam bao PK + UNIQUE + FK ============
  await recreateReviewTagsIfNeeded();
  await recreateReviewVotesIfNeeded();
  await recreateReportsIfNeeded();

  // ============ 7) Seed tags (idempotent) ============
  const tags = [
    ['作業很多', 'Heavy Workload'],
    ['作業適中', 'Moderate Workload'],
    ['作業很少', 'Light Workload'],
    ['老師親切', 'Friendly Teacher'],
    ['老師嚴格', 'Strict Teacher'],
    ['講解清楚', 'Clear Explanations'],
    ['講解含糊', 'Unclear Explanations'],
    ['點名嚴格', 'Strict Attendance'],
    ['不點名', 'No Attendance Check'],
    ['推薦', 'Recommended'],
    ['不推薦', 'Not Recommended'],
    ['考試容易', 'Easy Exams'],
    ['考試困難', 'Hard Exams'],
    ['開書考試', 'Open-book Exams'],
    ['報告很多', 'Many Presentations'],
    ['實用', 'Practical'],
    ['理論', 'Theory-heavy'],
    ['冷氣冷', 'Strong AC'],
    ['冷氣弱', 'Weak AC'],
    ['甜分高', 'Easy Grading'],
  ];
  const tagStmt = db.prepare(`INSERT OR IGNORE INTO tags (name_zh, name_en) VALUES (?, ?)`);
  tags.forEach(([zh, en]) => tagStmt.run(zh, en));
  await new Promise((resolve) => tagStmt.finalize(resolve));
  console.log(`Seed tags OK (${tags.length} tag(s))`);

  // ============ 8) Seed professors + offerings tu classes ============
  await seedProfessorsAndOfferings();

  // Final report
  const c = {
    users:           (await get(`SELECT COUNT(*) AS n FROM users`)).n,
    courses:         (await get(`SELECT COUNT(*) AS n FROM courses`)).n,
    classes:         (await get(`SELECT COUNT(*) AS n FROM classes`)).n,
    professors:      (await get(`SELECT COUNT(*) AS n FROM professors`)).n,
    offerings:       (await get(`SELECT COUNT(*) AS n FROM offerings`)).n,
    reviews:         (await get(`SELECT COUNT(*) AS n FROM reviews`)).n,
    tags:            (await get(`SELECT COUNT(*) AS n FROM tags`)).n,
  };
  console.log('Final counts:', JSON.stringify(c));
}

// -----------------------------------------------------------------------------
// Sub-functions
// -----------------------------------------------------------------------------
async function addColumnIfMissing(table, column, typeAndDefault) {
  const cols = await all(`PRAGMA table_info(${table})`);
  const exists = cols.some(r => r.name === column);
  if (!exists) {
    try {
      await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeAndDefault}`);
      console.log(`ALTER TABLE ${table} ADD COLUMN ${column} OK`);
    } catch (e) {
      console.error(`ALTER ${table} ADD ${column} failed:`, e.message);
    }
  }
}

// Can recreate users neu thieu cot can thiet (hien tai da co schema chuan).
async function recreateUsersIfNeeded() {
  const cols = await all(`PRAGMA table_info(users)`);
  const names = cols.map(c => c.name);
  // users da co schema chuan tu Bước 3 - chi can them cot neu thieu (an toan)
  if (!names.includes('is_banned')) {
    await run(`ALTER TABLE users ADD COLUMN is_banned INTEGER NOT NULL DEFAULT 0`);
  }
  // Dam bao co UNIQUE email (no se co roi tu schema cu)
  // Khong can recreate vi data da co
}

// offerings: rebuild neu thieu NOT NULL (scr_selcode, cls_id) hoac FK classes.
// offerings KHONG FK truc tiep vao reviews (reviews chi FK -> classes). Nen rebuild
// offerings rat an toan, khong can drop bang phu thuoc.
async function recreateOfferingsIfNeeded() {
  const exists = await get(`SELECT name FROM sqlite_master WHERE type='table' AND name='offerings'`);
  if (exists) {
    const cols = await all(`PRAGMA table_info(offerings)`);
    const sql = await get(`SELECT sql FROM sqlite_master WHERE type='table' AND name='offerings'`);
    const txt = (sql?.sql || '').toUpperCase();
    const hasNotNullSelcode = cols.some(c => c.name === 'scr_selcode' && c.notnull === 1);
    const hasNotNullClsId   = cols.some(c => c.name === 'cls_id' && c.notnull === 1);
    const hasFkClasses = /FOREIGN KEY.*\(?\s*SCR_SELCODE\s*,\s*CLS_ID\s*\)?.*REFERENCES\s+CLASSES/.test(txt);
    if (hasNotNullSelcode && hasNotNullClsId && hasFkClasses) {
      console.log('offerings: schema already canonical - skip rebuild');
      return;
    }
    console.log('offerings: schema khong khop canonical, rebuild (giu data)');
  }

  const tmp = '_offerings_old';
  await run(`DROP TABLE IF EXISTS ${tmp}`);
  if (exists) await run(`ALTER TABLE offerings RENAME TO ${tmp}`);

  await run(`
    CREATE TABLE offerings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id TEXT NOT NULL,
      professor_id INTEGER NOT NULL,
      semester TEXT NOT NULL,
      scr_selcode TEXT NOT NULL,
      cls_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(sub_id3),
      FOREIGN KEY (professor_id) REFERENCES professors(id),
      FOREIGN KEY (scr_selcode, cls_id) REFERENCES classes(scr_selcode, cls_id) ON DELETE CASCADE,
      UNIQUE(scr_selcode, cls_id)
    )
  `);

  if (exists) {
    // Copy data cu, chi lay rows co scr_selcode/cls_id NOT NULL (loc NULL cu).
    await run(`INSERT OR IGNORE INTO offerings
      (id, course_id, professor_id, semester, scr_selcode, cls_id, created_at)
      SELECT id, course_id, professor_id, semester, scr_selcode, cls_id, created_at
      FROM ${tmp}
      WHERE scr_selcode IS NOT NULL AND cls_id IS NOT NULL`);
    await run(`DROP TABLE ${tmp}`);
    console.log('Rebuild offerings: copied existing rows');
  } else {
    console.log('Rebuild offerings: created new table');
  }
}

// Reviews: luon rebuild theo canonical schema de dam bao NOT NULL + CHECK + UNIQUE + FK.
// (Recreate chi khi schema KHONG khop -> tranh mat data.)
//
// Canonical schema (CHOT):
//   - KHONG co cot offering_id. Review FK theo (scr_selcode, cls_id) -> classes.
//   - NOT NULL scr_selcode, cls_id, user_id
//   - 6 cot rating_* NOT NULL, CHECK BETWEEN 1 AND 5
//   - status NOT NULL DEFAULT 'visible' CHECK IN (visible/hidden/deleted)
//   - is_anonymous NOT NULL DEFAULT 0 CHECK IN (0,1)
//   - UNIQUE (user_id, scr_selcode, cls_id)
//   - FK (scr_selcode, cls_id) -> classes ON DELETE CASCADE
//   - FK user_id -> users ON DELETE CASCADE
async function recreateReviewsIfNeeded() {
  const exists = await get(`SELECT name FROM sqlite_master WHERE type='table' AND name='reviews'`);
  if (exists) {
    const cols = await all(`PRAGMA table_info(reviews)`);
    const sql = await get(`SELECT sql FROM sqlite_master WHERE type='table' AND name='reviews'`);
    const txt = (sql?.sql || '').toUpperCase();

    // Check canonical schema day du. QUAN TRONG: phai dam bao KHONG co cot offering_id.
    const hasNoOfferingId = !cols.some(c => c.name === 'offering_id');
    const hasNotNullSelcode = cols.some(c => c.name === 'scr_selcode' && c.notnull === 1);
    const hasNotNullClsId = cols.some(c => c.name === 'cls_id' && c.notnull === 1);
    const hasNotNullUserId = cols.some(c => c.name === 'user_id' && c.notnull === 1);
    const hasRatingCheck = /CHECK.*RATING_TEACHING_QUALITY.*BETWEEN 1 AND 5/.test(txt);
    const hasStatusCheck = /CHECK.*STATUS.*IN.*VISIBLE.*HIDDEN.*DELETED/.test(txt);
    const hasAnonCheck = /CHECK.*IS_ANONYMOUS.*IN.*0.*1/.test(txt);
    const hasUniqueTriple = /UNIQUE.*\(?\s*USER_ID\s*,\s*SCR_SELCODE\s*,\s*CLS_ID/.test(txt);
    const hasFkClasses = /FOREIGN KEY.*\(?\s*SCR_SELCODE\s*,\s*CLS_ID\s*\)?.*REFERENCES\s+CLASSES/.test(txt);
    const hasFkUsers = /FOREIGN KEY.*USER_ID.*REFERENCES\s+USERS/.test(txt);

    const ok =
      hasNoOfferingId &&
      hasNotNullSelcode &&
      hasNotNullClsId &&
      hasNotNullUserId &&
      hasRatingCheck &&
      hasStatusCheck &&
      hasAnonCheck &&
      hasUniqueTriple &&
      hasFkClasses &&
      hasFkUsers;

    if (ok) {
      console.log('reviews: schema already canonical - skip rebuild');
      return;
    } else {
      console.log('reviews: schema khong khop canonical, can rebuild', {
        hasNoOfferingId, hasNotNullSelcode, hasNotNullClsId, hasNotNullUserId,
        hasRatingCheck, hasStatusCheck, hasAnonCheck, hasUniqueTriple, hasFkClasses, hasFkUsers,
      });
    }
  }

  console.log('Rebuilding reviews table to canonical schema ...');

  // Truoc khi rename `reviews`, can DROP cac bang phu thuoc vi FK dang tro vao reviews.
  // Lam theo thu tu nguoc: reports -> review_votes -> review_tags.
  await run(`DROP TABLE IF EXISTS reports`);
  await run(`DROP TABLE IF EXISTS review_votes`);
  await run(`DROP TABLE IF EXISTS review_tags`);

  // Tao bang tam voi schema dung (giu data neu co)
  const tmp = '_reviews_old';
  await run(`DROP TABLE IF EXISTS ${tmp}`);
  if (exists) {
    await run(`ALTER TABLE reviews RENAME TO ${tmp}`);
  }

  await run(`
    CREATE TABLE reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scr_selcode TEXT NOT NULL,
      cls_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      is_anonymous INTEGER NOT NULL DEFAULT 0 CHECK (is_anonymous IN (0, 1)),
      rating_teaching_quality INTEGER NOT NULL CHECK (rating_teaching_quality BETWEEN 1 AND 5),
      rating_grading_fairness INTEGER NOT NULL CHECK (rating_grading_fairness BETWEEN 1 AND 5),
      rating_workload INTEGER NOT NULL CHECK (rating_workload BETWEEN 1 AND 5),
      rating_exam_difficulty INTEGER NOT NULL CHECK (rating_exam_difficulty BETWEEN 1 AND 5),
      rating_interaction INTEGER NOT NULL CHECK (rating_interaction BETWEEN 1 AND 5),
      rating_practical_value INTEGER NOT NULL CHECK (rating_practical_value BETWEEN 1 AND 5),
      comment TEXT NOT NULL,
      advice TEXT,
      status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden', 'deleted')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, scr_selcode, cls_id),
      FOREIGN KEY (scr_selcode, cls_id) REFERENCES classes(scr_selcode, cls_id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  if (exists) {
    // Copy data cu (chi giu rows co scr_selcode, cls_id hop le)
    // BO QUA cot offering_id neu schema cu co (de tuong thich nguoc).
    await run(`INSERT OR IGNORE INTO reviews
      (id, scr_selcode, cls_id, user_id, is_anonymous,
       rating_teaching_quality, rating_grading_fairness, rating_workload,
       rating_exam_difficulty, rating_interaction, rating_practical_value,
       comment, advice, status, created_at, updated_at)
      SELECT id, scr_selcode, cls_id, user_id, is_anonymous,
             rating_teaching_quality, rating_grading_fairness, rating_workload,
             rating_exam_difficulty, rating_interaction, rating_practical_value,
             comment, advice,
             CASE status WHEN 'visible' THEN 'visible' WHEN 'hidden' THEN 'hidden' WHEN 'deleted' THEN 'deleted' ELSE 'visible' END,
             created_at, updated_at
      FROM ${tmp}
      WHERE scr_selcode IS NOT NULL AND cls_id IS NOT NULL`);
    await run(`DROP TABLE ${tmp}`);
    console.log('Rebuild reviews: copied existing rows (where scr_selcode/cls_id valid)');
  } else {
    console.log('Rebuild reviews: created new table');
  }
}

// review_tags: PK (review_id, tag_id), FK CASCADE
async function recreateReviewTagsIfNeeded() {
  const exists = await get(`SELECT name FROM sqlite_master WHERE type='table' AND name='review_tags'`);
  if (exists) {
    const cols = await all(`PRAGMA table_info(review_tags)`);
    const sql = await get(`SELECT sql FROM sqlite_master WHERE type='table' AND name='review_tags'`);
    const txt = (sql?.sql || '').toUpperCase();
    const ok = /PRIMARY KEY.*REVIEW_ID.*TAG_ID/.test(txt) &&
               /FOREIGN KEY.*REVIEW_ID.*REFERENCES REVIEWS/.test(txt) &&
               /FOREIGN KEY.*TAG_ID.*REFERENCES TAGS/.test(txt);
    if (ok) {
      console.log('review_tags: schema already canonical - skip rebuild');
      return;
    }
    console.log('review_tags: schema khong khop canonical, rebuild');
  }

  console.log('Rebuilding review_tags table ...');
  const tmp = '_review_tags_old';
  await run(`DROP TABLE IF EXISTS ${tmp}`);
  if (exists) await run(`ALTER TABLE review_tags RENAME TO ${tmp}`);

  await run(`
    CREATE TABLE review_tags (
      review_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (review_id, tag_id),
      FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )
  `);

  if (exists) {
    await run(`INSERT OR IGNORE INTO review_tags (review_id, tag_id)
               SELECT review_id, tag_id FROM ${tmp}`);
    await run(`DROP TABLE ${tmp}`);
    console.log('Rebuild review_tags: copied existing rows');
  }
}

// review_votes: PK id, UNIQUE (user_id, review_id), FK CASCADE, CHECK value IN (-1,1)
async function recreateReviewVotesIfNeeded() {
  const exists = await get(`SELECT name FROM sqlite_master WHERE type='table' AND name='review_votes'`);
  if (exists) {
    const cols = await all(`PRAGMA table_info(review_votes)`);
    const sql = await get(`SELECT sql FROM sqlite_master WHERE type='table' AND name='review_votes'`);
    const txt = (sql?.sql || '').toUpperCase();
    const ok = /PRIMARY KEY.*ID/.test(txt) &&
               /UNIQUE.*USER_ID.*REVIEW_ID/.test(txt) &&
               /CHECK.*VALUE.*IN.*-1.*1/.test(txt);
    if (ok) {
      console.log('review_votes: schema already canonical - skip rebuild');
      return;
    }
    console.log('review_votes: schema khong khop canonical, rebuild');
  }

  console.log('Rebuilding review_votes table ...');
  const tmp = '_review_votes_old';
  await run(`DROP TABLE IF EXISTS ${tmp}`);
  if (exists) await run(`ALTER TABLE review_votes RENAME TO ${tmp}`);

  await run(`
    CREATE TABLE review_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      review_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      value INTEGER NOT NULL CHECK (value IN (-1, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, review_id),
      FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  if (exists) {
    await run(`INSERT OR IGNORE INTO review_votes (review_id, user_id, value, created_at)
               SELECT review_id, user_id,
                      CASE WHEN value IN (-1, 1) THEN value ELSE 1 END,
                      created_at
               FROM ${tmp}`);
    await run(`DROP TABLE ${tmp}`);
    console.log('Rebuild review_votes: copied existing rows');
  }
}

// reports: PK id, UNIQUE (user_id, review_id), FK CASCADE, status CHECK
async function recreateReportsIfNeeded() {
  const exists = await get(`SELECT name FROM sqlite_master WHERE type='table' AND name='reports'`);
  if (exists) {
    const sql = await get(`SELECT sql FROM sqlite_master WHERE type='table' AND name='reports'`);
    const txt = (sql?.sql || '').toUpperCase();
    const ok = /PRIMARY KEY.*ID/.test(txt) &&
               /UNIQUE.*USER_ID.*REVIEW_ID/.test(txt) &&
               /CHECK.*STATUS.*IN.*PENDING.*RESOLVED/.test(txt);
    if (ok) {
      console.log('reports: schema already canonical - skip rebuild');
      return;
    }
    console.log('reports: schema khong khop canonical, rebuild');
  }

  console.log('Rebuilding reports table ...');
  const tmp = '_reports_old';
  await run(`DROP TABLE IF EXISTS ${tmp}`);
  if (exists) await run(`ALTER TABLE reports RENAME TO ${tmp}`);

  await run(`
    CREATE TABLE reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      review_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, review_id),
      FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  if (exists) {
    await run(`INSERT OR IGNORE INTO reports (review_id, user_id, reason, status, created_at)
               SELECT review_id, user_id, reason,
                      CASE WHEN status IN ('pending','resolved','dismissed') THEN status ELSE 'pending' END,
                      created_at
               FROM ${tmp}`);
    await run(`DROP TABLE ${tmp}`);
    console.log('Rebuild reports: copied existing rows');
  }
}

async function seedProfessorsAndOfferings() {
  const rows = await all(`SELECT DISTINCT scr_teacher, sub_id3, scr_selcode, cls_id, dept_id FROM classes`);
  const professorCache = new Map();

  async function findOrCreateProfessor(rawName, deptId) {
    if (!rawName) return null;
    const names = rawName.split(/[,，、]\s*/).map(s => s.trim()).filter(Boolean);
    const primaryName = names[0];
    if (!primaryName) return null;
    const key = `${primaryName}::${deptId || ''}`;
    if (professorCache.has(key)) return professorCache.get(key);

    const existing = await get(
      `SELECT id FROM professors WHERE name_zh = ? AND IFNULL(department,'') = ?`,
      [primaryName, deptId || '']
    );
    if (existing) {
      professorCache.set(key, existing.id);
      return existing.id;
    }
    const fakeEmail = `prof_${Math.floor(Math.random() * 1e8)}@fcu.edu.tw`;
    try {
      const res = await run(
        `INSERT INTO professors (name_zh, name_en, department, email) VALUES (?, ?, ?, ?)`,
        [primaryName, null, deptId || null, fakeEmail]
      );
      professorCache.set(key, res.lastID);
      return res.lastID;
    } catch (e) {
      const again = await get(
        `SELECT id FROM professors WHERE name_zh = ? AND IFNULL(department,'') = ?`,
        [primaryName, deptId || '']
      );
      if (again) {
        professorCache.set(key, again.id);
        return again.id;
      }
      console.error('INSERT professor failed:', e.message);
      return null;
    }
  }

  const semesterDefault = '114-1';
  let inserted = 0;
  for (const r of rows) {
    const profId = await findOrCreateProfessor(r.scr_teacher, r.dept_id);
    if (!profId) continue;
    try {
      await run(
        `INSERT OR IGNORE INTO offerings (course_id, professor_id, semester, scr_selcode, cls_id)
         VALUES (?, ?, ?, ?, ?)`,
        [r.sub_id3, profId, semesterDefault, r.scr_selcode, r.cls_id]
      );
      inserted++;
    } catch (e) {
      if (!/UNIQUE/.test(e.message)) {
        console.error('INSERT offering failed:', e.message);
      }
    }
  }
  console.log(`Seeded offerings: ${inserted} processed`);
}

// -----------------------------------------------------------------------------
// CLI entry point
// -----------------------------------------------------------------------------
const isCli = (() => {
  try {
    return import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`;
  } catch {
    return false;
  }
})();

if (isCli) {
  runInitSchema()
    .then(() => db.close())
    .catch((err) => {
      console.error('initSchema failed:', err);
      db.close();
      process.exit(1);
    });
}
