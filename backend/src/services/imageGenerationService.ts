import OpenAI from 'openai';
import { ImageGenerationRequest } from './visualAnalysisService';
import { OPENAI_API_KEY } from '../config/env';
import * as fs from 'fs';
import * as path from 'path';

export interface GeneratedImage {
    id: string;
    url: string;
    prompt: string;
    metadata: {
        provider: 'dall-e';
        model: string;
        size: string;
        createdAt: Date;
    };
}

export class ImageGenerationService {
    private readonly openai: OpenAI;

    constructor() {
        if (!OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY가 설정되지 않았습니다. 환경 변수를 확인해주세요.');
        }
        this.openai = new OpenAI({
            apiKey: OPENAI_API_KEY,
        });
    }

    /**
     * DALL-E 3를 사용하여 이미지를 생성합니다.
     */
    public async generateImageWithDallE(request: ImageGenerationRequest): Promise<GeneratedImage> {
        console.log('=== DALL-E 3 이미지 생성 시작 ===');
        console.log('📝 요청 데이터:', {
            prompt: request.prompt,
            style: request.style,
            aspectRatio: request.aspectRatio,
            quality: request.quality
        });

        try {
            // 이미지 생성을 위한 프롬프트 구성
            const imagePrompt = this.buildImagePrompt(request);

            console.log('🎨 DALL-E 이미지 생성 요청:', {
                prompt: imagePrompt,
                model: 'dall-e-3'
            });

            // DALL-E 3 이미지 생성 요청
            const response = await this.openai.images.generate({
                model: 'dall-e-3',
                prompt: imagePrompt,
                size: this.getDallESize(request.aspectRatio),
                quality: request.quality || 'standard',
                n: 1,
            });

            if (!response.data || response.data.length === 0) {
                throw new Error('DALL-E API에서 응답을 받지 못했습니다.');
            }

            const imageData = response.data[0];
            const imageId = this.generateImageId();

            console.log('✅ DALL-E 응답 받음:', {
                imageId: imageId,
                url: imageData.url,
                revisedPrompt: imageData.revised_prompt
            });

            // 이미지 URL을 Base64로 변환하여 저장
            const base64Data = await this.downloadImageAsBase64(imageData.url!);
            const fileUrl = this.saveImageToFile(base64Data, imageId);

            return {
                id: imageId,
                url: fileUrl,
                prompt: request.prompt,
                metadata: {
                    provider: 'dall-e',
                    model: 'dall-e-3',
                    size: this.getDallESize(request.aspectRatio),
                    createdAt: new Date()
                }
            };
        } catch (error: any) {
            console.error('❌ DALL-E 이미지 생성 실패!');
            console.error('에러 타입:', error.constructor.name);
            console.error('에러 메시지:', error.message);

            if (error.stack) {
                console.error('📚 에러 스택 트레이스:', error.stack);
            }

            throw new Error(`DALL-E image generation failed: ${error.message}`);
        }
    }

    /**
     * 이미지 생성을 위한 프롬프트를 구성합니다.
     */
    private buildImagePrompt(request: ImageGenerationRequest): string {
        const style = request.style || 'professional';
        const aspectRatio = request.aspectRatio || '1:1';
        const quality = request.quality || 'standard';

        return `다음 요청에 따라 고품질 이미지를 생성해주세요:

프롬프트: ${request.prompt}
스타일: ${style}
화면 비율: ${aspectRatio}
품질: ${quality}

이미지는 교육용 콘텐츠에 적합하고, 깔끔하고 전문적인 스타일로 생성해주세요. 
텍스트나 글자는 포함하지 말고, 시각적으로 이해하기 쉬운 이미지로 만들어주세요.`;
    }

    /**
     * 이미지를 생성합니다 (DALL-E 3 사용).
     */
    public async generateImage(request: ImageGenerationRequest): Promise<GeneratedImage> {
        console.log('=== DALL-E 3 이미지 생성 시작 ===');
        console.log('요청 데이터:', request);

        try {
            console.log('🚀 DALL-E 3로 이미지 생성 시도...');
            const result = await this.generateImageWithDallE(request);
            console.log('✅ DALL-E 이미지 생성 성공!');
            return result;
        } catch (error) {
            console.error('❌ DALL-E 이미지 생성 실패');
            console.error('에러:', error instanceof Error ? error.message : String(error));
            throw new Error(`DALL-E image generation failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * DALL-E 이미지 크기를 결정합니다.
     */
    private getDallESize(aspectRatio?: string): '1024x1024' | '1792x1024' | '1024x1792' {
        if (!aspectRatio) {
            return '1024x1024'; // 기본 정사각형
        }

        // DALL-E 3에서 지원하는 크기들
        switch (aspectRatio) {
            case '16:9':
                return '1792x1024'; // 16:9 비율 (가로형)
            case '9:16':
                return '1024x1792'; // 9:16 비율 (세로형)
            case '4:3':
            case '3:4':
            case '1:1':
            default:
                return '1024x1024'; // 정사각형
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
            // temp-images 디렉토리가 없으면 생성
            const tempDir = path.join(process.cwd(), 'temp-images');
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

            // Base64 데이터를 직접 반환 (참고 코드처럼)
            return base64Data;
        } catch (error) {
            console.error('❌ 이미지 파일 저장 실패:', error);
            // 실패 시 원본 Base64 데이터 반환
            return base64Data;
        }
    }

    /**
     * 플레이스홀더 이미지를 생성합니다.
     */
    private generatePlaceholderImage(aspectRatio: string, prompt: string): string {
        // SVG 플레이스홀더 이미지 생성
        const width = aspectRatio === '9:16' ? 1080 : 1024;
        const height = aspectRatio === '9:16' ? 1920 : 1024;

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
     * 이미지 생성 비용을 계산합니다 (DALL-E 3 기준).
     */
    public calculateImageCost(size: string, quality: string = 'standard'): number {
        // DALL-E 3 가격 (2024년 기준) - USD
        const dallEPricing = {
            '1024x1024': {
                'standard': 0.040,
                'hd': 0.080
            },
            '1792x1024': {
                'standard': 0.080,
                'hd': 0.120
            },
            '1024x1792': {
                'standard': 0.080,
                'hd': 0.120
            }
        };

        const sizeKey = size as keyof typeof dallEPricing;
        const qualityKey = quality as 'standard' | 'hd';
        
        if (dallEPricing[sizeKey] && dallEPricing[sizeKey][qualityKey]) {
            return dallEPricing[sizeKey][qualityKey];
        }

        // 기본값 (1024x1024 standard)
        return 0.040;
    }

    /**
     * 이미지를 캐시에 저장합니다.
     */
    public async cacheImage(image: GeneratedImage): Promise<void> {
        // 실제 구현에서는 캐시 시스템에 이미지를 저장
        console.log('Caching image:', image.id);
    }

    /**
     * 사용 가능한 DALL-E 모델 목록을 반환합니다.
     */
    public getAvailableModels(): Record<string, any> {
        return {
            'dall-e-3': {
                name: 'DALL-E 3',
                description: 'OpenAI의 최신 이미지 생성 모델',
                maxSize: 1792,
                cost: 0.040,
                supportedSizes: ['1024x1024', '1792x1024', '1024x1792'],
                supportedQualities: ['standard', 'hd']
            }
        };
    }
} 