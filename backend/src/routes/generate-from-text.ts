import express, { Request, Response } from 'express';
import SectionRefinerService from '../services/sectionRefiner';

const router = express.Router();

// 텍스트를 5개로 균등 분할하는 함수
const splitIntoFive = (text: string): string[] => {
    if (!text || text.trim() === '') {
        return Array(5).fill('');
    }
    const lines = text.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) {
        return Array(5).fill('');
    }
    const linesPerSection = Math.ceil(lines.length / 5);
    const sections: string[] = [];
    for (let i = 0; i < 5; i++) {
        const startIndex = i * linesPerSection;
        const endIndex = Math.min((i + 1) * linesPerSection, lines.length);
        const sectionLines = lines.slice(startIndex, endIndex);
        sections.push(sectionLines.join('\n').trim());
    }
    return sections;
};

// POST /api/generate-from-text
router.post('/', async (req: Request, res: Response) => {
    console.log('=== 텍스트 기반 파싱 요청 시작 ===');
    console.log('요청 본문:', req.body);

    try {
        const { text } = req.body;

        // 텍스트 검증
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            console.error('파싱 오류: text가 없거나 비어있음');
            res.status(400).json({ error: 'text is required and must be a non-empty string' });
            return;
        }

        console.log('입력 텍스트 길이:', text.length);
        console.log('텍스트 미리보기:', text.substring(0, 200));

        // 텍스트를 5개로 균등 분할
        const fiveSections = splitIntoFive(text.trim());
        console.log('5개 섹션 분할 결과:', fiveSections.map((text, i) => ({
            section: i + 1,
            length: text.length,
            preview: text.substring(0, 100)
        })));

        // 섹션 다듬기 서비스 사용
        console.log('섹션 다듬기 시작');
        const sectionRefiner = SectionRefinerService.getInstance();
        const refinedSections = await sectionRefiner.refineSections(fiveSections);
        console.log('섹션 다듬기 완료');

        // 다듬어진 섹션을 슬라이드로 변환
        console.log('슬라이드 구조 변환 시작');
        const slides = refinedSections.map((refinedSection) => ({
            id: refinedSection.id,
            text: refinedSection.refinedText,
            originalText: refinedSection.originalText,
            title: refinedSection.title,
            keyPoints: refinedSection.keyPoints,
            summary: refinedSection.summary,
            sectionType: refinedSection.sectionType,
            images: [], // 텍스트 기반 입력에서는 이미지 없음
            hasVisuals: false // 텍스트 기반 입력에서는 이미지 없음
        }));

        console.log('슬라이드 구조 변환 완료, 슬라이드 수:', slides.length);

        // 슬라이드 배열을 포함하여 응답 (parse.ts와 동일한 형식)
        const response = {
            filename: 'text-input',
            type: 'text',
            slides,
            originalInfo: {
                numpages: 5,
                info: {}
            }
        };

        res.json(response);
        console.log('=== 텍스트 기반 파싱 요청 완료 ===');

    } catch (error) {
        console.error('텍스트 파싱 중 오류 발생:', error);
        console.error('오류 스택:', error instanceof Error ? error.stack : 'No stack trace');

        // 에러 응답
        const errorSlides = [{
            id: 1,
            text: '텍스트 파싱 중 오류가 발생했습니다: ' + String(error),
            images: [],
            hasVisuals: false
        }];

        const errorResponse = {
            filename: 'text-input',
            type: 'text',
            slides: errorSlides,
            originalInfo: {
                numpages: 1,
                info: {}
            },
            error: 'Text parsing failed: ' + String(error)
        };

        res.status(500).json(errorResponse);
    }
});

export default router;

