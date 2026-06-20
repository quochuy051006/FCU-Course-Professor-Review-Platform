# TASK.md

## FCU Course & Professor Review Platform
**逢甲課程與教師評價平台**

Trường áp dụng: **Feng Chia University / 逢甲大學 / Đại học Phùng Giáp, Taiwan**

---

## 1. Mục tiêu project

Xây dựng một website giúp sinh viên xem và chia sẻ trải nghiệm học tập trước khi đăng ký môn, theo cấu trúc:

```text
Course + Professor + Semester
Môn học + Giảng viên + Học kỳ
```

Ví dụ:

- Web Programming - Professor Lin - 114-1
- Database Systems - Professor Chen - 114-2

---

## 2. Công nghệ bắt buộc

### Frontend
- Vue 3
- Vite
- Vue Router
- HTML
- CSS
- JavaScript

### Backend
- Express.js
- JWT
- bcrypt
- dotenv
- cors

### Database
- SQLite

### Không dùng
- TypeScript
- PHP
- Python
- Java
- Laravel / Django / Spring
- Upload file / ảnh
- Chat realtime
- Direct message
- Follower system
- Forum phức tạp

---

## 3. Cấu trúc project

```text
FINAL/
  client/
  server/
  package.json
  README.md
  TASK.md
```

---

## 4. Tiến độ hiện tại

### Đã xong
- [x] Bước 1: Backend cơ bản
- [x] Bước 2: Database + seed data cơ bản
- [x] Bước 3: Auth API
- [x] Bước 4: Course / Professor / Offering / Review API
- [x] Bước 5: Vote / Report / Admin API
- [x] Bước 6: Frontend Vue cơ bản
- [x] Bước 7: Hoàn thiện các trang frontend

### Chưa xong
- [ ] Bước 8: README hoàn chỉnh + HackMD/Notion + kiểm tra trước khi nộp

---

## 5. Checklist chi tiết theo 8 bước

# Bước 1 — Backend cơ bản
## Mục tiêu
Khởi tạo server Express và kết nối SQLite.

## Checklist
- [x] Tạo `server/package.json`
- [x] Tạo `server/index.js`
- [x] Tạo `server/db.js`
- [x] Tạo `server/initDb.js`
- [x] Tạo `.env`
- [x] Tạo `.env.example`
- [x] Chạy được server ở `http://localhost:3000`
- [x] Tạo route `GET /api/health`
- [x] Kết nối được SQLite

## Tiêu chí hoàn thành
- `npm run dev:server` chạy được
- `GET /api/health` trả về JSON thành công

---

# Bước 2 — Database + seed data
## Mục tiêu
Tạo schema và dữ liệu mẫu.

## Checklist
- [x] Tạo bảng `users`
- [x] Tạo bảng `courses`
- [x] Tạo bảng `professors`
- [x] Tạo bảng `offerings`
- [x] Tạo bảng `reviews`
- [x] Tạo bảng `tags`
- [x] Tạo bảng `review_tags`
- [x] Tạo bảng `review_votes`
- [x] Tạo bảng `reports`
- [x] Tạo `seed.js`
- [x] Seed tài khoản admin
- [x] Seed tài khoản student
- [x] Seed dữ liệu môn học
- [x] Seed dữ liệu giảng viên giả
- [x] Seed dữ liệu offerings
- [x] Seed dữ liệu tags
- [x] Seed dữ liệu reviews mẫu

## Tiêu chí hoàn thành
- `database.sqlite` được tạo
- Login bằng tài khoản seed thành công

---

# Bước 3 — Auth API
## Mục tiêu
Làm đăng ký, đăng nhập, xác thực email demo.

