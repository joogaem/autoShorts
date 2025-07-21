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
    const [parseResult, setParseResult] = useState<{ type: string; warning?: string } | null>(null);
    const [generatingScript, setGeneratingScript] = useState(false);
    const [scriptResult, setScriptResult] = useState<any>(null);
    const [slideGroups, setSlideGroups] = useState<any[]>([]);
    // 1. 상태: selectedGroups (배열)
    const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
    const [generatingAudio, setGeneratingAudio] = useState(false);
    const [audioResult, setAudioResult] = useState<any>(null);
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
                    try {
                        setParsing(true);
                        const { filename } = JSON.parse(xhr.responseText);

                        // 1. 파싱 요청
                        const parseRes = await fetch(process.env.NEXT_PUBLIC_PARSE_URL || 'http://localhost:3001/api/parse', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ filename }),
                        });
                        const parseData = await parseRes.json();

                        // 2. 파싱 성공 여부는 filename/type으로만 판단
                        if (parseRes.ok && parseData.filename && parseData.type) {
                            // 3. 그룹핑 요청 (filename만 전달)
                            const groupRes = await fetch(process.env.NEXT_PUBLIC_GROUP_URL || 'http://localhost:3001/api/group-slides', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ filename: parseData.filename }),
                            });
                            const groupData = await groupRes.json();
                            if (groupRes.ok && groupData.data && Array.isArray(groupData.data.groups)) {
                                setSlideGroups(groupData.data.groups);
                                setParseResult({ type: parseData.type, warning: parseData.warning });
                            } else {
                                setError('그룹핑 실패: ' + (groupData.error || 'Unknown error'));
                            }
                        } else {
                            setError('파싱 실패: ' + (parseData.error || JSON.stringify(parseData) || 'Unknown error'));
                        }
                    } catch (e: any) {
                        setError('파싱/그룹핑 요청 중 오류 발생: ' + (e?.message || e));
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

    // 그룹 선택 핸들러
    const handleGroupSelect = (groupId: string) => {
        setSelectedGroups(prev =>
            prev.includes(groupId)
                ? prev.filter(id => id !== groupId)
                : [...prev, groupId]
        );
    };

    // 스크립트 생성 함수 (여러 그룹)
    const generateScriptsForSelectedGroups = async () => {
        if (!slideGroups.length || selectedGroups.length === 0) {
            setError('선택된 그룹이 없습니다.');
            return;
        }
        setGeneratingScript(true);
        setError(null);
        setScriptResult(null);
        try {
            const selected = slideGroups.filter(g => selectedGroups.includes(g.id));
            const results = await Promise.all(
                selected.map(async group => {
                    const response = await fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/generate-script', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ slides: group.slides, style: 'educational', tone: 'friendly', targetDuration: group.estimatedDuration }),
                    });
                    const data = await response.json();
                    return { group, script: data.data };
                })
            );
            setScriptResult(results);
        } catch (e: any) {
            setError('스크립트 생성 중 오류 발생: ' + (e?.message || e));
        } finally {
            setGeneratingScript(false);
        }
    };

    const generateAudio = async () => {
        if (!scriptResult) {
            setError('스크립트가 없습니다.');
            return;
        }

        setGeneratingAudio(true);
        setError(null);
        setAudioResult(null);

        try {
            console.log('TTS 요청 시작');
            const filename = `script_${Date.now()}`;

            const response = await fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/tts/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    script: {
                        hook: scriptResult.hook || '',
                        coreMessage: scriptResult.coreMessage || scriptResult.script,
                        cta: scriptResult.cta || ''
                    },
                    filename: filename,
                    groupInfo: selectedGroups.length === 1 ? {
                        id: selectedGroups[0],
                        title: slideGroups.find(g => g.id === selectedGroups[0])?.title
                    } : null
                }),
            });

            console.log('TTS 응답 상태:', response.status);

            const data = await response.json();
            console.log('TTS 응답:', data);

            if (response.ok && data.success) {
                setAudioResult(data);
                console.log('TTS 성공:', data.message);
            } else {
                setError('TTS 실패: ' + (data.error || 'Unknown error'));
                console.error('TTS 실패:', data);
            }
        } catch (e: any) {
            setError('TTS 중 오류 발생: ' + (e?.message || e));
            console.error('TTS 중 오류 발생:', e);
        } finally {
            setGeneratingAudio(false);
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
                            onClick={generateScriptsForSelectedGroups}
                            disabled={generatingScript || selectedGroups.length === 0}
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
                                        style={{
                                            border: selectedGroups.includes(group.id) ? '2px solid #1976d2' : '1px solid #ddd',
                                            borderRadius: 8,
                                            padding: 12,
                                            cursor: 'pointer',
                                            backgroundColor: selectedGroups.includes(group.id) ? '#f0f8ff' : 'white',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedGroups.includes(group.id)}
                                                onChange={() => handleGroupSelect(group.id)}
                                                style={{ marginRight: 8 }}
                                            />
                                            <strong>{group.title}</strong>
                                        </label>
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
                                    </div>
                                ))}
                            </div>
                            {selectedGroups.length > 0 && (
                                <button
                                    onClick={generateScriptsForSelectedGroups}
                                    disabled={generatingScript || selectedGroups.length === 0}
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
                    {/* 1. slides(페이지별) 표시 UI 완전 제거 */}
                    {/* 2. 그룹 리스트 UI를 체크박스 다중 선택으로 변경 */}
                    {/* 3. 선택된 그룹만 대상으로 스크립트 생성 버튼 및 결과 표시 */}
                    {scriptResult && Array.isArray(scriptResult) && scriptResult.length > 0 && (
                        <div style={{ marginTop: 32 }}>
                            <h3>생성된 스크립트</h3>
                            {scriptResult.map(({ group, script }, idx) => (
                                <div key={group.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, backgroundColor: '#f9f9f9', marginBottom: 24 }}>
                                    <div style={{ fontWeight: 600, marginBottom: 8 }}>{group.title} (예상 {group.estimatedDuration}초)</div>
                                    <div style={{ marginBottom: 8 }}><strong>스타일:</strong> {script.style}</div>
                                    <div style={{ marginBottom: 8 }}><strong>톤:</strong> {script.tone}</div>
                                    <div style={{ marginBottom: 16 }}><strong>스크립트:</strong></div>
                                    {script.hook && (
                                        <div style={{ marginBottom: 12 }}>
                                            <div style={{ fontWeight: 'bold', color: '#1976d2', marginBottom: 4 }}>🎯 Hook (도입부)</div>
                                            <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', backgroundColor: 'white', padding: 8, borderRadius: 4, border: '1px solid #e3f2fd', fontSize: 14 }}>{script.hook}</div>
                                        </div>
                                    )}
                                    {script.coreMessage && (
                                        <div style={{ marginBottom: 12 }}>
                                            <div style={{ fontWeight: 'bold', color: '#2e7d32', marginBottom: 4 }}>💡 Core Message (핵심 내용)</div>
                                            <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', backgroundColor: 'white', padding: 8, borderRadius: 4, border: '1px solid #c8e6c9', fontSize: 14 }}>{script.coreMessage}</div>
                                        </div>
                                    )}
                                    {script.cta && (
                                        <div style={{ marginBottom: 12 }}>
                                            <div style={{ fontWeight: 'bold', color: '#f57c00', marginBottom: 4 }}>📢 CTA (행동 유도)</div>
                                            <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', backgroundColor: 'white', padding: 8, borderRadius: 4, border: '1px solid #ffe0b2', fontSize: 14 }}>{script.cta}</div>
                                        </div>
                                    )}
                                </div>
                            ))}
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
                                    <div style={{ marginTop: 8 }}>
                                        {scriptResult.hook && (
                                            <div style={{ marginBottom: 12 }}>
                                                <div style={{ fontWeight: 'bold', color: '#1976d2', marginBottom: 4 }}>
                                                    🎯 Hook (도입부)
                                                </div>
                                                <div style={{
                                                    whiteSpace: 'pre-wrap',
                                                    lineHeight: '1.6',
                                                    backgroundColor: 'white',
                                                    padding: 8,
                                                    borderRadius: 4,
                                                    border: '1px solid #e3f2fd',
                                                    fontSize: 14
                                                }}>
                                                    {scriptResult.hook}
                                                </div>
                                            </div>
                                        )}
                                        {scriptResult.coreMessage && (
                                            <div style={{ marginBottom: 12 }}>
                                                <div style={{ fontWeight: 'bold', color: '#2e7d32', marginBottom: 4 }}>
                                                    💡 Core Message (핵심 내용)
                                                </div>
                                                <div style={{
                                                    whiteSpace: 'pre-wrap',
                                                    lineHeight: '1.6',
                                                    backgroundColor: 'white',
                                                    padding: 8,
                                                    borderRadius: 4,
                                                    border: '1px solid #e8f5e8',
                                                    fontSize: 14
                                                }}>
                                                    {scriptResult.coreMessage}
                                                </div>
                                            </div>
                                        )}
                                        {scriptResult.cta && (
                                            <div style={{ marginBottom: 12 }}>
                                                <div style={{ fontWeight: 'bold', color: '#f57c00', marginBottom: 4 }}>
                                                    🎬 CTA (행동 유도)
                                                </div>
                                                <div style={{
                                                    whiteSpace: 'pre-wrap',
                                                    lineHeight: '1.6',
                                                    backgroundColor: 'white',
                                                    padding: 8,
                                                    borderRadius: 4,
                                                    border: '1px solid #fff3e0',
                                                    fontSize: 14
                                                }}>
                                                    {scriptResult.cta}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div style={{ marginTop: 16 }}>
                                    {selectedGroups.length === 1 && (
                                        <div style={{
                                            marginBottom: 8,
                                            padding: 8,
                                            backgroundColor: '#fff3cd',
                                            borderRadius: 4,
                                            fontSize: 12,
                                            color: '#856404',
                                            border: '1px solid #ffeaa7'
                                        }}>
                                            📋 선택된 그룹: {slideGroups.find(g => g.id === selectedGroups[0])?.title}
                                        </div>
                                    )}
                                    <button
                                        onClick={generateAudio}
                                        disabled={generatingAudio}
                                        style={{
                                            padding: '8px 16px',
                                            backgroundColor: generatingAudio ? '#ccc' : '#4caf50',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 4,
                                            cursor: generatingAudio ? 'not-allowed' : 'pointer',
                                            fontSize: 14
                                        }}
                                    >
                                        {generatingAudio ? '음성 생성 중...' : `🎤 ${selectedGroups.length === 1 ? '선택된 그룹' : '전체'} 음성으로 변환`}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    {scriptResult && (
                        <div style={{ marginTop: 32 }}>
                            <h3>API 결과(raw)</h3>
                            <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, fontSize: 13, overflowX: 'auto' }}>
                                {JSON.stringify(scriptResult, null, 2)}
                            </pre>
                        </div>
                    )}
                    {audioResult && (
                        <div style={{ marginTop: 32 }}>
                            <h3>
                                생성된 음성 파일
                                {selectedGroups.length === 1 && (
                                    <span style={{
                                        fontSize: 14,
                                        color: '#666',
                                        fontWeight: 'normal',
                                        marginLeft: 8
                                    }}>
                                        ({slideGroups.find(g => g.id === selectedGroups[0])?.title})
                                    </span>
                                )}
                            </h3>
                            <div style={{
                                border: '1px solid #ddd',
                                borderRadius: 8,
                                padding: 16,
                                backgroundColor: '#f0f8f0',
                                marginBottom: 16
                            }}>
                                <div style={{ marginBottom: 8, color: '#2e7d32', fontWeight: 'bold' }}>
                                    ✅ {audioResult.message}
                                </div>
                                <div style={{ marginBottom: 16 }}>
                                    <strong>음성 파일 ({audioResult.audioFiles.length}개):</strong>
                                </div>
                                {audioResult.audioFiles.map((audioFile: any, index: number) => (
                                    <div key={index} style={{
                                        border: '1px solid #ddd',
                                        borderRadius: 4,
                                        padding: 12,
                                        marginBottom: 8,
                                        backgroundColor: 'white'
                                    }}>
                                        <div style={{ marginBottom: 8 }}>
                                            <strong>{audioFile.filename}</strong>
                                        </div>
                                        <div style={{ marginBottom: 8, fontSize: 12, color: '#666' }}>
                                            재생 시간: {audioFile.duration}초 • 크기: {(audioFile.size / 1024 / 1024).toFixed(2)}MB
                                        </div>
                                        <audio controls style={{ width: '100%' }}>
                                            <source src={`http://localhost:3001/audio/${audioFile.filename}`} type="audio/mpeg" />
                                            브라우저가 오디오를 지원하지 않습니다.
                                        </audio>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {status && <div style={{ color: 'green', marginTop: 16 }}>{status}</div>}
                    {error && <div style={{ color: 'red', marginTop: 16 }}>{error}</div>}
                    {warning && <div style={{ color: 'orange', marginTop: 16 }}>{warning}</div>}
                </div>
            )}
        </div>
    );
};

export default FileUpload; 