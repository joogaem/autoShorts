import express from 'express';
import { TTSService } from '../services/ttsService';

const router = express.Router();

// TTS 서비스 초기화 시 디버깅
console.log('🔧 TTS 라우터 초기화 시작...');
let ttsService: TTSService;
try {
    ttsService = new TTSService();
    console.log('✅ TTS 서비스 초기화 성공');
} catch (error) {
    console.error('❌ TTS 서비스 초기화 실패:', error);
    throw error;
}

/**
 * POST /api/tts/generate
 * 스크립트를 음성으로 변환
 */
router.post('/generate', async (req, res) => {
    console.log('=== TTS Generate API 호출 ===');
    console.log('📝 요청 본문:', JSON.stringify(req.body, null, 2));

    try {
        const { script, filename, groupInfo } = req.body;

        // 입력 검증
        if (!script) {
            console.error('❌ 스크립트가 없음');
            return res.status(400).json({
                success: false,
                error: '스크립트가 필요합니다.'
            });
        }

        if (!filename) {
            console.error('❌ 파일명이 없음');
            return res.status(400).json({
                success: false,
                error: '파일명이 필요합니다.'
            });
        }

        console.log('🎤 TTS API 호출됨');
        console.log('📝 스크립트 타입:', typeof script);
        console.log('📝 스크립트 키들:', Object.keys(script));
        console.log('📁 파일명:', filename);
        if (groupInfo) {
            console.log('📋 그룹 정보:', groupInfo);
        }

        // 스크립트 내용 검증
        const sections = ['hook', 'coreMessage', 'cta'];
        let hasContent = false;
        for (const section of sections) {
            if (script[section] && script[section].trim()) {
                console.log(`${section} 섹션 내용: "${script[section].substring(0, 50)}..."`);
                hasContent = true;
            } else {
                console.log(`${section} 섹션: 비어있음`);
            }
        }

        if (!hasContent) {
            console.error('❌ 모든 섹션이 비어있음');
            return res.status(400).json({
                success: false,
                error: '스크립트에 내용이 없습니다.'
            });
        }

        // 스크립트를 여러 개의 음성 파일로 변환
        console.log('🎬 TTS 서비스 호출 시작...');
        const audioFiles = await ttsService.generateAudioFromScript(script, filename);
        console.log('✅ TTS 서비스 호출 완료');

        // 각 오디오 파일의 정보 수집
        console.log('📊 오디오 파일 정보 수집 시작...');
        const audioInfo = audioFiles.map(audioPath => {
            const info = ttsService.getAudioInfo(audioPath);
            console.log(`📁 파일 정보: ${audioPath} - 크기: ${info.size} bytes, 시간: ${info.duration}초`);
            return {
                path: audioPath,
                filename: audioPath.split('/').pop(),
                duration: info.duration,
                size: info.size
            };
        });

        console.log('✅ TTS API 완료:', audioInfo);

        res.json({
            success: true,
            audioFiles: audioInfo,
            groupInfo: groupInfo,
            message: groupInfo ? `${groupInfo.title} 그룹 음성 변환이 완료되었습니다.` : '음성 변환이 완료되었습니다.'
        });

    } catch (error) {
        console.error('=== TTS Generate API 에러 ===');
        console.error('❌ TTS API 오류:', error);
        console.error('에러 타입:', typeof error);
        console.error('에러 메시지:', error instanceof Error ? error.message : String(error));
        console.error('에러 스택:', error instanceof Error ? error.stack : '스택 없음');
        console.error('=== TTS Generate API 에러 완료 ===');

        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : '음성 변환 중 오류가 발생했습니다.'
        });
    }
});

/**
 * POST /api/tts/simple
 * 단일 텍스트를 음성으로 변환
 */
router.post('/simple', async (req, res) => {
    console.log('=== TTS Simple API 호출 ===');
    console.log('📝 요청 본문:', JSON.stringify(req.body, null, 2));

    try {
        const { text, filename } = req.body;

        // 입력 검증
        if (!text) {
            console.error('❌ 텍스트가 없음');
            return res.status(400).json({
                success: false,
                error: '텍스트가 필요합니다.'
            });
        }

        if (!filename) {
            console.error('❌ 파일명이 없음');
            return res.status(400).json({
                success: false,
                error: '파일명이 필요합니다.'
            });
        }

        console.log('🎤 단일 TTS API 호출됨');
        console.log('📝 텍스트:', text.substring(0, 100) + '...');
        console.log('📁 파일명:', filename);

        // 단일 텍스트를 음성으로 변환
        console.log('🎬 단일 TTS 서비스 호출 시작...');
        const audioPath = await ttsService.textToSpeech(text, filename);
        console.log('✅ 단일 TTS 서비스 호출 완료');

        const info = ttsService.getAudioInfo(audioPath);
        console.log('✅ 단일 TTS API 완료:', audioPath);

        res.json({
            success: true,
            audioFile: {
                path: audioPath,
                filename: audioPath.split('/').pop(),
                duration: info.duration,
                size: info.size
            },
            message: '음성 변환이 완료되었습니다.'
        });

    } catch (error) {
        console.error('=== TTS Simple API 에러 ===');
        console.error('❌ 단일 TTS API 오류:', error);
        console.error('에러 타입:', typeof error);
        console.error('에러 메시지:', error instanceof Error ? error.message : String(error));
        console.error('에러 스택:', error instanceof Error ? error.stack : '스택 없음');
        console.error('=== TTS Simple API 에러 완료 ===');

        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : '음성 변환 중 오류가 발생했습니다.'
        });
    }
});

export default router; 