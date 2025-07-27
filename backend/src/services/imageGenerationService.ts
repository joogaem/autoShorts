import axios from 'axios';
import { ImageGenerationRequest } from './visualAnalysisService';

export interface GeneratedImage {
    id: string;
    url: string;
    prompt: string;
    metadata: {
        provider: 'dalle' | 'stability';
        model: string;
        size: string;
        createdAt: Date;
    };
}

export interface DalleImageRequest {
    prompt: string;
    n?: number;
    size?: '1024x1024' | '1792x1024' | '1024x1792';
    quality?: 'standard' | 'hd';
    style?: 'vivid' | 'natural';
}

export interface StabilityImageRequest {
    text_prompts: Array<{
        text: string;
        weight: number;
    }>;
    cfg_scale: number;
    height: number;
    width: number;
    samples: number;
    steps: number;
}

export class ImageGenerationService {
    private readonly OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    private readonly STABILITY_API_KEY = process.env.STABILITY_API_KEY;
    private readonly STABILITY_API_HOST = 'https://api.stability.ai';

    /**
     * DALL-E를 사용하여 이미지를 생성합니다.
     */
    public async generateImageWithDalle(request: ImageGenerationRequest): Promise<GeneratedImage> {
        if (!this.OPENAI_API_KEY) {
            throw new Error('OpenAI API key is not configured');
        }

        try {
            const dalleRequest: DalleImageRequest = {
                prompt: request.prompt,
                n: 1,
                size: this.getDalleSize(request.aspectRatio),
                quality: request.quality || 'standard',
                style: 'vivid'
            };

            const response = await axios.post(
                'https://api.openai.com/v1/images/generations',
                dalleRequest,
                {
                    headers: {
                        'Authorization': `Bearer ${this.OPENAI_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const imageData = response.data.data[0];
            const imageId = this.generateImageId();

            return {
                id: imageId,
                url: imageData.url,
                prompt: request.prompt,
                metadata: {
                    provider: 'dalle',
                    model: 'dall-e-3',
                    size: dalleRequest.size || '1024x1024',
                    createdAt: new Date()
                }
            };
        } catch (error) {
            console.error('DALL-E image generation failed:', error);
            throw new Error(`DALL-E image generation failed: ${error}`);
        }
    }

    /**
     * Stability AI를 사용하여 이미지를 생성합니다.
     */
    public async generateImageWithStability(request: ImageGenerationRequest): Promise<GeneratedImage> {
        if (!this.STABILITY_API_KEY) {
            throw new Error('Stability AI API key is not configured');
        }

        try {
            const stabilityRequest: StabilityImageRequest = {
                text_prompts: [
                    {
                        text: request.prompt,
                        weight: 1
                    }
                ],
                cfg_scale: 7,
                height: 1024,
                width: 1024,
                samples: 1,
                steps: 30
            };

            const response = await axios.post(
                `${this.STABILITY_API_HOST}/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image`,
                stabilityRequest,
                {
                    headers: {
                        'Authorization': `Bearer ${this.STABILITY_API_KEY}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                }
            );

            const imageData = response.data.artifacts[0];
            const imageId = this.generateImageId();

            return {
                id: imageId,
                url: `data:image/png;base64,${imageData.base64}`,
                prompt: request.prompt,
                metadata: {
                    provider: 'stability',
                    model: 'stable-diffusion-xl-1024-v1-0',
                    size: '1024x1024',
                    createdAt: new Date()
                }
            };
        } catch (error) {
            console.error('Stability AI image generation failed:', error);
            throw new Error(`Stability AI image generation failed: ${error}`);
        }
    }

    /**
     * 이미지를 생성합니다 (DALL-E 우선, 실패시 Stability AI 사용).
     */
    public async generateImage(request: ImageGenerationRequest): Promise<GeneratedImage> {
        try {
            // 먼저 DALL-E로 시도
            return await this.generateImageWithDalle(request);
        } catch (error) {
            console.log('DALL-E failed, trying Stability AI...');
            try {
                // DALL-E 실패시 Stability AI로 시도
                return await this.generateImageWithStability(request);
            } catch (stabilityError) {
                throw new Error(`Both DALL-E and Stability AI failed. DALL-E error: ${error}, Stability error: ${stabilityError}`);
            }
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
     * DALL-E 크기를 결정합니다.
     */
    private getDalleSize(aspectRatio?: string): DalleImageRequest['size'] {
        switch (aspectRatio) {
            case '9:16':
                return '1024x1792';
            case '16:9':
                return '1792x1024';
            case '1:1':
            default:
                return '1024x1024';
        }
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
     * 이미지를 캐시에 저장합니다.
     */
    public async cacheImage(image: GeneratedImage): Promise<void> {
        // 실제 구현에서는 캐시 시스템에 이미지를 저장
        console.log('Caching image:', image.id);
    }
} 