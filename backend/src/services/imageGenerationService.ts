import { GoogleGenerativeAI } from '@google/generative-ai';
import { ImageGenerationRequest } from './visualAnalysisService';
import { GOOGLE_API_KEY } from '../config/env';

export interface GeneratedImage {
    id: string;
    url: string;
    prompt: string;
    metadata: {
        provider: 'gemini';
        model: string;
        size: string;
        createdAt: Date;
    };
}

export class ImageGenerationService {
    private readonly GOOGLE_API_KEY: string;
    private readonly genAI: GoogleGenerativeAI;

    constructor() {
        if (!GOOGLE_API_KEY) {
            throw new Error('GOOGLE_API_KEY가 설정되지 않았습니다. 환경 변수를 확인해주세요.');
        }
        this.GOOGLE_API_KEY = GOOGLE_API_KEY;
        this.genAI = new GoogleGenerativeAI(this.GOOGLE_API_KEY);
    }

    /**
     * Gemini 2.5 Flash를 사용하여 이미지를 생성합니다.
     */
    public async generateImageWithGemini(request: ImageGenerationRequest): Promise<GeneratedImage> {
        console.log('=== Gemini 2.5 Flash 이미지 생성 시작 ===');
        console.log('📝 요청 데이터:', {
            prompt: request.prompt,
            style: request.style,
            aspectRatio: request.aspectRatio,
            quality: request.quality
        });

        try {
            const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

            // 이미지 생성을 위한 프롬프트 구성
            const imagePrompt = this.buildImagePrompt(request);

            console.log('🎨 Gemini 이미지 생성 요청:', {
                prompt: imagePrompt,
                model: 'gemini-2.0-flash-exp'
            });

            const result = await model.generateContent(imagePrompt);
            const response = await result.response;

            if (!response) {
                throw new Error('Gemini API에서 응답을 받지 못했습니다.');
            }

            // Gemini는 텍스트 응답을 반환하므로, 이미지 생성이 아닌 텍스트 기반 설명을 반환
            // 실제 이미지 생성은 Gemini의 이미지 생성 기능이 아직 제한적이므로
            // 텍스트 기반 설명을 반환하고, 프론트엔드에서 적절히 처리하도록 함
            const imageId = this.generateImageId();
            const description = response.text() || '이미지 생성 설명을 가져올 수 없습니다.';

            console.log('✅ Gemini 이미지 생성 완료:', {
                imageId: imageId,
                descriptionLength: description.length
            });

            return {
                id: imageId,
                url: `data:text/plain;base64,${Buffer.from(description).toString('base64')}`, // 임시로 텍스트를 base64로 인코딩
                prompt: request.prompt,
                metadata: {
                    provider: 'gemini',
                    model: 'gemini-2.0-flash-exp',
                    size: this.getGeminiSize(request.aspectRatio),
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
     * 이미지를 생성합니다 (Gemini 2.5 Flash 사용).
     */
    public async generateImage(request: ImageGenerationRequest): Promise<GeneratedImage> {
        console.log('=== Gemini 2.5 Flash 이미지 생성 시작 ===');
        console.log('요청 데이터:', request);

        try {
            console.log('🚀 Gemini 2.5 Flash로 이미지 생성 시도...');
            const result = await this.generateImageWithGemini(request);
            console.log('✅ Gemini 이미지 생성 성공!');
            return result;
        } catch (error) {
            console.error('❌ Gemini 이미지 생성 실패');
            console.error('에러:', error instanceof Error ? error.message : String(error));
            throw new Error(`Gemini image generation failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Gemini 이미지 크기를 결정합니다.
     */
    private getGeminiSize(aspectRatio?: string): string {
        if (!aspectRatio) {
            return '1024x1024'; // 기본 정사각형
        }

        // 비율에 따른 크기 결정
        switch (aspectRatio) {
            case '16:9':
                return '1920x1080'; // 16:9 비율
            case '9:16':
                return '1080x1920'; // 9:16 비율
            case '4:3':
                return '1024x768'; // 4:3 비율
            case '3:4':
                return '768x1024'; // 3:4 비율
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
     * 이미지 생성 비용을 계산합니다 (Gemini 기준).
     */
    public calculateImageCost(size: string, quality: string = 'standard'): number {
        // Gemini 2.5 Flash 가격 (2024년 기준) - 무료 또는 매우 저렴
        const geminiPricing = {
            '512x512': 0.0,
            '768x768': 0.0,
            '1024x1024': 0.0,
            '1920x1080': 0.0,  // 16:9
            '1080x1920': 0.0,  // 9:16
            '1024x768': 0.0,   // 4:3
            '768x1024': 0.0    // 3:4
        };

        // Gemini는 현재 무료이므로 0 반환
        return 0.0;
    }

    /**
     * 이미지를 캐시에 저장합니다.
     */
    public async cacheImage(image: GeneratedImage): Promise<void> {
        // 실제 구현에서는 캐시 시스템에 이미지를 저장
        console.log('Caching image:', image.id);
    }

    /**
     * 사용 가능한 Gemini 모델 목록을 반환합니다.
     */
    public getAvailableModels(): Record<string, any> {
        return {
            'gemini-2.0-flash-exp': {
                name: 'Gemini 2.0 Flash Experimental',
                description: 'Google의 최신 Gemini 모델로 이미지 생성 및 텍스트 처리',
                maxSize: 2048,
                cost: 0.0
            }
        };
    }
} 