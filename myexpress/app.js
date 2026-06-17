import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


import indexRouter from './routes/index.js';
import usersRouter from './routes/users.js';
import authRouter from './routes/auth.js';
import coursesRouter from './routes/courses.js';
import professorsRouter from './routes/professors.js';
import offeringsRouter from './routes/offerings.js';
import reviewsRouter from './routes/reviews.js';

var app = express();
app.use(cors());

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Health check (Buoc 1)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'fcu-review-platform', time: new Date().toISOString() });
});

app.use('/', indexRouter);
app.use('/users', usersRouter);

// Buoc 3: Auth API
app.use('/api/auth', authRouter);

// Buoc 4: Course / Professor / Offering / Review API
app.use('/api/courses', coursesRouter);
app.use('/api/professors', professorsRouter);
app.use('/api/offerings', offeringsRouter);
// reviewsRouter dong thoi xu ly /api/me/reviews va /api/reviews/:id
app.use('/api', reviewsRouter);

export default app;