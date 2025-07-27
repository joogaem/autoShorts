import express from 'express';
import { VisualAnalysisService, ImageGenerationRequest } from '../services/visualAnalysisService';
import { ImageGenerationService } from '../services/imageGenerationService';
import { VisualDecisionEngine } from '../services/visualDecisionEngine';
import { Slide } from '../types/slide';

const router = express.Router();

// 이미지 생성 서비스 인스턴스
const imageGenerationService = new ImageGenerationService();
const visualAnalysisService = new VisualAnalysisService();
const visualDecisionEngine = new VisualDecisionEngine();

/**
 * POST /api/generate-image
 * 단일 이미지 생성
 */
router.post('/generate-image', async (req, res) => {
    try {
        const { prompt, style, aspectRatio, quality } = req.body;

        if (!prompt) {
            return res.status(400).json({
                success: false,
                error: '프롬프트가 필요합니다'
            });
        }

        const imageRequest: ImageGenerationRequest = {
            prompt,
            style: style || 'professional',
            aspectRatio: aspectRatio || '9:16',
            quality: quality || 'standard'
        };

        const generatedImage = await imageGenerationService.generateImage(imageRequest);

        res.json({
            success: true,
            data: generatedImage
        });
    } catch (error) {
        console.error('이미지 생성 오류:', error);
        res.status(500).json({
            success: false,
            error: '이미지 생성 중 오류가 발생했습니다'
        });
    }
});

/**
 * POST /api/analyze-slides
 * 슬라이드들의 시각적 분석
 */
router.post('/analyze-slides', async (req, res) => {
    try {
        const { slides } = req.body;

        if (!slides || !Array.isArray(slides)) {
            return res.status(400).json({
                success: false,
                error: '슬라이드 배열이 필요합니다'
            });
        }

        const analysisResults = visualAnalysisService.analyzeMultipleSlides(slides);
        const slidesNeedingVisuals = visualAnalysisService.getSlidesNeedingVisuals(slides);

        res.json({
            success: true,
            data: {
                analysis: analysisResults,
                slidesNeedingVisuals: slidesNeedingVisuals.length,
                totalSlides: slides.length
            }
        });
    } catch (error) {
        console.error('슬라이드 분석 오류:', error);
        res.status(500).json({
            success: false,
            error: '슬라이드 분석 중 오류가 발생했습니다'
        });
    }
});

/**
 * POST /api/make-visual-decisions
 * 시각적 의사결정 수행
 */
router.post('/make-visual-decisions', async (req, res) => {
    try {
        const { slides } = req.body;

        if (!slides || !Array.isArray(slides)) {
            return res.status(400).json({
                success: false,
                error: '슬라이드 배열이 필요합니다'
            });
        }

        const batchResult = await visualDecisionEngine.makeBatchVisualDecisions(slides);

        res.json({
            success: true,
            data: batchResult
        });
    } catch (error) {
        console.error('시각적 의사결정 오류:', error);
        res.status(500).json({
            success: false,
            error: '시각적 의사결정 중 오류가 발생했습니다'
        });
    }
});

/**
 * POST /api/generate-images-for-slides
 * 슬라이드들을 위한 이미지 일괄 생성
 */
router.post('/generate-images-for-slides', async (req, res) => {
    try {
        const { slides } = req.body;

        if (!slides || !Array.isArray(slides)) {
            return res.status(400).json({
                success: false,
                error: '슬라이드 배열이 필요합니다'
            });
        }

        const generatedImages = await visualDecisionEngine.generateImagesForSlides(slides);

        res.json({
            success: true,
            data: {
                images: generatedImages,
                totalGenerated: generatedImages.length
            }
        });
    } catch (error) {
        console.error('슬라이드 이미지 생성 오류:', error);
        res.status(500).json({
            success: false,
            error: '슬라이드 이미지 생성 중 오류가 발생했습니다'
        });
    }
});

/**
 * POST /api/generate-images-for-groups
 * 그룹별 이미지 일괄 생성 (TTS 그룹과 동일한 단위)
 */
router.post('/generate-images-for-groups', async (req, res) => {
    try {
        const { groups, slides } = req.body;

        if (!groups || !Array.isArray(groups) || !slides || !Array.isArray(slides)) {
            return res.status(400).json({
                success: false,
                error: '그룹과 슬라이드 배열이 필요합니다'
            });
        }

        const groupResults = [];

        for (const group of groups) {
            // 그룹 데이터 검증
            if (!group || !group.id) {
                console.error('유효하지 않은 그룹 데이터:', group);
                continue;
            }

            // 그룹에 속한 슬라이드들 찾기 (안전한 검증 추가)
            const groupSlides = slides.filter((slide: any) => {
                if (!slide || !slide.id) {
                    console.error('유효하지 않은 슬라이드 데이터:', slide);
                    return false;
                }

                if (!group.slides || !Array.isArray(group.slides)) {
                    console.error('그룹에 slides 배열이 없음:', group);
                    return false;
                }

                return group.slides.includes(slide.id);
            });

            if (groupSlides.length > 0) {
                // 그룹별로 이미지 생성
                const groupImages = await visualDecisionEngine.generateImagesForSlides(groupSlides);

                groupResults.push({
                    groupId: group.id,
                    groupName: group.title || group.name || `Group ${group.id}`,
                    slides: groupSlides.map((slide: any) => slide.id),
                    images: groupImages,
                    totalGenerated: groupImages.length
                });
            } else {
                console.warn(`그룹 ${group.id}에 속한 슬라이드가 없습니다.`);
            }
        }

        res.json({
            success: true,
            data: {
                groups: groupResults,
                totalGroups: groupResults.length,
                totalGenerated: groupResults.reduce((sum, group) => sum + group.totalGenerated, 0)
            }
        });
    } catch (error) {
        console.error('그룹별 이미지 생성 오류:', error);
        res.status(500).json({
            success: false,
            error: '그룹별 이미지 생성 중 오류가 발생했습니다'
        });
    }
});

/**
 * POST /api/suggest-cost-effective-strategy
 * 비용 효율적인 전략 제안
 */
router.post('/suggest-cost-effective-strategy', async (req, res) => {
    try {
        const { slides } = req.body;

        if (!slides || !Array.isArray(slides)) {
            return res.status(400).json({
                success: false,
                error: '슬라이드 배열이 필요합니다'
            });
        }

        const strategy = await visualDecisionEngine.suggestCostEffectiveStrategy(slides);

        res.json({
            success: true,
            data: strategy
        });
    } catch (error) {
        console.error('전략 제안 오류:', error);
        res.status(500).json({
            success: false,
            error: '전략 제안 중 오류가 발생했습니다'
        });
    }
});

/**
 * GET /api/health
 * 서비스 상태 확인
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: '이미지 생성 서비스가 정상적으로 작동 중입니다',
        timestamp: new Date().toISOString()
    });
});

export default router; 