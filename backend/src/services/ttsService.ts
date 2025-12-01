import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import * as fs from 'fs';
import * as path from 'path';
import ffmpeg from 'fluent-ffmpeg';

export interface TTSResult {
    audioPath: string;
    srtPath?: string;
    duration: number;
}

export class TTSService {
    private client: TextToSpeechClient;
    private outputDir: string;
    private srtDir: string;

    constructor() {
        console.log('🔧 TTSService 초기화 시작...');

        try {
            this.client = new TextToSpeechClient();
            console.log('✅ Google Cloud TTS 클라이언트 생성 성공');
        } catch (error) {
            console.error('❌ Google Cloud TTS 클라이언트 생성 실패:', error);
            throw new Error(`TTS 클라이언트 초기화 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        }

        this.outputDir = path.join(__dirname, '../../uploads/audio');
        this.srtDir = path.join(__dirname, '../../uploads/audio');
        console.log('📁 오디오 출력 디렉토리:', this.outputDir);
        console.log('📁 SRT 출력 디렉토리:', this.srtDir);

        // 오디오 출력 디렉토리 생성
        try {
            if (!fs.existsSync(this.outputDir)) {
                fs.mkdirSync(this.outputDir, { recursive: true });
                console.log('✅ 오디오 디렉토리 생성 완료');
            } else {
                console.log('✅ 오디오 디렉토리 이미 존재');
            }

            // 디렉토리 쓰기 권한 확인
            const testFile = path.join(this.outputDir, 'test_write.tmp');
            fs.writeFileSync(testFile, 'test');
            fs.unlinkSync(testFile);
            console.log('✅ 디렉토리 쓰기 권한 확인 완료');

        } catch (error) {
            console.error('❌ 오디오 디렉토리 설정 실패:', error);
            throw new Error(`오디오 디렉토리 설정 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        }

        console.log('🎉 TTSService 초기화 완료');
    }

    /**
     * 텍스트를 SSML 형식으로 변환
     */
    private textToSSML(text: string): string {
        // 특수 문자 이스케이프
        const escaped = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');

        // SSML 형식으로 감싸기 (한국어 여성 음성, 자연스러운 속도)
        return `<speak>${escaped}</speak>`;
    }

    /**
     * 텍스트를 문장 단위로 분할
     */
    private splitIntoSentences(text: string): string[] {
        // 마침표, 느낌표, 물음표로 문장 분리 (숫자 소수점은 제외)
        const sentences = text
            .split(/(?<=[\.!?])(?!\d)\s+/g)
            .map(s => s.trim())
            .filter(s => s.length > 0);

        return sentences.length > 0 ? sentences : [text];
    }

    /**
     * 오디오 파일의 실제 길이를 측정 (초 단위)
     */
    private async getAudioDuration(audioPath: string): Promise<number> {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(audioPath, (err, metadata) => {
                if (err) {
                    console.warn(`⚠️ 오디오 길이 측정 실패, 추정값 사용: ${err.message}`);
                    // 실패 시 파일 크기 기반으로 추정 (1MB ≈ 1분)
                    const stats = fs.statSync(audioPath);
                    const estimated = Math.round((stats.size / 1024 / 1024) * 60);
                    resolve(estimated);
                } else {
                    const duration = metadata.format?.duration || 0;
                    resolve(duration);
                }
            });
        });
    }

    /**
     * SRT 파일 생성
     */
    private async generateSRT(
        sentences: string[],
        totalDuration: number,
        outputPath: string
    ): Promise<void> {
        const srtLines: string[] = [];
        const blockCount = sentences.length;
        const durationPerBlock = totalDuration / blockCount;

        for (let i = 0; i < sentences.length; i++) {
            const startTime = i * durationPerBlock;
            const endTime = i === sentences.length - 1 ? totalDuration : (i + 1) * durationPerBlock;

            srtLines.push(`${i + 1}`);
            srtLines.push(`${this.formatSRTTime(startTime)} --> ${this.formatSRTTime(endTime)}`);
            srtLines.push(sentences[i]);
            srtLines.push(''); // 빈 줄
        }

        fs.writeFileSync(outputPath, srtLines.join('\n'), 'utf8');
        console.log(`✅ SRT 파일 생성 완료: ${outputPath}`);
    }

    /**
     * 초 단위 시간을 SRT 형식으로 변환
     */
    private formatSRTTime(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const milliseconds = Math.floor((seconds % 1) * 1000);

        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
    }

    /**
     * 텍스트를 음성으로 변환 (SSML 사용, SRT 파일 생성)
     */
    async textToSpeech(text: string, filename: string, generateSRT: boolean = true): Promise<TTSResult> {
        try {
            console.log('=== TTS 변환 디버깅 시작 ===');
            console.log(`🎤 TTS 변환 시작: ${filename}`);
            console.log(`📝 텍스트 길이: ${text.length}자`);
            console.log(`📝 텍스트 내용: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);

            // 입력 검증
            if (!text || text.trim().length === 0) {
                throw new Error('텍스트가 비어있습니다.');
            }

            if (!filename || filename.trim().length === 0) {
                throw new Error('파일명이 비어있습니다.');
            }

            // 텍스트를 SSML로 변환
            const ssml = this.textToSSML(text);
            console.log('📝 SSML 변환 완료');
            console.log(`📝 SSML 길이: ${ssml.length}자`);

            // 한국어 여성 음성으로 설정 (SSML 사용)
            const request = {
                input: { ssml }, // SSML 사용
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

            console.log('🔧 TTS 요청 객체:', JSON.stringify(request, null, 2));
            console.log('🔊 Google Cloud TTS API 호출 중...');

            const [response] = await this.client.synthesizeSpeech(request);
            console.log('✅ Google Cloud TTS API 응답 받음');

            if (!response.audioContent) {
                console.error('❌ 응답에 오디오 콘텐츠가 없음');
                console.log('응답 객체:', JSON.stringify(response, null, 2));
                throw new Error('음성 생성 실패: 오디오 콘텐츠가 없습니다.');
            }

            console.log(`📊 오디오 콘텐츠 크기: ${response.audioContent.length} bytes`);

            // 파일 저장
            const outputPath = path.join(this.outputDir, `${filename}.mp3`);
            console.log(`💾 파일 저장 경로: ${outputPath}`);

            fs.writeFileSync(outputPath, response.audioContent, 'binary');
            console.log(`✅ 파일 저장 완료: ${outputPath}`);

            // 파일 존재 확인
            if (fs.existsSync(outputPath)) {
                const stats = fs.statSync(outputPath);
                console.log(`📁 저장된 파일 크기: ${stats.size} bytes`);
            } else {
                throw new Error('파일이 저장되지 않았습니다.');
            }

            console.log(`✅ TTS 변환 완료: ${outputPath}`);

            // 오디오 파일의 실제 길이 측정
            const duration = await this.getAudioDuration(outputPath);
            console.log(`⏱️ 오디오 길이: ${duration.toFixed(2)}초`);

            // SRT 파일 생성
            let srtPath: string | undefined;
            if (generateSRT) {
                const sentences = this.splitIntoSentences(text);
                console.log(`📝 문장 분할 완료: ${sentences.length}개 문장`);

                srtPath = path.join(this.srtDir, `${filename}.srt`);
                await this.generateSRT(sentences, duration, srtPath);
            }

            console.log('=== TTS 변환 디버깅 완료 ===');

            return {
                audioPath: outputPath,
                srtPath,
                duration
            };

        } catch (error) {
            console.error('=== TTS 변환 에러 디버깅 ===');
            console.error('❌ TTS 변환 실패:', error);
            console.error('에러 타입:', typeof error);
            console.error('에러 메시지:', error instanceof Error ? error.message : String(error));
            console.error('에러 스택:', error instanceof Error ? error.stack : '스택 없음');
            console.error('=== TTS 변환 에러 디버깅 완료 ===');
            throw new Error(`TTS 변환 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        }
    }

    /**
     * 스크립트를 여러 개의 음성 파일로 분할하여 변환
     */
    async generateAudioFromScript(script: any, baseFilename: string, generateSRT: boolean = true): Promise<Array<{ audioPath: string; srtPath?: string; duration: number; section: string }>> {
        try {
            console.log('=== 스크립트 오디오 생성 디버깅 시작 ===');
            console.log('🎬 스크립트에서 오디오 생성 시작');
            console.log('📝 스크립트 객체:', JSON.stringify(script, null, 2));
            console.log('📁 기본 파일명:', baseFilename);

            const audioResults: Array<{ audioPath: string; srtPath?: string; duration: number; section: string }> = [];
            const sections = ['hook', 'coreMessage', 'cta'];

            for (const section of sections) {
                console.log(`\n--- ${section} 섹션 처리 시작 ---`);

                if (script[section] && script[section].trim()) {
                    console.log(`${section} 섹션 텍스트: "${script[section].substring(0, 100)}${script[section].length > 100 ? '...' : ''}"`);

                    const sectionFilename = `${baseFilename}_${section}`;
                    console.log(`${section} 섹션 파일명: ${sectionFilename}`);

                    const result = await this.textToSpeech(script[section], sectionFilename, generateSRT);
                    audioResults.push({
                        audioPath: result.audioPath,
                        srtPath: result.srtPath,
                        duration: result.duration,
                        section
                    });

                    console.log(`✅ ${section} 섹션 오디오 생성 완료: ${result.audioPath}`);
                    if (result.srtPath) {
                        console.log(`✅ ${section} 섹션 SRT 생성 완료: ${result.srtPath}`);
                    }
                } else {
                    console.log(`⚠️ ${section} 섹션이 비어있어 건너뜀`);
                }
            }

            console.log(`🎉 전체 오디오 생성 완료: ${audioResults.length}개 파일`);
            console.log('생성된 파일들:', audioResults.map(r => ({
                audio: r.audioPath,
                srt: r.srtPath,
                duration: r.duration,
                section: r.section
            })));
            console.log('=== 스크립트 오디오 생성 디버깅 완료 ===');
            return audioResults;

        } catch (error) {
            console.error('=== 스크립트 오디오 생성 에러 디버깅 ===');
            console.error('❌ 스크립트 오디오 생성 실패:', error);
            console.error('에러 타입:', typeof error);
            console.error('에러 메시지:', error instanceof Error ? error.message : String(error));
            console.error('에러 스택:', error instanceof Error ? error.stack : '스택 없음');
            console.error('=== 스크립트 오디오 생성 에러 디버깅 완료 ===');
            throw error;
        }
    }

    /**
     * 오디오 파일 정보 가져오기
     */
    getAudioInfo(audioPath: string): { duration: number; size: number } {
        try {
            console.log(`📊 오디오 파일 정보 조회: ${audioPath}`);

            if (!fs.existsSync(audioPath)) {
                console.error(`❌ 파일이 존재하지 않음: ${audioPath}`);
                return { duration: 0, size: 0 };
            }

            const stats = fs.statSync(audioPath);
            console.log(`📁 파일 크기: ${stats.size} bytes`);

            // MP3 파일의 대략적인 재생 시간 추정 (1MB ≈ 1분)
            const duration = Math.round((stats.size / 1024 / 1024) * 60);
            console.log(`⏱️ 추정 재생 시간: ${duration}초`);

            return {
                duration,
                size: stats.size
            };
        } catch (error) {
            console.error('❌ 오디오 파일 정보 조회 실패:', error);
            return { duration: 0, size: 0 };
        }
    }
} 