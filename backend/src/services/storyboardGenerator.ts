import { GoogleGenerativeAI } from '@google/generative-ai';
import { GOOGLE_API_KEY } from '../config/env';
import { z } from 'zod';

// 스토리보드 장면 스키마 정의
const StoryboardSceneSchema = z.object({
    scene_number: z.number(),
    narrative_korean: z.string(),
    image_prompt_english: z.string()
});

type StoryboardScene = z.infer<typeof StoryboardSceneSchema>;

interface StoryboardRequest {
    userPrompt: string;
    style?: 'educational' | 'entertaining' | 'professional' | 'casual';
    tone?: 'friendly' | 'formal' | 'energetic' | 'calm';
}

interface StoryboardResponse {
    scenes: StoryboardScene[];
    characters: string[];
    artStyle: string;
    estimatedDuration: number;
}

// Gemini AI 모델 초기화
if (!GOOGLE_API_KEY) {
    console.error('[Storyboard] GOOGLE_API_KEY가 설정되지 않았습니다. .env를 확인하세요.');
}
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// 스토리보드 생성 서비스
export class StoryboardGeneratorService {
    private static instance: StoryboardGeneratorService;
    private cache = new Map<string, StoryboardResponse>();

    public static getInstance(): StoryboardGeneratorService {
        if (!StoryboardGeneratorService.instance) {
            StoryboardGeneratorService.instance = new StoryboardGeneratorService();
        }
        return StoryboardGeneratorService.instance;
    }

    private generateCacheKey(request: StoryboardRequest): string {
        // userPrompt를 정규화하여 공백 차이로 인한 캐시 미스 방지
        const normalizedPrompt = request.userPrompt.trim().replace(/\s+/g, ' ');
        const content = JSON.stringify({
            userPrompt: normalizedPrompt,
            style: request.style,
            tone: request.tone
        });
        return Buffer.from(content).toString('base64');
    }

