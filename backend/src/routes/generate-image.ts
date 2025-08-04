import express from 'express';
import { VisualAnalysisService, ImageGenerationRequest } from '../services/visualAnalysisService';
import { ImageGenerationService } from '../services/imageGenerationService';
import { VisualDecisionEngine } from '../services/visualDecisionEngine';
import { Slide } from '../types/slide';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

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
 * 동적 프롬프트만 사용하며, 실패 시 오류를 발생시킵니다.
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

        // core message를 여러 부분으로 분할
        console.log('core message 분할 시작...');
        const messageParts = await splitMessageIntoParts(coreMessage, groupTitle);
        console.log(`분할된 메시지 부분 수: ${messageParts.length}`);

        if (messageParts.length < 4) {
            throw new Error(`동적 프롬프트 생성 실패: ${messageParts.length}개의 프롬프트만 생성되었습니다. 4개가 필요합니다.`);
        }

        const scripts: any[] = [];
        let scriptIndex = 1;

        // 각 메시지 부분에 대해 동적 프롬프트 생성
        for (const messagePart of messageParts) {
            console.log(`메시지 부분 ${scriptIndex} 처리:`, messagePart.substring(0, 50) + '...');

            const promptType = getPromptTypeByIndex(scriptIndex - 1);
            console.log(`프롬프트 타입: ${promptType}`);

            const specificPrompt = await generateSpecificPrompt(messagePart, groupTitle, promptType);
            console.log(`생성된 프롬프트 길이: ${specificPrompt.length}`);

            // 동적 프롬프트인지 확인
            if (!isDynamicPrompt(specificPrompt)) {
                throw new Error(`동적 프롬프트 생성 실패: 스크립트 ${scriptIndex}가 기본 프롬프트로 생성되었습니다.`);
            }

            scripts.push({
                id: `tts_script_${Date.now()}_${scriptIndex}`,
                prompt: specificPrompt,
                description: getPromptTypeDescription(promptType),
                type: 'image_generation',
                enabled: true,
                source: 'tts_core_message'
            });

            scriptIndex++;
        }

        console.log(`최종 생성된 스크립트 수: ${scripts.length}`);
        console.log('=== generateImageScriptsFromTTS 완료 ===');
        return scripts;

    } catch (error) {
        console.error('=== generateImageScriptsFromTTS 에러 ===');
        console.error('스크립트 생성 실패:', error);
        console.error('에러 스택:', error instanceof Error ? error.stack : '스택 없음');

        // 에러 발생 시 오류를 다시 던짐 (기본 프롬프트 사용하지 않음)
        throw new Error(`동적 프롬프트 생성 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * 슬라이드 내용을 기반으로 이미지용 스크립트를 생성합니다.
 * 동적 프롬프트만 사용하며, 실패 시 오류를 발생시킵니다.
 */
async function generateImageScripts(slides: any[], groupTitle: string, coreMessage?: string): Promise<any[]> {
    try {
        console.log('=== generateImageScripts 시작 ===');
        console.log('입력 데이터:', {
            slidesCount: slides.length,
            groupTitle,
            hasCoreMessage: !!coreMessage,
            coreMessageLength: coreMessage?.length || 0
        });

        // core message가 있으면 그것을 우선 사용
        console.log('coreMessage', coreMessage);
        if (coreMessage && coreMessage.trim()) {
            console.log('Core message 기반 이미지 스크립트 생성:', {
                groupTitle,
                coreMessage: coreMessage.substring(0, 100) + '...'
            });

            // core message를 4개 부분으로 나누고 각각에 맞는 동적 프롬프트 생성
            console.log('동적 프롬프트 생성 호출...');
            const dynamicPrompts = await generateDynamicImagePrompts(coreMessage, groupTitle);
            console.log('동적 프롬프트 생성 결과:', {
                promptsCount: dynamicPrompts.length,
                prompts: dynamicPrompts.map((prompt, index) => ({
                    index,
                    length: prompt.length,
                    content: prompt.substring(0, 100) + '...'
                }))
            });

            // 동적 프롬프트 검증
            for (let i = 0; i < dynamicPrompts.length; i++) {
                if (!isDynamicPrompt(dynamicPrompts[i])) {
                    throw new Error(`동적 프롬프트 생성 실패: 프롬프트 ${i + 1}가 기본 프롬프트로 생성되었습니다.`);
                }
            }

            const imageScripts = [
                {
                    id: `core_script_${Date.now()}_1`,
                    prompt: dynamicPrompts[0],
                    description: '개념도/다이어그램',
                    type: 'image_generation',
                    enabled: true
                },
                {
                    id: `core_script_${Date.now()}_2`,
                    prompt: dynamicPrompts[1],
                    description: '인포그래픽',
                    type: 'image_generation',
                    enabled: true
                },
                {
                    id: `core_script_${Date.now()}_3`,
                    prompt: dynamicPrompts[2],
                    description: '실용적 예시',
                    type: 'image_generation',
                    enabled: true
                },
                {
                    id: `core_script_${Date.now()}_4`,
                    prompt: dynamicPrompts[3],
                    description: '핵심 요약',
                    type: 'image_generation',
                    enabled: true
                }
            ];

            console.log('Core message 기반 스크립트 생성 완료:', imageScripts.length, '개');
            return imageScripts;
        }

        // 그룹 내용이 있으면 그것을 core message로 사용
        const groupContent = slides.map(slide => slide.content || slide.text || '').join('\n\n');

        console.log('그룹 내용 분석:', {
            groupTitle,
            slidesCount: slides.length,
            contentLength: groupContent.length,
            contentPreview: groupContent.substring(0, 200) + '...'
        });

        if (!groupContent.trim()) {
            throw new Error('그룹 내용이 비어있습니다. 동적 프롬프트 생성을 위해 내용이 필요합니다.');
        }

        console.log('그룹 내용 기반 이미지 스크립트 생성:', {
            groupTitle,
            slidesCount: slides.length,
            contentLength: groupContent.length
        });

        // 그룹 내용을 core message로 사용하여 동적 프롬프트 생성
        console.log('그룹 내용으로 동적 프롬프트 생성 호출...');
        const dynamicPrompts = await generateDynamicImagePrompts(groupContent, groupTitle);
        console.log('그룹 내용 기반 동적 프롬프트 생성 결과:', {
            promptsCount: dynamicPrompts.length,
            prompts: dynamicPrompts.map((prompt, index) => ({
                index,
                length: prompt.length,
                content: prompt.substring(0, 100) + '...'
            }))
        });

        // 동적 프롬프트 검증
        for (let i = 0; i < dynamicPrompts.length; i++) {
            if (!isDynamicPrompt(dynamicPrompts[i])) {
                throw new Error(`동적 프롬프트 생성 실패: 프롬프트 ${i + 1}가 기본 프롬프트로 생성되었습니다.`);
            }
        }

        const imageScripts = [
            {
                id: `content_script_${Date.now()}_1`,
                prompt: dynamicPrompts[0],
                description: '개념도/다이어그램',
                type: 'image_generation',
                enabled: true
            },
            {
                id: `content_script_${Date.now()}_2`,
                prompt: dynamicPrompts[1],
                description: '인포그래픽',
                type: 'image_generation',
                enabled: true
            },
            {
                id: `content_script_${Date.now()}_3`,
                prompt: dynamicPrompts[2],
                description: '실용적 예시',
                type: 'image_generation',
                enabled: true
            },
            {
                id: `content_script_${Date.now()}_4`,
                prompt: dynamicPrompts[3],
                description: '핵심 요약',
                type: 'image_generation',
                enabled: true
            }
        ];

        console.log('그룹 내용 기반 스크립트 생성 완료:', imageScripts.length, '개');
        return imageScripts;

    } catch (error) {
        console.error('=== generateImageScripts 실패 ===');
        console.error('에러 상세:', error);
        console.error('에러 스택:', error instanceof Error ? error.stack : '스택 없음');

        // 에러 발생 시 오류를 다시 던짐 (기본 프롬프트 사용하지 않음)
        throw new Error(`동적 프롬프트 생성 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
}



/**
 * Core message를 분석하여 동적 이미지 프롬프트를 생성합니다.
 * 동적 프롬프트만 사용하며, 실패 시 오류를 발생시킵니다.
 */
async function generateDynamicImagePrompts(coreMessage: string, groupTitle: string): Promise<string[]> {
    try {
        console.log('=== 동적 프롬프트 생성 시작 ===');
        console.log('입력 데이터:', {
            groupTitle,
            messageLength: coreMessage.length,
            coreMessage: coreMessage.substring(0, 200) + '...'
        });

        // Core message를 의미적으로 분석하여 프롬프트 생성
        console.log('splitMessageIntoParts 함수 호출 시작...');
        const dynamicPrompts = await splitMessageIntoParts(coreMessage, groupTitle);
        console.log('splitMessageIntoParts 함수 호출 완료, 결과:', dynamicPrompts.length, '개');

        // 동적 프롬프트 검증
        for (let i = 0; i < dynamicPrompts.length; i++) {
            if (!isDynamicPrompt(dynamicPrompts[i])) {
                throw new Error(`동적 프롬프트 생성 실패: 프롬프트 ${i + 1}가 기본 프롬프트로 생성되었습니다.`);
            }
        }

        console.log('=== 순서별 분석 및 프롬프트 생성 완료 ===');
        console.log('최종 결과:', {
            totalPrompts: dynamicPrompts.length,
            prompts: dynamicPrompts.map((prompt, index) => ({
                index,
                length: prompt.length,
                content: prompt.substring(0, 100) + '...'
            }))
        });

        return dynamicPrompts;
    } catch (error) {
        console.error('=== 동적 프롬프트 생성 실패 ===');
        console.error('에러 상세:', error);
        console.error('에러 스택:', error instanceof Error ? error.stack : '스택 없음');

        // 실패 시 오류를 다시 던짐 (기본 프롬프트 사용하지 않음)
        throw new Error(`동적 프롬프트 생성 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * 메시지를 순서대로 4개 부분으로 나누고 각각에 맞는 구체적인 이미지 프롬프트를 생성합니다.
 */
async function splitMessageIntoParts(message: string, groupTitle: string): Promise<string[]> {
    console.log('=== splitMessageIntoParts 함수 시작 ===');
    console.log('입력 파라미터:', { message: message.substring(0, 100) + '...', groupTitle });

    try {
        console.log('=== 순서별 분석 및 프롬프트 생성 시작 ===');
        console.log('LLM 모델 확인:', llm ? '정의됨' : '정의되지 않음');

        const promptTemplate = PromptTemplate.fromTemplate(`
            You are a prompt engineer who specializes in generating high-quality visual prompts for DALL·E 3.
            
            Given the educational text below, divide it into four logical parts and write one optimized English prompt for each part. These prompts will be used to generate watercolor-style illustrations using DALL·E 3.
            
            **Text (in Korean)**: {message}
            **Lesson Title**: {groupTitle}
            
            **Requirements**:
            - Output 4 separate prompts in English, one for each part.
            - Each prompt must be specific, visual, and suitable for DALL·E 3 image generation.
            - Describe human actions, facial expressions, scenery, and symbolic or educational elements clearly.
            - Avoid abstract conceptual phrases unless they can be visualized.
            - Style should always be included (e.g., "watercolor, no text, clean, warm tone, educational atmosphere").
            - Focus on warm, educational, inclusive, and culturally respectful imagery.
            - Prompts must not include any text or letters inside the image.
            
            **Output format**:
            === Prompt1 ===  
            [English image prompt for part 1]
            
            === Prompt2 ===  
            [English image prompt for part 2]
            
            === Prompt3 ===  
            [English image prompt for part 3]
            
            === Prompt4 ===  
            [English image prompt for part 4]
            `);

        console.log('프롬프트 템플릿 생성 완료');
        console.log('LLM 체인 생성 시작...');

        const chain = promptTemplate.pipe(llm).pipe(new StringOutputParser());
        console.log('LLM 체인 생성 완료');

        console.log('LLM 호출 시작...');
        const result = await chain.invoke({ message, groupTitle });
        console.log('LLM 호출 완료, 결과 길이:', result.length);

        // AI 응답을 파싱하여 프롬프트만 추출
        console.log('응답 파싱 시작...');

        // 마크다운 형식으로 프롬프트 추출
        let prompts: string[] = [];

        // 더 유연한 파싱 방식
        console.log('전체 응답 길이:', result.length);
        console.log('응답 시작 부분:', result.substring(0, 200));
        console.log('응답 끝 부분:', result.substring(result.length - 200));

        // 방법 1: 완전한 Prompt 패턴
        const fullMatches = result.match(/=== Prompt\d+ ===\s*([\s\S]*?)(?=== Prompt\d+ ===|$)/g);
        if (fullMatches && fullMatches.length >= 4) {
            prompts = fullMatches.slice(0, 4).map(match => {
                const content = match.replace(/=== Prompt\d+ ===\s*/, '').trim();
                return content;
            });
            console.log('완전한 파싱 성공:', prompts.length, '개');
        } else {
            // 방법 2: 부분 Prompt 패턴 (1-3개만 있어도 OK)
            const partialMatches = result.match(/=== Prompt\d+ ===\s*([\s\S]*?)(?=== Prompt\d+ ===|$)/g);
            if (partialMatches && partialMatches.length > 0) {
                prompts = partialMatches.map(match => {
                    const content = match.replace(/=== Prompt\d+ ===\s*/, '').trim();
                    return content;
                });
                console.log('부분 파싱 성공:', prompts.length, '개');
            } else {
                // 방법 3: 줄바꿈 기반 분할 (최후의 수단)
                const lines = result.split('\n');
                const promptSections: string[] = [];
                let currentSection = '';
                let inPromptSection = false;

                for (const line of lines) {
                    if (line.includes('===') && line.includes('Prompt')) {
                        if (currentSection.trim()) {
                            promptSections.push(currentSection.trim());
                        }
                        currentSection = '';
                        inPromptSection = true;
                    } else if (inPromptSection && line.trim()) {
                        currentSection += line + '\n';
                    }
                }

                if (currentSection.trim()) {
                    promptSections.push(currentSection.trim());
                }

                if (promptSections.length > 0) {
                    prompts = promptSections.slice(0, 4);
                    console.log('줄바꿈 기반 파싱 성공:', prompts.length, '개');
                } else {
                    console.log('모든 파싱 방법 실패, 응답 내용:', result.substring(0, 500));
                }
            }
        }

        console.log('파싱된 프롬프트 개수:', prompts.length);

        if (prompts.length > 0) {
            console.log('순서별 분석 및 프롬프트 생성 완료:', prompts.length, '개');
            console.log('=== splitMessageIntoParts 함수 완료 ===');
            return prompts;
        } else {
            console.log('AI 분석 실패, 오류 발생');
            console.log('=== splitMessageIntoParts 함수 완료 (error) ===');
            throw new Error('AI 분석을 통한 동적 프롬프트 생성에 실패했습니다.');
        }
    } catch (error) {
        console.error('순서별 분석 중 오류:', error);
        console.error('에러 스택:', error instanceof Error ? error.stack : '스택 없음');
        console.log('동적 프롬프트 생성 실패');
        console.log('=== splitMessageIntoParts 함수 완료 (error) ===');
        throw new Error(`동적 프롬프트 생성 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * 인덱스에 따라 프롬프트 타입을 결정합니다.
 */
function getPromptTypeByIndex(index: number): string {
    const types = ['concept', 'infographic', 'example', 'summary'];
    return types[index] || 'concept';
}

/**
 * 특정 부분에 대한 구체적인 프롬프트를 생성합니다.
 */
async function generateSpecificPrompt(messagePart: string, groupTitle: string, promptType: string): Promise<string> {
    try {
        console.log(`=== ${promptType} 프롬프트 생성 시작 ===`);
        console.log('입력 데이터:', {
            groupTitle,
            promptType,
            messagePart: messagePart.substring(0, 200) + '...'
        });

        const promptTemplate = PromptTemplate.fromTemplate(`
주어진 내용을 기반으로 간결하고 명확한 이미지 생성 프롬프트를 만들어주세요.

**제목**: {groupTitle}
**내용**: {messagePart}
**타입**: {promptType}

**요구사항**:
- 간결하고 구체적인 이미지 프롬프트 생성
- 영어로 작성 (DALL-E 3 최적화)
- watercolor style, no text, clean, educational illustration
- 교육 자료에 적합한 이미지

**중요**: 이미지 생성 프롬프트만 응답하세요. 다른 설명은 포함하지 마세요.
`);

        console.log('LLM 호출 시작...');
        console.log('LLM 설정 확인 완료');
        console.log('OpenAI API 키 상태:', {
            hasKey: !!process.env.OPENAI_API_KEY,
            keyPrefix: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 10) + '...' : '없음'
        });

        const chain = promptTemplate.pipe(llm).pipe(new StringOutputParser());
        const result = await chain.invoke({
            groupTitle,
            messagePart,
            promptType
        });

        console.log(`=== ${promptType} 프롬프트 생성 완료 ===`);
        console.log('결과:', {
            length: result.length,
            content: result.substring(0, 200) + '...',
            isDynamic: result.includes('동적') || result.includes('분석') || result.includes('구체적'),
            isFallback: result.includes('기본') || result.includes('교육적인') || result.includes('깔끔하고')
        });

        return result.trim();
    } catch (error) {
        console.error(`=== ${promptType} 프롬프트 생성 실패 ===`);
        console.error('에러 상세:', error);
        console.error('에러 스택:', error instanceof Error ? error.stack : '스택 없음');

        console.log('동적 프롬프트 생성 실패');
        throw new Error(`동적 프롬프트 생성 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
}



/**
 * 프롬프트가 동적 프롬프트인지 확인합니다.
 */
function isDynamicPrompt(prompt: string): boolean {
    // 기본 프롬프트의 특징적인 패턴들을 확인
    const fallbackPatterns = [
        /에 대한 수업자료 이미지를 만들어줘/,
        /내용의 인포그래픽을 만들어줘/,
        /에 대한 예시 이미지를 만들어줘/,
        /의 핵심 요약 이미지를 만들어줘/,
        /수채화 색감\. 글씨 포함하지 않음/,
        /교육적인/,
        /깔끔하고/,
        /기본/
    ];

    // 동적 프롬프트의 특징적인 패턴들을 확인
    const dynamicPatterns = [
        /동적/,
        /분석/,
        /구체적/,
        /상세한/,
        /특정/,
        /전문적/,
        /고품질/,
        /watercolor/,
        /illustration/,
        /conceptual/,
        /symbolic/
    ];

    // 기본 프롬프트 패턴이 있으면 false
    for (const pattern of fallbackPatterns) {
        if (pattern.test(prompt)) {
            return false;
        }
    }

    // 동적 프롬프트 패턴이 있으면 true
    for (const pattern of dynamicPatterns) {
        if (pattern.test(prompt)) {
            return true;
        }
    }

    // 기본 프롬프트 패턴이 없고 동적 패턴이 있으면 true
    return true;
}

/**
 * 동적 프롬프트 생성 실패 시 사용할 기본 프롬프트들을 생성합니다.
 * 이 함수는 더 이상 사용되지 않습니다.
 */
function generateFallbackPrompts(coreMessage: string, groupTitle: string): string[] {
    throw new Error('기본 프롬프트는 더 이상 사용되지 않습니다. 동적 프롬프트만 사용해야 합니다.');
}

/**
 * 개별 프롬프트 생성 실패 시 사용할 기본 프롬프트를 생성합니다.
 * 이 함수는 더 이상 사용되지 않습니다.
 */
function generateFallbackPrompt(messagePart: string, groupTitle: string, promptType: string): string {
    throw new Error('기본 프롬프트는 더 이상 사용되지 않습니다. 동적 프롬프트만 사용해야 합니다.');
}

/**
 * 프롬프트 타입에 대한 설명을 반환합니다.
 */
function getPromptTypeDescription(promptType: string): string {
    const descriptions: { [key: string]: string } = {
        'concept': '교육적인 개념도나 다이어그램',
        'infographic': '인포그래픽',
        'example': '실용적인 예시나 사례',
        'summary': '핵심 요약'
    };
    return descriptions[promptType] || '교육적인 이미지';
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
 * GET /api/check-api-keys
 * API 키 상태 확인
 */
router.get('/check-api-keys', (req, res) => {
    const openaiKey = process.env.OPENAI_API_KEY;
    const stabilityKey = process.env.STABILITY_API_KEY;

    res.json({
        success: true,
        data: {
            openai: {
                configured: !!openaiKey,
                keyPrefix: openaiKey ? openaiKey.substring(0, 10) + '...' : null
            },
            stability: {
                configured: !!stabilityKey,
                keyPrefix: stabilityKey ? stabilityKey.substring(0, 10) + '...' : null
            },
            hasAnyKey: !!(openaiKey || stabilityKey)
        }
    });
});

export default router; 