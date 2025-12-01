import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL, UPLOAD_URL, PARSE_URL, GENERATE_FROM_TEXT_URL } from '../config/env';
import { setUploadData } from '../utils/sessionStorage';

const MAX_SIZE = 100 * 1024 * 1024; // 100MB

interface Slide {
    id: number;
    text: string;
    images: string[];
    hasVisuals: boolean;
    visualMetadata?: {
        textLength: number;
        imageCount: number;
        slideType: 'text-heavy' | 'image-heavy' | 'balanced' | 'minimal';
    };
}

interface VisualAnalysisResult {
    hasSufficientVisuals: boolean;
    needsAdditionalVisuals: boolean;
    visualScore: number;
    recommendedImagePrompt?: string;
    slideType: 'text-heavy' | 'image-heavy' | 'balanced' | 'minimal';
}

const FileUpload: React.FC = () => {
    const router = useRouter();
    const [inputMode, setInputMode] = useState<'file' | 'text'>('file');
    const [textInput, setTextInput] = useState('');
    const [dragActive, setDragActive] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [warning, setWarning] = useState<string | null>(null);
    const [parsing, setParsing] = useState(false);
    const [parseResult, setParseResult] = useState<{ type: string; warning?: string } | null>(null);
    const [slides, setSlides] = useState<Slide[]>([]);
    const [visualAnalysisResults, setVisualAnalysisResults] = useState<VisualAnalysisResult[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const validateFile = (file: File) => {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext !== 'pptx' && ext !== 'pdf') {
            return 'PPTX 또는 PDF 파일만 업로드할 수 있습니다.';
        }
        if (file.size > MAX_SIZE) {
            return '100MB 이하의 파일만 업로드할 수 있습니다.';
        }
        return null;
    };

    const handleText = async () => {
        setError(null);
        setStatus(null);
        setWarning(null);
        setParseResult(null);

        if (!textInput || textInput.trim().length === 0) {
            setError('텍스트를 입력해주세요.');
            return;
        }

        if (textInput.trim().length < 100) {
            setError('최소 100자 이상 입력해주세요.');
            return;
        }

        try {
            setParsing(true);
            setStatus('텍스트 처리 중...');

            // generate-from-text API 호출
            const parseRes = await fetch(GENERATE_FROM_TEXT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: textInput }),
            });

            const parseData = await parseRes.json();

            // 파싱 성공 여부는 filename/type으로만 판단
            if (parseRes.ok && parseData.filename && parseData.type) {
                // 슬라이드 데이터 추출
                if (parseData.slides && Array.isArray(parseData.slides)) {
                    setSlides(parseData.slides);
                }

                // 시각적 분석 요청 (최적화된 데이터만 전송)
                let analysisResults: any[] = [];
                try {
                    const slidesForAnalysis = parseData.slides.map((slide: any) => ({
                        id: slide.id,
                        text: slide.text,
                        images: slide.images,
                        visualMetadata: slide.visualMetadata
                    }));

                    const analysisRes = await fetch(API_URL + '/api/analyze-slides', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ slides: slidesForAnalysis }),
                    });
                    const analysisData = await analysisRes.json();
                    if (analysisRes.ok && analysisData.data?.analysis) {
                        analysisResults = analysisData.data.analysis;
                        setVisualAnalysisResults(analysisResults);
                    }
                } catch (analysisError) {
                    console.warn('시각적 분석 실패:', analysisError);
                }

                // 세션 스토리지에 업로드 데이터 저장
                setParseResult({ type: parseData.type, warning: parseData.warning });
                setUploadData({
                    filename: parseData.filename,
                    slides: parseData.slides,
                    parseResult: { type: parseData.type, warning: parseData.warning },
                    visualAnalysisResults: analysisResults,
                    coreMessages: []
                });

                // 그룹 페이지로 이동
                router.push('/groups');
            } else {
                setError('텍스트 처리 실패: ' + (parseData.error || JSON.stringify(parseData) || 'Unknown error'));
            }
        } catch (e: any) {
            setError('텍스트 처리 중 오류 발생: ' + (e?.message || e));
        } finally {
            setParsing(false);
        }
    };

    const handleFile = async (file: File) => {
        setError(null);
        setStatus(null);
        setWarning(null);
        setProgress(0);
        setParseResult(null);
        const err = validateFile(file);
        if (err) {
            setError(err);
            return;
        }
        const formData = new FormData();
        formData.append('file', file);
        try {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', UPLOAD_URL, true);
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    setProgress(Math.round((e.loaded / e.total) * 100));
                }
            };
            xhr.onload = async () => {
                if (xhr.status === 200) {
                    setStatus('업로드 성공!');
                    try {
                        setParsing(true);
                        const { filename } = JSON.parse(xhr.responseText);

                        // 1. 파싱 요청
                        const parseRes = await fetch(PARSE_URL, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ filename }),
                        });
                        const parseData = await parseRes.json();

                        // 2. 파싱 성공 여부는 filename/type으로만 판단
                        if (parseRes.ok && parseData.filename && parseData.type) {
                            // 3. 슬라이드 데이터 추출 (파싱 결과에서)
                            if (parseData.slides && Array.isArray(parseData.slides)) {
                                setSlides(parseData.slides);
                            }

                            // 4. 시각적 분석 요청 (최적화된 데이터만 전송)
                            let analysisResults: any[] = [];
                            try {
                                // 분석에 필요한 최소한의 데이터만 전송
                                const slidesForAnalysis = parseData.slides.map((slide: any) => ({
                                    id: slide.id,
                                    text: slide.text,
                                    images: slide.images,
                                    visualMetadata: slide.visualMetadata
                                }));

                                const analysisRes = await fetch(API_URL + '/api/analyze-slides', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ slides: slidesForAnalysis }),
                                });
                                const analysisData = await analysisRes.json();
                                if (analysisRes.ok && analysisData.data?.analysis) {
                                    analysisResults = analysisData.data.analysis;
                                    setVisualAnalysisResults(analysisResults);
                                }
                            } catch (analysisError) {
                                console.warn('시각적 분석 실패:', analysisError);
                                // 분석 실패해도 계속 진행
                            }

                            // 5. 세션 스토리지에 업로드 데이터 저장
                            setParseResult({ type: parseData.type, warning: parseData.warning });
                            setUploadData({
                                filename: parseData.filename,
                                slides: parseData.slides,
                                parseResult: { type: parseData.type, warning: parseData.warning },
                                visualAnalysisResults: analysisResults,
                                coreMessages: []
                            });

                            // 그룹 페이지로 이동
                            router.push('/groups');
                        } else {
                            setError('파싱 실패: ' + (parseData.error || JSON.stringify(parseData) || 'Unknown error'));
                        }
                    } catch (e: any) {
                        setError('파싱 요청 중 오류 발생: ' + (e?.message || e));
                    } finally {
                        setParsing(false);
                    }
                } else {
                    setError('업로드 실패: ' + xhr.responseText);
                }
            };
            xhr.onerror = () => {
                setError('네트워크 오류로 업로드 실패');
            };
            xhr.send(formData);
        } catch (e) {
            setError('업로드 중 오류 발생');
        }
    };

    const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    };

    return (
        <div>
            {/* 탭 전환 버튼 */}
            <div style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '24px',
                borderBottom: '1px solid #e5e7eb'
            }}>
                <button
                    onClick={() => setInputMode('text')}
                    style={{
                        padding: '12px 24px',
                        border: 'none',
                        borderBottom: inputMode === 'text' ? '2px solid #1976d2' : 'none',
                        background: 'transparent',
                        color: inputMode === 'text' ? '#1976d2' : '#6b7280',
                        fontWeight: inputMode === 'text' ? 600 : 400,
                        cursor: 'pointer',
                        fontSize: '16px'
                    }}
                >
                    텍스트 입력
                </button>
                <button
                    onClick={() => setInputMode('file')}
                    style={{
                        padding: '12px 24px',
                        border: 'none',
                        borderBottom: inputMode === 'file' ? '2px solid #1976d2' : 'none',
                        background: 'transparent',
                        color: inputMode === 'file' ? '#1976d2' : '#6b7280',
                        fontWeight: inputMode === 'file' ? 600 : 400,
                        cursor: 'pointer',
                        fontSize: '16px'
                    }}
                >
                    파일 업로드
                </button>
            </div>

            {/* 텍스트 입력 모드 */}
            {inputMode === 'text' && (
                <div>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            fontWeight: 500,
                            color: '#374151'
                        }}>
                            콘텐츠 텍스트 입력
                        </label>
                        <textarea
                            ref={textareaRef}
                            value={textInput}
                            onChange={(e) => setTextInput(e.target.value)}
                            placeholder="여기에 비디오로 만들고 싶은 콘텐츠를 입력하세요. 최소 100자 이상 입력해주세요."
                            style={{
                                width: '100%',
                                minHeight: '300px',
                                padding: '12px',
                                border: '1px solid #d1d5db',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontFamily: 'inherit',
                                resize: 'vertical'
                            }}
                        />
                        <div style={{
                            marginTop: '4px',
                            fontSize: '12px',
                            color: textInput.trim().length < 100 ? '#ef4444' : '#6b7280'
                        }}>
                            {textInput.trim().length}자 {textInput.trim().length < 100 && '(최소 100자 필요)'}
                        </div>
                    </div>

                    <button
                        onClick={handleText}
                        disabled={parsing || textInput.trim().length < 100}
                        style={{
                            width: '100%',
                            padding: '12px 24px',
                            background: (parsing || textInput.trim().length < 100) ? '#d1d5db' : '#1976d2',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '16px',
                            fontWeight: 500,
                            cursor: (parsing || textInput.trim().length < 100) ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {parsing ? '처리 중...' : '시작하기'}
                    </button>

                    {error && (
                        <div style={{
                            marginTop: '16px',
                            padding: '12px',
                            background: '#fee2e2',
                            color: '#dc2626',
                            borderRadius: '8px',
                            fontSize: '14px'
                        }}>
                            {error}
                        </div>
                    )}

                    {status && (
                        <div style={{
                            marginTop: '16px',
                            padding: '12px',
                            background: '#dcfce7',
                            color: '#16a34a',
                            borderRadius: '8px',
                            fontSize: '14px'
                        }}>
                            {status}
                        </div>
                    )}
                </div>
            )}

            {/* 파일 업로드 모드 */}
            {inputMode === 'file' && (
                <>
                    <div
                        onDragOver={e => { e.preventDefault(); setDragActive(true); }}
                        onDragLeave={e => { e.preventDefault(); setDragActive(false); }}
                        onDrop={onDrop}
                        style={{
                            border: dragActive ? '2px solid #1976d2' : '2px dashed #aaa',
                            borderRadius: 8,
                            padding: 32,
                            textAlign: 'center',
                            background: dragActive ? '#e3f2fd' : '#fafafa',
                            cursor: 'pointer',
                        }}
                        onClick={() => inputRef.current?.click()}
                    >
                        <input
                            type="file"
                            accept=".pptx,.pdf"
                            style={{ display: 'none' }}
                            ref={inputRef}
                            onChange={onChange}
                        />
                        <p style={{ margin: 0, fontWeight: 500 }}>
                            {dragActive ? '여기에 파일을 놓으세요!' : '여기를 클릭하거나 드래그하여 PPTX, PDF 파일을 업로드하세요 (최대 100MB)'}
                        </p>
                    </div>
                    {progress > 0 && progress < 100 && (
                        <div style={{ marginTop: 16 }}>
                            <div style={{ width: '100%', background: '#eee', borderRadius: 4 }}>
                                <div style={{ width: `${progress}%`, background: '#1976d2', height: 8, borderRadius: 4 }} />
                            </div>
                            <div style={{ textAlign: 'right', fontSize: 12 }}>{progress}%</div>
                        </div>
                    )}
                    {error && (
                        <div style={{
                            marginTop: '16px',
                            padding: '12px',
                            background: '#fee2e2',
                            color: '#dc2626',
                            borderRadius: '8px',
                            fontSize: '14px'
                        }}>
                            {error}
                        </div>
                    )}
                    {status && (
                        <div style={{
                            marginTop: '16px',
                            padding: '12px',
                            background: '#dcfce7',
                            color: '#16a34a',
                            borderRadius: '8px',
                            fontSize: '14px'
                        }}>
                            {status}
                        </div>
                    )}
                    {warning && (
                        <div style={{
                            marginTop: '16px',
                            padding: '12px',
                            background: '#fef3c7',
                            color: '#d97706',
                            borderRadius: '8px',
                            fontSize: '14px'
                        }}>
                            {warning}
                        </div>
                    )}
                </>
            )}

            {parsing && (
                <div style={{
                    marginTop: 16,
                    padding: '12px',
                    background: '#f3f4f6',
                    borderRadius: '8px',
                    textAlign: 'center',
                    fontSize: '14px',
                    color: '#374151'
                }}>
                    {parseResult ? '파싱 완료!' : '처리 중...'}
                </div>
            )}
        </div>
    );
};

export default FileUpload;
