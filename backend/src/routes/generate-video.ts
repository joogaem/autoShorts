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
            const { group, script, audioUrl, duration, srtPath, srtUrl, cues: ttsCues } = audioItem;
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

            // === 자막 결정 ===
            // 우선순위 1: TTS에서 생성한 SRT 파일 (SSML mark 기반, 가장 정확)
            // 우선순위 2: ttsCues → imageNarrations → 새 SRT 생성
            // 우선순위 3: fullScriptText 균등 분배 (fallback)
            const imageNarrations: Array<{ start: number; end: number; text: string }> = [];

            if (ttsCues && ttsCues.length > 0) {
                // SSML mark 기반 정확한 타이밍 사용
                console.log(`\n=== TTS cues 사용 (SSML mark 기반, ${ttsCues.length}개) ===`);
                for (const cue of ttsCues) {
                    imageNarrations.push(cue);
                    console.log(`  cue: ${cue.start.toFixed(2)}s→${cue.end.toFixed(2)}s "${cue.text}"`);
                }
            } else if (fullScriptText) {
                // fallback: fullScriptText에서 균등 분배
                console.log(`\n=== 자막 큐 생성 (fallback 균등 분배) ===`);
                const MAX_CHARS_PER_CUE = 22;
                const MIN_CHARS_PER_CUE = 10;
                const normalized = fullScriptText.replace(/\s+/g, ' ').trim();
                const sentences: string[] = normalized
                    .split(/(?<=[\.!?\uFF01\uFF1F\u3002])\s*/g)
                    .map(s => s.trim()).filter(Boolean);
                const splitByLen = (t: string): string[] => {
                    if (t.length <= MAX_CHARS_PER_CUE) return [t];
                    const words = t.split(' '); const chunks: string[] = []; let cur = '';
                    for (const w of words) {
                        const next = cur ? `${cur} ${w}` : w;
                        if (next.length > MAX_CHARS_PER_CUE && cur) { chunks.push(cur); cur = w; }
                        else cur = next;
                    }
                    if (cur) chunks.push(cur);
                    return chunks.length ? chunks : [t];
                };
                let cues = sentences.flatMap(splitByLen);
                const merged: string[] = [];
                for (const s of cues) {
                    if (!merged.length) { merged.push(s); continue; }
                    const last = merged[merged.length - 1];
                    if (s.length < MIN_CHARS_PER_CUE && last.length + s.length + 1 <= MAX_CHARS_PER_CUE + 6)
                        merged[merged.length - 1] = `${last} ${s}`.trim();
                    else merged.push(s);
                }
                cues = merged;
                const dur = duration / Math.max(1, cues.length);
                cues.forEach((text, i) => {
                    imageNarrations.push({ text, start: i * dur, end: i === cues.length - 1 ? duration : (i + 1) * dur });
                });
                console.log(`  ${cues.length}개 cue 생성 (균등 분배)`);
            }

            if (ttsSrtPath) {
                console.log(`\n=== TTS SRT 파일 사용 (SSML mark 타이밍): ${ttsSrtPath} ===`);
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

                    // 자막 타이밍을 실제 오디오 길이 기준으로 비율 스케일링
                    // (균등 재분배 X → SSML mark의 상대적 타이밍 보존)
                    if (imageNarrations.length > 0 && duration > 0 && Math.abs(actualAudioDuration - duration) > 0.05) {
                        const scale = actualAudioDuration / duration;
                        console.log(`\n🔧 자막 타이밍 스케일: x${scale.toFixed(4)} (${duration}s → ${actualAudioDuration.toFixed(2)}s)`);
                        imageNarrations.forEach(n => {
                            n.start = n.start * scale;
                            n.end = n.end * scale;
                        });
                        // 마지막 cue end를 실제 오디오 길이로 고정
                        imageNarrations[imageNarrations.length - 1].end = actualAudioDuration;
                    }

                    // FFmpeg concat 파일 생성 (마지막 이미지에도 duration 명시)
                    const concatFilePath = path.join(tempDir, `concat_${videoId}.txt`);
                    const concatLines = imagePaths.map((imgPath, index) => {
                        // 마지막 이미지도 duration 명시하여 정확한 길이 보장
                        return `file '${imgPath.replace(/'/g, "\\'")}'\nduration ${adjustedImageDuration}`;
                    }).join('\n') + `\nfile '${imagePaths[imagePaths.length - 1].replace(/'/g, "\\'")}'`;

                    writeFile(concatFilePath, concatLines).then(async () => {
                        // 자막 필터 생성 (SRT + libass 자동 래핑)
                        // fps=25 를 scale 앞에 삽입:
                        // concat demuxer는 이미지 1장당 프레임 1개만 생성하므로
                        // subtitle 필터가 항상 PTS=0만 보게 됨 → 자막이 첫 번째 cue에 고정됨
                        // fps=25 로 먼저 프레임을 복제하면 PTS가 정상적으로 진행되어 자막이 교체됨
                        let videoFilter =
                            "setpts=PTS-STARTPTS," +
                            "fps=25," +
                            "scale=1080:1920:force_original_aspect_ratio=decrease," +
                            "pad=1080:1920:(ow-iw)/2:(oh-ih)/2";

                        // 자막을 음성보다 약간 앞서 표시 (자막이 늦게 나오는 현상 보정)
                        const SUBTITLE_OFFSET_SEC = 0.9;

                        // SRT 항상 imageNarrations 기준으로 생성 (offset 적용 가능하도록)
                        // ttsSrtPath가 있어도 무시하고 imageNarrations 사용
                        let finalSrtPath: string | null = null;

                        if (imageNarrations.length > 0) {
                            finalSrtPath = path.join(tempDir, `subtitle_${videoId}.srt`);
                            const srtLines: string[] = [];

                            for (let idx = 0; idx < imageNarrations.length; idx++) {
                                const narration = imageNarrations[idx];
                                const start = Math.max(0, narration.start - SUBTITLE_OFFSET_SEC);
                                const end   = Math.max(start + 0.1, narration.end - SUBTITLE_OFFSET_SEC);

                                // 긴 자막은 더 작은 폰트로 표시 (ASS inline override tag)
                                const fontTag = narration.text.length > 28 ? '{\\fs8}' : narration.text.length > 22 ? '{\\fs9}' : '';

                                srtLines.push(`${idx + 1}`);
                                srtLines.push(`${formatSRTTime(start)} --> ${formatSRTTime(end)}`);
                                srtLines.push(fontTag + narration.text);
                                srtLines.push('');

                                console.log(`  📝 cue ${idx + 1}: ${start.toFixed(2)}s→${end.toFixed(2)}s "${narration.text.substring(0, 40)}"`);
                            }

                            await writeFile(finalSrtPath, srtLines.join('\n'), 'utf8');
                            console.log(`✅ SRT 생성 완료 (offset -${SUBTITLE_OFFSET_SEC}s 적용): ${finalSrtPath}`);
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

                            // FFmpeg subtitles 필터 경로 이스케이프 (문서 _escape_path 패턴)
                            // 1) Windows 백슬래시 → 슬래시
                            // 2) 콜론(:) → \:  (드라이브 문자 등)
                            // 3) 작은따옴표 → \'
                            let escapedSrtPath = finalSrtPath
                                .replace(/\\/g, '/')
                                .replace(/:/g, '\\:')
                                .replace(/'/g, "\\'");

                            // 작은따옴표로 경로 감싸기 (FFmpeg 필터 문법)
                            const quotedSrtPath = `'${escapedSrtPath}'`;

                            // libass 스타일: 하단 중앙, 여백/외곽선/배경
                            // force_style 값 내부의 쉼표는 필터 구분자이므로 \, 로 이스케이프 필수
                            // 색상 코드는 ASS 형식 그대로 사용: &HAABBGGRR (백슬래시 불필요)
                            const styleParts = [
                                'Alignment=2',              // 하단 중앙
                                'MarginV=60',               // 하단 여백
                                'MarginL=40',               // 좌측 여백 (텍스트 잘림 방지)
                                'MarginR=40',               // 우측 여백 (텍스트 잘림 방지)
                                'FontSize=11',              // libass PlayResY=288 기준 → 실제 1920px에서 ~73px
                                'BorderStyle=3',            // 배경 박스 스타일
                                'Outline=1',                // 외곽선 두께
                                'Shadow=0',
                                'PrimaryColour=&H00FFFFFF', // 불투명 흰색
                                'BackColour=&H99000000'     // 60% 투명 검정 배경
                            ];
                            // 쉼표를 \, 로 이스케이프 (JS 문자열: '\\,' → FFmpeg 수신: \,)
                            const style = styleParts.join('\\,');

                            // subtitles 필터: force_style 값도 작은따옴표로 감싸기
                            videoFilter += `,subtitles=${quotedSrtPath}:charenc=UTF-8:force_style='${style}'`;
                            console.log(`\n✅ subtitles 필터 적용 (자동 래핑)`);
                            console.log(`   SRT 파일 경로: ${finalSrtPath}`);
                            console.log(`   이스케이프된 경로: ${escapedSrtPath}`);
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