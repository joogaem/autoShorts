import express, { Request, Response } from 'express';

const router = express.Router();

// POST /api/parse
router.post('/', async (req: Request, res: Response) => {
    console.log('=== 파싱 요청 시작 ===');
    console.log('요청 본문:', req.body);

    // PDF/PPTX 파싱은 더 이상 지원하지 않음
    // 텍스트 입력은 /api/generate-from-text를 사용하세요
    res.status(400).json({
        error: 'PDF/PPTX parsing is no longer supported. Please use /api/generate-from-text for text input instead.'
    });
});

export default router;
