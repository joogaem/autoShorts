import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import * as fs from 'fs';
import * as path from 'path';

export class TTSService {
    private client: TextToSpeechClient;
    private outputDir: string;

    constructor() {
        this.client = new TextToSpeechClient();
        this.outputDir = path.join(__dirname, '../../uploads/audio');

        // 오디오 출력 디렉토리 생성
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    /**
     * 텍스트를 음성으로 변환
     */
    async textToSpeech(text: string, filename: string): Promise<string> {
        try {
            console.log(`🎤 TTS 변환 시작: ${filename}`);
            console.log(`📝 텍스트 길이: ${text.length}자`);

            // 한국어 여성 음성으로 설정
            const request = {
                input: { text },
                voice: {
                    languageCode: 'ko-KR',
                    name: 'ko-KR-Neural2-A', // 한국어 여성 음성
                    ssmlGender: 'FEMALE' as const,
                },
                audioConfig: {
                    audioEncoding: 'MP3' as const,
                    speakingRate: 1.0, // 정상 속도
                    pitch: 0.0, // 정상 피치
                },
            };

            console.log('🔊 Google Cloud TTS API 호출 중...');
            const [response] = await this.client.synthesizeSpeech(request);

            if (!response.audioContent) {
                throw new Error('음성 생성 실패: 오디오 콘텐츠가 없습니다.');
            }

            // 파일 저장
            const outputPath = path.join(this.outputDir, `${filename}.mp3`);
            fs.writeFileSync(outputPath, response.audioContent, 'binary');

            console.log(`✅ TTS 변환 완료: ${outputPath}`);
            return outputPath;

        } catch (error) {
            console.error('❌ TTS 변환 실패:', error);
            throw new Error(`TTS 변환 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        }
    }

    /**
     * 스크립트를 여러 개의 음성 파일로 분할하여 변환
     */
    async generateAudioFromScript(script: any, baseFilename: string): Promise<string[]> {
        try {
            console.log('🎬 스크립트에서 오디오 생성 시작');

            const audioFiles: string[] = [];
            const sections = ['hook', 'coreMessage', 'cta'];

            for (const section of sections) {
                if (script[section] && script[section].trim()) {
                    const sectionFilename = `${baseFilename}_${section}`;
                    const audioPath = await this.textToSpeech(script[section], sectionFilename);
                    audioFiles.push(audioPath);

                    console.log(`✅ ${section} 섹션 오디오 생성 완료: ${audioPath}`);
                }
            }

            console.log(`🎉 전체 오디오 생성 완료: ${audioFiles.length}개 파일`);
            return audioFiles;

        } catch (error) {
            console.error('❌ 스크립트 오디오 생성 실패:', error);
            throw error;
        }
    }

    /**
     * 오디오 파일 정보 가져오기
     */
    getAudioInfo(audioPath: string): { duration: number; size: number } {
        try {
            const stats = fs.statSync(audioPath);
            // MP3 파일의 대략적인 재생 시간 추정 (1MB ≈ 1분)
            const duration = Math.round((stats.size / 1024 / 1024) * 60);

            return {
                duration,
                size: stats.size
            };
        } catch (error) {
            console.error('❌ 오디오 파일 정보 읽기 실패:', error);
            return { duration: 0, size: 0 };
        }
    }
} 