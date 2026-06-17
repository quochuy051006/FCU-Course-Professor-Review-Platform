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

### Chưa xong
- [ ] Bước 4: Course / Professor / Offering / Review API
- [ ] Bước 5: Vote / Report / Admin API
- [ ] Bước 6: Frontend Vue cơ bản
- [ ] Bước 7: Hoàn thiện các trang frontend
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

## File cần tạo
- [ ] `server/routes/courses.js`
- [ ] `server/routes/professors.js`
- [ ] `server/routes/offerings.js`
- [ ] `server/routes/reviews.js`

## API cần làm
- [ ] `GET /api/courses`
- [ ] `GET /api/professors`
- [ ] `GET /api/offerings`
- [ ] `GET /api/offerings/search?q=...`
- [ ] `GET /api/offerings/:id`
- [ ] `GET /api/offerings/:id/reviews`
- [ ] `POST /api/offerings/:id/reviews`
- [ ] `PUT /api/reviews/:id`
- [ ] `DELETE /api/reviews/:id`
- [ ] `GET /api/me/reviews`

## Logic bắt buộc
- [ ] Offering phải là `Course + Professor + Semester`
- [ ] Search theo course code
- [ ] Search theo tên môn English
- [ ] Search theo tên môn Chinese
- [ ] Search theo tên giảng viên English
- [ ] Search theo tên giảng viên Chinese
- [ ] Search theo semester
- [ ] Chỉ user đã login + verified mới tạo review
- [ ] Validate 6 rating từ 1 đến 5
- [ ] `comment` không được rỗng
- [ ] Một user chỉ review 1 lần cho 1 offering
- [ ] Review anonymous chỉ hiện `匿名學生`
- [ ] Không lộ `user_id`, `email` trong public review API
- [ ] Chỉ owner được sửa review
- [ ] Chỉ owner được xóa review
- [ ] Xóa review là soft delete: `status = deleted`
- [ ] Chỉ hiện review có `status = visible`

## Tiêu chí hoàn thành
- Có thể lấy danh sách courses
- Có thể lấy danh sách professors
- Có thể tìm offerings
- Có thể xem detail một offering
- Có thể tạo, sửa, xóa mềm review
- Có thể xem `My Reviews`

---

# Bước 5 — Vote / Report / Admin API
## Mục tiêu
Thêm tương tác và kiểm duyệt.

## File cần tạo
- [ ] `server/routes/votes.js`
- [ ] `server/routes/reports.js`
- [ ] `server/routes/admin.js`

## API cần làm
- [ ] `POST /api/reviews/:id/vote`
- [ ] `POST /api/reviews/:id/report`
- [ ] `GET /api/admin/reports`
- [ ] `PUT /api/admin/reviews/:id/hide`
- [ ] `PUT /api/admin/reports/:id/resolve`

## Vote rules
- [ ] Chỉ user đã login + verified mới vote
- [ ] `value` chỉ nhận `1` hoặc `-1`
- [ ] Không cho vote review của chính mình
- [ ] Nếu đã vote thì update
- [ ] Nếu chưa vote thì insert

## Report rules
- [ ] Chỉ user đã login + verified mới report
- [ ] `reason` không được rỗng
- [ ] Một user chỉ report một review một lần

## Admin rules
- [ ] Chỉ admin mới vào được `/api/admin/*`
- [ ] Admin xem được danh sách report pending
- [ ] Admin hide review bằng `status = hidden`
- [ ] Admin resolve report bằng `status = resolved`

## Tiêu chí hoàn thành
- Vote hoạt động
- Report hoạt động
- Admin dashboard API hoạt động

---

# Bước 6 — Frontend Vue cơ bản
## Mục tiêu
Tạo khung frontend.

