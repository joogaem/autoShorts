import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
// @ts-ignore
import pdfParse from 'pdf-parse';
// @ts-ignore
import pptx2json from 'pptx2json';

const router = express.Router();

// 임시 이미지 저장 디렉토리
const TEMP_IMAGES_DIR = path.join(__dirname, '../../temp-images');

// 임시 이미지 디렉토리가 없으면 생성
if (!fs.existsSync(TEMP_IMAGES_DIR)) {
    fs.mkdirSync(TEMP_IMAGES_DIR, { recursive: true });
}

// 이미지를 임시 파일로 저장하고 URL 반환하는 함수
const saveImageToTemp = (imageData: string, extension: string, slideIndex: number, imageIndex: number): string => {
    try {
        // base64 데이터에서 실제 데이터 부분만 추출
        const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        // 고유한 파일명 생성
        const timestamp = Date.now();
        const filename = `slide_${slideIndex + 1}_img_${imageIndex + 1}_${timestamp}${extension}`;
        const filePath = path.join(TEMP_IMAGES_DIR, filename);

        // 파일 저장
        fs.writeFileSync(filePath, buffer);

        // URL 반환 (실제 배포 시에는 적절한 URL로 변경 필요)
        return `/temp-images/${filename}`;
    } catch (error) {
        console.error('이미지 저장 실패:', error);
        return '';
    }
};

