import React, { useRef, useState } from 'react';

const MAX_SIZE = 100 * 1024 * 1024; // 100MB

interface Slide {
    id: number;
    text: string;
    images: string[];
    hasVisuals: boolean;
}

const FileUpload: React.FC = () => {
    const [dragActive, setDragActive] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [warning, setWarning] = useState<string | null>(null);
    const [parsing, setParsing] = useState(false);
    const [parseResult, setParseResult] = useState<{ type: string; slides: Slide[]; warning?: string } | null>(null);
    const [generatingScript, setGeneratingScript] = useState(false);
    const [scriptResult, setScriptResult] = useState<any>(null);
    const [slideGroups, setSlideGroups] = useState<any[]>([]);
    const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
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
            xhr.open('POST', process.env.NEXT_PUBLIC_UPLOAD_URL || 'http://localhost:3001/api/upload', true);
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    setProgress(Math.round((e.loaded / e.total) * 100));
                }
            };
            xhr.onload = async () => {
                if (xhr.status === 200) {
                    setStatus('업로드 성공!');
                    // 업로드 성공 시 파싱 요청
                    try {
                        setParsing(true);
                        const { filename } = JSON.parse(xhr.responseText);
                        console.log('업로드 성공, 파싱 시작. 파일명:', filename);

                        const parseRes = await fetch(process.env.NEXT_PUBLIC_PARSE_URL || 'http://localhost:3001/api/parse', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ filename }),
                        });

                        console.log('파싱 응답 상태:', parseRes.status, parseRes.statusText);
                        console.log('파싱 응답 헤더:', Object.fromEntries(parseRes.headers.entries()));

                        let parseData: any;
                        let responseText = '';
                        try {
                            responseText = await parseRes.text();
                            console.log('파싱 응답 원본 텍스트:', responseText);

                            parseData = JSON.parse(responseText);
                            console.log('파싱 응답 파싱 성공:', parseData);
                        } catch (jsonErr) {
                            // JSON 파싱 실패 시 text로 받아서 에러로 처리
                            console.error('파싱 응답 JSON 파싱 실패:', jsonErr);
                            setError('파싱 응답 파싱 실패: ' + responseText);
                            console.error('파싱 응답 파싱 실패:', responseText, jsonErr);
                            return;
                        }
                        console.log('parseRes.ok && parseData.slides', parseRes.ok, parseData.slides)
                        console.log('전체 parseData 구조:', JSON.stringify(parseData, null, 2));
                        console.log('parseData.type:', parseData.type);
                        console.log('parseData.slides 존재 여부:', !!parseData.slides);
                        console.log('parseData.slides 타입:', typeof parseData.slides);
                        console.log('parseData.slides 길이:', parseData.slides?.length);

                        if (parseRes.ok && parseData.slides) {
                            console.log('파싱 성공, 슬라이드 수:', parseData.slides.length);
                            setParseResult({
                                type: parseData.type,
                                slides: parseData.slides,
                                warning: parseData.warning
                            });

                            // 그룹 정보가 있으면 바로 설정
                            if (parseData.groups && Array.isArray(parseData.groups)) {
                                console.log('그룹 정보 발견:', parseData.groups.length, '개 그룹');
                                setSlideGroups(parseData.groups);
                            }

                            if (parseData.warning) {
                                console.warn('파싱 경고:', parseData.warning);
                                setWarning(parseData.warning);
                            }
                        } else {
                            console.error('파싱 실패 - 응답이 성공이 아니거나 slides가 없음:', parseData);
                            setError('파싱 실패: ' + (parseData.error || JSON.stringify(parseData) || 'Unknown error'));
                            console.error('파싱 실패:', parseData);
                        }
                    } catch (e: any) {
                        console.error('파싱 요청 중 예외 발생:', e);
                        setError('파싱 요청 중 오류 발생: ' + (e?.message || e));
                        console.error('파싱 요청 중 오류 발생:', e);
                    } finally {
                        setParsing(false);
                        console.log('파싱 완료');
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

    const generateScript = async () => {
        if (!parseResult || !parseResult.slides) {
            setError('파싱 결과가 없습니다.');
            return;
        }

        // 선택된 그룹이 있으면 해당 그룹의 슬라이드만 사용
        let slidesToUse = parseResult.slides;
        if (selectedGroup && slideGroups.length > 0) {
            const selectedGroupData = slideGroups.find(g => g.id === selectedGroup);
            if (selectedGroupData) {
                slidesToUse = selectedGroupData.slides;
                console.log('선택된 그룹의 슬라이드 사용:', selectedGroupData.title, slidesToUse.length, '개 슬라이드');
            }
        }

        setGeneratingScript(true);
        setError(null);
        setScriptResult(null);

        try {
            console.log('스크립트 생성 요청 시작');
            const response = await fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/generate-script', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slides: slidesToUse,
                    style: 'educational',
                    tone: 'friendly',
                    targetDuration: 60
                }),
            });

            console.log('스크립트 생성 응답 상태:', response.status);

            const data = await response.json();
            console.log('스크립트 생성 응답:', data);

            if (response.ok && data.success) {
                setScriptResult(data.data);
                console.log('스크립트 생성 성공');
            } else {
                setError('스크립트 생성 실패: ' + (data.error || 'Unknown error'));
                console.error('스크립트 생성 실패:', data);
            }
        } catch (e: any) {
            setError('스크립트 생성 중 오류 발생: ' + (e?.message || e));
            console.error('스크립트 생성 중 오류 발생:', e);
        } finally {
            setGeneratingScript(false);
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
                    <div style={{ marginBottom: 16 }}>
                        <button
                            onClick={generateScript}
                            disabled={generatingScript}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: generatingScript ? '#ccc' : '#1976d2',
                                color: 'white',
                                border: 'none',
                                borderRadius: 4,
                                cursor: generatingScript ? 'not-allowed' : 'pointer',
                                fontSize: 14
                            }}
                        >
                            {generatingScript ? '스크립트 생성 중...' : '전체 스크립트 생성'}
                        </button>
                    </div>

                    {/* 쇼츠 그룹 썸네일 */}
                    {slideGroups.length > 0 && (
                        <div style={{ marginBottom: 24 }}>
                            <h4>쇼츠 그룹 선택 ({slideGroups.length}개)</h4>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                                gap: 16,
                                marginBottom: 16
                            }}>
                                {slideGroups.map((group) => (
                                    <div
                                        key={group.id}
                                        onClick={() => setSelectedGroup(selectedGroup === group.id ? null : group.id)}
                                        style={{
                                            border: selectedGroup === group.id ? '2px solid #1976d2' : '1px solid #ddd',
                                            borderRadius: 8,
                                            padding: 12,
                                            cursor: 'pointer',
                                            backgroundColor: selectedGroup === group.id ? '#f0f8ff' : 'white',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <div style={{ marginBottom: 8 }}>
                                            <strong>{group.title}</strong>
                                        </div>
                                        <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                                            {group.slides.length}개 슬라이드 • {group.estimatedDuration}초
                                        </div>
                                        {group.thumbnail && (
                                            <img
                                                src={`http://localhost:3001${group.thumbnail}`}
                                                alt={group.title}
                                                style={{
                                                    width: '100%',
                                                    height: 120,
                                                    objectFit: 'cover',
                                                    borderRadius: 4,
                                                    border: '1px solid #eee'
                                                }}
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                }}
                                            />
                                        )}
                                        {selectedGroup === group.id && (
                                            <div style={{
                                                marginTop: 8,
                                                padding: 8,
                                                backgroundColor: '#e3f2fd',
                                                borderRadius: 4,
                                                fontSize: 12,
                                                color: '#1976d2'
                                            }}>
                                                ✓ 선택됨
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {selectedGroup && (
                                <button
                                    onClick={generateScript}
                                    disabled={generatingScript}
                                    style={{
                                        padding: '8px 16px',
                                        backgroundColor: generatingScript ? '#ccc' : '#ff9800',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: 4,
                                        cursor: generatingScript ? 'not-allowed' : 'pointer',
                                        fontSize: 14
                                    }}
                                >
                                    {generatingScript ? '스크립트 생성 중...' : '선택된 그룹 스크립트 생성'}
                                </button>
                            )}
                        </div>
                    )}

                    {/* 기존 파싱 결과 표시 */}
                    {parseResult.slides.map((slide) => (
                        <div key={slide.id} style={{ border: '1px solid #eee', borderRadius: 8, marginBottom: 16, padding: 12 }}>
                            <div style={{ fontWeight: 600, marginBottom: 8 }}>
                                {parseResult.type === 'pdf' ? '페이지' : '슬라이드'} {slide.id}
                                {slide.hasVisuals && (
                                    <span style={{ marginLeft: 8, fontSize: 12, color: '#666' }}>
                                        (시각적 요소 포함)
                                    </span>
                                )}
                            </div>
                            {slide.text && slide.text.trim() !== '' ? (
                                <div style={{ marginBottom: 8 }}>
                                    <strong>텍스트:</strong>
                                    <p style={{ margin: '4px 0', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{slide.text}</p>
                                </div>
                            ) : (
                                <div style={{ marginBottom: 8, color: '#666', fontStyle: 'italic' }}>
                                    텍스트 내용이 없습니다.
                                </div>
                            )}
                            {slide.images && slide.images.length > 0 && (
                                <div style={{ marginTop: 8 }}>
                                    <strong>이미지 ({slide.images.length}개):</strong>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                                        {slide.images.map((imageUrl, imageIndex) => (
                                            <img
                                                key={imageIndex}
                                                src={`http://localhost:3001${imageUrl}`}
                                                alt={`slide${slide.id}-img${imageIndex + 1}`}
                                                style={{
                                                    maxWidth: 200,
                                                    maxHeight: 150,
                                                    border: '1px solid #ddd',
                                                    borderRadius: 4
                                                }}
                                                onError={(e) => {
                                                    console.error('이미지 로드 실패:', imageUrl);
                                                    e.currentTarget.style.display = 'none';
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    {parseResult.slides.length === 0 && (
                        <div style={{ textAlign: 'center', color: '#666', fontStyle: 'italic', padding: 20 }}>
                            파싱된 내용이 없습니다.
                        </div>
                    )}
                </div>
            )}
            {scriptResult && (
                <div style={{ marginTop: 32 }}>
                    <h3>생성된 스크립트</h3>
                    <div style={{
                        border: '1px solid #ddd',
                        borderRadius: 8,
                        padding: 16,
                        backgroundColor: '#f9f9f9',
                        marginBottom: 16
                    }}>
                        <div style={{ marginBottom: 8 }}>
                            <strong>예상 지속 시간:</strong> {scriptResult.estimatedDuration}초
                        </div>
                        <div style={{ marginBottom: 8 }}>
                            <strong>스타일:</strong> {scriptResult.style}
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <strong>톤:</strong> {scriptResult.tone}
                        </div>
                        <div>
                            <strong>스크립트:</strong>
                            <div style={{
                                marginTop: 8,
                                whiteSpace: 'pre-wrap',
                                lineHeight: '1.6',
                                backgroundColor: 'white',
                                padding: 12,
                                borderRadius: 4,
                                border: '1px solid #eee'
                            }}>
                                {scriptResult.script}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {status && <div style={{ color: 'green', marginTop: 16 }}>{status}</div>}
            {error && <div style={{ color: 'red', marginTop: 16 }}>{error}</div>}
            {warning && <div style={{ color: 'orange', marginTop: 16 }}>{warning}</div>}
        </div>
    );
};

export default FileUpload; 