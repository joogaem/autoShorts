import express, { Request, Response } from 'express';
import { ImageGenerationService } from '../services/imageGenerationService';

interface StoryboardScene {
    scene_number: number;
    narrative_korean: string;
    image_prompt_english: string;
}

interface StoryboardResponse {
    scenes: StoryboardScene[];
    characters: string[];
    artStyle: string;
    estimatedDuration: number;
}

const router = express.Router();

interface StoryboardImageResult {
    sceneNumber: number;
    image: {
        id: string;
        url: string;
        prompt: string;
        metadata: {
            provider: string;
            model: string;
            size: string;
            createdAt: string;
        };
    };
    narrative: string;
    prompt: string;
}

interface StoryboardImagesResponse {
    images: StoryboardImageResult[];
    errors: Array<{
        sceneNumber: number;
        error: string;
    }>;
    totalScenes: number;
    successCount: number;
    errorCount: number;
    storyboard: {
        characters: string[];
        artStyle: string;
        estimatedDuration: number;
    };
}

// POST /api/generate-storyboard-images
router.post('/', async (req: Request, res: Response) => {
    console.log('=== 스토리보드 이미지 생성 요청 시작 ===');
    console.log('요청 본문:', req.body);

    try {
        const { storyboard } = req.body as { storyboard: StoryboardResponse };

        // 필수 파라미터 검증
        if (!storyboard || !storyboard.scenes || !Array.isArray(storyboard.scenes)) {
            console.error('스토리보드 이미지 생성 오류: storyboard.scenes가 필요함');
            res.status(400).json({
                success: false,
                error: 'storyboard.scenes is required and must be an array'
            });
            return;
        }

        console.log('스토리보드 이미지 생성 파라미터:', {
            scenesCount: storyboard.scenes.length,
            characters: storyboard.characters,
            artStyle: storyboard.artStyle
        });

        const imageService = new ImageGenerationService();
        const results: StoryboardImageResult[] = [];
        const errors: Array<{ sceneNumber: number; error: string }> = [];

        // 각 장면에 대해 이미지 생성
        for (let i = 0; i < storyboard.scenes.length; i++) {
            const scene = storyboard.scenes[i];
            console.log(`장면 ${i + 1}/${storyboard.scenes.length} 이미지 생성 중...`);

            try {
                const imageRequest = {
                    prompt: scene.image_prompt_english,
                    style: 'photographic' as const,
                    aspectRatio: '9:16' as const,
                    quality: 'hd' as const
                };

                const generatedImage = await imageService.generateImage(imageRequest);

                results.push({
                    sceneNumber: scene.scene_number,
                    image: {
                        id: generatedImage.id,
                        url: generatedImage.url,
                        prompt: generatedImage.prompt,
                        metadata: {
                            provider: generatedImage.metadata.provider,
                            model: generatedImage.metadata.model,
                            size: generatedImage.metadata.size,
                            createdAt: generatedImage.metadata.createdAt.toISOString()
                        }
                    },
                    narrative: scene.narrative_korean,
                    prompt: scene.image_prompt_english
                });

                console.log(`장면 ${i + 1} 이미지 생성 성공:`, generatedImage.id);

            } catch (error) {
                console.error(`장면 ${i + 1} 이미지 생성 실패:`, error);
                errors.push({
                    sceneNumber: scene.scene_number,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }

        const response: StoryboardImagesResponse = {
            images: results,
            errors: errors,
            totalScenes: storyboard.scenes.length,
            successCount: results.length,
            errorCount: errors.length,
            storyboard: {
                characters: storyboard.characters,
                artStyle: storyboard.artStyle,
                estimatedDuration: storyboard.estimatedDuration
            }
        };

        console.log('스토리보드 이미지 생성 완료:', {
            successCount: response.successCount,
            errorCount: response.errorCount,
            totalScenes: response.totalScenes
        });

        res.json({
            success: true,
            data: response
        });

        console.log('=== 스토리보드 이미지 생성 요청 완료 ===');

    } catch (error) {
        console.error('스토리보드 이미지 생성 중 오류 발생:', error);
        res.status(500).json({
            success: false,
            error: 'Storyboard images generation failed',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});

export default router;
