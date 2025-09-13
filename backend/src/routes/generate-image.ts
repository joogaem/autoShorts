import express from 'express';
import { VisualAnalysisService, ImageGenerationRequest } from '../services/visualAnalysisService';
import { ImageGenerationService } from '../services/imageGenerationService';
import { VisualDecisionEngine } from '../services/visualDecisionEngine';
import { Slide } from '../types/slide';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { z } from 'zod';
import { GOOGLE_API_KEY } from '../config/env';

const router = express.Router();

// 이미지 생성 서비스 인스턴스
const imageGenerationService = new ImageGenerationService();
const visualAnalysisService = new VisualAnalysisService();
const visualDecisionEngine = new VisualDecisionEngine();

// LLM 모델 초기화
const llm = new ChatOpenAI({
    modelName: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 1000,
});

// JSON 스키마 정의 - 이미지 프롬프트 4개를 위한 스키마
const imagePromptsSchema = z.object({
    prompt1: z.string().describe("첫 번째 이미지 프롬프트 (개념도/다이어그램용)"),
    prompt2: z.string().describe("두 번째 이미지 프롬프트 (인포그래픽용)"),
    prompt3: z.string().describe("세 번째 이미지 프롬프트 (실용적 예시용)"),
    prompt4: z.string().describe("네 번째 이미지 프롬프트 (핵심 요약용)")
});

// JsonOutputParser 초기화
const jsonOutputParser = new JsonOutputParser<z.infer<typeof imagePromptsSchema>>();

// 새로운 프롬프트 템플릿
const promptTemplate = PromptTemplate.fromTemplate(`
    You are a prompt engineer creating **square 1:1, child-friendly, textbook-style** illustrations for Stable Diffusion, synchronized with an **English TTS script**. 
    From the educational text below, produce **four sequential image prompts** that together visualize one continuous mini-story (Beat 1 → Beat 2 → Beat 3 → Beat 4). 
    The four images must feel like consecutive shots of the **same scene, same characters, same environment, same palette and style**.
    
    **Text (in Korean)**: {message}
    **Lesson Title**: {groupTitle}
    
    ### Global Style & Composition (apply to all four prompts)
    - Warm, friendly, **textbook illustration** style; **soft pastel palette**, **clean outlines**, **minimal details**, **smooth shading**, **no harsh shadows**.
    - **No text, letters, numerals, or handwriting** anywhere in the image (any language).
    - Speech bubbles, if any, must be **empty or icon-only** (no letters).
    - **1:1 square aspect ratio** composition, but ensure all important elements are inside a centered **safe area** so the image can be cropped to 9:16 without losing key content.
    - Center-weighted composition, large clear subject, simple background; leave **negative space** above and below for optional subtitles in vertical format.
    - Avoid complex/realistic/abstract/surreal styles.
    - Use **photographic style** that works well with Stable Diffusion models.
    
    ### Continuity & Beat Design
    - Use the **same characters** (age-appropriate learners/teacher) and the **same classroom-like setting** with small prop changes to express meaning.
    - Beat 1 = introduce core concept; Beat 2 = clarify with icon-only board/diagram; Beat 3 = hands-on or interaction showing how the idea works; Beat 4 = concise wrap-up/contrast or zoom-out synthesis.
    - Suggest gentle **camera changes** (e.g., medium shot → closer shot → over-the-shoulder → wide shot) while keeping framing within the safe area.
    - Do **not** add any on-image text.
    
    ### Output JSON
    Return prompts in **English**, each a self-contained instruction that references continuity (e.g., “same characters as previous shot”).
    
    {{
      "prompt1": "English image prompt for Beat 1 (introduce the idea; establish characters & setting; center-weighted; negative space for captions).",
      "prompt2": "English image prompt for Beat 2 (same scene & characters; simple icon-only board/diagram in background; slight push-in).",
      "prompt3": "English image prompt for Beat 3 (same scene & characters; practical interaction/activity; over-the-shoulder or close-up; center-safe composition).",
      "prompt4": "English image prompt for Beat 4 (same scene & characters; calm summary or contrast; gentle zoom-out; balanced, uncluttered background)."
    }}
    
    **Important**: Return ONLY valid JSON. Do not include any other text or explanations.
    `);

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
 * 그룹별 이미지 일괄 생성 (이미지 스크립트 기반)
 */
