import express from 'express';
import cors from 'cors';

import { OPENAI_API_KEY, PORT } from './config/env';

console.log('OpenAI Key:', OPENAI_API_KEY);
console.log('Server Port:', PORT);

const app = express();
const port = PORT;

// CORS 미들웨어를 모든 요청에 적용
app.use(cors());

app.get('/', (req, res) => {
    res.send('Hello, backend!');
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});