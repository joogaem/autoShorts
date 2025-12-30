import express, { Request, Response } from 'express';
import StoryboardGeneratorService from '../services/storyboardGenerator';

const router = express.Router();

// POST /api/generate-storyboard
router.post('/', async (req: Request, res: Response) => {
    console.log('=== 스토리보드 생성 요청 시작 ===');
    console.log('요청 본문:', req.body);

    try {
        const { userPrompt, style, tone } = req.body;

        // 필수 파라미터 검증
        if (!userPrompt || typeof userPrompt !== 'string' || userPrompt.trim().length === 0) {
            console.error('스토리보드 생성 오류: userPrompt가 필요함');
            res.status(400).json({
                error: 'userPrompt is required and must be a non-empty string'
            });
            return;
        }

        console.log('스토리보드 생성 파라미터:', {
            userPrompt: userPrompt.substring(0, 200) + (userPrompt.length > 200 ? '...' : ''),
            userPromptLength: userPrompt.length,
            style: style || 'educational',
            tone: tone || 'friendly'
        });
        console.log('전체 userPrompt 내용:', userPrompt);

        // 스토리보드 생성
        const storyboardService = StoryboardGeneratorService.getInstance();
        const storyboardRequest = {
            userPrompt: userPrompt.trim(),
            style: style || 'educational',
            tone: tone || 'friendly'
        };

        const storyboard = await storyboardService.generateStoryboard(storyboardRequest);

        console.log('스토리보드 생성 완료:', {
            scenesCount: storyboard.scenes.length,
            charactersCount: storyboard.characters.length
        });

        // 스토리보드 결과 반환
        res.json({
            success: true,
            data: {
                storyboard,
                metadata: {
                    totalScenes: storyboard.scenes.length,
                    characters: storyboard.characters,
                    artStyle: storyboard.artStyle,
                    estimatedDuration: storyboard.estimatedDuration
                }
            }
        });

        console.log('=== 스토리보드 생성 요청 완료 ===');

    } catch (error) {
        console.error('스토리보드 생성 중 오류 발생:', error);
        res.status(500).json({
            error: 'Storyboard generation failed',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});

// GET /api/generate-storyboard/cache/clear - 캐시 초기화
router.get('/cache/clear', (req: Request, res: Response) => {
    try {
        const storyboardService = StoryboardGeneratorService.getInstance();
        storyboardService.clearCache();

        res.json({
            success: true,
            message: 'Storyboard cache cleared successfully'
        });
    } catch (error) {
        console.error('캐시 초기화 중 오류:', error);
        res.status(500).json({
            error: 'Failed to clear cache',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});

// GET /api/generate-storyboard/cache/status - 캐시 상태 확인
router.get('/cache/status', (req: Request, res: Response) => {
    try {
        const storyboardService = StoryboardGeneratorService.getInstance();
        const cacheSize = storyboardService.getCacheSize();

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