router.post('/generate-images-for-groups', async (req, res) => {
    try {
        const { groups, slides, imageScripts } = req.body;

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

            console.log('처리 중인 그룹:', {
                id: group.id,
                title: group.title,
                slides: group.slides
            });

            // 해당 그룹의 이미지 스크립트 찾기
            const groupImageScripts = imageScripts?.find((scriptGroup: any) =>
                scriptGroup.groupId === group.id
            )?.imageScripts || [];

            console.log(`그룹 ${group.id}의 이미지 스크립트 수:`, groupImageScripts.length);

            if (groupImageScripts.length > 0) {
                // 이미지 스크립트를 기반으로 이미지 생성
                const imageRequests = groupImageScripts.map((script: any) => ({
                    prompt: script.prompt,
                    style: 'professional' as const,
                    aspectRatio: '9:16',
                    quality: 'standard'
                }));

                const groupImages = await imageGenerationService.generateMultipleImages(imageRequests);
                const totalCost = groupImages.length * imageGenerationService.calculateImageCost('512x512', 'standard');

                groupResults.push({
                    groupId: group.id,
                    groupName: group.title || group.name || `Group ${group.id}`,
                    slides: group.slides || [],
                    images: groupImages,
                    imageScripts: groupImageScripts,
                    totalGenerated: groupImages.length,
                    estimatedCost: totalCost
                });
            } else {
                console.warn(`그룹 ${group.id}에 이미지 스크립트가 없습니다. 동적 프롬프트 기반 이미지 스크립트가 필요합니다.`);
                throw new Error(`그룹 "${group.title}"에 이미지 스크립트가 없습니다. 동적 프롬프트 기반 이미지 스크립트가 필요합니다.`);
            }
        }

        // 프론트엔드 호환성을 위해 images 배열로 변환
        const allImages = groupResults.flatMap(group => group.images);

        res.json({
            success: true,
            data: {
                images: allImages,
                groups: groupResults,
                totalGroups: groupResults.length,
                totalGenerated: allImages.length
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
 * POST /api/generate-image-scripts
 * TTS 정보만을 기반으로 이미지 생성을 위한 스크립트 생성
 */
router.post('/generate-image-scripts', async (req, res) => {
    try {
        console.log('=== /api/generate-image-scripts API 호출 시작 ===');
        console.log('요청 바디:', {
            groupsCount: req.body.groups?.length || 0,
            coreMessagesCount: req.body.coreMessages?.length || 0
        });

        const { groups, coreMessages } = req.body;

        if (!groups || !Array.isArray(groups)) {
            console.error('유효하지 않은 요청 데이터:', { groups });
            return res.status(400).json({
                success: false,
                error: '그룹 배열이 필요합니다'
            });
        }

        console.log('데이터 검증 통과');
        const groupResults = [];

        for (const group of groups) {
            console.log(`=== 그룹 ${group.id} 처리 시작 ===`);

            if (!group || !group.id) {
                console.error('유효하지 않은 그룹 데이터:', group);
                continue;
            }

            console.log('TTS 정보 기반 이미지 스크립트 생성 중인 그룹:', {
                id: group.id,
                title: group.title
            });

            // 해당 그룹의 core message 찾기
            const groupCoreMessage = coreMessages?.find((msg: any) =>
                msg.groupId === group.id
            )?.coreMessage;

            console.log(`그룹 ${group.id}의 core message:`, groupCoreMessage ? groupCoreMessage.substring(0, 100) + '...' : '없음');

            if (groupCoreMessage) {
                // core message를 기반으로 이미지 스크립트 생성
                console.log(`generateImageScripts 함수 호출 시작...`);
                console.log('호출 파라미터:', {
                    groupTitle: group.title,
                    coreMessage: groupCoreMessage.substring(0, 100) + '...'
                });

                // 슬라이드 정보 없이 core message만으로 스크립트 생성
                const imageScripts = await generateImageScriptsFromTTS(group.title, groupCoreMessage);

                console.log(`그룹 ${group.id} 스크립트 생성 결과:`, {
                    groupTitle: group.title,
                    scriptsCount: imageScripts.length,
                    scriptTypes: imageScripts.map((s: any) => s.description)
                });

                // 생성된 스크립트 상세 분석
                console.log('=== 생성된 스크립트 상세 분석 ===');
                imageScripts.forEach((script: any, index: number) => {
                    console.log(`스크립트 ${index + 1}:`, {
                        id: script.id,
                        description: script.description,
                        promptLength: script.prompt?.length || 0,
                        promptPreview: script.prompt?.substring(0, 150) + '...',
                        isDynamic: script.prompt?.includes('동적') || script.prompt?.includes('분석') || script.prompt?.includes('구체적'),
                        isFallback: script.prompt?.includes('기본') || script.prompt?.includes('교육적인') || script.prompt?.includes('깔끔하고')
                    });
                });

                groupResults.push({
                    groupId: group.id,
                    groupName: group.title || group.name || `Group ${group.id}`,
                    imageScripts: imageScripts,
                    totalScripts: imageScripts.length,
                    hasCoreMessage: true
                });
            } else {
                console.warn(`그룹 ${group.id}에 core message가 없습니다. 동적 프롬프트 생성을 위해 core message가 필요합니다.`);
                throw new Error(`그룹 "${group.title}"에 core message가 없습니다. 동적 프롬프트 생성을 위해 core message가 필요합니다.`);
            }
        }

        console.log('=== API 응답 생성 ===');
        console.log('최종 결과:', {
            totalGroups: groupResults.length,
            totalScripts: groupResults.reduce((sum, group) => sum + group.totalScripts, 0)
        });

        res.json({
            success: true,
            data: {
                groups: groupResults,
                totalGroups: groupResults.length,
                totalScripts: groupResults.reduce((sum, group) => sum + group.totalScripts, 0)
            }
        });
    } catch (error) {
        console.error('=== 이미지 스크립트 생성 API 오류 ===');
        console.error('에러 상세:', error);
        console.error('에러 스택:', error instanceof Error ? error.stack : '스택 없음');
        res.status(500).json({
            success: false,
            error: '이미지 스크립트 생성 중 오류가 발생했습니다'
        });
    }
});

/**
 * TTS 정보만을 기반으로 이미지용 스크립트를 생성합니다.
 */
async function generateImageScriptsFromTTS(groupTitle: string, coreMessage: string): Promise<any[]> {
    try {
        console.log('=== generateImageScriptsFromTTS 시작 ===');
        console.log('입력 데이터:', {
            groupTitle,
            coreMessageLength: coreMessage.length,
            coreMessagePreview: coreMessage.substring(0, 100) + '...'
        });

        if (!coreMessage || coreMessage.trim().length === 0) {
            throw new Error('Core message가 비어있습니다. 동적 프롬프트 생성을 위해 core message가 필요합니다.');
        }

        // 새로운 프롬프트 템플릿을 사용하여 4개의 프롬프트 생성
        console.log('새로운 프롬프트 템플릿으로 프롬프트 생성 시작...');
        const chain = promptTemplate.pipe(llm).pipe(jsonOutputParser);
        const result = await chain.invoke({ message: coreMessage, groupTitle });

        // JSON 결과를 배열로 변환
        const prompts = [
            result.prompt1,
            result.prompt2,
            result.prompt3,
            result.prompt4
        ];

        console.log('프롬프트 생성 완료:', prompts.length, '개');

        const scripts: any[] = [];
        const descriptions = ['개념도/다이어그램', '인포그래픽', '실용적 예시', '핵심 요약'];

        // 각 프롬프트에 대해 스크립트 생성
        prompts.forEach((prompt, index) => {
            scripts.push({
                id: `tts_script_${Date.now()}_${index + 1}`,
                prompt: prompt,
                description: descriptions[index],
                type: 'image_generation',
                enabled: true,
                source: 'tts_core_message'
            });
        });

        console.log(`최종 생성된 스크립트 수: ${scripts.length}`);
        console.log('=== generateImageScriptsFromTTS 완료 ===');
        return scripts;

    } catch (error) {
        console.error('=== generateImageScriptsFromTTS 에러 ===');
        console.error('스크립트 생성 실패:', error);
        console.error('에러 스택:', error instanceof Error ? error.stack : '스택 없음');

        throw new Error(`동적 프롬프트 생성 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
}

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

/**
 * GET /api/gemini-models
 * 사용 가능한 Gemini 모델 목록 조회
 */
router.get('/gemini-models', (req, res) => {
    try {
        const models = imageGenerationService.getAvailableModels();

        res.json({
            success: true,
            data: {
                models,
                defaultModel: 'gemini-2.0-flash-exp',
                description: 'Gemini 모델을 사용하여 고품질 이미지를 생성할 수 있습니다.'
            }
        });
    } catch (error) {
        console.error('모델 목록 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '모델 목록 조회 중 오류가 발생했습니다'
        });
    }
});

/**
 * GET /api/debug-gemini
 * Gemini 디버깅 정보
 */
router.get('/debug-gemini', (req, res) => {
    try {
        console.log('=== Gemini 디버깅 정보 ===');

        const googleKey = GOOGLE_API_KEY;

        // 환경 변수 상태
        console.log('🔍 환경 변수 상태:');
        console.log('- GOOGLE_API_KEY:', googleKey ? '설정됨' : '설정되지 않음');

        // API 키 유효성 검사
        if (googleKey) {
            console.log('- GOOGLE_API_KEY 길이:', googleKey.length);
            console.log('- GOOGLE_API_KEY 시작:', googleKey.substring(0, 10) + '...');
        }

        // 서비스 상태
        const imageService = new ImageGenerationService();
        const availableModels = imageService.getAvailableModels();

        console.log('📋 사용 가능한 모델들:');
        Object.entries(availableModels).forEach(([key, model]) => {
            console.log(`- ${key}: ${model.name} (${model.description})`);
        });

        res.json({
            success: true,
            data: {
                environment: {
                    googleKey: {
                        configured: !!googleKey,
                        length: googleKey?.length || 0,
                        prefix: googleKey ? googleKey.substring(0, 10) + '...' : null
                    }
                },
                models: availableModels,
                recommendations: {
                    ifNoGoogleKey: 'Google AI Studio에서 API 키를 발급받으세요: https://aistudio.google.com/',
                    ifGoogleKeyInvalid: 'API 키가 올바른지 확인하고, 계정에 충분한 크레딧이 있는지 확인하세요.',
                    testConnection: '이미지 생성 API를 호출하여 실제 연결을 테스트해보세요.'
                }
            }
        });

    } catch (error) {
        console.error('❌ 디버깅 정보 수집 실패:', error);
        res.status(500).json({
            success: false,
            error: '디버깅 정보 수집 중 오류가 발생했습니다',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});

/**
 * GET /api/check-api-keys
 * API 키 상태 확인
 */
router.get('/check-api-keys', (req, res) => {
    const googleKey = GOOGLE_API_KEY;

    console.log('=== API 키 상태 확인 ===');
    console.log('환경 변수 상태:', {
        GOOGLE_API_KEY: googleKey ? '설정됨' : '설정되지 않음'
    });

    if (googleKey) {
        console.log('✅ GOOGLE_API_KEY 확인됨:', googleKey.substring(0, 10) + '...');
    } else {
        console.error('❌ GOOGLE_API_KEY가 설정되지 않았습니다!');
    }

    const hasKey = !!googleKey;
    console.log('🔑 전체 API 키 상태:', hasKey ? '사용 가능' : '사용 불가능');

    res.json({
        success: true,
        data: {
            google: {
                configured: !!googleKey,
                keyPrefix: googleKey ? googleKey.substring(0, 10) + '...' : null,
                status: googleKey ? 'active' : 'missing'
            },
            hasKey: hasKey,
            primaryService: 'Gemini 2.5 Flash (Google AI)',
            recommendations: {
                ifNoGoogleKey: 'Google AI Studio에서 API 키를 발급받아 GOOGLE_API_KEY 환경변수에 설정하세요.',
                ifGoogleKeyInvalid: 'API 키가 올바른지 확인하고, 계정에 충분한 크레딧이 있는지 확인하세요.'
            }
        }
    });
});

export default router; 