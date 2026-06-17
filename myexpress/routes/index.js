import express from 'express';
const router = express.Router();

router.get('/test', (req, res) => {
    res.json({ message: "Bố mày đã kết nối thành công!" });
});

export default router;