## Checklist
- [x] Tạo `server/routes/auth.js`
- [x] Tạo `server/middleware/auth.js`
- [x] Tạo `POST /api/auth/register`
- [x] Tạo `POST /api/auth/login`
- [x] Tạo `GET /api/auth/verify-email?token=...`
- [x] Tạo `GET /api/auth/me`
- [x] Hash password bằng bcrypt
- [x] Tạo JWT token khi login
- [x] Kiểm tra email phải đúng domain `@fcu.edu.tw`
- [x] Trả `verification_link` demo
- [x] Tạo middleware `authenticateToken`
- [x] Tạo middleware `requireVerified`
- [x] Tạo middleware `requireAdmin`

## Tiêu chí hoàn thành
- Login thành công
- Register email trường thành công
- Email sai domain bị chặn
- Có verification link demo
- Health API hoạt động

---

# Bước 4 — Course / Professor / Offering / Review API
## Mục tiêu
Làm phần nghiệp vụ chính của hệ thống.

> **Lưu ý:** Cấu trúc thực tế của repo dùng `myexpress/` thay vì `server/`. Các file bên dưới map sang `myexpress/routes/*`. Đăng ký trong `myexpress/app.js:42-48`.

## File cần tạo
- [x] `server/routes/courses.js` (thực tế: `myexpress/routes/courses.js`)
- [x] `server/routes/professors.js` (thực tế: `myexpress/routes/professors.js`)
- [x] `server/routes/offerings.js` (thực tế: `myexpress/routes/offerings.js`)
- [x] `server/routes/reviews.js` (thực tế: `myexpress/routes/reviews.js`)

## API cần làm
- [x] `GET /api/courses` (`courses.js:7`)
- [x] `GET /api/professors` (`professors.js:17`)
- [x] `GET /api/offerings` (`offerings.js:85`)
- [x] `GET /api/offerings/search?q=...` (`offerings.js:100`)
- [x] `GET /api/offerings/:id` (`offerings.js:136`)
- [x] `GET /api/offerings/:id/reviews` (`offerings.js:266`)
- [x] `POST /api/offerings/:id/reviews` (`offerings.js:386`, yêu cầu `authenticateToken + requireVerified`)
- [x] `PUT /api/reviews/:id` (`reviews.js:185`, yêu cầu `authenticateToken`, chỉ owner)
- [x] `DELETE /api/reviews/:id` (`reviews.js:359`, yêu cầu `authenticateToken`, chỉ owner)
- [x] `GET /api/me/reviews` (`reviews.js:410` qua `myReviewsRouter`, yêu cầu `authenticateToken`)

## Logic bắt buộc
- [x] Offering phải là `Course + Professor + Semester` (`offerings.js` JOIN `courses` + `professors` theo `course_id`/`professor_id` + cột `semester`)
- [x] Search theo course code (`offerings.js:113` `c.code LIKE ?`)
- [x] Search theo tên môn English (`offerings.js:114` `c.name_en LIKE ?`)
- [x] Search theo tên môn Chinese (`offerings.js:115` `c.name_zh LIKE ?`)
- [x] Search theo tên giảng viên English (`offerings.js:116` `p.name_en LIKE ?`)
- [x] Search theo tên giảng viên Chinese (`offerings.js:117` `p.name_zh LIKE ?`)
- [x] Search theo semester (`offerings.js:118` `o.semester LIKE ?`)
- [x] Chỉ user đã login + verified mới tạo review (`offerings.js:386` dùng `authenticateToken + requireVerified`)
- [x] Validate 6 rating từ 1 đến 5 (`offerings.js:398-415`)
- [x] `comment` không được rỗng (`offerings.js:393-396`)
- [x] Một user chỉ review 1 lần cho 1 offering (`offerings.js:445-458` check trùng theo `user_id + scr_selcode + cls_id`)
- [x] Review anonymous chỉ hiện `匿名學生` (`offerings.js:341-343`)
- [x] Không lộ `user_id`, `email` trong public review API (`offerings.js:339-368` chỉ trả về `author_name` từ email trước `@`, không trả `user_id`/`user_email`)
- [x] Chỉ owner được sửa review (`reviews.js:205-209`)
- [x] Chỉ owner được xóa review (`reviews.js:380-384`)
- [x] Xóa review là soft delete: `status = deleted` (`reviews.js:392-396`)
- [x] Chỉ hiện review có `status = visible` (`offerings.js:301` trong list reviews; `offerings.js:65,75,191,217` trong count/avg/tags)

