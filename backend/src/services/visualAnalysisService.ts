import { Slide, SlideElement } from '../types/slide';

export interface VisualAnalysisResult {
    hasSufficientVisuals: boolean;
    needsAdditionalVisuals: boolean;
    visualScore: number;
    recommendedImagePrompt?: string;
    slideType: 'text-heavy' | 'image-heavy' | 'balanced' | 'minimal';
}

export interface ImageGenerationRequest {
    prompt: string;
    style?: 'realistic' | 'artistic' | 'minimal' | 'professional';
    aspectRatio?: '9:16' | '16:9' | '1:1';
    quality?: 'standard' | 'hd';
}

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

export class VisualAnalysisService {
    private readonly MIN_VISUAL_SCORE = 0.3;
    private readonly IDEAL_VISUAL_SCORE = 0.6;

    /**
 * 슬라이드의 시각적 콘텐츠를 분석합니다.
 * 파싱 단계에서 이미 추출된 정보를 활용합니다.
 */
    public analyzeSlideVisuals(slide: Slide): VisualAnalysisResult {
        // 파싱에서 이미 추출된 정보 활용
        const textContent = slide.text || '';
        const imageCount = slide.images?.length || 0;

        // 파싱에서 이미 계산된 메타데이터가 있으면 활용
        if (slide.visualMetadata) {
            const visualScore = this.calculateVisualScore(textContent, imageCount);
            const slideType = slide.visualMetadata.slideType;

            const hasSufficientVisuals = visualScore >= this.MIN_VISUAL_SCORE;
            const needsAdditionalVisuals = visualScore < this.IDEAL_VISUAL_SCORE;

            let recommendedImagePrompt: string | undefined;
            if (needsAdditionalVisuals && textContent.length > 0) {
                recommendedImagePrompt = this.generateImagePrompt(textContent, slideType);
            }

            return {
                hasSufficientVisuals,
                needsAdditionalVisuals,
                visualScore,
                recommendedImagePrompt,
                slideType
            };
        }

        // 기존 로직 (하위 호환성)
        const visualScore = this.calculateVisualScore(textContent, imageCount);
        const slideType = this.determineSlideType(textContent, imageCount);

        const hasSufficientVisuals = visualScore >= this.MIN_VISUAL_SCORE;
        const needsAdditionalVisuals = visualScore < this.IDEAL_VISUAL_SCORE;

        let recommendedImagePrompt: string | undefined;
        if (needsAdditionalVisuals && textContent.length > 0) {
            recommendedImagePrompt = this.generateImagePrompt(textContent, slideType);
        }

        return {
            hasSufficientVisuals,
            needsAdditionalVisuals,
            visualScore,
            recommendedImagePrompt,
            slideType
        };
    }

    /**
 * 파싱에서 이미 추출된 정보를 활용하므로 별도 추출 메서드가 불필요합니다.
 * 파싱 단계에서 slide.text와 slide.images를 직접 사용합니다.
 */

    /**
     * 시각적 점수를 계산합니다.
     */
    private calculateVisualScore(textContent: string, imageCount: number): number {
        const textLength = textContent.length;
        const textScore = Math.min(textLength / 500, 1); // 텍스트가 많을수록 점수 낮음
        const imageScore = Math.min(imageCount / 3, 1); // 이미지가 많을수록 점수 높음

        // 가중 평균 계산 (이미지에 더 높은 가중치)
        return (imageScore * 0.7) + ((1 - textScore) * 0.3);
    }

    /**
     * 슬라이드 타입을 결정합니다.
     */
    private determineSlideType(textContent: string, imageCount: number): VisualAnalysisResult['slideType'] {
        const textLength = textContent.length;

        if (textLength > 200 && imageCount === 0) {
            return 'text-heavy';
        } else if (imageCount >= 2 && textLength < 100) {
            return 'image-heavy';
        } else if (textLength > 100 && imageCount > 0) {
            return 'balanced';
        } else {
            return 'minimal';
        }
    }

    /**
     * 이미지 생성 프롬프트를 생성합니다.
     */
    private generateImagePrompt(textContent: string, slideType: VisualAnalysisResult['slideType']): string {
        const keywords = this.extractKeywords(textContent);
        const basePrompt = keywords.join(', ');

        switch (slideType) {
            case 'text-heavy':
                return `${basePrompt}, professional business presentation, clean design, modern style`;
            case 'minimal':
                return `${basePrompt}, minimalist design, clean background, professional`;
            case 'balanced':
                return `${basePrompt}, balanced composition, professional presentation style`;
            default:
                return `${basePrompt}, professional presentation image`;
        }
    }

    /**
     * 텍스트에서 키워드를 추출합니다.
     */
    private extractKeywords(text: string): string[] {
        // 간단한 키워드 추출 로직
        const words = text.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 3);

        // 가장 자주 나타나는 단어들을 키워드로 선택
        const wordCount: { [key: string]: number } = {};
        words.forEach(word => {
            wordCount[word] = (wordCount[word] || 0) + 1;
        });

        return Object.entries(wordCount)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([word]) => word);
    }

    /**
     * 여러 슬라이드를 일괄 분석합니다.
     */
    public analyzeMultipleSlides(slides: Slide[]): VisualAnalysisResult[] {
        return slides.map(slide => this.analyzeSlideVisuals(slide));
    }

    /**
     * 시각적 개선이 필요한 슬라이드들을 필터링합니다.
     */
    public getSlidesNeedingVisuals(slides: Slide[]): Slide[] {
        return slides.filter(slide => {
            const analysis = this.analyzeSlideVisuals(slide);
            return analysis.needsAdditionalVisuals;
        });
    }
} 