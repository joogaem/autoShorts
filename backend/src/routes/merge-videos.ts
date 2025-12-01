import express, { Request, Response } from 'express';
import ffmpeg from 'fluent-ffmpeg';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';

const router = express.Router();
const writeFile = promisify(fs.writeFile);
const exists = promisify(fs.exists);
const mkdir = promisify(fs.mkdir);

/**
 * POST /api/merge-videos
 * 전달된 5개(또는 그 이상)의 동영상을 순차적으로 이어 붙여 하나의 최종 영상으로 생성
 * body: { videoUrls: string[] } // 예: ["/temp-videos/vid1.mp4", ...]
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const { videoUrls } = req.body as { videoUrls: string[] };

        if (!videoUrls || !Array.isArray(videoUrls) || videoUrls.length === 0) {
            return res.status(400).json({ success: false, error: 'videoUrls 배열이 필요합니다.' });
        }

        const tempDir = path.join(process.cwd(), 'temp-videos');
        if (!(await exists(tempDir))) {
            await mkdir(tempDir, { recursive: true });
        }

        // URL을 실제 파일 경로로 변환
        // 프론트는 "/temp-videos/xyz.mp4" 형태를 받으므로 파일명만 추출해서 tempDir 하위 경로로 맵핑
        const inputPaths = videoUrls.map((url) => {
            const filename = path.basename(url);
            return path.join(tempDir, filename);
        });

        // 입력 파일 유효성 검사
        for (const p of inputPaths) {
            if (!fs.existsSync(p)) {
                return res.status(400).json({ success: false, error: `입력 파일을 찾을 수 없습니다: ${path.basename(p)}` });
            }
        }

        const concatListPath = path.join(tempDir, `concat_${Date.now()}.txt`);
        const listContent = inputPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
        await writeFile(concatListPath, listContent, 'utf-8');

        const finalFilename = `final_${Date.now()}.mp4`;
        const outputPath = path.join(tempDir, finalFilename);

        await new Promise<void>((resolve, reject) => {
            // 생성된 영상들은 동일 코덱/해상도이므로 concat demuxer + stream copy 시도
            ffmpeg(concatListPath)
                .inputOptions(['-f', 'concat', '-safe', '0'])
                .outputOptions(['-c', 'copy'])
                .output(outputPath)
                .on('start', (commandLine) => {
                    console.log('[merge-videos] FFmpeg:', commandLine);
                })
                .on('end', () => {
                    fs.unlink(concatListPath, () => {});
                    resolve();
                })
                .on('error', (err) => {
                    console.error('[merge-videos] FFmpeg error, fallback to re-encode:', err);
                    // 일부 환경에서 copy 실패 시 재인코딩으로 폴백
                    ffmpeg(concatListPath)
                        .inputOptions(['-f', 'concat', '-safe', '0'])
                        .videoCodec('libx264')
                        .audioCodec('aac')
                        .outputOptions(['-pix_fmt', 'yuv420p', '-r', '30'])
                        .output(outputPath)
                        .on('end', () => {
                            fs.unlink(concatListPath, () => {});
                            resolve();
                        })
                        .on('error', (err2) => {
                            fs.unlink(concatListPath, () => {});
                            reject(err2);
                        })
                        .run();
                })
                .run();
        });

        const videoUrl = `/temp-videos/${finalFilename}`;
        return res.json({ success: true, data: { videoUrl } });
    } catch (error: any) {
        console.error('❌ 영상 병합 실패:', error);
        return res.status(500).json({ success: false, error: error?.message || '영상 병합 중 오류가 발생했습니다.' });
    }
});

export default router;


