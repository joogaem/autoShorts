import express, { Request, Response } from 'express';
import ScriptGeneratorService from '../services/scriptGenerator';
import { groupSlides, Slide, SlideGroup } from './group-slides';

const router = express.Router();

// POST /api/generate-script
router.post('/', async (req: Request, res: Response) => {
    console.log('=== 스크립트 생성 요청 시작 ===');
    console.log('요청 본문:', req.body);

    try {
        const { slides, style, tone, targetDuration, maxSlidesPerGroup = 3, maxDurationPerGroup = 60 } = req.body;

        // 필수 파라미터 검증
        if (!slides || !Array.isArray(slides) || slides.length === 0) {
            console.error('스크립트 생성 오류: slides가 없거나 유효하지 않음');
            res.status(400).json({
                error: 'slides is required and must be a non-empty array'
            });
            return;
        }

        console.log('스크립트 생성 파라미터:', {
            slidesCount: slides.length,
            style,
            tone,
            targetDuration,
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
            console.error('스크립트 생성 오류: 슬라이드 데이터 형식이 유효하지 않음');
            res.status(400).json({
                error: 'Invalid slide data format. Each slide must have id, text, images, and hasVisuals properties.'
            });
            return;
        }

        // 1. 슬라이드 그룹핑
        const groups = groupSlides(slides, maxSlidesPerGroup, maxDurationPerGroup);
        console.log('슬라이드 그룹핑 결과:', groups.map(g => ({ id: g.id, title: g.title, slideCount: g.slides.length, estimatedDuration: g.estimatedDuration })));

        // 2. 각 그룹별로 스크립트 생성
        const scriptService = ScriptGeneratorService.getInstance();
        const groupScripts = [];
        for (const group of groups) {
            const scriptRequest = {
                slides: group.slides,
                style: style || 'educational',
                tone: tone || 'friendly',
                targetDuration: group.estimatedDuration || 60
            };
            const script = await scriptService.generateScript(scriptRequest);
            groupScripts.push({
                groupId: group.id,
                groupTitle: group.title,
                estimatedDuration: group.estimatedDuration,
                script
            });
        }

        // 3. 그룹별 스크립트 리스트 반환
        res.json({
            success: true,
            data: groupScripts
        });

        console.log('=== 그룹별 스크립트 생성 요청 완료 ===');

    } catch (error) {
        console.error('스크립트 생성 중 오류 발생:', error);
        res.status(500).json({
            error: 'Script generation failed',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});

// GET /api/generate-script/cache/clear - 캐시 초기화
router.get('/cache/clear', (req: Request, res: Response) => {
    try {
        const scriptService = ScriptGeneratorService.getInstance();
        scriptService.clearCache();

        res.json({
            success: true,
            message: 'Script cache cleared successfully'
        });
    } catch (error) {
        console.error('캐시 초기화 중 오류:', error);
        res.status(500).json({
            error: 'Failed to clear cache',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});

// GET /api/generate-script/cache/status - 캐시 상태 확인
router.get('/cache/status', (req: Request, res: Response) => {
    try {
        const scriptService = ScriptGeneratorService.getInstance();
        const cacheSize = scriptService.getCacheSize();

        res.json({
            success: true,
            cacheSize,
            message: `Cache contains ${cacheSize} items`
        });
    } catch (error) {
        console.error('캐시 상태 확인 중 오류:', error);
        res.status(500).json({
            error: 'Failed to get cache status',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});

export default router; 