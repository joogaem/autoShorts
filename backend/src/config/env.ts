// Backend 환경 변수 설정
import dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// .env 파일 로드 (프로젝트 루트에서)
// 여러 가능한 경로를 시도
const possibleEnvPaths = [
    path.resolve(__dirname, '../../.env'),  // backend/src/config/../../.env (프로젝트 루트)
    path.resolve(__dirname, '../../../.env'), // 안전장치
    path.resolve(process.cwd(), '.env'),     // 현재 작업 디렉토리
];

let envLoaded = false;
for (const envPath of possibleEnvPaths) {
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
        console.log(`✅ .env 파일 로드 완료: ${envPath}`);
        envLoaded = true;
        break;
    }
}

if (!envLoaded) {
    console.warn('⚠️ .env 파일을 찾을 수 없습니다. 다음 경로들을 확인했습니다:');
    possibleEnvPaths.forEach(p => console.warn(`  - ${p}`));
    console.warn('환경 변수는 시스템 환경 변수에서만 로드됩니다.');
    // 기본 dotenv 로드 시도 (현재 디렉토리)
    dotenv.config();
}

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
    
    if (GOOGLE_APPLICATION_CREDENTIALS) {
        console.log('GOOGLE_APPLICATION_CREDENTIALS:', GOOGLE_APPLICATION_CREDENTIALS);
        // 파일 존재 확인
        try {
            const credsPath = path.isAbsolute(GOOGLE_APPLICATION_CREDENTIALS) 
                ? GOOGLE_APPLICATION_CREDENTIALS 
                : path.resolve(process.cwd(), GOOGLE_APPLICATION_CREDENTIALS);
            if (fs.existsSync(credsPath)) {
                console.log('✅ Credentials 파일 존재 확인됨');
            } else {
                console.warn('⚠️ Credentials 파일을 찾을 수 없습니다:', credsPath);
            }
        } catch (error) {
            console.warn('⚠️ Credentials 경로 확인 중 오류:', error);
        }
    } else {
        console.log('GOOGLE_APPLICATION_CREDENTIALS:', '설정되지 않음 (Application Default Credentials 사용)');
    }
}
