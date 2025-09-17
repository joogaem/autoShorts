import express, { Request, Response } from 'express';
import { ChatOpenAI } from '@langchain/openai';

const router = express.Router();

// OpenAI 모델 초기화
const model = new ChatOpenAI({
    modelName: 'gpt-4o',
    temperature: 0.3,
    maxTokens: 1000,
});

// POST /api/translate
router.post('/', async (req: Request, res: Response) => {
    try {
        const { text, targetLanguage } = req.body;

        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            res.status(400).json({
                error: 'text is required and must be a non-empty string'
            });
            return;
        }

        if (!targetLanguage || !['korean', 'english'].includes(targetLanguage)) {
            res.status(400).json({
                error: 'targetLanguage is required and must be either "korean" or "english"'
            });
            return;
        }

        // 번역 프롬프트 생성
        const prompt = targetLanguage === 'korean'
            ? `다음 영어 텍스트를 자연스러운 한국어로 번역해주세요. 교육용 콘텐츠에 적합한 톤으로 번역하고, 전문 용어는 이해하기 쉽게 설명해주세요.

영어 텍스트:
${text}

한국어 번역:`
            : `다음 한국어 텍스트를 자연스러운 영어로 번역해주세요. 교육용 콘텐츠에 적합한 톤으로 번역하고, 이미지 생성 프롬프트에 적합한 구체적이고 시각적인 표현을 사용해주세요.

한국어 텍스트:
${text}

영어 번역:`;

        // OpenAI API 호출
        const response = await model.invoke(prompt);
        const translatedText = response.content as string;

        res.json({
            success: true,
            data: {
                originalText: text,
                translatedText: translatedText.trim(),
                targetLanguage
            }
        });

    } catch (error) {
        console.error('번역 중 오류 발생:', error);
        res.status(500).json({
            error: 'Translation failed',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});

export default router;
