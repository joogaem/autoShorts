import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL, UPLOAD_URL, PARSE_URL } from '../config/env';
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
            {parsing && <div style={{ marginTop: 16 }}>파싱 중...</div>}
            {parseResult && (
                <div style={{ marginTop: 32 }}>
                    <h3>파싱 결과 ({parseResult.type.toUpperCase()})</h3>
                    <div style={{ marginTop: 16, padding: 16, backgroundColor: '#f0f8f0', borderRadius: 8, textAlign: 'center' }}>
                        <div style={{ fontSize: 18, color: '#2e7d32', marginBottom: 8 }}>✅ 파일 파싱 완료!</div>
                        <div style={{ color: '#666' }}>
                            다듬어진 5개 섹션이 준비되었습니다. 다음 단계로 진행하세요.
                        </div>
                    </div>
                    {status && <div style={{ color: 'green', marginTop: 16 }}>{status}</div>}
                    {error && <div style={{ color: 'red', marginTop: 16 }}>{error}</div>}
                    {warning && <div style={{ color: 'orange', marginTop: 16 }}>{warning}</div>}
                </div>
            )}
        </div>
    );
};

export default FileUpload;
