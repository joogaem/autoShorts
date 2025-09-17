// 스토리보드 장면 타입 정의
export interface StoryboardScene {
    scene_number: number;
    narrative_korean: string;
    image_prompt_english: string;
}

// 스토리보드 응답 타입 정의
export interface StoryboardResponse {
    scenes: StoryboardScene[];
    characters: string[];
    artStyle: string;
    estimatedDuration: number;
}

// 스토리보드 생성 요청 타입 정의
export interface StoryboardRequest {
    userPrompt: string;
    style?: 'educational' | 'entertaining' | 'professional' | 'casual';
    tone?: 'friendly' | 'formal' | 'energetic' | 'calm';
}

// 스토리보드 API 응답 타입 정의
export interface StoryboardApiResponse {
    success: boolean;
    data: {
        storyboard: StoryboardResponse;
        metadata: {
            totalScenes: number;
            characters: string[];
            artStyle: string;
            estimatedDuration: number;
        };
    };
}
