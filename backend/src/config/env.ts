// Backend 환경 변수 설정
import dotenv from 'dotenv';

// .env 파일 로드 (프로젝트 루트에서)
dotenv.config({ path: '../.env' });

// OpenAI API 키
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// Google API 키 (Gemini용)
export const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';

// NanoBana API 키
export const NANOBANA_API_KEY = process.env.NANOBANA_API_KEY || '';

// 서버 포트
export const PORT = parseInt(process.env.PORT || '3001', 10);

// Google Cloud TTS 설정
export const GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS || '';

// 환경 변수 검증
export const validateEnv = () => {
    const requiredVars = [
        'OPENAI_API_KEY',
        'GOOGLE_API_KEY'
    ];

    const missing = requiredVars.filter(varName => !process.env[varName]);

    if (missing.length > 0) {
        console.warn('⚠️ 다음 환경 변수들이 설정되지 않았습니다:', missing);
        console.warn('일부 기능이 작동하지 않을 수 있습니다.');
    }
};

// 개발 환경에서 환경 변수 상태 로그
if (process.env.NODE_ENV === 'development') {
    console.log('🔧 Backend 환경 변수 로드 완료:');
    console.log('PORT:', PORT);
    console.log('OPENAI_API_KEY:', OPENAI_API_KEY ? '설정됨' : '설정되지 않음');
    console.log('GOOGLE_API_KEY:', GOOGLE_API_KEY ? '설정됨' : '설정되지 않음');
    console.log('NANOBANA_API_KEY:', NANOBANA_API_KEY ? '설정됨' : '설정되지 않음');
    console.log('GOOGLE_APPLICATION_CREDENTIALS:', GOOGLE_APPLICATION_CREDENTIALS ? '설정됨' : '설정되지 않음');
}
