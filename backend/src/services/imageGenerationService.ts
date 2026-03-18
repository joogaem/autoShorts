import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { ImageGenerationRequest } from './visualAnalysisService';
import { OPENAI_API_KEY, GOOGLE_API_KEY } from '../config/env';
import * as fs from 'fs';
import * as path from 'path';

export interface GeneratedImage {
    id: string;
    url: string;
    prompt: string;
    metadata: {
        provider: 'gemini-image' | 'dall-e';
        model: string;
        size: string;
        createdAt: Date;
    };
}

export class ImageGenerationService {
    private readonly openai: OpenAI;
    private readonly genAI: GoogleGenAI;

    constructor() {
        if (!OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY가 설정되지 않았습니다. 환경 변수를 확인해주세요.');
        }
        if (!GOOGLE_API_KEY) {
            throw new Error('GOOGLE_API_KEY가 설정되지 않았습니다. 환경 변수를 확인해주세요.');
        }

        this.openai = new OpenAI({
            apiKey: OPENAI_API_KEY,
        });

        this.genAI = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });
    }

    /**
     * Gemini 내장 이미지 생성 모델을 사용하여 이미지를 생성합니다.
     */
    public async generateImageWithGemini(request: ImageGenerationRequest, referenceImagePath?: string): Promise<GeneratedImage> {
        console.log('=== Gemini 이미지 생성 시작 ===');
        console.log('📝 요청 데이터:', {
            prompt: request.prompt,
            style: request.style,
            aspectRatio: request.aspectRatio,
            quality: request.quality,
            hasReference: !!referenceImagePath,
        });

        try {
            // 레퍼런스 이미지가 있으면 멀티모달, 없으면 텍스트 단독 요청
            let contents: any;
            if (referenceImagePath && fs.existsSync(referenceImagePath)) {
                const referenceBase64 = fs.readFileSync(referenceImagePath).toString('base64');
                contents = this.buildMultimodalContents(request, referenceBase64);
                console.log('🖼️ 레퍼런스 이미지 포함 멀티모달 요청');
            } else {
                contents = this.buildImagePrompt(request);
                console.log('📝 텍스트 단독 요청');
            }

            console.log('🎨 Gemini 이미지 생성 시도 (모델: gemini-2.5-flash-image)');
            const response = await this.genAI.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents,
            });

            console.log('✅ Gemini API 응답 수신 성공');

            const imageId = this.generateImageId();
            let imageData: string | null = null;

            // 응답에서 이미지 데이터 추출 (예제 코드 방식)
            if (response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.text) {
                        console.log('📄 텍스트 응답:', part.text);
                    } else if (part.inlineData && part.inlineData.data) {
                        imageData = part.inlineData.data || null;
                        if (imageData) {
                            console.log('🖼️ 이미지 데이터 발견! 길이:', imageData.length);
                        }
                        break;
                    }
                }
            }

            if (!imageData) {
                console.error('⚠️ Gemini 응답에 inlineData(이미지)가 없습니다.');
                throw new Error('Gemini API에서 이미지 데이터를 받지 못했습니다.');
            }

            console.log('✅ Gemini 이미지 데이터 추출 성공:', {
                imageId: imageId,
                dataLength: imageData.length
            });

            // Base64 데이터를 직접 Buffer로 변환하여 파일로 저장
            // Windows에서 한글 경로 문제 해결: C:\ffmpeg 사용
            const tempDir = process.platform === 'win32' 
                ? 'C:\\ffmpeg' 
                : path.join(process.cwd(), 'temp-images');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const fileName = `${imageId}.png`;
            const filePath = path.join(tempDir, fileName);
            const imageBuffer = Buffer.from(imageData, 'base64');
            fs.writeFileSync(filePath, imageBuffer);

            console.log('✅ 이미지 파일 저장 완료:', {
                fileName: fileName,
                filePath: filePath,
                fileSize: imageBuffer.length,
                relativePath: `/temp-images/${fileName}`
            });

            return {
                id: imageId,
                url: `/temp-images/${fileName}`,
                prompt: request.prompt,
                metadata: {
                    provider: 'gemini-image',
                    model: 'gemini-2.5-flash-image',
                    size: this.getImageSize(request.aspectRatio || '1:1'),
                    createdAt: new Date()
                }
            };
        } catch (error: any) {
            console.error('❌ Gemini 이미지 생성 실패!');
            console.error('에러 타입:', error.constructor.name);
            console.error('에러 메시지:', error.message);

            if (error.stack) {
                console.error('📚 에러 스택 트레이스:', error.stack);
            }

            throw new Error(`Gemini image generation failed: ${error.message}`);
        }
    }

    /**
     * 이미지 생성을 위한 프롬프트를 구성합니다.
     */
    private buildImagePrompt(request: ImageGenerationRequest): string {
        return `Generate a high-quality image based on this prompt: ${request.prompt}. No text, no letters, no numbers anywhere in the image.`;
    }

    /**
     * 레퍼런스 이미지를 포함한 Gemini 멀티모달 요청용 contents를 구성합니다.
     * 레퍼런스 이미지와 동일한 캐릭터·화풍을 유지하면서 새 장면을 생성합니다.
     */
    private buildMultimodalContents(request: ImageGenerationRequest, referenceImageBase64: string): any[] {
        return [
            {
                role: 'user',
                parts: [
                    {
                        inlineData: {
                            mimeType: 'image/png',
                            data: referenceImageBase64,
                        },
                    },
                    {
                        text: `This is a reference image. Generate a NEW image that:
1. Uses the EXACT SAME art style as the reference image
2. Features the EXACT SAME characters with the EXACT SAME appearance (hair, skin tone, clothing, facial features) as shown in the reference
3. Only changes the scene, action, or setting as described below
4. No text, no letters, no numbers anywhere in the image

New scene to generate: ${request.prompt}`,
                    },
                ],
            },
        ];
    }

    /**
     * 가로세로 비율을 Gemini API 형식으로 변환합니다.
     */
    private convertAspectRatio(aspectRatio: string): string {
        const ratioMap: Record<string, string> = {
            '1:1': '1:1',
            '2:3': '2:3',
            '3:2': '3:2',
            '3:4': '3:4',
            '4:3': '4:3',
            '4:5': '4:5',
            '5:4': '5:4',
            '9:16': '9:16',
            '16:9': '16:9',
            '21:9': '21:9'
        };
        return ratioMap[aspectRatio] || '1:1';
    }

    /**
     * 가로세로 비율에 따른 이미지 크기를 반환합니다.
     */
    private getImageSize(aspectRatio: string): string {
        const sizeMap: Record<string, string> = {
            '1:1': '1024x1024',
            '2:3': '832x1248',
            '3:2': '1248x832',
            '3:4': '864x1184',
            '4:3': '1184x864',
            '4:5': '896x1152',
            '5:4': '1152x896',
            '9:16': '768x1344',
            '16:9': '1344x768',
            '21:9': '1536x672'
        };
        return sizeMap[aspectRatio] || '1024x1024';
    }

    /**
     * 이미지를 생성합니다 (Gemini 내장 이미지 생성 사용).
     */
    public async generateImage(request: ImageGenerationRequest, referenceImagePath?: string): Promise<GeneratedImage> {
        console.log('=== Gemini 이미지 생성 시작 ===');
        console.log('요청 데이터:', request);

        try {
            console.log('🚀 Gemini로 이미지 생성 시도...');
            const result = await this.generateImageWithGemini(request, referenceImagePath);
            console.log('✅ Gemini 이미지 생성 성공!');
            return result;
        } catch (error) {
            console.error('❌ Gemini 이미지 생성 실패');
            console.error('에러:', error instanceof Error ? error.message : String(error));
            throw new Error(`Gemini image generation failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 여러 이미지를 일괄 생성합니다.
     */
    public async generateMultipleImages(requests: ImageGenerationRequest[]): Promise<GeneratedImage[]> {
        const results: GeneratedImage[] = [];

        for (const request of requests) {
            try {
                const image = await this.generateImage(request);
                results.push(image);
            } catch (error) {
                console.error(`Failed to generate image for prompt: ${request.prompt}`, error);
                // 실패한 이미지는 건너뛰고 계속 진행
            }
        }

        return results;
    }

    /**
     * 고유한 이미지 ID를 생성합니다.
     */
    private generateImageId(): string {
        return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * URL에서 이미지를 다운로드하여 Base64로 변환합니다.
     */
    private async downloadImageAsBase64(imageUrl: string): Promise<string> {
        try {
            const response = await fetch(imageUrl);
            if (!response.ok) {
                throw new Error(`Failed to download image: ${response.statusText}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const mimeType = response.headers.get('content-type') || 'image/png';

            return `data:${mimeType};base64,${buffer.toString('base64')}`;
        } catch (error) {
            console.error('❌ 이미지 다운로드 실패:', error);
            throw new Error(`Failed to download image: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Base64 이미지 데이터를 파일로 저장하고 URL을 반환합니다.
     */
    private saveImageToFile(base64Data: string, imageId: string): string {
        try {
            // Windows에서 한글 경로 문제 해결: C:\ffmpeg 사용
            const tempDir = process.platform === 'win32' 
                ? 'C:\\ffmpeg' 
                : path.join(process.cwd(), 'temp-images');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            // Base64 데이터에서 실제 데이터 부분만 추출
            const base64Content = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
            const fileName = `${imageId}.png`;
            const filePath = path.join(tempDir, fileName);

            // Base64 데이터를 파일로 저장
            const imageBuffer = Buffer.from(base64Content, 'base64');
            fs.writeFileSync(filePath, imageBuffer);

            console.log('✅ 이미지 파일 저장 완료:', {
                fileName: fileName,
                filePath: filePath,
                fileSize: imageBuffer.length,
                relativePath: `/temp-images/${fileName}`
            });

            // 세션 저장소 용량 문제를 피하기 위해, 경량 URL만 반환
            return `/temp-images/${fileName}`;
        } catch (error) {
            console.error('❌ 이미지 파일 저장 실패:', error);
            // 실패 시에도 세션 저장 부담을 줄이기 위해 플레이스홀더 URL 반환
            return `/temp-images/${imageId}.png`;
        }
    }

    /**
     * 플레이스홀더 이미지를 생성합니다 (1:1 정사각형 고정).
     */
    private generatePlaceholderImage(aspectRatio: string, prompt: string): string {
        // SVG 플레이스홀더 이미지 생성 (1:1 정사각형 고정)
        const width = 1024;  // 1:1 정사각형 고정
        const height = 1024; // 1:1 정사각형 고정

        // prompt가 undefined이거나 null인 경우 처리
        const safePrompt = prompt || '이미지 생성 중';
        const displayText = safePrompt.length > 50 ? safePrompt.substring(0, 50) + '...' : safePrompt;

        const svg = `
            <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#1d4ed8;stop-opacity:1" />
                    </linearGradient>
                </defs>
                <rect width="100%" height="100%" fill="url(#grad1)"/>
                <rect x="20" y="20" width="${width - 40}" height="${height - 40}" fill="none" stroke="white" stroke-width="4" rx="20"/>
                <circle cx="${width / 2}" cy="${height / 2 - 60}" r="60" fill="white" opacity="0.8"/>
                <text x="${width / 2}" y="${height / 2 + 20}" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="24" font-weight="bold">🎨</text>
                <text x="${width / 2}" y="${height / 2 + 80}" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="18" font-weight="500">이미지 생성 중</text>
                <text x="${width / 2}" y="${height / 2 + 120}" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" opacity="0.8">${displayText}</text>
            </svg>
        `;

        return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    }

    /**
     * 이미지를 비디오용으로 최적화합니다.
     */
    public async optimizeImageForVideo(imageUrl: string): Promise<string> {
        // 실제 구현에서는 이미지 리사이징 및 최적화 로직을 추가
        // 현재는 원본 URL을 반환
        return imageUrl;
    }

    /**
     * 이미지 캐시를 확인합니다.
     */
    public async checkImageCache(prompt: string): Promise<GeneratedImage | null> {
        // 실제 구현에서는 캐시 시스템을 구현
        // 현재는 null을 반환 (캐시 없음)
        return null;
    }

    /**
     * 이미지 생성 비용을 계산합니다 (DALL-E 3 기준, 1:1 정사각형 표준 품질 고정).
     */
    public calculateImageCost(size: string, quality: string = 'standard'): number {
        // DALL-E 3 가격 (2024년 기준) - 1024x1024 표준 품질 고정
        return 0.040; // 1:1 정사각형 표준 품질 고정 가격
    }

    /**
     * 이미지를 캐시에 저장합니다.
     */
    public async cacheImage(image: GeneratedImage): Promise<void> {
        // 실제 구현에서는 캐시 시스템에 이미지를 저장
        console.log('Caching image:', image.id);
    }

    /**
     * 사용 가능한 모델 목록을 반환합니다.
     */
    public getAvailableModels(): Record<string, any> {
        return {
            'gemini-3-pro-image': {
                name: 'Gemini 3 Pro Image',
                description: 'Gemini 내장 이미지 생성 모델 (Nano Banana Pro)',
                maxSize: 1536,
                cost: 0.039, // 토큰 기반 가격 (1,290 토큰 * $30/1M 토큰)
                supportedRatios: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
                aspectRatio: '1:1'
            },
            'dall-e-3': {
                name: 'DALL-E 3',
                description: 'OpenAI의 최신 이미지 생성 모델 (백업용)',
                maxSize: 1024,
                cost: 0.040,
                fixedSize: '1024x1024',
                fixedQuality: 'standard',
                aspectRatio: '1:1'
            }
        };
    }
} 