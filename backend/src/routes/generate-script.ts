import express, { Request, Response } from 'express';
import ScriptGeneratorService from '../services/scriptGenerator';

// 타입 정의
interface Slide {
    id: number;
    text: string;
    images: string[];
    hasVisuals: boolean;
}

interface KeyPoint {
    id: string;
    title: string;
    content: string;
    estimatedDuration: number;
    thumbnail?: string;
}

const router = express.Router();

// POST /api/generate-script
router.post('/', async (req: Request, res: Response) => {
    console.log('=== 스크립트 생성 요청 시작 ===');
    console.log('요청 본문:', req.body);

    try {
        const { keyPoints, sections, style, tone, targetDuration } = req.body;

        // sections 또는 keyPoints 중 하나는 필수
        if (!sections && (!keyPoints || !Array.isArray(keyPoints) || keyPoints.length === 0)) {
            console.error('스크립트 생성 오류: sections 또는 keyPoints가 필요함');
            res.status(400).json({
                error: 'Either sections or keyPoints is required'
            });
            return;
        }

        console.log('스크립트 생성 파라미터:', {
            hasSections: !!sections,
            sectionsCount: sections?.length || 0,
            hasKeyPoints: !!keyPoints,
            keyPointsCount: keyPoints?.length || 0,
            style,
            tone,
            targetDuration
        });

        let script: any;

        // sections가 있는 경우 (새로운 방식)
        if (sections && Array.isArray(sections) && sections.length > 0) {
            // sections 데이터 검증
            const validSections = sections.every((section: any) => typeof section === 'string' && section.trim().length > 0);

            if (!validSections) {
                console.error('스크립트 생성 오류: sections 데이터 형식이 유효하지 않음');
                res.status(400).json({
                    error: 'Invalid sections data format. Each section must be a non-empty string.'
                });
                return;
            }

            // sections를 기반으로 스크립트 생성
            const scriptService = ScriptGeneratorService.getInstance();
            const scriptRequest = {
                sections: sections,
                style: style || 'educational',
                tone: tone || 'friendly',
                targetDuration: targetDuration || 60
            };

            console.log('스크립트 생성 요청 (sections):', {
                sectionsCount: sections.length,
                style: scriptRequest.style,
                tone: scriptRequest.tone,
                targetDuration: scriptRequest.targetDuration
            });

            script = await scriptService.generateScriptFromSections(scriptRequest);
        } else {
            // 기존 keyPoints 방식
            // 중요 내용 데이터 검증
            const validKeyPoints = keyPoints.every((keyPoint: any) =>
                keyPoint.id &&
                typeof keyPoint.title === 'string' &&
                typeof keyPoint.content === 'string' &&
                typeof keyPoint.estimatedDuration === 'number'
            );

            if (!validKeyPoints) {
                console.error('스크립트 생성 오류: 중요 내용 데이터 형식이 유효하지 않음');
                res.status(400).json({
                    error: 'Invalid keyPoints data format. Each keyPoint must have id, title, content, and estimatedDuration properties.'
                });
                return;
            }

            // 중요 내용을 기반으로 스크립트 생성
            const scriptService = ScriptGeneratorService.getInstance();
            const scriptRequest = {
                keyPoints: keyPoints,
                style: style || 'educational',
                tone: tone || 'friendly',
                targetDuration: targetDuration || 60
            };

            console.log('스크립트 생성 요청 (keyPoints):', {
                keyPointsCount: keyPoints.length,
                style: scriptRequest.style,
                tone: scriptRequest.tone,
                targetDuration: scriptRequest.targetDuration
            });

            script = await scriptService.generateScript(scriptRequest);
        }

        // 단일 스크립트 결과 반환
        res.json({
            success: true,
            data: [{
                groupId: 'single-group',
                groupTitle: 'Generated Script',
                estimatedDuration: script.estimatedDuration,
                script: script
            }]
        });

        console.log('=== 스크립트 생성 요청 완료 ===');

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