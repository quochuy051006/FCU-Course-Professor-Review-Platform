import express from 'express';
import db from '../db.js';

const router = express.Router();

// Lấy danh sách môn học kèm phân trang và tìm kiếm
router.get('/', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  const search = req.query.search ? `%${req.query.search}%` : null;

  let sql = `
    SELECT sub_id3, sub_name, credits 
    FROM courses
  `;
  
  let countSql = `SELECT COUNT(*) as total FROM courses`;
  let params = [];

  if (search) {
    sql += ` WHERE sub_id3 LIKE ? OR sub_name LIKE ?`;
    countSql += ` WHERE sub_id3 LIKE ? OR sub_name LIKE ?`;
    params = [search, search];
  }

  sql += ` ORDER BY sub_id3 LIMIT ? OFFSET ?`;
  const queryParams = [...params, limit, offset];

  // 1. Đếm tổng số lượng để Frontend làm thanh phân trang
  db.get(countSql, params, (countError, result) => {
    if (countError) {
      console.error('Failed to count courses:', countError.message);
      return res.status(500).json({ message: 'Unable to get courses' });
    }

    const total = result ? result.total : 0;

    // 2. Lấy dữ liệu trang hiện tại
    db.all(sql, queryParams, (error, courses) => {
      if (error) {
        console.error('Failed to get courses:', error.message);
        return res.status(500).json({ message: 'Unable to get courses' });
      }

      return res.json({
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        },
        courses
      });
    });
  });
});

// Lấy chi tiết 1 môn học và TOÀN BỘ CÁC LỚP HỌC (classes) đang mở của môn đó
router.get('/:sub_id3', (req, res) => {
  const { sub_id3 } = req.params;

  // Lấy thông tin môn học
  db.get(
    `SELECT sub_id3, sub_name, credits FROM courses WHERE sub_id3 = ?`,
    [sub_id3],
    (courseError, course) => {
      if (courseError) {
        console.error('Failed to get course detail:', courseError.message);
        return res.status(500).json({ message: 'Unable to get course detail' });
      }

      if (!course) {
        return res.status(404).json({ message: 'Course not found' });
      }

      // Lấy các lớp học thuộc môn này, kèm tên khoa/phòng ban (JOIN với departments)
      const classesSql = `
        SELECT 
          cl.scr_selcode, 
          cl.cls_id, 
          cl.cls_name, 
          cl.scr_teacher, 
          cl.scr_period, 
          cl.scr_precnt,
          d.dept_name
        FROM classes cl
        LEFT JOIN departments d ON cl.dept_id = d.dept_id
        WHERE cl.sub_id3 = ?
        ORDER BY cl.cls_id
      `;

      db.all(classesSql, [sub_id3], (classesError, classes) => {
        if (classesError) {
          console.error('Failed to get classes for course:', classesError.message);
          return res.status(500).json({ message: 'Unable to get course classes' });
        }

        // Trả về combo thông tin môn + danh sách lớp để Vue hiển thị
        return res.json({
          ...course,
          classes
        });
      });
    }
  );
});

export default router;