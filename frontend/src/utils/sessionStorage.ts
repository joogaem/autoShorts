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
    sessionStorage.setItem('groupData', JSON.stringify(data));
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
    sessionStorage.setItem('scriptData', JSON.stringify(data));
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
    sessionStorage.setItem('ttsData', JSON.stringify(data));
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