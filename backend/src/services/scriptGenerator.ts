import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

interface Slide {
    id: number;
    text: string;
    images: string[];
    hasVisuals: boolean;
}

interface ScriptRequest {
    slides: Slide[];
    style?: 'educational' | 'entertaining' | 'professional' | 'casual';
    tone?: 'friendly' | 'formal' | 'energetic' | 'calm';
    targetDuration?: number; // 초 단위
}

interface ScriptResponse {
    script: string;
    hook: string;
    coreMessage: string;
    cta: string;
    estimatedDuration: number;
    style: string;
    tone: string;
    slides: Slide[];
}

// OpenAI 모델 초기화
const model = new ChatOpenAI({
    modelName: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 2000,
});

// 스크립트 생성 프롬프트 템플릿
const scriptPromptTemplate = PromptTemplate.fromTemplate(`
당신은 전문적인 쇼츠 비디오 스크립트 작가입니다. 
주어진 슬라이드 내용을 바탕으로 60초 이내의 매력적인 쇼츠 비디오 스크립트를 작성해주세요.

**스타일**: {style}
**톤**: {tone}
**목표 길이**: {targetDuration}초

**슬라이드 내용**:
{slidesContent}

**스크립트 구조**:
1. **Hook (5-10초)**: 시청자의 관심을 끄는 강력한 오프닝
2. **Core Message (40-50초)**: 핵심 내용을 명확하고 흥미롭게 전달
3. **CTA (5-10초)**: 행동 유도 (구독, 좋아요, 댓글 등)

**요구사항**:
- 한국어로 작성
- 자연스럽고 구어체적인 톤
- 시청자가 끝까지 볼 수 있도록 흥미롭게
- 핵심 메시지를 명확하게 전달
- 적절한 감정과 리듬감 포함

**출력 형식**:
스크립트만 작성하고, 각 섹션을 명확히 구분해주세요.

스크립트:
`);

// 스크립트 생성 서비스
export class ScriptGeneratorService {
    private static instance: ScriptGeneratorService;
    private cache = new Map<string, ScriptResponse>();

    public static getInstance(): ScriptGeneratorService {
        if (!ScriptGeneratorService.instance) {
            ScriptGeneratorService.instance = new ScriptGeneratorService();
        }
        return ScriptGeneratorService.instance;
    }

    private generateCacheKey(request: ScriptRequest): string {
        const content = JSON.stringify({
            slides: request.slides.map(s => ({ id: s.id, text: s.text })),
            style: request.style,
            tone: request.tone,
            targetDuration: request.targetDuration
        });
        return Buffer.from(content).toString('base64');
    }

    public async generateScript(request: ScriptRequest): Promise<ScriptResponse> {
        const cacheKey = this.generateCacheKey(request);

        // 캐시 확인
        if (this.cache.has(cacheKey)) {
            console.log('캐시된 스크립트 사용');
            return this.cache.get(cacheKey)!;
        }

        try {
            console.log('스크립트 생성 시작:', {
                slidesCount: request.slides.length,
                style: request.style,
                tone: request.tone,
                targetDuration: request.targetDuration
            });

            // 슬라이드 내용을 텍스트로 변환
            const slidesContent = request.slides
                .map(slide => `슬라이드 ${slide.id}: ${slide.text}`)
                .join('\n\n');

            // 프롬프트 생성
            const prompt = await scriptPromptTemplate.format({
                slidesContent,
                style: request.style || 'educational',
                tone: request.tone || 'friendly',
                targetDuration: request.targetDuration || 60
            });

            console.log('프롬프트 생성 완료, OpenAI API 호출 시작');

            // OpenAI API 호출
            const aiResponse = await model.invoke(prompt);
            const script = aiResponse.content as string;

            console.log('스크립트 생성 완료');

            // 예상 지속 시간 계산 (한국어 기준 약 3-4음절/초)
            const estimatedDuration = this.calculateDuration(script);

            // 스크립트를 섹션별로 분리
            const { hook, coreMessage, cta } = this.parseScriptSections(script.trim());

            const scriptResponse: ScriptResponse = {
                script: script.trim(),
                hook,
                coreMessage,
                cta,
                estimatedDuration,
                style: request.style || 'educational',
                tone: request.tone || 'friendly',
                slides: request.slides
            };

            // 캐시에 저장
            this.cache.set(cacheKey, scriptResponse);

            console.log('스크립트 생성 완료:', {
                estimatedDuration,
                scriptLength: script.length
            });

            return scriptResponse;

        } catch (error) {
            console.error('스크립트 생성 중 오류:', error);
            throw new Error(`스크립트 생성 실패: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private calculateDuration(script: string): number {
        // 한국어 기준으로 대략적인 지속 시간 계산
        // 공백과 특수문자 제거 후 음절 수 계산
        const cleanText = script.replace(/[^\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/g, '');
        const syllableCount = cleanText.length;

        // 한국어는 약 3-4음절/초로 발화
        const duration = Math.ceil(syllableCount / 3.5);

        // 최소 30초, 최대 90초로 제한
        return Math.max(30, Math.min(90, duration));
    }

    private parseScriptSections(script: string): { hook: string; coreMessage: string; cta: string } {
        // 스크립트를 줄 단위로 분리
        const lines = script.split('\n').filter(line => line.trim());

        let hook = '';
        let coreMessage = '';
        let cta = '';
        let currentSection = 'coreMessage'; // 기본값

        for (const line of lines) {
            const trimmedLine = line.trim();

            // 섹션 구분자 찾기
            if (trimmedLine.includes('Hook') || trimmedLine.includes('1.') || trimmedLine.includes('오프닝')) {
                currentSection = 'hook';
                continue;
            } else if (trimmedLine.includes('Core Message') || trimmedLine.includes('2.') || trimmedLine.includes('핵심')) {
                currentSection = 'coreMessage';
                continue;
            } else if (trimmedLine.includes('CTA') || trimmedLine.includes('3.') || trimmedLine.includes('행동')) {
                currentSection = 'cta';
                continue;
            }

            // 내용을 해당 섹션에 추가
            if (currentSection === 'hook') {
                hook += (hook ? '\n' : '') + trimmedLine;
            } else if (currentSection === 'coreMessage') {
                coreMessage += (coreMessage ? '\n' : '') + trimmedLine;
            } else if (currentSection === 'cta') {
                cta += (cta ? '\n' : '') + trimmedLine;
            }
        }

        // 섹션이 비어있으면 전체 스크립트를 coreMessage로 설정
        if (!hook && !coreMessage && !cta) {
            coreMessage = script;
        }

        return { hook, coreMessage, cta };
    }

    public clearCache(): void {
        this.cache.clear();
        console.log('스크립트 캐시 초기화 완료');
    }

    public getCacheSize(): number {
        return this.cache.size;
    }
}

export default ScriptGeneratorService; 