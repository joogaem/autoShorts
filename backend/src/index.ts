import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import path from 'path';
import fs from 'fs';

import { OPENAI_API_KEY, PORT } from './config/env';
import uploadRouter from './routes/upload';
import parseRouter from './routes/parse';
import generateScriptRouter from './routes/generate-script';
import groupSlidesRouter from './routes/group-slides';

console.log('OpenAI Key:', OPENAI_API_KEY);
console.log('Server Port:', PORT);

const app = express();
const port = PORT;

// CORS 미들웨어를 모든 요청에 적용
app.use(cors());
app.use(express.json());

// 정적 파일 서빙 설정
app.use('/temp-images', express.static(path.join(__dirname, '../temp-images')));

app.get('/', (req, res) => {
    res.send('Hello, backend!');
});

app.use('/api/upload', uploadRouter);
app.use('/api/parse', parseRouter);
app.use('/api/generate-script', generateScriptRouter);
app.use('/api/group-slides', groupSlidesRouter);

// 1시간마다 /uploads 폴더에서 24시간 이상 지난 파일 삭제
const UPLOAD_DIR = path.join(__dirname, '../uploads');
cron.schedule('0 * * * *', () => {
    const now = Date.now();
    const files = fs.readdirSync(UPLOAD_DIR);
    files.forEach(file => {
        const filePath = path.join(UPLOAD_DIR, file);
        try {
            const stats = fs.statSync(filePath);
            const age = (now - stats.mtimeMs) / 1000; // 초 단위
            if (age > 86400) { // 24시간
                fs.unlinkSync(filePath);
                console.log(`[AutoDelete] Deleted: ${file}`);
            }
        } catch (err) {
            console.error(`[AutoDelete] Error deleting ${file}:`, err);
        }
    });
});

// 1시간마다 /temp-images 폴더에서 24시간 이상 지난 파일 삭제
const TEMP_IMAGES_DIR = path.join(__dirname, '../temp-images');
cron.schedule('0 * * * *', () => {
    if (!fs.existsSync(TEMP_IMAGES_DIR)) return;

    const now = Date.now();
    const files = fs.readdirSync(TEMP_IMAGES_DIR);
    files.forEach(file => {
        const filePath = path.join(TEMP_IMAGES_DIR, file);
        try {
            const stats = fs.statSync(filePath);
            const age = (now - stats.mtimeMs) / 1000; // 초 단위
            if (age > 86400) { // 24시간
                fs.unlinkSync(filePath);
                console.log(`[AutoDelete] Deleted temp image: ${file}`);
            }
        } catch (err) {
            console.error(`[AutoDelete] Error deleting temp image ${file}:`, err);
        }
    });
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});