    public async generateStoryboard(request: StoryboardRequest): Promise<StoryboardResponse> {
        // 환경 변수로 캐시 사용 여부 제어 (기본값: 개발 환경에서는 비활성화)
        // STORYBOARD_CACHE_ENABLED=true로 설정하면 캐시 활성화
        const cacheEnabled = process.env.STORYBOARD_CACHE_ENABLED === 'true' || 
                             (process.env.NODE_ENV === 'production' && process.env.STORYBOARD_CACHE_ENABLED !== 'false');
        
        if (cacheEnabled) {
            const cacheKey = this.generateCacheKey(request);
            
            // 캐시 확인
            if (this.cache.has(cacheKey)) {
                console.log('캐시된 스토리보드 사용 (캐시 키:', cacheKey.substring(0, 20) + '...)');
                return this.cache.get(cacheKey)!;
            }
        } else {
            console.log('캐시 비활성화: 새로운 스토리보드 생성');
        }

        try {
            console.log('스토리보드 생성 시작:', {
                userPrompt: request.userPrompt.substring(0, 100) + '...',
                style: request.style,
                tone: request.tone
            });

            // 스토리보드 생성 프롬프트
            const prompt = `You are a professional educational content creator. Transform the given content into a 5-scene storyboard with STRICT visual consistency across all scenes.

**Educational Content:**
"${request.userPrompt}"

**STEP 1 — DEFINE VISUAL IDENTITY (do this mentally before writing prompts):**
Before writing any scene, decide ONCE:
- **Art style**: Choose ONE specific style (e.g., "flat vector cartoon illustration with clean outlines and soft pastel colors")
- **Characters**: If people appear, define EACH character ONCE with specific details:
  - Gender, approximate age, hair color/style, skin tone, clothing color and style
  - Example: "a young woman in her 30s, short black bob hair, light skin, wearing a light blue blazer and white shirt"
  - Keep EXACTLY the same description in every scene they appear

**STEP 2 — WRITE 5 SCENES:**
Every single "image_prompt_english" field MUST:
1. Start with the EXACT SAME art style string (copy it verbatim into each prompt)
2. Include the EXACT SAME character description for each character that appears (copy verbatim)
3. Only change the ACTION and SETTING for each scene
4. End with: "no text, no letters, no numbers in the image"

**Storytelling:**
- Create a narrative arc: intro → build-up → climax → resolution → wrap-up
- Use real-world professional scenarios to illustrate the concept
- Korean narrative should be formal and accessible

**OUTPUT FORMAT — CRITICAL:**
Return ONLY a valid JSON array. No explanation, no markdown, no extra text.

[
  {
    "scene_number": 1,
    "narrative_korean": "한국어 내레이션...",
    "image_prompt_english": "[EXACT ART STYLE], [EXACT CHARACTER DESCRIPTION if person appears], [scene-specific action and setting], no text no letters no numbers"
  },
  ... (5 scenes total)
]`;

            // Gemini API 호출
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            console.log('=== Gemini API 원본 응답 ===');
            console.log('응답 길이:', text.length);
            console.log('응답 내용 (처음 500자):', text.substring(0, 500));
            console.log('응답 내용 (마지막 500자):', text.substring(Math.max(0, text.length - 500)));
            console.log('전체 응답:', text);
            console.log('=== 응답 끝 ===');

            // JSON 파싱
            let storyboardData;
            try {
                // 다양한 JSON 형식 추출 시도
                let jsonString = '';

                // 1. ```json ... ``` 코드 블록 확인
                const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
                if (jsonBlockMatch) {
                    jsonString = jsonBlockMatch[1].trim();
                    console.log('✅ JSON 코드 블록에서 추출');
                } else {
                    // 2. ``` ... ``` 일반 코드 블록 확인 (JSON 포함 가능)
                    const codeBlockMatch = text.match(/```\s*([\s\S]*?)\s*```/);
                    if (codeBlockMatch) {
                        const codeContent = codeBlockMatch[1].trim();
                        // JSON 배열로 시작하는지 확인
                        if (codeContent.trim().startsWith('[')) {
                            jsonString = codeContent;
                            console.log('✅ 일반 코드 블록에서 JSON 추출');
                        }
                    }

                    // 3. 직접 JSON 배열 패턴 찾기 (대괄호로 시작하고 끝나는 부분)
                    if (!jsonString) {
                        const jsonArrayMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
                        if (jsonArrayMatch) {
                            jsonString = jsonArrayMatch[0].trim();
                            console.log('✅ 텍스트에서 JSON 배열 추출');
                        }
                    }

                    // 4. 첫 번째 [ 부터 마지막 ] 까지 추출 시도
                    if (!jsonString) {
                        const firstBracket = text.indexOf('[');
                        const lastBracket = text.lastIndexOf(']');
                        if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
                            jsonString = text.substring(firstBracket, lastBracket + 1).trim();
                            console.log('✅ 대괄호 범위에서 JSON 추출');
                        }
                    }

                    // 5. 전체 텍스트가 JSON인 경우
                    if (!jsonString && text.trim().startsWith('[') && text.trim().endsWith(']')) {
                        jsonString = text.trim();
                        console.log('✅ 전체 응답이 JSON');
                    }
                }

                if (!jsonString) {
                    console.error('❌ JSON 형식을 찾을 수 없습니다');
                    console.log('원본 응답 (처음 1000자):', text.substring(0, 1000));
                    throw new Error('응답에서 JSON 형식을 찾을 수 없습니다');
                }

                console.log('=== 추출된 JSON 문자열 ===');
                console.log('JSON 문자열 길이:', jsonString.length);
                console.log('JSON 문자열 내용 (처음 500자):', jsonString.substring(0, 500));
                if (jsonString.length > 500) {
                    console.log('JSON 문자열 내용 (마지막 500자):', jsonString.substring(jsonString.length - 500));
                }
                console.log('=== JSON 문자열 끝 ===');

                storyboardData = JSON.parse(jsonString);
                console.log('✅ JSON 파싱 성공:', storyboardData);
            } catch (parseError) {
                console.error('❌ JSON 파싱 오류:', parseError);
                console.log('원본 응답 (전체):', text);
                console.log('원본 응답 길이:', text.length);
                throw new Error(`스토리보드 JSON 파싱 실패: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
            }

            // 스키마 검증
            const scenes = storyboardData.map((scene: any, index: number) => {
                try {
                    return StoryboardSceneSchema.parse({
                        scene_number: scene.scene_number || index + 1,
                        narrative_korean: scene.narrative_korean || '',
                        image_prompt_english: scene.image_prompt_english || ''
                    });
                } catch (error) {
                    console.error(`장면 ${index + 1} 스키마 검증 오류:`, error);
                    throw new Error(`장면 ${index + 1} 데이터 형식이 올바르지 않습니다`);
                }
            });

            // 캐릭터 정보 추출 (이미지 프롬프트에서)
            const characters = this.extractCharacters(scenes);

            // artStyle을 첫 번째 장면 프롬프트에서 추출 (AI가 정의한 일관 스타일 반영)
            const inferredArtStyle = scenes[0]?.image_prompt_english?.split(',').slice(0, 3).join(',').trim()
                || 'flat vector cartoon illustration, consistent style across all scenes';

            const storyboardResponse: StoryboardResponse = {
                scenes,
                characters,
                artStyle: inferredArtStyle,
                estimatedDuration: 45 // 5장면 * 9초 평균
            };

            // 캐시가 활성화된 경우에만 캐시에 저장
            const cacheEnabled = process.env.STORYBOARD_CACHE_ENABLED === 'true' || 
                                 (process.env.NODE_ENV === 'production' && process.env.STORYBOARD_CACHE_ENABLED !== 'false');
            if (cacheEnabled) {
                const cacheKey = this.generateCacheKey(request);
                this.cache.set(cacheKey, storyboardResponse);
                console.log('스토리보드 캐시에 저장됨 (캐시 키:', cacheKey.substring(0, 20) + '...)');
            }

            console.log('스토리보드 생성 완료:', {
                scenesCount: scenes.length,
                charactersCount: characters.length
            });

            return storyboardResponse;

        } catch (error) {
            console.error('스토리보드 생성 중 오류:', error);
            throw new Error(`스토리보드 생성 실패: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private extractCharacters(scenes: StoryboardScene[]): string[] {
        const characterDescriptions = new Set<string>();

        scenes.forEach(scene => {
            const prompt = scene.image_prompt_english.toLowerCase();

            // 일반적인 캐릭터 설명 패턴 찾기
            const characterPatterns = [
                /(young|old|teenage|adult)\s+(boy|girl|man|woman|child|person)/g,
                /(curly|straight|short|long)\s+(hair|brown|black|blonde|red)/g,
                /(wearing|dressed in|clothed in)\s+[^,]+/g
            ];

            characterPatterns.forEach(pattern => {
                const matches = prompt.match(pattern);
                if (matches) {
                    matches.forEach(match => characterDescriptions.add(match.trim()));
                }
            });
        });

        return Array.from(characterDescriptions);
    }

    public clearCache(): void {
        this.cache.clear();
        console.log('스토리보드 캐시 초기화 완료');
    }

    public getCacheSize(): number {
        return this.cache.size;
    }
}

export default StoryboardGeneratorService;
