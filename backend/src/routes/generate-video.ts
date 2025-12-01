import express, { Request, Response } from 'express';
import ffmpeg from 'fluent-ffmpeg';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';

const router = express.Router();
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const exists = promisify(fs.exists);
const mkdir = promisify(fs.mkdir);

/**
 * POST /api/generate-video
 * TTS 오디오와 이미지를 조합하여 영상 생성 (SRT + libass 자동 래핑)
 */
router.post('/', async (req: Request, res: Response) => {
    console.log('=== 영상 생성 요청 시작 ===');

    try {
        const { ttsData, imageData, scriptData } = req.body;

        if (!ttsData || !imageData) {
            return res.status(400).json({
                success: false,
                error: 'TTS 데이터와 이미지 데이터가 필요합니다.'
            });
        }

        // 스토리보드 데이터에서 나레이션 추출(로그용)
        const storyboardScenes = scriptData?.storyboardResult?.scenes || scriptData?.storyboardImages?.images || [];
        const narrations: Map<number, string> = new Map();

        console.log('=== 나레이션 추출 시작 ===');
        console.log('scriptData 구조:', {
            hasStoryboardResult: !!scriptData?.storyboardResult,
            hasStoryboardImages: !!scriptData?.storyboardImages,
            scenesCount: storyboardScenes.length
        });

        storyboardScenes.forEach((scene: any, idx: number) => {
            const sceneNum = scene.scene_number || scene.sceneNumber || (idx + 1);
            const narrative = scene.narrative_korean || scene.narrative || scene.narrative_english || '';
            if (sceneNum && narrative) {
                narrations.set(sceneNum, narrative);
                console.log(`나레이션 추가: 장면 ${sceneNum} = "${narrative.substring(0, 50)}..."`);
            }
        });

        console.log(`총 ${narrations.size}개의 나레이션이 추출되었습니다.`);
        console.log('=== 나레이션 추출 완료 ===\n');

        console.log('TTS 데이터:', {
            audioResultCount: ttsData.audioResult?.length || 0
        });
        console.log('이미지 데이터:', {
            generatedImagesCount: imageData.generatedImages?.length || 0
        });

        const videos = [];
        const tempDir = path.join(process.cwd(), 'temp-videos');

        // temp-videos 디렉토리 생성
        if (!(await exists(tempDir))) {
            await mkdir(tempDir, { recursive: true });
        }

        // 각 그룹별로 영상 생성
        for (const audioItem of ttsData.audioResult || []) {
            const { group, script, audioUrl, duration, srtPath, srtUrl } = audioItem;
            console.log(`\n=== 그룹 "${group.title}" 영상 생성 시작 ===`);

            // TTS에서 생성한 SRT 파일 경로 확인
            console.log('📝 TTS SRT 정보:', { srtPath, srtUrl });

            // 해당 그룹의 이미지 찾기
            const imageResult = imageData.generatedImages?.find(
                (img: any) => img.group.id === group.id
            );

            if (!imageResult) {
                console.warn(`그룹 ${group.title}에 대한 이미지가 없습니다. 건너뜁니다.`);
                continue;
            }

            const images = imageResult.images || [];
            if (images.length === 0) {
                console.warn(`그룹 ${group.title}에 생성된 이미지가 없습니다. 건너뜁니다.`);
                continue;
            }

            console.log(`이미지 ${images.length}개 발견, 오디오 길이: ${duration}초`);

            // 오디오 파일 경로
            let audioPath: string;
            if (audioUrl.startsWith('http')) {
                audioPath = await downloadAudio(audioUrl, tempDir);
            } else if (audioUrl.startsWith('/audio/')) {
                // 정적 서빙 경로(/audio)는 실제 디스크의 uploads/audio를 가리킵니다
                const filename = path.basename(audioUrl);
                // process.cwd()는 backend 디렉토리를 가리킵니다
                audioPath = path.join(process.cwd(), 'uploads/audio', filename);
            } else if (path.isAbsolute(audioUrl)) {
                audioPath = audioUrl;
            } else {
                audioPath = path.join(process.cwd(), audioUrl.replace(/^\//, ''));
            }

            if (!(await exists(audioPath))) {
                throw new Error(`오디오 파일을 찾을 수 없습니다: ${audioPath}`);
            }

            // 이미지 파일 경로 리스트 생성
            const imagePaths: string[] = [];
            for (const image of images) {
                const imageUrl = image.url || image.imageUrl || image.data;
                let imagePath: string;

                if (imageUrl.startsWith('data:')) {
                    // Base64 데이터인 경우 파일로 저장
                    const base64Data = imageUrl.split(',')[1];
                    const imageId = image.id || `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    imagePath = path.join(tempDir, `${imageId}.png`);
                    await writeFile(imagePath, Buffer.from(base64Data, 'base64'));
                } else if (imageUrl.startsWith('http')) {
                    // URL인 경우 다운로드
                    imagePath = await downloadImage(imageUrl, tempDir, image.id || `img_${Date.now()}`);
                } else {
                    // 로컬 경로
                    imagePath = path.join(process.cwd(), imageUrl.replace(/^\//, ''));
                }

                if (await exists(imagePath)) {
                    imagePaths.push(imagePath);
                } else {
                    console.warn(`이미지 파일을 찾을 수 없습니다: ${imagePath}`);
                }
            }

            if (imagePaths.length === 0) {
                throw new Error(`그룹 ${group.title}에 유효한 이미지가 없습니다.`);
            }

            console.log(`유효한 이미지 ${imagePaths.length}개 준비 완료`);

            // 각 이미지당 표시 시간 계산 (오디오 길이를 이미지 개수로 나눔)
            const imageDuration = parseFloat((duration / imagePaths.length).toFixed(2));

            // 프론트 페이지에 표시되는 자막 스크립트 가져오기 (프론트와 동일한 로직)
            console.log(`\n=== 자막 스크립트 가져오기 (그룹: ${group.title}) ===`);

            let fullScriptText = '';

            // 1. 스토리보드 나레이션에서 찾기 (그룹 ID 기준)
            const groupId = group.id || '';
            const sceneNum = parseInt(groupId.toString().replace(/scene-?/i, '')) || null;

            if (sceneNum) {
                const storyboardScenes = scriptData?.storyboardResult?.scenes || [];
                const scene = storyboardScenes.find((s: any) =>
                    (s.scene_number || s.sceneNumber) === sceneNum
                );
                if (scene?.narrative_korean) {
                    fullScriptText = scene.narrative_korean;
                    console.log(`✅ 스토리보드 나레이션에서 가져옴 (장면 ${sceneNum})`);
                }
            }

            // 2. TTS 스크립트에서 찾기 (대안)
            if (!fullScriptText && script) {
                if (typeof script === 'string') {
                    fullScriptText = script;
                } else if (script.coreMessage) {
                    fullScriptText = script.coreMessage;
                }
                if (fullScriptText) {
                    console.log(`✅ TTS 스크립트에서 가져옴`);
                }
            }

            if (!fullScriptText) {
                console.warn(`⚠️  자막 스크립트를 찾을 수 없습니다.`);
            } else {
                console.log(`📝 전체 자막 스크립트 (${fullScriptText.length}자): "${fullScriptText.substring(0, 100)}${fullScriptText.length > 100 ? '...' : ''}"`);
            }

            // TTS에서 생성한 SRT 파일 경로 확인
            let ttsSrtPath: string | null = null;
            if (srtPath) {
                // 로컬 경로인 경우
                if (path.isAbsolute(srtPath)) {
                    ttsSrtPath = srtPath;
                } else if (srtPath.startsWith('/audio/')) {
                    // 정적 서빙 경로인 경우
                    const filename = path.basename(srtPath);
                    ttsSrtPath = path.join(process.cwd(), 'uploads/audio', filename);
                } else {
                    // 상대 경로인 경우
                    ttsSrtPath = path.join(process.cwd(), srtPath.replace(/^\//, ''));
                }

                // 파일 존재 확인
                if (ttsSrtPath && await exists(ttsSrtPath)) {
                    console.log(`✅ TTS에서 생성한 SRT 파일 발견: ${ttsSrtPath}`);
                } else {
                    console.warn(`⚠️  TTS SRT 파일이 존재하지 않음: ${ttsSrtPath}`);
                    ttsSrtPath = null;
                }
            } else if (srtUrl) {
                // URL인 경우 다운로드 (videoId는 나중에 생성되므로 임시 파일명 사용)
                console.log(`📥 TTS SRT 파일 다운로드: ${srtUrl}`);
                try {
                    const response = await fetch(srtUrl);
                    const srtContent = await response.text();
                    const srtFilename = `tts_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.srt`;
                    ttsSrtPath = path.join(tempDir, srtFilename);
                    await writeFile(ttsSrtPath, srtContent, 'utf8');
                    console.log(`✅ TTS SRT 파일 다운로드 완료: ${ttsSrtPath}`);
                } catch (error) {
                    console.warn(`⚠️  TTS SRT 파일 다운로드 실패: ${error}`);
                    ttsSrtPath = null;
                }
            }

            // === (1번 방식) 문장 단위 자막 큐 생성 (자동 래핑: subtitles 필터에 맡김) ===
            // TTS에서 생성한 SRT가 있으면 그것을 사용, 없으면 새로 생성
            const imageNarrations: Array<{ start: number; end: number; text: string }> = [];

            // TTS SRT 파일이 있으면 직접 사용
            if (ttsSrtPath) {
                console.log(`\n=== TTS에서 생성한 SRT 파일 사용 ===`);
                console.log(`SRT 파일 경로: ${ttsSrtPath}`);
                // SRT 파일을 읽어서 검증만 하고, FFmpeg에서 직접 사용
                try {
                    const srtContent = await readFile(ttsSrtPath, 'utf8');
                    console.log(`✅ TTS SRT 파일 읽기 완료 (${srtContent.length}자)`);
                    console.log(`📄 SRT 파일 내용 미리보기 (처음 200자):`);
                    console.log(srtContent.substring(0, 200));
                } catch (error) {
                    console.error(`❌ TTS SRT 파일 읽기 실패: ${error}`);
                    ttsSrtPath = null; // 실패 시 새로 생성
                }
            }

            // TTS SRT가 없으면 기존 방식대로 생성
            if (!ttsSrtPath && fullScriptText) {
                console.log(`\n=== 자막 큐 생성 (문장 단위, 자동 래핑) ===`);

                // 인라인 문장 분해 + 짧은 문장 합치기
                const normalized = fullScriptText.replace(/\s+/g, ' ').trim();
                // 마침표/느낌표/물음표 뒤 공백 기준 분리 (숫자 소수점 등은 제외 시도)
                let cues: string[] = normalized
                    .split(/(?<=[\.!?])(?!\d)\s+/g)
                    .map(s => s.trim())
                    .filter(Boolean);

                // 최소 글자수 미달 cue는 이웃과 병합 (너무 짧은 표시 시간 방지)
                const minCharsPerCue = 18;
                const merged: string[] = [];
                for (const s of cues) {
                    if (merged.length === 0) {
                        merged.push(s);
                        continue;
                    }
                    const last = merged[merged.length - 1];
                    if (last.length < minCharsPerCue) {
                        merged[merged.length - 1] = `${last} ${s}`.trim();
                    } else {
                        merged.push(s);
                    }
                }
                if (merged.length >= 2 && merged[merged.length - 1].length < minCharsPerCue) {
                    const tail = merged.pop()!;
                    merged[merged.length - 1] = `${merged[merged.length - 1]} ${tail}`.trim();
                }
                cues = merged;

                const blockCount = Math.max(1, cues.length);
                const subtitleDuration = duration / blockCount;

                console.log(`총 cue: ${blockCount}개, cue당 평균: ${subtitleDuration.toFixed(3)}초`);

                for (let i = 0; i < cues.length; i++) {
                    const start = i * subtitleDuration;
                    const end = (i === cues.length - 1) ? duration : start + subtitleDuration;

                    imageNarrations.push({
                        start,
                        end,
                        text: cues[i] // 줄바꿈 없이 한 큐당 한 문장(또는 합쳐진 문장)
                    });

                    console.log(`  📝 cue ${i + 1}: ${start.toFixed(3)}s → ${end.toFixed(3)}s / "${cues[i].slice(0, 60)}${cues[i].length > 60 ? '...' : ''}"`);
                }
            }

            console.log('=== 자막 매칭 완료 ===\n');

            // 영상 파일 경로
            const videoId = `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const outputPath = path.join(tempDir, `${videoId}.mp4`);

            // 출력 디렉토리 확인 및 생성
            if (!(await exists(tempDir))) {
                await mkdir(tempDir, { recursive: true });
                console.log(`✅ 출력 디렉토리 생성: ${tempDir}`);
            }

            // 출력 디렉토리 쓰기 권한 확인
            try {
                const testFile = path.join(tempDir, `.test_write_${Date.now()}`);
                await writeFile(testFile, 'test');
                await fs.promises.unlink(testFile);
                console.log(`✅ 출력 디렉토리 쓰기 권한 확인: ${tempDir}`);
            } catch (error) {
                console.error(`❌ 출력 디렉토리 쓰기 권한 없음: ${tempDir}`, error);
                throw new Error(`출력 디렉토리에 쓰기 권한이 없습니다: ${tempDir}`);
            }

            console.log(`📁 출력 파일 경로: ${outputPath}`);

            // FFmpeg로 영상 생성 (이미지 슬라이드쇼 + 오디오)
            await new Promise<void>((resolve, reject) => {
                console.log('FFmpeg 영상 생성 시작...');

                // 오디오 파일의 실제 길이 확인 (ffprobe 사용)
                const getAudioDuration = (audioPath: string): Promise<number> => {
                    return new Promise((resolve, reject) => {
                        ffmpeg.ffprobe(audioPath, (err, metadata) => {
                            if (err) {
                                console.warn(`⚠️ 오디오 길이 확인 실패, duration 값 사용: ${err.message}`);
                                resolve(duration); // 실패 시 전달받은 duration 사용
                            } else {
                                const actualDuration = metadata.format?.duration || duration;
                                console.log(`✅ 오디오 실제 길이: ${actualDuration.toFixed(2)}초 (전달받은 duration: ${duration}초)`);
                                resolve(actualDuration);
                            }
                        });
                    });
                };

                getAudioDuration(audioPath).then(async (actualAudioDuration) => {
                    // 실제 오디오 길이에 맞춰 이미지 duration 재계산
                    const adjustedImageDuration = parseFloat((actualAudioDuration / imagePaths.length).toFixed(2));
                    console.log(`📊 이미지 duration 재계산: ${actualAudioDuration}초 / ${imagePaths.length}개 = ${adjustedImageDuration}초`);

                    // 자막 블록 시간을 실제 오디오 길이에 맞춰 조정
                    if (imageNarrations.length > 0 && actualAudioDuration !== duration) {
                        console.log(`\n🔧 자막 블록 시간 조정: ${duration}초 → ${actualAudioDuration.toFixed(2)}초`);
                        const blockCount = imageNarrations.length;
                        const adjustedSubtitleDuration = actualAudioDuration / blockCount;

                        imageNarrations.forEach((narration, idx) => {
                            const oldStart = narration.start;
                            const oldEnd = narration.end;
                            narration.start = idx * adjustedSubtitleDuration;
                            narration.end = (idx === blockCount - 1) ? actualAudioDuration : narration.start + adjustedSubtitleDuration;
                            console.log(`   블록 ${idx + 1}: ${oldStart.toFixed(3)}s~${oldEnd.toFixed(3)}s → ${narration.start.toFixed(3)}s~${narration.end.toFixed(3)}s`);
                        });
                        console.log(`✅ 자막 블록 시간 조정 완료\n`);
                    }

                    // FFmpeg concat 파일 생성 (마지막 이미지에도 duration 명시)
                    const concatFilePath = path.join(tempDir, `concat_${videoId}.txt`);
                    const concatLines = imagePaths.map((imgPath, index) => {
                        // 마지막 이미지도 duration 명시하여 정확한 길이 보장
                        return `file '${imgPath.replace(/'/g, "\\'")}'\nduration ${adjustedImageDuration}`;
                    }).join('\n') + `\nfile '${imagePaths[imagePaths.length - 1].replace(/'/g, "\\'")}'`;

                    writeFile(concatFilePath, concatLines).then(async () => {
                        // 자막 필터 생성 (SRT + libass 자동 래핑)
                        let videoFilter =
                            "setpts=PTS-STARTPTS," +
                            "scale=1080:1920:force_original_aspect_ratio=decrease," +
                            "pad=1080:1920:(ow-iw)/2:(oh-ih)/2";

                        // 최종 SRT 파일 경로 결정 (TTS에서 생성한 것 우선 사용)
                        let finalSrtPath: string | null = null;

                        if (ttsSrtPath) {
                            // TTS에서 생성한 SRT 파일 사용
                            finalSrtPath = ttsSrtPath;
                            console.log(`\n=== TTS에서 생성한 SRT 파일 사용 ===`);
                            console.log(`SRT 파일 경로: ${finalSrtPath}`);
                        } else if (imageNarrations.length > 0) {
                            // 새로 SRT 파일 생성
                            console.log(`\n=== SRT 자막 파일 생성 ===`);
                            console.log(`생성할 자막 블록 수: ${imageNarrations.length}개`);
                            console.log(`실제 오디오 길이: ${actualAudioDuration.toFixed(3)}초`);

                            finalSrtPath = path.join(tempDir, `subtitle_${videoId}.srt`);
                            const srtLines: string[] = [];

                            for (let idx = 0; idx < imageNarrations.length; idx++) {
                                const narration = imageNarrations[idx];
                                const startTimeStr = formatSRTTime(narration.start);
                                const endTimeStr = formatSRTTime(narration.end);

                                srtLines.push(`${idx + 1}`);
                                srtLines.push(`${startTimeStr} --> ${endTimeStr}`);
                                srtLines.push(narration.text); // 자동 래핑을 위해 줄바꿈 없이 넣음
                                srtLines.push('');

                                console.log(`  📝 SRT 항목 ${idx + 1}:`);
                                console.log(`     시간: ${startTimeStr} --> ${endTimeStr}`);
                                console.log(`     원본 시간: ${narration.start.toFixed(3)}s ~ ${narration.end.toFixed(3)}s`);
                                console.log(`     텍스트: "${narration.text.substring(0, 50)}${narration.text.length > 50 ? '...' : ''}"`);
                            }

                            const srtContent = srtLines.join('\n');
                            await writeFile(finalSrtPath, srtContent, 'utf8');

                            // 생성된 SRT 파일 내용 확인
                            console.log(`\n✅ SRT 자막 파일 생성 완료: ${finalSrtPath}`);
                            console.log(`   파일 크기: ${srtContent.length} 바이트`);
                            console.log(`   총 자막 블록: ${imageNarrations.length}개`);
                        }

                        // 최종 SRT 파일 검증 및 적용
                        if (finalSrtPath && (await exists(finalSrtPath))) {
                            const verifyContent = await readFile(finalSrtPath, 'utf8');
                            console.log(`\n🔍 최종 SRT 파일 검증:`);
                            console.log(`   파일 경로: ${finalSrtPath}`);
                            console.log(`   파일 존재: ✅`);
                            console.log(`   파일 크기: ${verifyContent.length} 바이트`);
                            console.log(`   첫 200자: "${verifyContent.substring(0, 200)}"`);
                            console.log(`   ${ttsSrtPath ? '📌 TTS에서 생성한 SRT 파일 사용' : '📝 새로 생성한 SRT 파일 사용'}`);

                            // FFmpeg subtitles 필터 경로 이스케이프
                            // macOS/Linux 경로를 슬래시로 통일하고 콜론(:) 이스케이프
                            let escapedSrtPath = finalSrtPath.replace(/\\/g, '/');

                            // FFmpeg 필터에서 콜론(:)은 특수문자이므로 이스케이프 필요
                            // 경로의 모든 콜론을 \: 로 이스케이프
                            escapedSrtPath = escapedSrtPath.replace(/:/g, '\\:');

                            // 작은따옴표와 백슬래시 이스케이프
                            escapedSrtPath = escapedSrtPath.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

                            // 작은따옴표로 경로 감싸기 (FFmpeg 필터 문법)
                            const quotedSrtPath = `'${escapedSrtPath}'`;

                            // libass 스타일: 하단 중앙, 여백/외곽선/배경
                            // force_style 값 내부의 쉼표는 필터 구분자로 파싱되므로 \,로 이스케이프 필수
                            // FFmpeg 필터에서 쉼표는 필터 구분자이므로 값 내부의 쉼표는 반드시 \,로 이스케이프
                            const styleParts = [
                                'Alignment=2',                 // 하단 중앙
                                'MarginV=80',                  // 하단 여백
                                'FontSize=48',                 // 폰트 크기
                                'BorderStyle=3',               // 윤곽/박스
                                'Outline=2',                   // 외곽선 두께
                                'Shadow=0',
                                'PrimaryColour=\\&H00FFFFFF',    // 흰색 (&H 이스케이프)
                                'BackColour=\\&H80000000'        // 반투명 검정 (&H 이스케이프)
                            ];
                            // 각 쉼표를 \,로 이스케이프 (JavaScript 문자열에서 백슬래시는 이중으로 필요)
                            // FFmpeg에 전달될 때 실제 백슬래시+쉼표가 되어야 하므로 \\, 사용
                            const style = styleParts.join('\\,');

                            console.log(`\n🔍 force_style 디버그:`);
                            console.log(`   styleParts:`, styleParts);
                            console.log(`   style (이스케이프 후): "${style}"`);
                            console.log(`   style 길이: ${style.length}`);
                            console.log(`   style 바이트:`, Buffer.from(style).toString('hex'));

                            // subtitles 필터: 경로를 작은따옴표로 감싸고 force_style 적용
                            // macOS 경로의 콜론(:)을 이스케이프했으므로 필터가 정상 작동
                            // force_style 값은 이미 이스케이프되어 있으므로 그대로 사용
                            videoFilter += `,subtitles=${quotedSrtPath}:charenc=UTF-8:force_style=${style}`;
                            console.log(`\n✅ subtitles 필터 적용 (자동 래핑)`);
                            console.log(`   SRT 파일 경로: ${finalSrtPath}`);
                            console.log(`   이스케이프된 경로: ${escapedSrtPath}`);
                            console.log(`   필터 문자열: subtitles='${escapedSrtPath}':force_style='${style}'`);
                            console.log(`   전체 videoFilter: ${videoFilter}`);
                        } else {
                            console.warn('⚠️ 표시할 자막 파일이 없어 자막 없이 생성합니다.');
                        }

                        console.log('=== FFmpeg 비디오 필터 ===');
                        console.log(videoFilter);

                        // FFmpeg outputOptions 준비
                        const outputOpts: string[] = [
                            "-pix_fmt", "yuv420p",
                            "-r", "30",
                            "-t", actualAudioDuration.toFixed(2),
                            "-map", "0:v", // 비디오 스트림 매핑 (첫 번째 입력의 비디오)
                            "-map", "1:a", // 오디오 스트림 매핑 (두 번째 입력의 오디오)
                        ];

                        // 비디오 필터 적용 (자막 포함)
                        if (videoFilter && videoFilter.trim()) {
                            outputOpts.push("-vf");
                            outputOpts.push(videoFilter);
                            console.log(`✅ 비디오 필터 적용: ${videoFilter}`);
                            console.log(`📝 필터 길이: ${videoFilter.length}자`);
                        }

                        // FFmpeg 명령 구성
                        const command = ffmpeg(concatFilePath)
                            .inputOptions(['-f', 'concat', '-safe', '0'])
                            .input(audioPath)
                            .videoCodec('libx264')
                            .audioCodec('aac')
                            .outputOptions(outputOpts)
                            .output(outputPath)
                            .on('start', (commandLine) => {
                                console.log('=== FFmpeg 명령어 전체 ===');
                                console.log(commandLine);
                                console.log('=== FFmpeg 명령어 끝 ===');
                            })
                            .on('stderr', line => console.log('ffmpeg:', line))
                            .addOption('-v', 'debug') // 자세한 로그
                            .on('progress', (progress) => {
                                if (progress.percent) {
                                    console.log('진행률:', Math.round(progress.percent) + '%');
                                }
                            })
                            .on('end', () => {
                                console.log('✅ 영상 생성 완료:', outputPath);
                                // concat 파일 정리
                                fs.unlink(concatFilePath, () => { });
                                resolve();
                            })
                            .on('error', (err) => {
                                console.error('❌ FFmpeg 오류:', err);
                                // concat 파일 정리
                                fs.unlink(concatFilePath, () => { });
                                reject(err);
                            })
                            .run();
                    }).catch(reject);
                }).catch(reject);
            });

            // 생성된 영상의 상대 경로
            const videoUrl = `/temp-videos/${videoId}.mp4`;

            videos.push({
                group: {
                    id: group.id,
                    title: group.title
                },
                videoUrl: videoUrl,
                duration: duration,
                imagesCount: imagePaths.length
            });

            console.log(`그룹 "${group.title}" 영상 생성 완료\n`);
        }

        console.log(`\n=== 전체 영상 생성 완료: ${videos.length}개 ===`);

        res.json({
            success: true,
            data: {
                videos: videos,
                totalVideos: videos.length
            }
        });

    } catch (error: any) {
        console.error('❌ 영상 생성 실패:', error);
        res.status(500).json({
            success: false,
            error: error.message || '영상 생성 중 오류가 발생했습니다.'
        });
    }
});

/**
 * 오디오 파일 다운로드
 */
async function downloadAudio(url: string, outputDir: string): Promise<string> {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const fileName = `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp3`;
    const filePath = path.join(outputDir, fileName);

    await writeFile(filePath, buffer);
    return filePath;
}

/**
 * 이미지 파일 다운로드
 */
async function downloadImage(url: string, outputDir: string, imageId: string): Promise<string> {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const fileName = `${imageId}.png`;
    const filePath = path.join(outputDir, fileName);

    await writeFile(filePath, buffer);
    return filePath;
}

/**
 * 초 단위 시간을 SRT 형식으로 변환
 * @param seconds 초 단위 시간 (예: 12.345)
 * @returns SRT 형식 시간 문자열 (예: "00:00:12,345")
 */
function formatSRTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

export default router;