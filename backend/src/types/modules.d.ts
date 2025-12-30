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
