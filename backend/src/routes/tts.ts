import express from 'express';
import { TTSService } from '../services/ttsService';

const router = express.Router();
const ttsService = new TTSService();

/**
 * POST /api/tts/generate
 * 스크립트를 음성으로 변환
 */
router.post('/generate', async (req, res) => {
    try {
        const { script, filename, groupInfo } = req.body;

        if (!script) {
            return res.status(400).json({
                success: false,
                error: '스크립트가 필요합니다.'
            });
        }

        if (!filename) {
            return res.status(400).json({
                success: false,
                error: '파일명이 필요합니다.'
            });
        }

        console.log('🎤 TTS API 호출됨');
        console.log('📝 스크립트:', script);
        console.log('📁 파일명:', filename);
        if (groupInfo) {
            console.log('📋 그룹 정보:', groupInfo);
        }

        // 스크립트를 여러 개의 음성 파일로 변환
        const audioFiles = await ttsService.generateAudioFromScript(script, filename);

        // 각 오디오 파일의 정보 수집
        const audioInfo = audioFiles.map(audioPath => {
            const info = ttsService.getAudioInfo(audioPath);
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
        console.error('❌ TTS API 오류:', error);
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
    try {
        const { text, filename } = req.body;

        if (!text) {
            return res.status(400).json({
                success: false,
                error: '텍스트가 필요합니다.'
            });
        }

        if (!filename) {
            return res.status(400).json({
                success: false,
                error: '파일명이 필요합니다.'
            });
        }

        console.log('🎤 단일 TTS API 호출됨');
        console.log('📝 텍스트:', text.substring(0, 100) + '...');
        console.log('📁 파일명:', filename);

        // 단일 텍스트를 음성으로 변환
        const audioPath = await ttsService.textToSpeech(text, filename);
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
        console.error('❌ 단일 TTS API 오류:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : '음성 변환 중 오류가 발생했습니다.'
        });
    }
});

export default router; 