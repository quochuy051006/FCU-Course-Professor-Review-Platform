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

async function importData() {
    db.serialize(() => {
        // --- PHẦN INIT (Tạo bảng) ---
        db.run(`DROP TABLE IF EXISTS classes`);
        db.run(`DROP TABLE IF EXISTS courses`);
        db.run(`DROP TABLE IF EXISTS departments`);

        db.run(`CREATE TABLE departments (dept_id TEXT PRIMARY KEY, dept_name TEXT)`);
        db.run(`CREATE TABLE courses (sub_id3 TEXT PRIMARY KEY, sub_name TEXT, credits INTEGER)`);
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
                uniqueCourses.set(c.sub_id3, { id: c.sub_id3, name: c.sub_name, credit: c.scr_credit });
            }
        });
        const stmtCourse = db.prepare("INSERT OR IGNORE INTO courses VALUES (?, ?, ?)");
        uniqueCourses.forEach(c => stmtCourse.run(c.id, c.name, c.credit));
        stmtCourse.finalize();

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