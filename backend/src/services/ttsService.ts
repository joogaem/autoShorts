import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import * as fs from 'fs';
import * as path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { spawn } from 'child_process';

export interface SubtitleCue {
    start: number;
    end: number;
    text: string;
}

export interface TTSResult {
    audioPath: string;
    srtPath?: string;
    duration: number;
    cues?: SubtitleCue[]; // SSML mark 기반 정확한 자막 타이밍
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
    private escapeSSML(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    private textToSSML(text: string): string {
        return `<speak>${this.escapeSSML(text)}</speak>`;
    }

    /**
     * 텍스트를 cue로 분할 후 SSML <mark> 태그를 삽입
     * TTS 응답의 timepoints로 정확한 자막 타이밍 획득
     */
    private buildSSMLWithMarks(cues: string[]): string {
        const parts = cues.map((cue, i) => `<mark name="${i}"/>${this.escapeSSML(cue)}`);
        return `<speak>${parts.join(' ')}</speak>`;
    }

    private mergeShorCues(cues: string[], maxChars: number, minChars: number = 10): string[] {
        const MERGE_TOLERANCE = 6; // 짧은 이음말(합니다/입니다 등)은 maxChars 초과해도 병합
        const merged: string[] = [];
        for (const s of cues) {
            if (merged.length === 0) { merged.push(s); continue; }
            const last = merged[merged.length - 1];
            if (s.length < minChars && last.length + s.length + 1 <= maxChars + MERGE_TOLERANCE) {
                merged[merged.length - 1] = `${last} ${s}`.trim();
            } else {
                merged.push(s);
            }
        }
        return merged;
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
     * 텍스트를 최대 글자 수 기준으로 어절 단위 분할
     */
    private splitByCharLimit(text: string, maxChars: number): string[] {
        if (text.length <= maxChars) return [text];
        const words = text.split(' ');
        const chunks: string[] = [];
        let current = '';
        for (const word of words) {
            const next = current ? `${current} ${word}` : word;
            if (next.length > maxChars && current) {
                chunks.push(current);
                current = word;
            } else {
                current = next;
            }
        }
        if (current) chunks.push(current);
        return chunks.length ? chunks : [text];
    }

    /**
     * SRT 파일 생성 (글자 수 기준 cue 분할 포함)
     */
    private async generateSRT(
        sentences: string[],
        totalDuration: number,
        outputPath: string
    ): Promise<void> {
        const MAX_CHARS_PER_CUE = 22; // 한 cue 최대 글자 수
        const MIN_CHARS_PER_CUE = 10; // 이 미만은 이전 cue에 병합

        // 1단계: 글자 수 초과 문장 추가 분할
        let cues: string[] = sentences.flatMap(s => this.splitByCharLimit(s, MAX_CHARS_PER_CUE));

        // 2단계: 너무 짧은 cue 병합
        const merged: string[] = [];
        for (const s of cues) {
            if (merged.length === 0) { merged.push(s); continue; }
            const last = merged[merged.length - 1];
            if (s.length < MIN_CHARS_PER_CUE && last.length + s.length + 1 <= MAX_CHARS_PER_CUE) {
                merged[merged.length - 1] = `${last} ${s}`.trim();
            } else {
                merged.push(s);
            }
        }
        cues = merged;

        // 3단계: 총 duration 균등 분배
        const blockCount = cues.length;
        const durationPerBlock = totalDuration / blockCount;
        const srtLines: string[] = [];

        for (let i = 0; i < cues.length; i++) {
            const startTime = i * durationPerBlock;
            const endTime = i === cues.length - 1 ? totalDuration : (i + 1) * durationPerBlock;

            srtLines.push(`${i + 1}`);
            srtLines.push(`${this.formatSRTTime(startTime)} --> ${this.formatSRTTime(endTime)}`);
            srtLines.push(cues[i]);
            srtLines.push('');
        }

        fs.writeFileSync(outputPath, srtLines.join('\n'), 'utf8');
        console.log(`✅ SRT 파일 생성 완료: ${outputPath} (${cues.length}개 cue)`);
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
     * FFmpeg silencedetect로 오디오의 묵음 구간 감지
     */
    private detectSilences(audioPath: string): Promise<Array<{ start: number; end: number }>> {
        return new Promise((resolve) => {
            const silences: Array<{ start: number; end: number }> = [];
            let currentStart: number | null = null;

            const proc = spawn('ffmpeg', [
                '-i', audioPath,
                '-af', 'silencedetect=noise=-30dB:d=0.15',
                '-f', 'null', '-'
            ]);

            const handleData = (data: Buffer) => {
                const lines = data.toString().split('\n');
                for (const line of lines) {
                    const sm = line.match(/silence_start:\s*([\d.]+)/);
                    const em = line.match(/silence_end:\s*([\d.]+)/);
                    if (sm) currentStart = parseFloat(sm[1]);
                    if (em && currentStart !== null) {
                        silences.push({ start: currentStart, end: parseFloat(em[1]) });
                        currentStart = null;
                    }
                }
            };

            proc.stderr.on('data', handleData);
            proc.on('close', () => {
                console.log(`🔇 silencedetect 완료: ${silences.length}개 묵음 구간`);
                resolve(silences);
            });
            proc.on('error', (err) => {
                console.warn(`⚠️ silencedetect 실패 (fallback 사용): ${err.message}`);
                resolve([]);
            });
        });
    }

    /**
     * 묵음 구간 기반으로 텍스트를 의미 단위 cue로 분할
     */
    private buildCuesFromSilences(
        text: string,
        silences: Array<{ start: number; end: number }>,
        totalDuration: number
    ): SubtitleCue[] {
        const MAX_CHARS = 22;

        // 묵음 구간 사이의 발화 구간 추출
        const segments: Array<{ start: number; end: number }> = [];
        let speechStart = 0;
        for (const silence of silences) {
            if (silence.start - speechStart > 0.05) {
                segments.push({ start: speechStart, end: silence.start });
            }
            speechStart = silence.end;
        }
        if (totalDuration - speechStart > 0.05) {
            segments.push({ start: speechStart, end: totalDuration });
        }

        if (segments.length === 0) return [];

        const totalSpeechDuration = segments.reduce((s, seg) => s + (seg.end - seg.start), 0);
        const totalChars = text.length;

        const cues: SubtitleCue[] = [];
        let charPos = 0;

        for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            const isLast = i === segments.length - 1;

            let charEnd: number;
            if (isLast) {
                charEnd = totalChars;
            } else {
                const segDuration = seg.end - seg.start;
                const rawEnd = Math.round(charPos + (segDuration / totalSpeechDuration) * totalChars);
                // 가장 가까운 공백으로 스냅
                let fw = rawEnd, bw = rawEnd;
                while (fw < totalChars && text[fw] !== ' ') fw++;
                while (bw > charPos && text[bw] !== ' ') bw--;
                charEnd = (fw - rawEnd) <= (rawEnd - bw) ? fw : bw;
            }

            const segmentText = text.slice(charPos, charEnd).trim();
            charPos = Math.min(charEnd + 1, totalChars);
            if (!segmentText) continue;

            const subCues = this.mergeShorCues(this.splitByCharLimit(segmentText, MAX_CHARS), MAX_CHARS);
            const segDuration = seg.end - seg.start;
            const subDur = segDuration / subCues.length;

            subCues.forEach((cueText, j) => {
                cues.push({
                    text: cueText,
                    start: seg.start + j * subDur,
                    end: seg.start + (j + 1) * subDur,
                });
            });
        }

        if (cues.length > 0) {
            cues[cues.length - 1].end = totalDuration;
        }

        console.log(`✅ silencedetect 기반 cue 생성 완료: ${cues.length}개`);
        return cues;
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

            // 텍스트를 cue로 분할 후 SSML mark 삽입
            const MAX_CHARS = 22;
            const rawCues = this.splitIntoSentences(text).flatMap(s => this.splitByCharLimit(s, MAX_CHARS));
            const cueTexts = this.mergeShorCues(rawCues, MAX_CHARS);

            const ssml = this.buildSSMLWithMarks(cueTexts);
            console.log(`📝 SSML with marks 생성 완료 (${cueTexts.length}개 cue)`);

            // enableTimePointing: SSML_MARK 로 각 mark의 정확한 타임스탬프 요청
            const request: any = {
                input: { ssml },
                voice: {
                    languageCode: 'ko-KR',
                    name: 'ko-KR-Neural2-A',
                    ssmlGender: 'FEMALE' as const,
                },
                audioConfig: {
                    audioEncoding: 'MP3' as const,
                    speakingRate: 1.0,
                    pitch: 0.0,
                },
                enableTimePointing: ['SSML_MARK'],
            };

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

            // 자막 타이밍 생성: silencedetect → SSML marks → 균등 분배 순으로 시도
            let cues: SubtitleCue[] | undefined;
            let srtPath: string | undefined;

            // 1차: silencedetect 기반 의미 단위 분할
            const silences = await this.detectSilences(outputPath);
            if (silences.length >= 1) {
                cues = this.buildCuesFromSilences(text, silences, duration);
                if (cues.length === 0) cues = undefined; // 실패 시 fallback
            }

            // 2차: SSML mark timepoints
            if (!cues) {
                const timepoints: Array<{ markName: string; timeSeconds: number }> =
                    (response as any).timepoints || [];

                if (timepoints.length > 0 && timepoints.length === cueTexts.length) {
                    console.log(`✅ SSML timepoints 수신: ${timepoints.length}개`);
                    cues = cueTexts.map((t, i) => ({
                        text: t,
                        start: timepoints[i].timeSeconds,
                        end: i < timepoints.length - 1 ? timepoints[i + 1].timeSeconds : duration,
                    }));
                } else {
                    // 3차: 균등 분배
                    console.warn(`⚠️ timepoints 없음 (${timepoints.length}/${cueTexts.length}), 균등 분배 사용`);
                    const dur = duration / cueTexts.length;
                    cues = cueTexts.map((t, i) => ({
                        text: t,
                        start: i * dur,
                        end: i === cueTexts.length - 1 ? duration : (i + 1) * dur,
                    }));
                }
            }

            if (generateSRT && cues) {
                srtPath = path.join(this.srtDir, `${filename}.srt`);
                const srtLines: string[] = [];
                cues.forEach((cue, i) => {
                    srtLines.push(`${i + 1}`);
                    srtLines.push(`${this.formatSRTTime(cue.start)} --> ${this.formatSRTTime(cue.end)}`);
                    srtLines.push(cue.text);
                    srtLines.push('');
                });
                fs.writeFileSync(srtPath, srtLines.join('\n'), 'utf8');
                console.log(`✅ SRT 생성 완료: ${srtPath} (${cues.length}개 cue)`);
            }

            console.log('=== TTS 변환 디버깅 완료 ===');

            return { audioPath: outputPath, srtPath, duration, cues };

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
    async generateAudioFromScript(script: any, baseFilename: string, generateSRT: boolean = true): Promise<Array<{ audioPath: string; srtPath?: string; duration: number; section: string; cues?: SubtitleCue[] }>> {
        try {
            console.log('=== 스크립트 오디오 생성 디버깅 시작 ===');
            console.log('🎬 스크립트에서 오디오 생성 시작');
            console.log('📝 스크립트 객체:', JSON.stringify(script, null, 2));
            console.log('📁 기본 파일명:', baseFilename);

            const audioResults: Array<{ audioPath: string; srtPath?: string; duration: number; section: string; cues?: SubtitleCue[] }> = [];
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
                        cues: result.cues,
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