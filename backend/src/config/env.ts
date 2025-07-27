import dotenv from 'dotenv';

// .env 파일을 루트에서 자동으로 로드
dotenv.config();

export const PORT = process.env.PORT || 3001;
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
export const STABILITY_API_KEY = process.env.STABILITY_API_KEY;
export const GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS;

// TTS 디버깅을 위한 환경 변수들
export const TTS_DEBUG = process.env.TTS_DEBUG === 'true';
export const GOOGLE_CLOUD_PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID;

console.log('🔧 환경 변수 로드 완료:');
console.log('PORT:', PORT);
console.log('OPENAI_API_KEY:', OPENAI_API_KEY ? '설정됨' : '설정되지 않음');
console.log('STABILITY_API_KEY:', STABILITY_API_KEY ? '설정됨' : '설정되지 않음');
console.log('GOOGLE_APPLICATION_CREDENTIALS:', GOOGLE_APPLICATION_CREDENTIALS ? '설정됨' : '설정되지 않음');
console.log('TTS_DEBUG:', TTS_DEBUG);
console.log('GOOGLE_CLOUD_PROJECT_ID:', GOOGLE_CLOUD_PROJECT_ID);