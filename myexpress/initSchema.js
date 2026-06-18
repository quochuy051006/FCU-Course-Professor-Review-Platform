/**
 * initSchema.js
 *
 * Database schema synchronization and seeding script.
 * * Architecture Constraints:
 * - reviews table does NOT contain offering_id. It links via composite foreign key (scr_selcode, cls_id) -> classes.
 * - offerings table is used for SEARCH and DETAIL operations.
 * - Idempotent: Can be executed multiple times safely without data duplication.
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
// Database Helper Wrappers (Promises)
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
// Main Initialization Function
// -----------------------------------------------------------------------------
export async function runInitSchema() {
  // 1) Create professors table
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

  // 2) Handle offerings schema migration and setup
  await recreateOfferingsIfNeeded();
  await run(`CREATE INDEX IF NOT EXISTS idx_offerings_course ON offerings(course_id)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_offerings_professor ON offerings(professor_id)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_offerings_semester ON offerings(semester)`);

  // 3) Ensure legacy courses table compatibility mapping
  await addColumnIfMissing('courses', 'name_zh', 'TEXT');
  await addColumnIfMissing('courses', 'name_en', 'TEXT');
  await addColumnIfMissing('courses', 'department', 'TEXT');
  await addColumnIfMissing('courses', 'description', 'TEXT');
  await addColumnIfMissing('courses', 'code', 'TEXT');
  await run(`UPDATE courses SET code = sub_id3 WHERE code IS NULL OR code = ''`);
  await run(`UPDATE courses SET name_zh = sub_name WHERE name_zh IS NULL OR name_zh = ''`);

  // 4) Ensure users table safety constraints
  await recreateUsersIfNeeded();

  // 5) Rebuild canonical reviews system
  await recreateReviewsIfNeeded();

  // 6) Validate dependent relational entity schemas
  await recreateReviewTagsIfNeeded();
  await recreateReviewVotesIfNeeded();
  await recreateReportsIfNeeded();

  // 7) Seed metadata lookup tags
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
  console.log(`Seed tags completed (${tags.length} tags processed)`);

  // 8) Execute data normalization from classes ingestion
  await seedProfessorsAndOfferings();

  // Global metric summary execution audit report
  const metrics = {
    users:       (await get(`SELECT COUNT(*) AS n FROM users`)).n,
    courses:     (await get(`SELECT COUNT(*) AS n FROM courses`)).n,
    classes:     (await get(`SELECT COUNT(*) AS n FROM classes`)).n,
    professors:  (await get(`SELECT COUNT(*) AS n FROM professors`)).n,
    offerings:   (await get(`SELECT COUNT(*) AS n FROM offerings`)).n,
    reviews:     (await get(`SELECT COUNT(*) AS n FROM reviews`)).n,
    tags:        (await get(`SELECT COUNT(*) AS n FROM tags`)).n,
  };
  console.log('Final database entity metrics:', JSON.stringify(metrics));
}

// -----------------------------------------------------------------------------
// Sub-migration Pipeline Routines
// -----------------------------------------------------------------------------
async function addColumnIfMissing(table, column, typeAndDefault) {
  const cols = await all(`PRAGMA table_info(${table})`);
  const exists = cols.some(r => r.name === column);
  if (!exists) {
    try {
      await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeAndDefault}`);
      console.log(`Alteration success: Added column ${column} to table ${table}`);
    } catch (e) {
      console.error(`Alteration failure for table ${table} on column ${column}:`, e.message);
    }
  }
}

async function recreateUsersIfNeeded() {
  const cols = await all(`PRAGMA table_info(users)`);
  const names = cols.map(c => c.name);
  if (!names.includes('is_banned')) {
    await run(`ALTER TABLE users ADD COLUMN is_banned INTEGER NOT NULL DEFAULT 0`);
  }
}

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
      console.log('Offerings entity matches canonical structural definition - skipping rebuild.');
      return;
    }
    console.log('Offerings structural mismatch detected. Migrating definitions safely...');
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
    await run(`INSERT OR IGNORE INTO offerings
      (id, course_id, professor_id, semester, scr_selcode, cls_id, created_at)
      SELECT id, course_id, professor_id, semester, scr_selcode, cls_id, created_at
      FROM ${tmp}
      WHERE scr_selcode IS NOT NULL AND cls_id IS NOT NULL`);
    await run(`DROP TABLE ${tmp}`);
    console.log('Migration recovery completed for offerings table structural data mapping.');
  } else {
    console.log('Offerings transactional structural model storage provisioned.');
  }
}

async function recreateReviewsIfNeeded() {
  const exists = await get(`SELECT name FROM sqlite_master WHERE type='table' AND name='reviews'`);
  if (exists) {
    const cols = await all(`PRAGMA table_info(reviews)`);
    const sql = await get(`SELECT sql FROM sqlite_master WHERE type='table' AND name='reviews'`);
    const txt = (sql?.sql || '').toUpperCase();

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
      hasNoOfferingId && hasNotNullSelcode && hasNotNullClsId && hasNotNullUserId &&
      hasRatingCheck && hasStatusCheck && hasAnonCheck && hasUniqueTriple &&
      hasFkClasses && hasFkUsers;

    if (ok) {
      console.log('Reviews relational schema validation succeeded - skipping rebuild.');
      return;
    }
    console.log('Reviews internal structural anomaly found. Initiating dynamic table rebuild execution...');
  }

  await run(`DROP TABLE IF EXISTS reports`);
  await run(`DROP TABLE IF EXISTS review_votes`);
  await run(`DROP TABLE IF EXISTS review_tags`);

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
    console.log('Reviews core database relational table restoration structural synchronization finalized.');
  } else {
    console.log('Reviews engine database data pipeline initialization created successfully.');
  }
}

async function recreateReviewTagsIfNeeded() {
  const exists = await get(`SELECT name FROM sqlite_master WHERE type='table' AND name='review_tags'`);
  if (exists) {
    const sql = await get(`SELECT sql FROM sqlite_master WHERE type='table' AND name='review_tags'`);
    const txt = (sql?.sql || '').toUpperCase();
    const ok = /PRIMARY KEY.*REVIEW_ID.*TAG_ID/.test(txt) &&
               /FOREIGN KEY.*REVIEW_ID.*REFERENCES REVIEWS/.test(txt) &&
               /FOREIGN KEY.*TAG_ID.*REFERENCES TAGS/.test(txt);
    if (ok) {
      console.log('Review_tags relational schema validation succeeded.');
      return;
    }
  }

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
    await run(`INSERT OR IGNORE INTO review_tags (review_id, tag_id) SELECT review_id, tag_id FROM ${tmp}`);
    await run(`DROP TABLE ${tmp}`);
  }
}

async function recreateReviewVotesIfNeeded() {
  const exists = await get(`SELECT name FROM sqlite_master WHERE type='table' AND name='review_votes'`);
  if (exists) {
    const sql = await get(`SELECT sql FROM sqlite_master WHERE type='table' AND name='review_votes'`);
    const txt = (sql?.sql || '').toUpperCase();
    const ok = /PRIMARY KEY.*ID/.test(txt) && /UNIQUE.*USER_ID.*REVIEW_ID/.test(txt) && /CHECK.*VALUE.*IN.*-1.*1/.test(txt);
    if (ok) {
      console.log('Review_votes verification process passed successfully.');
      return;
    }
  }

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
               SELECT review_id, user_id, CASE WHEN value IN (-1, 1) THEN value ELSE 1 END, created_at FROM ${tmp}`);
    await run(`DROP TABLE ${tmp}`);
  }
}

async function recreateReportsIfNeeded() {
  const exists = await get(`SELECT name FROM sqlite_master WHERE type='table' AND name='reports'`);
  if (exists) {
    const sql = await get(`SELECT sql FROM sqlite_master WHERE type='table' AND name='reports'`);
    const txt = (sql?.sql || '').toUpperCase();
    const ok = /PRIMARY KEY.*ID/.test(txt) && /UNIQUE.*USER_ID.*REVIEW_ID/.test(txt) && /CHECK.*STATUS.*IN.*PENDING.*RESOLVED/.test(txt);
    if (ok) {
      console.log('Reports normalization architecture verification complete.');
      return;
    }
  }

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
               SELECT review_id, user_id, reason, CASE WHEN status IN ('pending','resolved','dismissed') THEN status ELSE 'pending' END, created_at FROM ${tmp}`);
    await run(`DROP TABLE ${tmp}`);
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
      console.error('INSERT professor execution failed:', e.message);
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
        console.error('INSERT dynamic offering mapping failed:', e.message);
      }
    }
  }
  console.log(`Dynamic seeding engine: Data extraction complete. ${inserted} offerings mapped.`);
}

// -----------------------------------------------------------------------------
// Safe Cross-Platform CLI Execution Block (Windows Friendly Paths Detection)
// -----------------------------------------------------------------------------
const isCli = (() => {
  try {
    const currentFile = fileURLToPath(import.meta.url).toLowerCase().replace(/\\/g, '/');
    const runningFile = path.resolve(process.argv[1]).toLowerCase().replace(/\\/g, '/');
    return currentFile === runningFile;
  } catch {
    return false;
  }
})();

if (isCli) {
  console.log('🚀 Executing database initialization pipeline...');
  runInitSchema()
    .then(() => {
      console.log('🎉 Structural initialization and seeding routines completed smoothly!');
      db.close();
    })
    .catch((err) => {
      console.error('❌ Pipeline failure initialization failed:', err);
      db.close();
      process.exit(1);
    });
}