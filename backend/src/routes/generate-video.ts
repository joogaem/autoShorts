import express, { Request, Response } from 'express';
import ffmpeg from 'fluent-ffmpeg';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import { execSync } from 'child_process';
// FFmpeg 경로 자동 설정
import '../config/ffmpeg';

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
        // Windows에서 한글 경로 문제 해결: C:\ffmpeg 사용
        const tempDir = process.platform === 'win32' 
            ? 'C:\\ffmpeg' 
            : path.join(process.cwd(), 'temp-videos');

        // temp-videos 디렉토리 생성
        if (!(await exists(tempDir))) {
            await mkdir(tempDir, { recursive: true });
        }

        // 이미지와 오디오를 1:1로 매칭하여 각 쌍을 개별 비디오로 생성
        const videoSegments: string[] = []; // 개별 비디오 파일 경로들

        // 각 그룹별로 처리
        for (const audioItem of ttsData.audioResult || []) {
            const { group, script, audioUrl, duration, srtPath, srtUrl } = audioItem;
            console.log(`\n=== 그룹 "${group.title}" 처리 시작 ===`);

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
            
            // 오디오 파일을 여러 개로 분할하거나, 이미지와 1:1 매칭
            // 여기서는 이미지와 오디오를 1:1로 매칭한다고 가정
            // 만약 오디오가 1개이고 이미지가 여러 개라면, 오디오를 분할해야 함
            // 하지만 사용자가 "오디오 파일 여러개"라고 했으므로, 각 이미지에 대응하는 오디오가 있다고 가정
            
            // 일단 현재 구조에서는 이미지 여러 개 + 오디오 1개이므로
            // 오디오를 이미지 개수만큼 분할하거나, 각 이미지에 동일한 오디오를 사용
            // 사용자 요구사항에 맞춰 각 이미지+오디오 쌍을 개별 비디오로 생성

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
                    // 로컬 경로: /temp-images/로 시작하는 경우 C:\ffmpeg에서 직접 찾기
                    if (imageUrl.startsWith('/temp-images/')) {
                        const filename = path.basename(imageUrl);
                        // Windows에서 한글 경로 문제 해결: C:\ffmpeg 사용
                        if (process.platform === 'win32') {
                            imagePath = path.join('C:\\ffmpeg', filename);
                        } else {
                            imagePath = path.join(process.cwd(), 'temp-images', filename);
                        }
                        console.log(`📁 이미지 경로 변환: ${imageUrl} -> ${imagePath}`);
                    } else {
                        // 다른 로컬 경로: 한글 경로 문제 해결을 위해 C:\ffmpeg로 복사
                        const originalPath = path.join(process.cwd(), imageUrl.replace(/^\//, ''));
                        if (await exists(originalPath)) {
                            // Windows에서만 C:\ffmpeg로 복사
                            if (process.platform === 'win32') {
                                const filename = path.basename(originalPath);
                                imagePath = path.join(tempDir, filename);
                                // 파일이 이미 존재하지 않으면 복사
                                if (!(await exists(imagePath))) {
                                    const originalContent = await readFile(originalPath);
                                    await writeFile(imagePath, originalContent);
                                    console.log(`📁 이미지 파일 복사: ${originalPath} -> ${imagePath}`);
                                } else {
                                    console.log(`📁 이미지 파일 이미 존재: ${imagePath}`);
                                }
                            } else {
                                imagePath = originalPath;
                            }
                        } else {
                            imagePath = originalPath;
                        }
                    }
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

            // 이미지와 오디오를 1:1로 매칭하여 각 쌍을 개별 비디오로 생성
            // 오디오를 이미지 개수만큼 분할 (각 이미지당 오디오 길이 / 이미지 개수)
            // segmentDuration은 나중에 actualAudioDuration을 사용하여 재계산됨

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

            // TTS 시간에 맞춰서 장면 하나의 이미지를 유지하여 비디오 생성
            console.log(`\n=== 장면 비디오 생성 시작 ===`);
            console.log(`이미지 ${imagePaths.length}개 중 첫 번째 이미지 사용, 오디오 1개 (${duration}초)`);
            
            // 오디오 실제 길이 확인
            const getAudioDuration = (audioPath: string): Promise<number> => {
                return new Promise((resolve, reject) => {
                    ffmpeg.ffprobe(audioPath, (err, metadata) => {
                        if (err) {
                            console.warn(`⚠️ 오디오 길이 확인 실패, duration 값 사용: ${err.message}`);
                            resolve(duration);
                        } else {
                            const actualDuration = metadata.format?.duration || duration;
                            console.log(`✅ 오디오 실제 길이: ${actualDuration.toFixed(2)}초`);
                            resolve(actualDuration);
                        }
                    });
                });
            };

            const actualAudioDuration = await getAudioDuration(audioPath);
            
            // 첫 번째 이미지를 사용하여 전체 TTS 시간 동안 유지
            const imagePath = imagePaths[0]; // 첫 번째 이미지 사용
            console.log(`📊 장면 이미지: ${path.basename(imagePath)}`);
            console.log(`📊 장면 길이: ${actualAudioDuration.toFixed(2)}초 (TTS 시간에 맞춤)`);
            
            const videoId = `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            // Windows 경로 정규화: 절대 경로로 변환
            const outputPath = path.resolve(path.join(tempDir, `${videoId}.mp4`));

            // 출력 디렉토리 확인 및 생성
            if (!(await exists(tempDir))) {
                await mkdir(tempDir, { recursive: true });
                console.log(`✅ 출력 디렉토리 생성: ${tempDir}`);
            }
            
            // 출력 경로 디버깅
            console.log(`📁 출력 경로: ${outputPath}`);
            console.log(`📁 출력 디렉토리 존재 여부: ${await exists(path.dirname(outputPath))}`);

            // 자막 파일 처리 (최대 2줄로 재구성)
            let finalSrtPath: string | null = null;
            
            if (ttsSrtPath) {
                // TTS에서 생성한 SRT 파일이 있는 경우
                console.log(`\n=== 자막 파일 재구성 (최대 2줄) ===`);
                const reformattedSrtPath = path.join(tempDir, `reformatted_${videoId}.srt`);
                await reformatSRTForTwoLines(ttsSrtPath, actualAudioDuration, reformattedSrtPath);
                finalSrtPath = reformattedSrtPath;
            } else if (fullScriptText) {
                // SRT 파일이 없고 스크립트 텍스트가 있는 경우
                console.log(`\n=== 자막 파일 생성 (최대 2줄) ===`);
                const generatedSrtPath = path.join(tempDir, `generated_${videoId}.srt`);
                
                // 텍스트를 최대 2줄로 분할
                const twoLineTexts = splitTextIntoTwoLines(fullScriptText);
                const lineCount = twoLineTexts.length;
                const durationPerSubtitle = actualAudioDuration / lineCount;
                
                console.log(`📝 자막 줄 수 계산: ${lineCount}개 (각 최대 2줄)`);
                console.log(`⏱️ 영상 총 길이: ${actualAudioDuration.toFixed(2)}초`);
                console.log(`📊 자막당 평균 시간: ${durationPerSubtitle.toFixed(2)}초`);
                
                // SRT 파일 생성
                let srtContent = '';
                for (let i = 0; i < twoLineTexts.length; i++) {
                    const startTime = i * durationPerSubtitle;
                    const endTime = (i === twoLineTexts.length - 1) ? actualAudioDuration : (i + 1) * durationPerSubtitle;
                    
                    srtContent += `${i + 1}\n`;
                    srtContent += `${formatSRTTime(startTime)} --> ${formatSRTTime(endTime)}\n`;
                    srtContent += `${twoLineTexts[i]}\n\n`;
                }
                
                await writeFile(generatedSrtPath, srtContent, 'utf8');
                finalSrtPath = generatedSrtPath;
                console.log(`✅ 생성된 SRT 파일 저장: ${generatedSrtPath}`);
            }

            // 비디오 필터 구성 (자막 포함)
            const videoFilters: string[] = [
                'scale=1080:1920:force_original_aspect_ratio=decrease',
                'pad=1080:1920:(ow-iw)/2:(oh-ih)/2'
            ];

            // 자막 필터 추가 (화면 하단 20% 위치)
            if (finalSrtPath) {
                try {
                    // Windows 경로 처리: 절대 경로로 변환
                    const absoluteSrtPath = path.resolve(finalSrtPath);
                    
                    // 파일 존재 확인
                    if (!(await exists(absoluteSrtPath))) {
                        console.warn(`⚠️ 자막 파일이 존재하지 않음: ${absoluteSrtPath}`);
                    } else {
                        // Windows에서 FFmpeg는 슬래시를 인식하므로 백슬래시를 슬래시로 변환
                        let normalizedSrtPath = absoluteSrtPath.replace(/\\/g, '/');
                        
                        // 작은따옴표 이스케이프 (경로에 작은따옴표가 있을 경우)
                        normalizedSrtPath = normalizedSrtPath.replace(/'/g, "\\'");
                        
                        // force_style 문자열
                        const styleString = 'Alignment=2,MarginV=200,FontSize=44,Outline=2,Shadow=1,PrimaryColour=&HFFFFFF,OutlineColour=&H000000';
                        
                        // subtitles 필터 구성
                        // Windows에서는 경로를 작은따옴표로 감싸고, force_style은 따옴표 없이
                        const subtitleFilter = `subtitles='${normalizedSrtPath}':force_style=${styleString}`;
                        videoFilters.push(subtitleFilter);
                        console.log(`✅ 자막 필터 추가: 화면 하단 20% 위치 (최대 2줄)`);
                        console.log(`📝 자막 파일 절대 경로: ${absoluteSrtPath}`);
                        console.log(`📝 정규화된 경로: ${normalizedSrtPath}`);
                    }
                } catch (error) {
                    console.warn(`⚠️ 자막 필터 추가 실패, 자막 없이 진행: ${error}`);
                    // 자막 필터 없이 진행
                }
            }

            const videoFilter = videoFilters.join(',');

            // 이미지 하나를 TTS 시간 동안 유지하는 비디오 생성
            await new Promise<void>(async (resolve, reject) => {
                console.log(`\n--- 장면 비디오 생성 ---`);
                console.log(`이미지: ${path.basename(imagePath)}`);
                console.log(`오디오: 전체 (${actualAudioDuration.toFixed(2)}초)`);
                if (finalSrtPath) {
                    console.log(`자막: ${path.basename(finalSrtPath)}`);
                }
                console.log(`출력: ${path.basename(outputPath)}`);
                console.log(`출력 전체 경로: ${outputPath}`);

                // Windows에서 경로 정규화: 입력 경로도 정규화
                let normalizedImagePath = path.resolve(imagePath);
                let normalizedAudioPath = path.resolve(audioPath);
                let normalizedOutputPath = path.resolve(outputPath);

                // 출력 디렉토리 존재 확인 및 생성
                const outputDir = path.dirname(normalizedOutputPath);
                if (!(await exists(outputDir))) {
                    try {
                        await mkdir(outputDir, { recursive: true });
                        console.log(`✅ 출력 디렉토리 생성 완료: ${outputDir}`);
                    } catch (mkdirErr: any) {
                        console.error(`❌ 출력 디렉토리 생성 실패: ${mkdirErr.message}`);
                        reject(new Error(`출력 디렉토리 생성 실패: ${mkdirErr.message}`));
                        return;
                    }
                }

                // 출력 파일이 이미 존재하면 삭제 (ffmpeg가 덮어쓰기 실패할 수 있음)
                if (await exists(normalizedOutputPath)) {
                    try {
                        fs.unlinkSync(normalizedOutputPath);
                        console.log(`🗑️ 기존 출력 파일 삭제: ${normalizedOutputPath}`);
                    } catch (unlinkErr: any) {
                        console.warn(`⚠️ 기존 출력 파일 삭제 실패: ${unlinkErr.message}`);
                    }
                }

                // 입력 파일 존재 확인
                if (!(await exists(normalizedImagePath))) {
                    reject(new Error(`이미지 파일을 찾을 수 없습니다: ${normalizedImagePath}`));
                    return;
                }
                if (!(await exists(normalizedAudioPath))) {
                    reject(new Error(`오디오 파일을 찾을 수 없습니다: ${normalizedAudioPath}`));
                    return;
                }

                const ffmpegCommand = ffmpeg(normalizedImagePath)
                    .inputOptions(['-loop', '1']) // 이미지를 루프로 재생
                    .input(normalizedAudioPath)
                    .videoCodec('libx264')
                    .audioCodec('aac')
                    .outputOptions([
                        '-y', // 출력 파일 덮어쓰기 허용
                        '-pix_fmt', 'yuv420p',
                        '-r', '30',
                        '-shortest', // 오디오 길이에 맞춤
                        '-vf', videoFilter
                    ])
                    .output(normalizedOutputPath);

                ffmpegCommand
                    .on('start', (cmd) => console.log(`FFmpeg: ${cmd}`))
                    .on('end', () => {
                        console.log(`✅ 장면 비디오 생성 완료`);
                        // 임시 자막 파일 정리
                        if (finalSrtPath && finalSrtPath !== ttsSrtPath) {
                            fs.unlink(finalSrtPath, () => {});
                        }
                        resolve();
                    })
                    .on('error', (err) => {
                        console.error(`❌ 장면 비디오 생성 실패:`, err);
                        // 임시 자막 파일 정리
                        if (finalSrtPath && finalSrtPath !== ttsSrtPath) {
                            fs.unlink(finalSrtPath, () => {});
                        }
                        reject(err);
                    })
                    .run();
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
 * Windows에서 한글 경로를 짧은 경로(8.3 형식)로 변환
 * @param longPath 긴 경로
 * @returns 짧은 경로 또는 원본 경로
 */
function getShortPath(longPath: string): string {
    if (process.platform !== 'win32') {
        return longPath;
    }

    try {
        // PowerShell을 사용하여 짧은 경로 얻기
        const command = `powershell -Command "(New-Object -ComObject Scripting.FileSystemObject).GetFile('${longPath.replace(/'/g, "''")}').ShortPath"`;
        const shortPath = execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
        if (shortPath && fs.existsSync(shortPath)) {
            console.log(`📁 짧은 경로 변환: ${longPath} -> ${shortPath}`);
            return shortPath;
        }
    } catch (error) {
        // 짧은 경로를 얻을 수 없으면 원본 경로 사용
        console.warn(`⚠️ 짧은 경로 변환 실패, 원본 경로 사용: ${error}`);
    }

    return longPath;
}

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

/**
 * SRT 시간 문자열을 초로 변환
 * @param srtTime SRT 형식 시간 문자열 (예: "00:00:12,345")
 * @returns 초 단위 시간
 */
function parseSRTTime(srtTime: string): number {
    const [timePart, msPart] = srtTime.split(',');
    const [hours, minutes, seconds] = timePart.split(':').map(Number);
    const milliseconds = msPart ? parseInt(msPart) : 0;
    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

/**
 * 텍스트를 최대 2줄로 분할하고 줄 수 계산
 * @param text 원본 텍스트
 * @returns 분할된 텍스트 배열 (각 요소는 최대 2줄)
 */
function splitTextIntoTwoLines(text: string): string[] {
    // 문장 단위로 분할
    const sentences = text.split(/(?<=[\.!?])\s+/).filter(s => s.trim());
    const result: string[] = [];
    let currentLines: string[] = [];

    for (const sentence of sentences) {
        const testLines = [...currentLines, sentence];
        const lineCount = testLines.length;

        if (lineCount <= 2) {
            currentLines = testLines;
        } else {
            // 2줄을 넘으면 현재까지를 저장하고 새로 시작
            if (currentLines.length > 0) {
                result.push(currentLines.join(' '));
            }
            currentLines = [sentence];
        }
    }

    // 마지막 남은 줄들 추가
    if (currentLines.length > 0) {
        result.push(currentLines.join(' '));
    }

    return result.length > 0 ? result : [text];
}

/**
 * SRT 파일을 파싱하여 최대 2줄로 재구성
 * @param srtPath 원본 SRT 파일 경로
 * @param totalDuration 영상 총 길이 (초)
 * @param outputPath 출력 SRT 파일 경로
 */
async function reformatSRTForTwoLines(srtPath: string, totalDuration: number, outputPath: string): Promise<void> {
    const srtContent = await readFile(srtPath, 'utf8');
    
    // SRT 파일 파싱
    const subtitleBlocks = srtContent.split(/\n\s*\n/).filter(block => block.trim());
    const allTexts: string[] = [];

    for (const block of subtitleBlocks) {
        const lines = block.trim().split('\n');
        if (lines.length >= 3) {
            // 시간 정보는 무시하고 텍스트만 추출
            const text = lines.slice(2).join(' ').trim();
            if (text) {
                allTexts.push(text);
            }
        }
    }

    // 전체 텍스트를 합치고 최대 2줄로 분할
    const fullText = allTexts.join(' ');
    const twoLineTexts = splitTextIntoTwoLines(fullText);
    const lineCount = twoLineTexts.length;

    console.log(`📝 자막 줄 수 계산: ${lineCount}개 (각 최대 2줄)`);
    console.log(`⏱️ 영상 총 길이: ${totalDuration.toFixed(2)}초`);
    
    const durationPerSubtitle = totalDuration / lineCount;
    console.log(`📊 자막당 평균 시간: ${durationPerSubtitle.toFixed(2)}초`);

    // 새로운 SRT 파일 생성
    let newSRTContent = '';
    for (let i = 0; i < twoLineTexts.length; i++) {
        const startTime = i * durationPerSubtitle;
        const endTime = (i === twoLineTexts.length - 1) ? totalDuration : (i + 1) * durationPerSubtitle;
        
        newSRTContent += `${i + 1}\n`;
        newSRTContent += `${formatSRTTime(startTime)} --> ${formatSRTTime(endTime)}\n`;
        newSRTContent += `${twoLineTexts[i]}\n\n`;
    }

    await writeFile(outputPath, newSRTContent, 'utf8');
    console.log(`✅ 재구성된 SRT 파일 저장: ${outputPath}`);
}

export default router;