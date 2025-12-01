// 세션 스토리지 관리 유틸리티

export interface UploadData {
    filename: string;
    slides: any[];
    parseResult: any;
    visualAnalysisResults?: any[];
    coreMessages?: any[];
}

export interface GroupData {
    selectedGroups: string[];
    slideGroups: any[];
    keyPoints?: any[];
    selectedSectionIndex?: number;
    selectedSection?: any;
}

export interface ScriptData {
    scriptResult?: any;
    storyboardResult?: any;
    storyboardImages?: any;
    generationMode?: 'script' | 'storyboard' | 'storyboard-images';
    slideGroups?: any[];
}

export interface TTSData {
    audioResult: any;
    slideGroups?: any[];
}

export interface ImageData {
    generatedImages: any[];
}

export interface VideoData {
    videos: any[];
    finalVideoUrl?: string;
}

// 세션 스토리지 용량 체크 및 에러 핸들링
const setItemWithErrorHandling = (key: string, value: string, clearOldData: boolean = false) => {
    try {
        sessionStorage.setItem(key, value);
    } catch (error: any) {
        if (error.name === 'QuotaExceededError') {
            console.warn('SessionStorage quota exceeded. Attempting cleanup...');

            // 이전 데이터 정리
            if (clearOldData) {
                // 더 오래된 데이터부터 삭제
                const itemsToClear = ['uploadData', 'groupData'];
                for (const itemKey of itemsToClear) {
                    if (itemKey !== key) {
                        sessionStorage.removeItem(itemKey);
                    }
                }
            }

            // 재시도
            try {
                sessionStorage.setItem(key, value);
                console.log('Successfully stored data after cleanup');
            } catch (retryError) {
                console.error('Failed to store data even after cleanup:', retryError);
                throw new Error('세션 저장소 용량이 초과되었습니다. 브라우저의 세션 데이터를 지워주세요.');
            }
        } else {
            throw error;
        }
    }
};

// 업로드 데이터 관리
export const setUploadData = (data: UploadData) => {
    sessionStorage.setItem('uploadData', JSON.stringify(data));
};

export const getUploadData = (): UploadData | null => {
    const data = sessionStorage.getItem('uploadData');
    return data ? JSON.parse(data) : null;
};

export const clearUploadData = () => {
    sessionStorage.removeItem('uploadData');
};

// 그룹 데이터 관리
export const setGroupData = (data: GroupData) => {
    // keyPoints 배열을 최소화 - 전체 콘텐츠 대신 메타데이터만 저장
    const optimizedData = {
        ...data,
        keyPoints: data.keyPoints?.map(kp => ({
            id: kp.id,
            title: kp.title,
            // content를 일부만 저장하거나 제외
            content: kp.content ? kp.content.substring(0, 500) + '...' : '',
            estimatedDuration: kp.estimatedDuration,
            originalText: kp.originalText ? kp.originalText.substring(0, 200) + '...' : undefined,
            keyPoints: kp.keyPoints?.slice(0, 3), // 최대 3개만
            summary: kp.summary || undefined,
            refinedText: kp.refinedText ? kp.refinedText.substring(0, 500) + '...' : undefined,
            sectionType: kp.sectionType
        }))
    };

    const serialized = JSON.stringify(optimizedData);
    setItemWithErrorHandling('groupData', serialized, true);
};

export const getGroupData = (): GroupData | null => {
    const data = sessionStorage.getItem('groupData');
    return data ? JSON.parse(data) : null;
};

export const clearGroupData = () => {
    sessionStorage.removeItem('groupData');
};

// 스크립트 데이터 관리
export const setScriptData = (data: ScriptData) => {
    // storyboardImages 데이터 최적화 - 이미지 URL만 저장
    const optimizedData = {
        ...data,
        storyboardImages: data.storyboardImages ? {
            ...data.storyboardImages,
            images: data.storyboardImages.images?.map((img: any) => ({
                ...img,
                image: img.image ? {
                    id: img.image.id,
                    url: img.image.url,
                    prompt: img.image.prompt.substring(0, 200) + (img.image.prompt.length > 200 ? '...' : ''),
                    metadata: img.image.metadata
                } : img.image
            }))
        } : undefined
    };

    const serialized = JSON.stringify(optimizedData);
    setItemWithErrorHandling('scriptData', serialized, false);
};

export const getScriptData = (): ScriptData | null => {
    const data = sessionStorage.getItem('scriptData');
    return data ? JSON.parse(data) : null;
};

export const clearScriptData = () => {
    sessionStorage.removeItem('scriptData');
};

// TTS 데이터 관리
export const setTTSData = (data: TTSData) => {
    // audioResult 데이터 최적화 - 전체 오디오 파일 대신 필수 정보만 저장
    const optimizedData = {
        ...data,
        audioResult: data.audioResult?.map((item: any) => ({
            group: {
                id: item.group?.id,
                title: item.group?.title,
                estimatedDuration: item.group?.estimatedDuration
            },
            script: item.script,
            audioUrl: item.audioUrl,
            duration: item.duration,
            // allAudioFiles는 제외하거나 URL만 저장
            allAudioFiles: item.allAudioFiles?.map((file: any) => ({
                filename: file.filename,
                duration: file.duration
            }))
        }))
    };

    const serialized = JSON.stringify(optimizedData);
    setItemWithErrorHandling('ttsData', serialized, false);
};

export const getTTSData = (): TTSData | null => {
    const data = sessionStorage.getItem('ttsData');
    return data ? JSON.parse(data) : null;
};

export const clearTTSData = () => {
    sessionStorage.removeItem('ttsData');
};

// 이미지 데이터 관리
export const setImageData = (data: ImageData) => {
    sessionStorage.setItem('imageData', JSON.stringify(data));
};

export const getImageData = (): ImageData | null => {
    const data = sessionStorage.getItem('imageData');
    return data ? JSON.parse(data) : null;
};

export const clearImageData = () => {
    sessionStorage.removeItem('imageData');
};

// 비디오 데이터 관리
export const setVideoData = (data: VideoData) => {
    sessionStorage.setItem('videoData', JSON.stringify(data));
};

export const getVideoData = (): VideoData | null => {
    const data = sessionStorage.getItem('videoData');
    return data ? JSON.parse(data) : null;
};

export const setFinalVideoUrl = (url: string) => {
    const existing = getVideoData() || { videos: [] };
    const updated = { ...existing, finalVideoUrl: url };
    sessionStorage.setItem('videoData', JSON.stringify(updated));
};

export const clearVideoData = () => {
    sessionStorage.removeItem('videoData');
};

// 전체 세션 클리어
export const clearAllSessionData = () => {
    sessionStorage.clear();
};

// 현재 단계 확인
export const getCurrentStep = (): number => {
    if (getImageData()) return 5;
    if (getTTSData()) return 4;
    if (getScriptData()) return 3;
    if (getGroupData()) return 2;
    if (getUploadData()) return 1;
    return 0;
}; 