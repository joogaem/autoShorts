import { Slide } from '../types/slide';
import { VisualAnalysisService, VisualAnalysisResult, ImageGenerationRequest } from './visualAnalysisService';
import { ImageGenerationService, GeneratedImage } from './imageGenerationService';

export interface VisualDecisionResult {
    needsImage: boolean;
    recommendedPrompt?: string;
    priority: 'high' | 'medium' | 'low';
    reasoning: string;
    slideId: string;
}

export interface BatchVisualDecisionResult {
    decisions: VisualDecisionResult[];
    totalSlides: number;
    slidesNeedingImages: number;
    estimatedCost: number;
}

export class VisualDecisionEngine {
    private visualAnalysisService: VisualAnalysisService;
    private imageGenerationService: ImageGenerationService;

    constructor() {
        this.visualAnalysisService = new VisualAnalysisService();
        this.imageGenerationService = new ImageGenerationService();
    }

    /**
     * 단일 슬라이드에 대한 시각적 의사결정을 수행합니다.
     */
    public async makeVisualDecision(slide: Slide): Promise<VisualDecisionResult> {
        const analysis = this.visualAnalysisService.analyzeSlideVisuals(slide);

        const needsImage = analysis.needsAdditionalVisuals;
        const priority = this.determinePriority(analysis);
        const reasoning = this.generateReasoning(analysis);

        let recommendedPrompt: string | undefined;
        if (needsImage && analysis.recommendedImagePrompt) {
            recommendedPrompt = analysis.recommendedImagePrompt;
        }

        return {
            needsImage,
            recommendedPrompt,
            priority,
            reasoning,
            slideId: slide.id
        };
    }

    /**
     * 여러 슬라이드에 대한 일괄 시각적 의사결정을 수행합니다.
     */
    public async makeBatchVisualDecisions(slides: Slide[]): Promise<BatchVisualDecisionResult> {
        const decisions: VisualDecisionResult[] = [];

        for (const slide of slides) {
            const decision = await this.makeVisualDecision(slide);
            decisions.push(decision);
        }

        const slidesNeedingImages = decisions.filter(d => d.needsImage).length;
        const estimatedCost = this.estimateCost(decisions);

        return {
            decisions,
            totalSlides: slides.length,
            slidesNeedingImages,
            estimatedCost
        };
    }

    /**
     * 시각적 개선이 필요한 슬라이드들에 대해 이미지를 생성합니다.
     */
    public async generateImagesForSlides(slides: Slide[]): Promise<GeneratedImage[]> {
        const batchResult = await this.makeBatchVisualDecisions(slides);
        const slidesNeedingImages = batchResult.decisions.filter(d => d.needsImage);

        const imageRequests: ImageGenerationRequest[] = slidesNeedingImages
            .filter(decision => decision.recommendedPrompt)
            .map(decision => ({
                prompt: decision.recommendedPrompt!,
                style: 'professional',
                aspectRatio: '9:16', // 쇼츠 비디오용 세로 비율
                quality: 'standard'
            }));

        return await this.imageGenerationService.generateMultipleImages(imageRequests);
    }

    /**
     * 우선순위를 결정합니다.
     */
    private determinePriority(analysis: VisualAnalysisResult): VisualDecisionResult['priority'] {
        if (analysis.visualScore < 0.2) {
            return 'high';
        } else if (analysis.visualScore < 0.4) {
            return 'medium';
        } else {
            return 'low';
        }
    }

    /**
     * 의사결정 이유를 생성합니다.
     */
    private generateReasoning(analysis: VisualAnalysisResult): string {
        const reasons: string[] = [];

        if (analysis.slideType === 'text-heavy') {
            reasons.push('텍스트가 많고 시각적 요소가 부족합니다');
        }

        if (analysis.visualScore < 0.3) {
            reasons.push('시각적 점수가 낮습니다');
        }

        if (!analysis.hasSufficientVisuals) {
            reasons.push('충분한 시각적 콘텐츠가 없습니다');
        }

        if (reasons.length === 0) {
            return '시각적 콘텐츠가 충분합니다';
        }

        return reasons.join(', ');
    }

    /**
     * 예상 비용을 계산합니다.
     */
    private estimateCost(decisions: VisualDecisionResult[]): number {
        const imagesNeeded = decisions.filter(d => d.needsImage).length;
        const averageCostPerImage = 0.04; // DALL-E 3 기준 (실제로는 더 정확한 계산 필요)
        return imagesNeeded * averageCostPerImage;
    }

    /**
     * 슬라이드의 시각적 품질을 평가합니다.
     */
    public evaluateVisualQuality(slide: Slide): number {
        const analysis = this.visualAnalysisService.analyzeSlideVisuals(slide);
        return analysis.visualScore;
    }

    /**
     * 시각적 개선 제안을 생성합니다.
     */
    public generateVisualImprovementSuggestions(slide: Slide): string[] {
        const analysis = this.visualAnalysisService.analyzeSlideVisuals(slide);
        const suggestions: string[] = [];

        if (analysis.slideType === 'text-heavy') {
            suggestions.push('관련 이미지나 아이콘을 추가하여 시각적 매력을 높이세요');
        }

        if (analysis.visualScore < 0.3) {
            suggestions.push('슬라이드의 주요 개념을 나타내는 이미지를 추가하세요');
        }

        if (!analysis.hasSufficientVisuals) {
            suggestions.push('색상과 그래픽 요소를 활용하여 시각적 균형을 맞추세요');
        }

        return suggestions;
    }

    /**
 * 비용 효율적인 이미지 생성 전략을 제안합니다.
 */
    public async suggestCostEffectiveStrategy(slides: Slide[]): Promise<{
        strategy: string;
        estimatedSavings: number;
        recommendations: string[];
    }> {
        const batchResult = await this.makeBatchVisualDecisions(slides);
        const highPrioritySlides = batchResult.decisions.filter((d: VisualDecisionResult) => d.priority === 'high');
        const mediumPrioritySlides = batchResult.decisions.filter((d: VisualDecisionResult) => d.priority === 'medium');

        const recommendations: string[] = [];
        let estimatedSavings = 0;

        if (highPrioritySlides.length > 0) {
            recommendations.push(`우선순위가 높은 ${highPrioritySlides.length}개 슬라이드에만 이미지를 생성하세요`);
            estimatedSavings += (mediumPrioritySlides.length * 0.04);
        }

        if (batchResult.slidesNeedingImages > 10) {
            recommendations.push('유사한 슬라이드들은 동일한 이미지를 재사용하세요');
            estimatedSavings += (batchResult.slidesNeedingImages * 0.02);
        }

        return {
            strategy: '우선순위 기반 선택적 이미지 생성',
            estimatedSavings,
            recommendations
        };
    }
} 