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

// 이미지 스크립트 생성 프롬프트 템플릿
const imageScriptPromptTemplate = PromptTemplate.fromTemplate(`
당신은 교육 콘텐츠를 위한 이미지 생성 전문가입니다.
주어진 그룹의 내용을 분석하여 교육적으로 효과적인 이미지 스크립트 5개를 생성해주세요.

**그룹 제목**: {groupTitle}
**그룹 내용**:
{groupContent}

**요구사항**:
1. 각 스크립트는 서로 다른 시각적 접근 방식을 사용해야 합니다
2. 교육적이고 이해하기 쉬운 이미지가 되도록 해야 합니다
3. 한국어로 작성하고, 구체적이고 명확한 설명을 포함해야 합니다
4. 쇼츠 비디오에 적합한 세로 비율(9:16)을 고려해야 합니다
5. 반드시 JSON 배열 형태로만 응답해야 합니다

**생성할 5개 스크립트 유형**:
1. **개념도/다이어그램**: 핵심 개념을 시각적으로 표현
2. **인포그래픽**: 정보를 구조화하여 시각화
3. **실용적 예시**: 실제 적용 사례나 예시를 보여줌
4. **단계별 프로세스**: 학습 과정을 순서대로 표현
5. **핵심 요약**: 주요 포인트를 간결하게 정리

**중요**: 반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.

[
  {{
    "description": "개념도/다이어그램",
    "prompt": "{groupTitle}에 대한 교육적인 개념도, 깔끔하고 전문적인 스타일, 핵심 개념을 시각적으로 표현, 세로 비율 9:16에 최적화"
  }},
  {{
    "description": "인포그래픽",
    "prompt": "{groupTitle} 학습 내용을 시각화한 인포그래픽, 색상이 풍부하고 이해하기 쉬운 디자인, 데이터와 정보를 명확하게 표현, 세로 비율 9:16에 최적화"
  }},
  {{
    "description": "실용적 예시",
    "prompt": "{groupTitle}에 대한 실용적인 예시나 사례를 보여주는 이미지, 현실적이고 구체적인 스타일, 실제 적용 사례를 시각화, 세로 비율 9:16에 최적화"
  }},
  {{
    "description": "단계별 프로세스",
    "prompt": "{groupTitle} 학습 과정을 단계별로 보여주는 프로세스 이미지, 순서가 명확하고 직관적인 디자인, 단계별 진행을 시각화, 세로 비율 9:16에 최적화"
  }},
  {{
    "description": "핵심 요약",
    "prompt": "{groupTitle}의 핵심 요약을 담은 미니멀한 이미지, 핵심 포인트만 강조된 깔끔한 스타일, 주요 메시지를 간결하게 표현, 세로 비율 9:16에 최적화"
  }}
]
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
                console.warn(`그룹 ${group.id}에 이미지 스크립트가 없습니다. 기본 이미지를 생성합니다.`);

                // 이미지 스크립트가 없을 때 기본 이미지 생성
                try {
                    const defaultImageRequest: ImageGenerationRequest = {
                        prompt: `${group.title || group.name || '교육 콘텐츠'}에 대한 전문적이고 교육적인 이미지`,
                        style: 'professional' as const,
                        aspectRatio: '9:16',
                        quality: 'standard'
                    };

                    const defaultImage = await imageGenerationService.generateImage(defaultImageRequest);
                    const imageCost = imageGenerationService.calculateImageCost('512x512', 'standard');

                    groupResults.push({
                        groupId: group.id,
                        groupName: group.title || group.name || `Group ${group.id}`,
                        slides: [],
                        images: [defaultImage],
                        imageScripts: [],
                        totalGenerated: 1,
                        estimatedCost: imageCost
                    });
                } catch (error) {
                    console.error('기본 이미지 생성 실패:', error);

                    // API 키 문제인지 확인
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    if (errorMessage.includes('API key is not configured') ||
                        errorMessage.includes('status code 400') ||
                        errorMessage.includes('status code 403')) {
                        console.warn('API 키가 설정되지 않았거나 유효하지 않습니다. 이미지 생성이 건너뜁니다.');
                    }

                    // 이미지 생성 실패 시 빈 결과 추가
                    groupResults.push({
                        groupId: group.id,
                        groupName: group.title || group.name || `Group ${group.id}`,
                        slides: [],
                        images: [],
                        imageScripts: [],
                        totalGenerated: 0,
                        estimatedCost: 0
                    });
                }
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
 * 이미지 생성을 위한 스크립트 생성
 */
router.post('/generate-image-scripts', async (req, res) => {
    try {
        const { groups, slides, coreMessages } = req.body;

        if (!groups || !Array.isArray(groups) || !slides || !Array.isArray(slides)) {
            return res.status(400).json({
                success: false,
                error: '그룹과 슬라이드 배열이 필요합니다'
            });
        }

        const groupResults = [];

        for (const group of groups) {
            if (!group || !group.id) {
                console.error('유효하지 않은 그룹 데이터:', group);
                continue;
            }

            console.log('이미지 스크립트 생성 중인 그룹:', {
                id: group.id,
                title: group.title,
                slides: group.slides
            });

            // 그룹에 속한 슬라이드들 찾기
            const groupSlides = slides.filter((slide: any) => {
                if (!slide || !slide.id) {
                    console.error('유효하지 않은 슬라이드 데이터:', slide);
                    return false;
                }

                if (!group.slides || !Array.isArray(group.slides)) {
                    console.error('그룹에 slides 배열이 없음:', group);
                    return false;
                }

                const isIncluded = group.slides.includes(slide.id);
                console.log(`슬라이드 ${slide.id}가 그룹 ${group.id}에 포함됨:`, isIncluded);
                return isIncluded;
            });

            console.log(`그룹 ${group.id}의 슬라이드 수:`, groupSlides.length);

            if (groupSlides.length > 0) {
                // 해당 그룹의 core message 찾기
                const groupCoreMessage = coreMessages?.find((msg: any) =>
                    msg.groupId === group.id
                )?.coreMessage;

                console.log(`그룹 ${group.id}의 core message:`, groupCoreMessage ? groupCoreMessage.substring(0, 100) + '...' : '없음');

                // core message를 기반으로 이미지 스크립트 생성
                const imageScripts = await generateImageScripts(groupSlides, group.title, groupCoreMessage);

                console.log(`그룹 ${group.id} 스크립트 생성 결과:`, {
                    groupTitle: group.title,
                    hasCoreMessage: !!groupCoreMessage,
                    scriptsCount: imageScripts.length,
                    scriptTypes: imageScripts.map((s: any) => s.description)
                });

                groupResults.push({
                    groupId: group.id,
                    groupName: group.title || group.name || `Group ${group.id}`,
                    slides: groupSlides.map((slide: any) => slide.id),
                    imageScripts: imageScripts,
                    totalScripts: imageScripts.length,
                    hasCoreMessage: !!groupCoreMessage
                });
            } else {
                console.warn(`그룹 ${group.id}에 속한 슬라이드가 없습니다. 기본 스크립트를 생성합니다.`);

                // 슬라이드가 없을 때 기본 이미지 스크립트 생성
                const defaultScripts = generateDefaultImageScripts(group.title || group.name || '교육 콘텐츠');

                groupResults.push({
                    groupId: group.id,
                    groupName: group.title || group.name || `Group ${group.id}`,
                    slides: [],
                    imageScripts: defaultScripts,
                    totalScripts: defaultScripts.length,
                    hasCoreMessage: false
                });
            }
        }

        res.json({
            success: true,
            data: {
                groups: groupResults,
                totalGroups: groupResults.length,
                totalScripts: groupResults.reduce((sum, group) => sum + group.totalScripts, 0)
            }
        });
    } catch (error) {
        console.error('이미지 스크립트 생성 오류:', error);
        res.status(500).json({
            success: false,
            error: '이미지 스크립트 생성 중 오류가 발생했습니다'
        });
    }
});

/**
 * 슬라이드 내용을 기반으로 이미지용 스크립트를 생성합니다.
 */
async function generateImageScripts(slides: any[], groupTitle: string, coreMessage?: string): Promise<any[]> {
    try {
        // core message가 있으면 그것을 우선 사용
        if (coreMessage && coreMessage.trim()) {
            console.log('Core message 기반 이미지 스크립트 생성:', {
                groupTitle,
                coreMessage: coreMessage.substring(0, 100) + '...'
            });

            // core message 기반으로 4개의 다양한 이미지 스크립트 생성
            const imageScripts = [
                {
                    id: `core_script_${Date.now()}_1`,
                    prompt: `${coreMessage}에 대한 교육적인 개념도나 다이어그램을 생성해줘. 깔끔하고 전문적인 스타일로 핵심 내용을 시각적으로 표현해줘.`,
                    description: '개념도/다이어그램',
                    type: 'image_generation',
                    enabled: true
                },
                {
                    id: `core_script_${Date.now()}_2`,
                    prompt: `${coreMessage} 내용을 시각화한 인포그래픽을 생성해줘. 색상이 풍부하고 이해하기 쉬운 디자인으로 정보를 명확하게 표현해줘.`,
                    description: '인포그래픽',
                    type: 'image_generation',
                    enabled: true
                },
                {
                    id: `core_script_${Date.now()}_3`,
                    prompt: `${coreMessage}에 대한 실용적인 예시나 사례를 보여주는 이미지를 생성해줘. 현실적이고 구체적인 스타일로 실제 적용 사례를 시각화해줘.`,
                    description: '실용적 예시',
                    type: 'image_generation',
                    enabled: true
                },
                {
                    id: `core_script_${Date.now()}_4`,
                    prompt: `${coreMessage}의 핵심 요약을 담은 미니멀한 이미지를 생성해줘. 핵심 포인트만 강조된 깔끔한 스타일로 주요 메시지를 간결하게 표현해줘.`,
                    description: '핵심 요약',
                    type: 'image_generation',
                    enabled: true
                }
            ];

            console.log('Core message 기반 스크립트 생성 완료:', imageScripts.length, '개');
            return imageScripts;
        }

        // 그룹 내용을 텍스트로 변환
        const groupContent = slides.map(slide => slide.content || slide.text || '').join('\n\n');

        if (!groupContent.trim()) {
            console.warn('그룹 내용이 비어있습니다. 기본 스크립트를 생성합니다.');
            return generateDefaultImageScripts(groupTitle);
        }

        console.log('그룹 내용 기반 이미지 스크립트 생성:', {
            groupTitle,
            slidesCount: slides.length,
            contentLength: groupContent.length
        });

        // 그룹 내용 기반으로 4개의 이미지 스크립트 생성
        const imageScripts = [
            {
                id: `content_script_${Date.now()}_1`,
                prompt: `${groupTitle}에 대한 교육적인 개념도나 다이어그램을 생성해줘. ${groupContent.substring(0, 200)} 내용을 바탕으로 깔끔하고 전문적인 스타일로 핵심 내용을 시각적으로 표현해줘.`,
                description: '개념도/다이어그램',
                type: 'image_generation',
                enabled: true
            },
            {
                id: `content_script_${Date.now()}_2`,
                prompt: `${groupTitle} 내용을 시각화한 인포그래픽을 생성해줘. ${groupContent.substring(0, 200)} 내용을 바탕으로 색상이 풍부하고 이해하기 쉬운 디자인으로 정보를 명확하게 표현해줘.`,
                description: '인포그래픽',
                type: 'image_generation',
                enabled: true
            },
            {
                id: `content_script_${Date.now()}_3`,
                prompt: `${groupTitle}에 대한 실용적인 예시나 사례를 보여주는 이미지를 생성해줘. ${groupContent.substring(0, 200)} 내용을 바탕으로 현실적이고 구체적인 스타일로 실제 적용 사례를 시각화해줘.`,
                description: '실용적 예시',
                type: 'image_generation',
                enabled: true
            },
            {
                id: `content_script_${Date.now()}_4`,
                prompt: `${groupTitle}의 핵심 요약을 담은 미니멀한 이미지를 생성해줘. ${groupContent.substring(0, 200)} 내용을 바탕으로 핵심 포인트만 강조된 깔끔한 스타일로 주요 메시지를 간결하게 표현해줘.`,
                description: '핵심 요약',
                type: 'image_generation',
                enabled: true
            }
        ];

        console.log('그룹 내용 기반 스크립트 생성 완료:', imageScripts.length, '개');
        return imageScripts;

    } catch (error) {
        console.error('이미지 스크립트 생성 실패:', error);
        console.log('기본 스크립트로 대체합니다.');
        return generateDefaultImageScripts(groupTitle);
    }
}

/**
 * 텍스트 응답에서 스크립트를 파싱합니다.
 */
function parseTextResponse(responseText: string, groupTitle: string): any[] {
    const scripts = [];
    const lines = responseText.split('\n');
    let currentScript: any = null;

    for (const line of lines) {
        const trimmedLine = line.trim();

        // 스크립트 설명 찾기
        if (trimmedLine.includes('개념도') || trimmedLine.includes('다이어그램')) {
            if (currentScript) scripts.push(currentScript);
            currentScript = { description: '개념도/다이어그램', prompt: '' };
        } else if (trimmedLine.includes('인포그래픽')) {
            if (currentScript) scripts.push(currentScript);
            currentScript = { description: '인포그래픽', prompt: '' };
        } else if (trimmedLine.includes('실용적') || trimmedLine.includes('예시')) {
            if (currentScript) scripts.push(currentScript);
            currentScript = { description: '실용적 예시', prompt: '' };
        } else if (trimmedLine.includes('단계별') || trimmedLine.includes('프로세스')) {
            if (currentScript) scripts.push(currentScript);
            currentScript = { description: '단계별 프로세스', prompt: '' };
        } else if (trimmedLine.includes('핵심') || trimmedLine.includes('요약')) {
            if (currentScript) scripts.push(currentScript);
            currentScript = { description: '핵심 요약', prompt: '' };
        } else if (currentScript && trimmedLine.length > 10) {
            // 프롬프트 내용 추가
            currentScript.prompt += (currentScript.prompt ? ' ' : '') + trimmedLine;
        }
    }

    if (currentScript) scripts.push(currentScript);

    // 파싱된 스크립트가 없으면 기본 스크립트 생성
    if (scripts.length === 0) {
        console.log('텍스트 파싱 실패, 기본 스크립트 사용');
        return generateDefaultImageScripts(groupTitle);
    }

    return scripts;
}

/**
 * 텍스트에서 핵심 주제를 추출합니다.
 */
function extractKeyTopics(text: string): string[] {
    // 간단한 키워드 추출 로직
    const keywords = text.toLowerCase()
        .replace(/[^\w\s가-힣]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 1)
        .slice(0, 5); // 상위 5개 키워드만 사용

    return keywords.length > 0 ? keywords : ['교육', '학습', '개념'];
}

/**
 * 기본 이미지 스크립트를 생성합니다.
 */
function generateDefaultImageScripts(groupTitle: string): any[] {
    return [
        {
            id: `default_script_${Date.now()}_1`,
            prompt: `${groupTitle}에 대한 교육적인 개념도, 깔끔하고 전문적인 스타일, 핵심 개념을 시각적으로 표현, 교육적이고 명확한 디자인, 세로 비율 9:16에 최적화`,
            description: '교육 개념도',
            type: 'image_generation',
            enabled: true
        },
        {
            id: `default_script_${Date.now()}_2`,
            prompt: `${groupTitle} 학습 내용을 시각화한 인포그래픽, 색상이 풍부하고 이해하기 쉬운 디자인, 데이터와 정보를 명확하게 표현, 시각적 학습 자료, 세로 비율 9:16에 최적화`,
            description: '학습 인포그래픽',
            type: 'image_generation',
            enabled: true
        },
        {
            id: `default_script_${Date.now()}_3`,
            prompt: `${groupTitle}에 대한 실용적인 예시나 사례를 보여주는 이미지, 현실적이고 구체적인 스타일, 실제 적용 사례를 시각화, 실무 적용 예시, 세로 비율 9:16에 최적화`,
            description: '실용적 예시',
            type: 'image_generation',
            enabled: true
        },
        {
            id: `default_script_${Date.now()}_4`,
            prompt: `${groupTitle} 학습 과정을 단계별로 보여주는 프로세스 이미지, 순서가 명확하고 직관적인 디자인, 단계별 진행을 시각화, 체계적 학습 과정, 세로 비율 9:16에 최적화`,
            description: '단계별 프로세스',
            type: 'image_generation',
            enabled: true
        },
        {
            id: `default_script_${Date.now()}_5`,
            prompt: `${groupTitle}의 핵심 요약을 담은 미니멀한 이미지, 핵심 포인트만 강조된 깔끔한 스타일, 주요 메시지를 간결하게 표현, 핵심 요약, 세로 비율 9:16에 최적화`,
            description: '핵심 요약',
            type: 'image_generation',
            enabled: true
        }
    ];
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