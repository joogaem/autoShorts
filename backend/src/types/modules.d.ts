// node-pptx에 공식 타입이 없으므로 임시 선언
declare module 'node-pptx' {
  interface Slide {
    texts?: string[];
    images?: Array<{
      data: string;
      ext: string;
    }>;
  }

  interface Presentation {
    slides: Slide[];
  }

  export function readFile(filePath: string): Promise<Presentation>;
}

// @google/genai SDK 타입 선언이 없는 경우를 위한 임시 선언
declare module '@google/genai' {
  export class GoogleGenAI {
    constructor(config: { apiKey: string });
    models: {
      generateContent(args: {
        model: string;
        contents: any;
        generationConfig?: any;
      }): Promise<any>;
    };
  }
}
