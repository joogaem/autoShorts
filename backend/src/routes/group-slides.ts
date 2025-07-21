import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
// @ts-ignore
import pdfParse from 'pdf-parse';
// @ts-ignore
import pptx2json from 'pptx2json';

interface Slide {
    id: number;
    text: string;
    images: string[];
    hasVisuals: boolean;
}

interface SlideGroup {
    id: string;
    title: string;
    slides: Slide[];
    estimatedDuration: number;
    thumbnail?: string;
}

const router = express.Router();

// 슬라이드를 그룹으로 나누는 함수
function groupSlides(slides: Slide[], maxSlidesPerGroup: number = 3, maxDurationPerGroup: number = 60): SlideGroup[] {
    const groups: SlideGroup[] = [];
    let currentGroup: Slide[] = [];
    let currentDuration = 0;
    let groupId = 1;

    for (const slide of slides) {
        // 슬라이드 텍스트 길이로 대략적인 지속 시간 계산 (한국어 기준)
        const slideText = slide.text.replace(/[^\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/g, '');
        const slideDuration = Math.ceil(slideText.length / 3.5); // 3.5음절/초

        // 현재 그룹에 추가할 수 있는지 확인
        const canAddToCurrentGroup =
            currentGroup.length < maxSlidesPerGroup &&
            (currentDuration + slideDuration) <= maxDurationPerGroup;

        if (canAddToCurrentGroup) {
            currentGroup.push(slide);
            currentDuration += slideDuration;
        } else {
            // 현재 그룹이 있으면 저장
            if (currentGroup.length > 0) {
                groups.push(createSlideGroup(currentGroup, groupId++));
            }
            // 새 그룹 시작
            currentGroup = [slide];
            currentDuration = slideDuration;
        }
    }

    // 마지막 그룹 처리
    if (currentGroup.length > 0) {
        groups.push(createSlideGroup(currentGroup, groupId++));
    }

    return groups;
}

// 슬라이드 그룹 생성 함수
function createSlideGroup(slides: Slide[], groupId: number): SlideGroup {
    const firstSlide = slides[0];
    const lastSlide = slides[slides.length - 1];

    // 그룹 제목 생성 (첫 번째 슬라이드의 텍스트에서 추출)
    let title = `쇼츠 ${groupId}`;
    if (firstSlide.text && firstSlide.text.trim()) {
        const firstLine = firstSlide.text.split('\n')[0].trim();
        if (firstLine.length > 0) {
            title = firstLine.length > 30 ? firstLine.substring(0, 30) + '...' : firstLine;
        }
    }

    // 예상 지속 시간 계산
    const totalText = slides.map(s => s.text).join(' ');
    const cleanText = totalText.replace(/[^\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/g, '');
    const estimatedDuration = Math.ceil(cleanText.length / 3.5);

    // 썸네일 이미지 선택 (첫 번째 슬라이드의 첫 번째 이미지)
    let thumbnail: string | undefined;
    if (firstSlide.images && firstSlide.images.length > 0) {
        thumbnail = firstSlide.images[0];
    }

    return {
        id: `group-${groupId}`,
        title,
        slides,
        estimatedDuration: Math.max(30, Math.min(90, estimatedDuration)),
        thumbnail
    };
}

// POST /api/group-slides
router.post('/', async (req: Request, res: Response) => {
    console.log('=== 슬라이드 그룹화 요청 시작 ===');
    console.log('요청 본문:', req.body);

    try {
        let { slides, filename, maxSlidesPerGroup = 3, maxDurationPerGroup = 60 } = req.body;

        // slides가 없고 filename만 있으면 파일에서 슬라이드 추출
        if ((!slides || !Array.isArray(slides) || slides.length === 0) && filename) {
            // 파일 경로
            const filePath = path.join(__dirname, '../../uploads', filename);
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: 'File not found' });
            }
            const ext = path.extname(filename).toLowerCase();
            if (ext === '.pdf') {
                const dataBuffer = fs.readFileSync(filePath);
                const pdfData = await pdfParse(dataBuffer);
                // PDF 텍스트 분할 함수 재사용
                const splitPdfTextIntoPages = (text: string, numPages: number): string[] => {
                    if (!text || text.trim() === '') return Array(numPages).fill('');
                    const lines = text.split('\n').filter(line => line.trim() !== '');
                    if (lines.length === 0) return Array(numPages).fill('');
                    const linesPerPage = Math.ceil(lines.length / numPages);
                    const pages: string[] = [];
                    for (let i = 0; i < numPages; i++) {
                        const startIndex = i * linesPerPage;
                        const endIndex = Math.min((i + 1) * linesPerPage, lines.length);
                        const pageLines = lines.slice(startIndex, endIndex);
                        pages.push(pageLines.join('\n').trim());
                    }
                    return pages;
                };
                const pageTexts = splitPdfTextIntoPages(pdfData.text, pdfData.numpages);
                slides = pageTexts.map((pageText, pageIndex) => ({
                    id: pageIndex + 1,
                    text: pageText,
                    images: [],
                    hasVisuals: false
                }));
            } else if (ext === '.pptx') {
                const result = await pptx2json(filePath);
                slides = result.slides.map((slide: any, slideIndex: number) => {
                    const textContent = (slide.texts || []).join(' ').trim();
                    const imageUrls: string[] = [];
                    if (slide.images && slide.images.length > 0) {
                        slide.images.forEach((img: any, imageIndex: number) => {
                            if (img.data) {
                                // 이미지 저장 로직은 생략 (필요시 parse.ts 참고)
                                imageUrls.push('');
                            }
                        });
                    }
                    return {
                        id: slideIndex + 1,
                        text: textContent,
                        images: imageUrls,
                        hasVisuals: imageUrls.length > 0 || (slide.images && slide.images.length > 0)
                    };
                });
            } else {
                return res.status(400).json({ error: 'Unsupported file type' });
            }
        }

        // 필수 파라미터 검증
        if (!slides || !Array.isArray(slides) || slides.length === 0) {
            console.error('슬라이드 그룹화 오류: slides가 없거나 유효하지 않음');
            res.status(400).json({
                error: 'slides is required and must be a non-empty array'
            });
            return;
        }

        console.log('슬라이드 그룹화 파라미터:', {
            slidesCount: slides.length,
            maxSlidesPerGroup,
            maxDurationPerGroup
        });

        // 슬라이드 데이터 검증
        const validSlides = slides.every((slide: any) =>
            slide.id &&
            typeof slide.text === 'string' &&
            Array.isArray(slide.images) &&
            typeof slide.hasVisuals === 'boolean'
        );

        if (!validSlides) {
            console.error('슬라이드 그룹화 오류: 슬라이드 데이터 형식이 유효하지 않음');
            res.status(400).json({
                error: 'Invalid slide data format. Each slide must have id, text, images, and hasVisuals properties.'
            });
            return;
        }

        // 슬라이드 그룹화
        const groups = groupSlides(slides, maxSlidesPerGroup, maxDurationPerGroup);

        console.log('슬라이드 그룹화 완료:', {
            totalGroups: groups.length,
            groups: groups.map(g => ({
                id: g.id,
                title: g.title,
                slideCount: g.slides.length,
                estimatedDuration: g.estimatedDuration
            }))
        });

        res.json({
            success: true,
            data: {
                groups,
                totalGroups: groups.length,
                originalSlideCount: slides.length
            }
        });

        console.log('=== 슬라이드 그룹화 요청 완료 ===');

    } catch (error) {
        console.error('슬라이드 그룹화 중 오류 발생:', error);
        res.status(500).json({
            error: 'Slide grouping failed',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});

export { groupSlides, Slide, SlideGroup };
export default router; 