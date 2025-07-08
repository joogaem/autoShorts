import dotenv from 'dotenv';

// .env 파일을 루트에서 자동으로 로드
dotenv.config();

function requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`환경 변수 ${key}가 설정되어 있지 않습니다.`);
    }
    return value;
}

// 필수 환경 변수
export const OPENAI_API_KEY = requireEnv('OPENAI_API_KEY');
export const DALL_E_API_KEY = requireEnv('DALL_E_API_KEY');
export const GOOGLE_TTS_PROJECT_ID = requireEnv('GOOGLE_TTS_PROJECT_ID');
export const GOOGLE_TTS_CLIENT_EMAIL = requireEnv('GOOGLE_TTS_CLIENT_EMAIL');
export const GOOGLE_TTS_PRIVATE_KEY = requireEnv('GOOGLE_TTS_PRIVATE_KEY');
export const GOOGLE_TTS_LANGUAGE = process.env.GOOGLE_TTS_LANGUAGE || 'ko-KR';
export const PORT = process.env.PORT || '3001';

// 선택적 환경 변수는 아래처럼 사용 가능
// export const OPTIONAL_KEY = process.env.OPTIONAL_KEY;