## Tiêu chí hoàn thành
- [x] Có thể lấy danh sách courses
- [x] Có thể lấy danh sách professors
- [x] Có thể tìm offerings
- [x] Có thể xem detail một offering
- [x] Có thể tạo, sửa, xóa mềm review
- [x] Có thể xem `My Reviews`

---

# Bước 5 — Vote / Report / Admin API
## Mục tiêu
Thêm tương tác và kiểm duyệt.

## File cần tạo
- [x] `server/routes/votes.js`
- [x] `server/routes/reports.js`
- [x] `server/routes/admin.js`

## API cần làm
- [x] `POST /api/reviews/:id/vote`
- [x] `POST /api/reviews/:id/report`
- [x] `GET /api/admin/reports`
- [x] `PUT /api/admin/reviews/:id/hide`
- [x] `PUT /api/admin/reports/:id/resolve`

## Vote rules
- [x] Chỉ user đã login + verified mới vote
- [x] `value` chỉ nhận `1` hoặc `-1`
- [x] Không cho vote review của chính mình
- [x] Nếu đã vote thì update
- [x] Nếu chưa vote thì insert

## Report rules
- [x] Chỉ user đã login + verified mới report
- [x] `reason` không được rỗng
- [x] Một user chỉ report một review một lần

## Admin rules
- [x] Chỉ admin mới vào được `/api/admin/*`
- [x] Admin xem được danh sách report pending
- [x] Admin hide review bằng `status = hidden`
- [x] Admin resolve report bằng `status = resolved`

## Tiêu chí hoàn thành
- [x] Vote hoạt động
- [x] Report hoạt động
- [x] Admin dashboard API hoạt động

---

# Bước 6 — Frontend Vue cơ bản
## Mục tiêu
Tạo khung frontend.

## File / cấu trúc cần có
- [x] `client/src/main.js`
- [x] `client/src/App.vue`
- [x] `client/src/router.js`
- [x] `client/src/api.js`
- [x] `client/src/assets/style.css`
- [x] `client/src/components/Navbar.vue`
- [x] `client/src/components/SearchBar.vue`
- [x] `client/src/components/OfferingCard.vue`
- [x] `client/src/components/ReviewCard.vue`
- [x] `client/src/components/RatingInput.vue`
- [x] `client/src/components/TagSelector.vue`

## Route cần tạo
- [x] `/`
- [x] `/login`
- [x] `/register`
- [x] `/search`
- [x] `/offerings/:id`
- [x] `/offerings/:id/review`
- [x] `/reviews/:id/edit`
- [x] `/me/reviews`
- [x] `/admin/reports`

## Logic frontend cơ bản
- [x] Tích hợp Vue Router
- [x] `api.js` tự gắn JWT từ localStorage
- [x] Navbar hiển thị theo trạng thái login
- [x] Có route guard cơ bản cho admin / logged in user

## Tiêu chí hoàn thành
- Frontend chạy được ở `http://localhost:5173`
- Router điều hướng được
- Có layout cơ bản

---

# Bước 7 — Hoàn thiện frontend pages
## Mục tiêu
Kết nối giao diện với backend.

## Trang cần làm
- [x] `HomePage.vue`
- [x] `LoginPage.vue`
- [x] `RegisterPage.vue`
- [x] `SearchResultsPage.vue`
- [x] `OfferingDetailPage.vue`
- [x] `CreateReviewPage.vue`
- [x] `EditReviewPage.vue`
- [x] `MyReviewsPage.vue`
- [x] `AdminReportsPage.vue`

## Chức năng từng trang
### Home
- [x] Hiển thị tên website
- [x] Có search bar
- [x] Hiển thị offerings

