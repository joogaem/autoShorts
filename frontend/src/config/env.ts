// Frontend 환경 변수 설정
// Next.js는 NEXT_PUBLIC_ 접두사가 있는 환경 변수만 클라이언트에서 접근 가능

export const NODE_ENV = process.env.NODE_ENV || 'development';
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
export const UPLOAD_URL = process.env.NEXT_PUBLIC_UPLOAD_URL || 'http://localhost:3001/api/upload';
export const PARSE_URL = process.env.NEXT_PUBLIC_PARSE_URL || 'http://localhost:3001/api/parse';
export const CORE_MESSAGES_URL = process.env.NEXT_PUBLIC_CORE_MESSAGES_URL || 'http://localhost:3001/api/extract-core-messages';

// 환경 변수 검증
export const validateEnv = () => {
    const requiredVars = [
        'NEXT_PUBLIC_API_URL',
        'NEXT_PUBLIC_UPLOAD_URL',
        'NEXT_PUBLIC_PARSE_URL',
        'NEXT_PUBLIC_CORE_MESSAGES_URL'
    ];

    const missing = requiredVars.filter(varName => !process.env[varName]);

    if (missing.length > 0) {
        console.warn('⚠️ 다음 환경 변수들이 설정되지 않았습니다:', missing);
        console.warn('기본값을 사용합니다.');
    }
};

// 개발 환경에서 환경 변수 상태 로그
if (NODE_ENV === 'development') {
    console.log('🔧 Frontend 환경 변수 로드 완료:');
    console.log('API_URL:', API_URL);
    console.log('UPLOAD_URL:', UPLOAD_URL);
    console.log('PARSE_URL:', PARSE_URL);
    console.log('CORE_MESSAGES_URL:', CORE_MESSAGES_URL);
}
