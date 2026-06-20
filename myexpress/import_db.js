import sqlite3 from 'sqlite3';
import fs from 'fs';

// 1. Khởi tạo DB
const db = new sqlite3.Database('./database.sqlite');
const data = JSON.parse(fs.readFileSync('all_courses_1151.json', 'utf8'));

const units = [
    { name: "永續處", id: "SG" }, { name: "創能學院", id: "CC" },
    { name: "通識中心", id: "GE" }, { name: "工科學院", id: "CA" },
    { name: "商學院", id: "CB" }, { name: "人社學院", id: "CH" },
    { name: "資電學院", id: "CI" }, { name: "建設學院", id: "CD" },
    { name: "金融學院", id: "CF" }, { name: "國際科技與管理學院", id: "NM" },
    { name: "建築專業學院", id: "AS" }, { name: "外語文", id: "XA" },
    { name: "體育選項課", id: "XD" }, { name: "統籌科目", id: "XF" },
    { name: "軍訓", id: "XH" }
];

const departmentNames = new Map(units.map(unit => [unit.id, unit.name]));

async function importData() {
    db.serialize(() => {
        // --- PHẦN INIT (Tạo bảng) ---
        db.run(`DROP TABLE IF EXISTS course_departments`);
        db.run(`DROP TABLE IF EXISTS classes`);
        db.run(`DROP TABLE IF EXISTS courses`);
        db.run(`DROP TABLE IF EXISTS departments`);

        db.run(`CREATE TABLE departments (dept_id TEXT PRIMARY KEY, dept_name TEXT)`);
        db.run(`CREATE TABLE courses (
            sub_id3 TEXT PRIMARY KEY,
            sub_name TEXT,
            credits INTEGER,
            name_zh TEXT,
            name_en TEXT,
            department TEXT NOT NULL,
            description TEXT,
            code TEXT
        )`);
        db.run(`CREATE TABLE course_departments (
            course_id TEXT NOT NULL,
            dept_id TEXT NOT NULL,
            PRIMARY KEY (course_id, dept_id),
            FOREIGN KEY (course_id) REFERENCES courses(sub_id3) ON DELETE CASCADE,
            FOREIGN KEY (dept_id) REFERENCES departments(dept_id) ON DELETE CASCADE
        )`);
        db.run(`CREATE TABLE classes (
            scr_selcode TEXT,
            cls_id TEXT,
            sub_id3 TEXT,
            dept_id TEXT,
            cls_name TEXT,
            scr_teacher TEXT,
            scr_period TEXT,
            scr_precnt INTEGER,
            PRIMARY KEY (scr_selcode, cls_id),
            FOREIGN KEY (sub_id3) REFERENCES courses(sub_id3),
            FOREIGN KEY (dept_id) REFERENCES departments(dept_id)
        )`);

        // --- PHẦN IMPORT (Nhập dữ liệu) ---
        // 1. Nhập Khoa
        const stmtDept = db.prepare("INSERT OR IGNORE INTO departments VALUES (?, ?)");
        units.forEach(u => stmtDept.run(u.id, u.name));
        stmtDept.finalize();

        // 2. Nhập Môn học
        const uniqueCourses = new Map();
        data.forEach(c => {
            if (!uniqueCourses.has(c.sub_id3)) {
                uniqueCourses.set(c.sub_id3, {
                    id: c.sub_id3,
                    name: c.sub_name,
                    credit: c.scr_credit,
                    departmentIds: new Set(),
                });
            }
            if (c.dept_id) uniqueCourses.get(c.sub_id3).departmentIds.add(c.dept_id);
        });
        const stmtCourse = db.prepare(`INSERT OR IGNORE INTO courses
            (sub_id3, sub_name, credits, name_zh, name_en, department, description, code)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
        uniqueCourses.forEach(c => {
            const department = [...c.departmentIds]
                .map(id => departmentNames.get(id) || id)
                .join(', ') || '未提供';
            stmtCourse.run(c.id, c.name, c.credit, c.name, null, department, null, c.id);
        });
        stmtCourse.finalize();

        const stmtCourseDepartment = db.prepare(`INSERT OR IGNORE INTO course_departments
            (course_id, dept_id) VALUES (?, ?)`);
        data.forEach(c => {
            if (c.sub_id3 && c.dept_id) stmtCourseDepartment.run(c.sub_id3, c.dept_id);
        });
        stmtCourseDepartment.finalize();

        // 3. Nhập Lớp học (Dùng INSERT OR REPLACE để đè trùng lặp)
        const stmtClass = db.prepare(`INSERT OR REPLACE INTO classes 
            (scr_selcode, cls_id, sub_id3, dept_id, cls_name, scr_teacher, scr_period, scr_precnt) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
        
        data.forEach(c => {
            stmtClass.run(c.scr_selcode, c.cls_id, c.sub_id3, c.dept_id, c.cls_name, c.scr_teacher, c.scr_period, c.scr_precnt);
        });
        stmtClass.finalize();

        console.log("=== THÀNH CÔNG: Đã khởi tạo và nhập 80k+ dòng dữ liệu vào SQLite! ===");
    });
}

importData();