### Login
- [x] Gọi API login
- [x] Lưu token
- [x] Chuyển về home

### Register
- [x] Gọi API register
- [x] Hiển thị `verification_link`

### SearchResults
- [x] Gọi API search offerings
- [x] Hiển thị kết quả

### OfferingDetail
- [x] Gọi API offering detail
- [x] Gọi API reviews
- [x] Hiển thị average rating
- [x] Hiển thị tags
- [x] Hiển thị review list
- [x] Vote / report được

### CreateReview
- [x] Form 6 rating
- [x] comment
- [x] advice
- [x] anonymous checkbox
- [x] tag selector
- [x] submit review

### EditReview
- [x] Load review cũ
- [x] Sửa review
- [x] Submit update

### MyReviews
- [x] Xem danh sách review của mình
- [x] Edit
- [x] Delete

### AdminReports
- [x] Xem reports
- [x] Hide review
- [x] Resolve report

## Tiêu chí hoàn thành
- User có thể đăng ký / đăng nhập trên giao diện
- User có thể search và xem offering
- User có thể tạo review
- Admin có thể xử lý report

---

# Bước 8 — README / HackMD / hoàn thiện trước khi nộp
## Mục tiêu
Chuẩn bị tài liệu nộp bài.

## README.md
- [x] Viết mô tả project
- [x] Viết motivation
- [x] Viết tech stack
- [x] Viết folder structure
- [x] Viết hướng dẫn chạy backend
- [x] Viết hướng dẫn chạy frontend
- [x] Viết hướng dẫn seed database
- [x] Viết demo accounts
- [x] Viết progress / future work
- [x] Ghi chú dữ liệu mô phỏng

## HackMD / Notion
- [ ] Thêm họ tên
- [ ] Thêm lớp
- [ ] Thêm tên nhóm
- [ ] Thêm tiêu đề website
- [ ] Thêm GitHub repo
- [ ] Giải thích động cơ làm project
- [ ] Giải thích hệ thống
- [ ] Giải thích database
- [ ] Giải thích API
- [ ] Chụp ảnh từng màn hình
- [ ] Viết khó khăn và cách giải quyết
- [ ] Viết future work

## Ảnh cần chụp
- [ ] Trang chủ
- [ ] Trang login
- [ ] Trang register
- [ ] Search results
- [ ] Offering detail
- [ ] Create review
- [ ] My Reviews
- [ ] Admin dashboard

## Kiểm tra GitHub trước khi nộp
- [ ] Không upload `node_modules`
- [ ] Không upload `.env`
- [ ] Không upload `database.sqlite`
- [ ] Có `README.md`
- [ ] Code chạy được sau khi clone

---

## 6. Tài khoản demo

### Admin
- Email: `admin@fcu.edu.tw`
- Password: `admin123`

### Student
- Email: `student1@fcu.edu.tw`
- Password: `student123`

- Email: `student2@fcu.edu.tw`
- Password: `student123`

### Unverified student
- Email: `unverified@fcu.edu.tw`
- Password: `student123`

---

## 7. Ưu tiên làm việc tiếp theo

### Ưu tiên cao nhất
- [x] Hoàn thành Bước 4

### Ưu tiên thứ hai
- [x] Hoàn thành Bước 5

### Sau đó mới làm
- [x] Bước 6
- [x] Bước 7
- [ ] Bước 8

---

## 8. Kết luận

Tình trạng hiện tại:

- Backend cơ bản: ổn
- Database + seed: ổn
- Auth API: ổn
- API nghiệp vụ chính (Course / Professor / Offering / Review): ổn
- Vote / Report / Admin API: ổn
- Frontend hoàn chỉnh: ổn
- README / báo cáo: chưa hoàn thiện

**Kết luận cuối:**
Project hiện tại đã xong khoảng **7/8 bước**.
Việc cần làm ngay bây giờ là **Bước 8: README / HackMD / hoàn thiện trước khi nộp**.
