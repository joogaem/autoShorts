export interface SlideElement {
    type: 'text' | 'image' | 'shape' | 'chart';
    content?: string;
    src?: string;
    alt?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
}

export interface Slide {
    id: string;
    title?: string;
    text?: string;
    images?: string[]; // 파싱에서 추출된 이미지 URL들
    elements?: SlideElement[];
    background?: string;
    layout?: string;
    order: number;
    hasVisuals?: boolean; // 파싱에서 계산된 시각적 요소 존재 여부
    visualMetadata?: {
        textLength: number;
        imageCount: number;
        slideType: 'text-heavy' | 'image-heavy' | 'balanced' | 'minimal';
    };
}

export interface StoryboardScene {
    sceneNumber: number;
    narrative: string;
    imagePrompt: string;
}

export interface StoryboardResponse {
    scenes: StoryboardScene[];
    characters: string[];
    artStyle: string;
    estimatedDuration: number;
} 