## File / cấu trúc cần có
- [ ] `client/src/main.js`
- [ ] `client/src/App.vue`
- [ ] `client/src/router.js`
- [ ] `client/src/api.js`
- [ ] `client/src/assets/style.css`
- [ ] `client/src/components/Navbar.vue`
- [ ] `client/src/components/SearchBar.vue`
- [ ] `client/src/components/OfferingCard.vue`
- [ ] `client/src/components/ReviewCard.vue`
- [ ] `client/src/components/RatingInput.vue`
- [ ] `client/src/components/TagSelector.vue`

## Route cần tạo
- [ ] `/`
- [ ] `/login`
- [ ] `/register`
- [ ] `/search`
- [ ] `/offerings/:id`
- [ ] `/offerings/:id/review`
- [ ] `/reviews/:id/edit`
- [ ] `/me/reviews`
- [ ] `/admin/reports`

## Logic frontend cơ bản
- [ ] Tích hợp Vue Router
- [ ] `api.js` tự gắn JWT từ localStorage
- [ ] Navbar hiển thị theo trạng thái login
- [ ] Có route guard cơ bản cho admin / logged in user

## Tiêu chí hoàn thành
- Frontend chạy được ở `http://localhost:5173`
- Router điều hướng được
- Có layout cơ bản

---

# Bước 7 — Hoàn thiện frontend pages
## Mục tiêu
Kết nối giao diện với backend.

## Trang cần làm
- [ ] `HomePage.vue`
- [ ] `LoginPage.vue`
- [ ] `RegisterPage.vue`
- [ ] `SearchResultsPage.vue`
- [ ] `OfferingDetailPage.vue`
- [ ] `CreateReviewPage.vue`
- [ ] `EditReviewPage.vue`
- [ ] `MyReviewsPage.vue`
- [ ] `AdminReportsPage.vue`

## Chức năng từng trang
### Home
- [ ] Hiển thị tên website
- [ ] Có search bar
- [ ] Hiển thị offerings

### Login
- [ ] Gọi API login
- [ ] Lưu token
- [ ] Chuyển về home

### Register
- [ ] Gọi API register
- [ ] Hiển thị `verification_link`

### SearchResults
- [ ] Gọi API search offerings
- [ ] Hiển thị kết quả

### OfferingDetail
- [ ] Gọi API offering detail
- [ ] Gọi API reviews
- [ ] Hiển thị average rating
- [ ] Hiển thị tags
- [ ] Hiển thị review list
- [ ] Vote / report được

### CreateReview
- [ ] Form 6 rating
- [ ] comment
- [ ] advice
- [ ] anonymous checkbox
- [ ] tag selector
- [ ] submit review

### EditReview
- [ ] Load review cũ
- [ ] Sửa review
- [ ] Submit update

### MyReviews
- [ ] Xem danh sách review của mình
- [ ] Edit
- [ ] Delete

### AdminReports
- [ ] Xem reports
- [ ] Hide review
- [ ] Resolve report

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
- [ ] Viết mô tả project
- [ ] Viết motivation
- [ ] Viết tech stack
- [ ] Viết folder structure
- [ ] Viết hướng dẫn chạy backend
- [ ] Viết hướng dẫn chạy frontend
- [ ] Viết hướng dẫn seed database
- [ ] Viết demo accounts
- [ ] Viết progress / future work
- [ ] Ghi chú dữ liệu mô phỏng

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
- [ ] Hoàn thành Bước 4

### Ưu tiên thứ hai
- [ ] Hoàn thành Bước 5

### Sau đó mới làm
- [ ] Bước 6
- [ ] Bước 7
- [ ] Bước 8

---

## 8. Kết luận

Tình trạng hiện tại:

- Backend cơ bản: ổn
- Database + seed: ổn
- Auth API: ổn
- API nghiệp vụ chính: chưa làm
- Frontend hoàn chỉnh: chưa làm
- README / báo cáo: chưa hoàn thiện

**Kết luận cuối:**
Project hiện tại đã xong khoảng **3/8 bước**.  
Việc cần làm ngay bây giờ là **Bước 4: Course / Professor / Offering / Review API**.
