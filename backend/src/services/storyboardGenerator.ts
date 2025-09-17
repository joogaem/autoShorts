import { GoogleGenerativeAI } from '@google/generative-ai';
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
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

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
        const content = JSON.stringify({
            userPrompt: request.userPrompt,
            style: request.style,
            tone: request.tone
        });
        return Buffer.from(content).toString('base64');
    }

    public async generateStoryboard(request: StoryboardRequest): Promise<StoryboardResponse> {
        const cacheKey = this.generateCacheKey(request);

        // 캐시 확인
        if (this.cache.has(cacheKey)) {
            console.log('캐시된 스토리보드 사용');
            return this.cache.get(cacheKey)!;
        }

        try {
            console.log('스토리보드 생성 시작:', {
                userPrompt: request.userPrompt.substring(0, 100) + '...',
                style: request.style,
                tone: request.tone
            });

            // 스토리보드 생성 프롬프트
            const prompt = `You are an expert storyteller and educator who excels at making complex, abstract concepts understandable through simple, compelling narratives. A user will provide you with an educational topic.

Your task is to create a 5-scene storyboard. Follow these rules precisely:

1.  **Story Creation:** Based on the user's concept, invent a short, original, and memorable story (like an anecdote or analogy).
2.  **Character Consistency:** If your story has characters, you MUST ensure they look the same across all scenes. To do this:
    *   Create a single, detailed visual description for each main character (e.g., "a curious young boy with curly brown hair, wearing a red striped t-shirt and blue shorts", or "a young Korean girl with short black hair, wearing round glasses and a yellow raincoat").
    *   **Use this exact, identical description in the image prompt for every scene the character appears in.** This is crucial for consistency.
3.  **Art Style Consistency:** ALL scenes MUST have a consistent, photorealistic art style. To achieve this, you MUST append the following phrase to the end of EVERY \`image_prompt_english\`: ", photorealistic, cinematic lighting, high detail". This is mandatory for a unified look.
4.  **Scene Breakdown:** Structure the story into 5 scenes for a short vertical video (30-60 seconds).
5.  **Output Format:** For each scene, provide:
    *   \`narrative_korean\`: A short, engaging narrative in Korean.
    *   \`image_prompt_english\`: A detailed, cinematic English prompt for an image generation model.
        *   **Text in Images:** Any text that might appear in the image (like on a sign or a book cover) MUST be in English.
        *   **Safety:** The prompt must be 100% SFW (Safe For Work) and avoid any sensitive or harmful topics (violence, weapons, etc.).

Return the result as a JSON array of objects, with each object having "scene_number", "narrative_korean", and "image_prompt_english".

User Concept: "${request.userPrompt}"`;

            // Gemini API 호출
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            console.log('Gemini API 응답 받음, 파싱 시작');

            // JSON 파싱
            let storyboardData;
            try {
                // JSON 부분만 추출 (```json ... ``` 형태일 수 있음)
                const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\[[\s\S]*\]/);
                const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
                storyboardData = JSON.parse(jsonString);
            } catch (parseError) {
                console.error('JSON 파싱 오류:', parseError);
                console.log('원본 응답:', text);
                throw new Error('스토리보드 JSON 파싱 실패');
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

            const storyboardResponse: StoryboardResponse = {
                scenes,
                characters,
                artStyle: 'photorealistic, cinematic lighting, high detail',
                estimatedDuration: 45 // 5장면 * 9초 평균
            };

            // 캐시에 저장
            this.cache.set(cacheKey, storyboardResponse);

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
