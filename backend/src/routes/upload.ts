import express, { Request, Response } from 'express';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// 업로드 폴더 경로
const UPLOAD_DIR = path.join(__dirname, '../../uploads');

// 업로드 폴더가 없으면 생성
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// multer 설정: 100MB 제한, .pptx만 허용
const upload = multer({
    storage: multer.diskStorage({
        destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
            cb(null, UPLOAD_DIR);
        },
        filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            cb(null, uniqueSuffix + '-' + file.originalname);
        },
    }),
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext === '.pptx' || ext === '.pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only .pptx and .pdf files are allowed!'));
        }
    },
});

// Express Request에 file 속성 추가 (optional)
interface MulterRequest extends Request {
    file?: Express.Multer.File;
}

// POST /upload
router.post('/', upload.single('file'), (req: Request, res: Response) => {
    const file = req.file as Express.Multer.File | undefined;
    if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
    }
    res.json({
        message: 'File uploaded successfully',
        filename: file.filename,
        originalname: file.originalname,
        size: file.size,
    });
});

export default router; 