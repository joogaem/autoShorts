// FFmpeg 경로 설정
import ffmpeg from 'fluent-ffmpeg';
import * as path from 'path';
import * as fs from 'fs';

/**
 * FFmpeg 경로를 자동으로 찾아서 설정합니다.
 * Windows 환경에서 WinGet으로 설치된 경우를 포함하여 여러 경로를 확인합니다.
 */
export function configureFFmpeg() {
    // 환경 변수에서 명시적으로 설정된 경로 확인
    const envFfmpegPath = process.env.FFMPEG_PATH;
    if (envFfmpegPath && fs.existsSync(envFfmpegPath)) {
        ffmpeg.setFfmpegPath(envFfmpegPath);
        console.log(`✅ FFmpeg 경로 설정됨 (환경 변수): ${envFfmpegPath}`);
        
        // 같은 디렉토리에서 ffprobe 찾기
        const dir = path.dirname(envFfmpegPath);
        const ffprobePath = path.join(dir, process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe');
        if (fs.existsSync(ffprobePath)) {
            ffmpeg.setFfprobePath(ffprobePath);
            console.log(`✅ FFprobe 경로 설정됨: ${ffprobePath}`);
        }
        return;
    }

    // Windows에서 WinGet으로 설치된 경우 동적으로 찾기
    const winGetPaths: string[] = [];
    if (process.env.LOCALAPPDATA) {
        const winGetPackagesDir = path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Packages');
        if (fs.existsSync(winGetPackagesDir)) {
            try {
                const packages = fs.readdirSync(winGetPackagesDir);
                for (const pkg of packages) {
                    if (pkg.includes('FFmpeg') || pkg.includes('ffmpeg')) {
                        const pkgPath = path.join(winGetPackagesDir, pkg);
                        if (fs.statSync(pkgPath).isDirectory()) {
                            // ffmpeg-*-full_build 디렉토리 찾기
                            const subdirs = fs.readdirSync(pkgPath);
                            for (const subdir of subdirs) {
                                if (subdir.includes('ffmpeg') && subdir.includes('full_build')) {
                                    const binPath = path.join(pkgPath, subdir, 'bin', 'ffmpeg.exe');
                                    if (fs.existsSync(binPath)) {
                                        winGetPaths.push(binPath);
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                // 읽기 오류 무시
            }
        }
    }

    // Windows에서 일반적인 설치 경로들 확인
    const possiblePaths = [
        ...winGetPaths, // WinGet으로 설치된 경우 (동적으로 찾은 경로들)
        // Chocolatey로 설치된 경우
        path.join(process.env.ProgramData || 'C:\\ProgramData', 'chocolatey', 'bin', 'ffmpeg.exe'),
        // 직접 설치된 경우 (일반적인 경로)
        'C:\\ffmpeg\\bin\\ffmpeg.exe',
        'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
    ];

    let foundFfmpeg = false;
    let foundFfprobe = false;

    // 가능한 경로들 확인
    for (const ffmpegPath of possiblePaths) {
        if (ffmpegPath && fs.existsSync(ffmpegPath)) {
            ffmpeg.setFfmpegPath(ffmpegPath);
            console.log(`✅ FFmpeg 경로 설정됨: ${ffmpegPath}`);
            foundFfmpeg = true;
            
            // 같은 디렉토리에서 ffprobe 찾기
            const dir = path.dirname(ffmpegPath);
            const ffprobePath = path.join(dir, process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe');
            if (fs.existsSync(ffprobePath)) {
                ffmpeg.setFfprobePath(ffprobePath);
                console.log(`✅ FFprobe 경로 설정됨: ${ffprobePath}`);
                foundFfprobe = true;
            }
            break;
        }
    }

    // PATH 환경 변수에서 찾기 시도
    if (!foundFfmpeg) {
        const pathEnv = process.env.PATH || process.env.Path || '';
        const pathDirs = pathEnv.split(path.delimiter);
        
        for (const dir of pathDirs) {
            const ffmpegPath = path.join(dir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
            if (fs.existsSync(ffmpegPath)) {
                ffmpeg.setFfmpegPath(ffmpegPath);
                console.log(`✅ FFmpeg 경로 설정됨 (PATH): ${ffmpegPath}`);
                foundFfmpeg = true;
                
                // 같은 디렉토리에서 ffprobe 찾기
                const ffprobePath = path.join(dir, process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe');
                if (fs.existsSync(ffprobePath)) {
                    ffmpeg.setFfprobePath(ffprobePath);
                    console.log(`✅ FFprobe 경로 설정됨 (PATH): ${ffprobePath}`);
                    foundFfprobe = true;
                }
                break;
            }
        }
    }

    // ffprobe를 아직 찾지 못한 경우 추가 검색
    if (!foundFfprobe) {
        const ffprobePaths: string[] = [];
        
        // WinGet으로 설치된 경우 동적으로 찾기
        if (process.env.LOCALAPPDATA) {
            const winGetPackagesDir = path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Packages');
            if (fs.existsSync(winGetPackagesDir)) {
                try {
                    const packages = fs.readdirSync(winGetPackagesDir);
                    for (const pkg of packages) {
                        if (pkg.includes('FFmpeg') || pkg.includes('ffmpeg')) {
                            const pkgPath = path.join(winGetPackagesDir, pkg);
                            if (fs.statSync(pkgPath).isDirectory()) {
                                const subdirs = fs.readdirSync(pkgPath);
                                for (const subdir of subdirs) {
                                    if (subdir.includes('ffmpeg') && subdir.includes('full_build')) {
                                        const binPath = path.join(pkgPath, subdir, 'bin', 'ffprobe.exe');
                                        if (fs.existsSync(binPath)) {
                                            ffprobePaths.push(binPath);
                                        }
                                    }
                                }
                            }
                        }
                    }
                } catch (error) {
                    // 읽기 오류 무시
                }
            }
        }
        
        // 기타 일반적인 경로들
        ffprobePaths.push(
            path.join(process.env.ProgramData || 'C:\\ProgramData', 'chocolatey', 'bin', 'ffprobe.exe'),
            'C:\\ffmpeg\\bin\\ffprobe.exe',
            'C:\\Program Files\\ffmpeg\\bin\\ffprobe.exe',
        );

        for (const ffprobePath of ffprobePaths) {
            if (ffprobePath && fs.existsSync(ffprobePath)) {
                ffmpeg.setFfprobePath(ffprobePath);
                console.log(`✅ FFprobe 경로 설정됨: ${ffprobePath}`);
                foundFfprobe = true;
                break;
            }
        }
    }

    if (!foundFfmpeg) {
        console.warn('⚠️ FFmpeg 경로를 자동으로 찾을 수 없습니다. 환경 변수 FFMPEG_PATH를 설정하거나 PATH에 추가해주세요.');
    }
}

// 모듈 로드 시 자동으로 설정
configureFFmpeg();