// PDF 텍스트를 페이지별로 분할하는 함수
const splitPdfTextIntoPages = (text: string, numPages: number): string[] => {
    if (!text || text.trim() === '') {
        // 텍스트가 비어있으면 페이지 수만큼 빈 문자열 반환
        return Array(numPages).fill('');
    }

    // PDF 텍스트를 줄바꿈으로 분할
    const lines = text.split('\n').filter(line => line.trim() !== '');

    if (lines.length === 0) {
        return Array(numPages).fill('');
    }

    // 페이지당 대략적인 라인 수 계산
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

// POST /api/parse
router.post('/', async (req: Request, res: Response) => {
    console.log('=== 파싱 요청 시작 ===');
    console.log('요청 본문:', req.body);

    const { filename } = req.body;
    if (!filename) {
        console.error('파싱 오류: filename이 없음');
        res.status(400).json({ error: 'filename is required' });
        return;
    }

    console.log('파싱할 파일명:', filename);

    const filePath = path.join(__dirname, '../../uploads', filename);
    console.log('파일 경로:', filePath);

    if (!fs.existsSync(filePath)) {
        console.error('파싱 오류: 파일을 찾을 수 없음', filePath);
        res.status(404).json({ error: 'File not found' });
        return;
    }

    console.log('파일 존재 확인됨');

    const ext = path.extname(filename).toLowerCase();
    console.log('파일 확장자:', ext);

    if (ext === '.pdf') {
        console.log('PDF 파싱 시작');
        try {
            console.log('PDF 파일 읽기 시작');
            const dataBuffer = fs.readFileSync(filePath);
            console.log('PDF 파일 읽기 완료, 크기:', dataBuffer.length);

            console.log('PDF 파싱 라이브러리 호출 시작');
            let pdfData;
            try {
                pdfData = await pdfParse(dataBuffer);
                console.log('PDF 파싱 라이브러리 호출 완료');
            } catch (parseError) {
                console.error('PDF 파싱 라이브러리 오류:', parseError);
                // 파싱 라이브러리 오류 시 기본 구조로 응답
                const fallbackSlides = [{
                    id: 1,
                    text: 'PDF 파싱 중 오류가 발생했습니다. 파일이 손상되었거나 지원되지 않는 형식일 수 있습니다.',
                    images: [],
                    hasVisuals: false
                }];

                const fallbackResponse = {
                    filename,
                    type: 'pdf',
                    slides: fallbackSlides,
                    originalInfo: {
                        numpages: 1,
                        info: {}
                    },
                    error: 'PDF parsing library error: ' + String(parseError)
                };

                console.log('PDF 파싱 라이브러리 오류 대체 응답:', JSON.stringify(fallbackResponse, null, 2));
                res.json(fallbackResponse);
                return;
            }

            console.log('PDF 파싱 결과:', {
                filename,
                numPages: pdfData.numpages,
                textLength: pdfData.text?.length || 0,
                textPreview: pdfData.text?.substring(0, 200) || 'No text',
                info: pdfData.info
            });

            // 텍스트가 추출되지 않은 경우 처리
            if (!pdfData.text || pdfData.text.trim() === '') {
                console.warn('PDF에서 텍스트를 추출할 수 없습니다. 빈 페이지로 처리합니다.');
                const slides = Array(pdfData.numpages || 1).fill(null).map((_, pageIndex) => ({
                    id: pageIndex + 1,
                    text: '텍스트를 추출할 수 없습니다. 이 PDF는 이미지나 스캔된 문서일 수 있습니다.',
                    images: [],
                    hasVisuals: false
                }));

                console.log('빈 텍스트 처리 완료, 슬라이드 수:', slides.length);

                const emptyResponse = {
                    filename,
                    type: 'pdf',
                    slides,
                    originalInfo: {
                        numpages: pdfData.numpages,
                        info: pdfData.info
                    },
                    warning: '텍스트 추출에 실패했습니다. 이미지나 스캔된 PDF일 수 있습니다.'
                };

                console.log('PDF 빈 텍스트 최종 응답 구조:', JSON.stringify(emptyResponse, null, 2));
                res.json(emptyResponse);
                console.log('PDF 파싱 응답 전송 완료 (빈 텍스트)');
                return;
            }

            console.log('PDF 텍스트 분할 시작');
            // PDF 텍스트를 페이지별로 분할
            const pageTexts = splitPdfTextIntoPages(pdfData.text, pdfData.numpages);

            console.log('페이지별 텍스트 분할 결과:', pageTexts.map((text, i) => ({
                page: i + 1,
                length: text.length,
                preview: text.substring(0, 100)
            })));

            console.log('슬라이드 구조 변환 시작');
            // PowerPoint와 동일한 출력 구조로 변환
            const slides = pageTexts.map((pageText, pageIndex) => ({
                id: pageIndex + 1,
                text: pageText,
                images: [], // PDF에서는 이미지 추출이 복잡하므로 일단 빈 배열
                hasVisuals: false // PDF에서는 이미지 추출이 복잡하므로 일단 false
            }));

            console.log('슬라이드 구조 변환 완료, 슬라이드 수:', slides.length);

            const response = {
                filename,
                type: 'pdf',
                slides,
                originalInfo: {
                    numpages: pdfData.numpages,
                    info: pdfData.info
                }
            };

            console.log('PDF 파싱 최종 응답 구조:', JSON.stringify(response, null, 2));
            console.log('PDF 파싱 응답 전송 시작');
            res.json(response);
            console.log('PDF 파싱 응답 전송 완료');
            return;
        } catch (err) {
            console.error('PDF 파싱 중 오류 발생:', err);
            console.error('오류 스택:', err instanceof Error ? err.stack : 'No stack trace');

            // 최종 에러 처리 - 기본 구조로 응답
            const errorSlides = [{
                id: 1,
                text: 'PDF 파싱 중 오류가 발생했습니다: ' + String(err),
                images: [],
                hasVisuals: false
            }];

            const errorResponse = {
                filename,
                type: 'pdf',
                slides: errorSlides,
                originalInfo: {
                    numpages: 1,
                    info: {}
                },
                error: 'PDF parsing failed: ' + String(err)
            };

            console.log('PDF 파싱 오류 대체 응답:', JSON.stringify(errorResponse, null, 2));
            res.json(errorResponse);
            return;
        }
    }
    if (ext === '.pptx') {
        console.log('PPTX 파싱 시작');
        try {
            console.log('PPTX 파싱 라이브러리 호출 시작');
            const result = await pptx2json(filePath);
            console.log('PPTX 파싱 라이브러리 호출 완료');
            console.log('PPTX 파싱 결과:', {
                filename,
                slidesCount: result.slides?.length || 0
            });

            console.log('슬라이드 구조 변환 시작');
            // 계획된 출력 구조에 맞게 변환
            const slides = result.slides.map((slide: any, slideIndex: number) => {
                console.log(`슬라이드 ${slideIndex + 1} 처리 중:`, {
                    textsCount: slide.texts?.length || 0,
                    imagesCount: slide.images?.length || 0
                });

                // 텍스트 내용을 하나의 문자열로 결합
                const textContent = (slide.texts || []).join(' ').trim();

                // 이미지 처리 및 URL 생성
                const imageUrls: string[] = [];
                if (slide.images && slide.images.length > 0) {
                    console.log(`슬라이드 ${slideIndex + 1} 이미지 처리 시작, 이미지 수:`, slide.images.length);
                    slide.images.forEach((img: any, imageIndex: number) => {
                        if (img.data) {
                            console.log(`이미지 ${imageIndex + 1} 저장 시작`);
                            const imageUrl = saveImageToTemp(img.data, img.ext, slideIndex, imageIndex);
                            if (imageUrl) {
                                imageUrls.push(imageUrl);
                                console.log(`이미지 ${imageIndex + 1} 저장 완료:`, imageUrl);
                            } else {
                                console.warn(`이미지 ${imageIndex + 1} 저장 실패`);
                            }
                        } else {
                            console.warn(`이미지 ${imageIndex + 1} 데이터 없음`);
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

            console.log('슬라이드 구조 변환 완료, 슬라이드 수:', slides.length);

            const response = {
                filename,
                type: 'pptx',
                slides,
            };

            console.log('PPTX 파싱 응답 전송 시작');
            res.json(response);
            console.log('PPTX 파싱 응답 전송 완료');
            return;
        } catch (err) {
            console.error('PPTX 파싱 중 오류 발생:', err);
            console.error('오류 스택:', err instanceof Error ? err.stack : 'No stack trace');
            res.status(500).json({ error: 'PPTX parsing failed', details: String(err) });
            return;
        }
    }
    // TODO: pptx 등 다른 확장자 분기

    console.log('지원하지 않는 파일 형식:', ext);
    res.json({
        message: '파싱 준비 완료',
        filename,
        // 추출 결과는 이후 추가
    });
    console.log('=== 파싱 요청 완료 ===');
});

export default router; 