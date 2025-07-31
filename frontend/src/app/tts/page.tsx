'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProgressBar from '../../components/ProgressBar';
import { getScriptData, setTTSData, clearScriptData } from '../../utils/sessionStorage';

const TTSPage: React.FC = () => {
    const router = useRouter();
    const [scriptData, setScriptDataState] = useState<any>(null);
    const [scriptResult, setScriptResult] = useState<any[]>([]);
    const [generatingTTS, setGeneratingTTS] = useState(false);
    const [ttsResult, setTTSResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // 세션에서 스크립트 데이터 가져오기
        const data = getScriptData();
        if (!data) {
            setError('스크립트 데이터가 없습니다. 처음부터 다시 시작해주세요.');
            return;
        }

        setScriptDataState(data);
        setScriptResult(data.scriptResult);
    }, []);

    const generateAudio = async () => {
        if (!scriptResult || scriptResult.length === 0) {
            setError('스크립트가 없습니다.');
            return;
        }
        setGeneratingTTS(true);
        setError(null);
        setTTSResult(null);

        try {
            const results = await Promise.all(
                scriptResult.map(async ({ group, script }) => {
                    const filename = `script_${Date.now()}_${group.id}`;

                    const response = await fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/tts/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            script: {
                                hook: script.hook || '',
                                coreMessage: script.coreMessage || '',
                                cta: script.cta || ''
                            },
                            filename: filename,
                            groupInfo: {
                                id: group.id,
                                title: group.title
                            }
                        }),
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
                    }

                    const data = await response.json();
                    console.log('TTS 생성 응답:', data);

                    if (data.success && data.audioFiles && data.audioFiles.length > 0) {
                        // 첫 번째 오디오 파일을 메인으로 사용
                        const mainAudioFile = data.audioFiles[0];
                        return {
                            group,
                            script,
                            audioUrl: `/audio/${mainAudioFile.filename}`,
                            duration: mainAudioFile.duration || group.estimatedDuration,
                            allAudioFiles: data.audioFiles
                        };
                    } else {
                        throw new Error('Invalid response format from TTS API');
                    }
                })
            );
            setTTSResult(results);
        } catch (e: any) {
            console.error('TTS 생성 오류:', e);
            setError('TTS 생성 중 오류 발생: ' + (e?.message || e));
        } finally {
            setGeneratingTTS(false);
        }
    };

    const handleContinue = () => {
        if (!ttsResult || ttsResult.length === 0) {
            setError('TTS를 먼저 생성해주세요.');
            return;
        }

        // 세션에 TTS 데이터 저장 (그룹 정보 포함)
        setTTSData({
            audioResult: ttsResult,
            slideGroups: scriptData.slideGroups || [] // 그룹 정보도 함께 저장
        });

        // 이미지 생성 페이지로 이동
        router.push('/images');
    };

    const handleBack = () => {
        clearScriptData();
        router.push('/script');
    };

    if (error && !scriptData) {
        return (
            <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
                <ProgressBar currentStep={3} />
                <div style={{
                    maxWidth: '1200px',
                    margin: '0 auto',
                    padding: '48px 24px',
                    textAlign: 'center'
                }}>
                    <div style={{
                        padding: '48px',
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}>
                        <div style={{ fontSize: '24px', marginBottom: '16px', color: '#dc2626' }}>❌</div>
                        <div style={{ fontSize: '18px', color: '#dc2626', marginBottom: '24px' }}>{error}</div>
                        <button
                            onClick={handleBack}
                            style={{
                                padding: '12px 24px',
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '16px'
                            }}
                        >
                            스크립트 생성으로 돌아가기
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
            <ProgressBar currentStep={3} />

            <div style={{
                maxWidth: '1200px',
                margin: '0 auto',
                padding: '48px 24px'
            }}>
                <div style={{
                    textAlign: 'center',
                    marginBottom: '48px'
                }}>
                    <h1 style={{
                        fontSize: '32px',
                        fontWeight: 'bold',
                        color: '#111827',
                        marginBottom: '16px'
                    }}>
                        TTS 생성
                    </h1>
                    <p style={{
                        fontSize: '18px',
                        color: '#6b7280'
                    }}>
                        스크립트를 음성으로 변환합니다
                    </p>
                </div>

                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    padding: '32px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    marginBottom: '32px'
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '24px'
                    }}>
                        <h2 style={{
                            fontSize: '24px',
                            fontWeight: '600',
                            color: '#111827'
                        }}>
                            스크립트 ({scriptResult.length}개)
                        </h2>
                        <button
                            onClick={generateAudio}
                            disabled={generatingTTS}
                            style={{
                                padding: '12px 24px',
                                backgroundColor: generatingTTS ? '#d1d5db' : '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: generatingTTS ? 'not-allowed' : 'pointer',
                                fontSize: '16px'
                            }}
                        >
                            {generatingTTS ? 'TTS 생성 중...' : 'TTS 생성'}
                        </button>
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                        gap: '24px'
                    }}>
                        {scriptResult.map(({ group, script }) => (
                            <div
                                key={group.id}
                                style={{
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '12px',
                                    padding: '20px',
                                    backgroundColor: 'white'
                                }}
                            >
                                <h3 style={{
                                    fontSize: '18px',
                                    fontWeight: '600',
                                    color: '#111827',
                                    marginBottom: '8px'
                                }}>
                                    {group.title}
                                </h3>
                                <div style={{
                                    fontSize: '14px',
                                    color: '#6b7280',
                                    marginBottom: '12px'
                                }}>
                                    예상 {group.estimatedDuration}초
                                </div>
                                <div style={{
                                    fontSize: '12px',
                                    color: '#9ca3af',
                                    marginBottom: '8px'
                                }}>
                                    <strong>스타일:</strong> {script.style}
                                </div>
                                <div style={{
                                    fontSize: '12px',
                                    color: '#9ca3af',
                                    marginBottom: '8px'
                                }}>
                                    <strong>톤:</strong> {script.tone}
                                </div>
                                <div style={{
                                    fontSize: '12px',
                                    color: '#9ca3af'
                                }}>
                                    <strong>음성:</strong> Alloy (다국어)
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 생성된 TTS 표시 */}
                {ttsResult && Array.isArray(ttsResult) && ttsResult.length > 0 && (
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        padding: '32px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        marginBottom: '32px'
                    }}>
                        <h2 style={{
                            fontSize: '24px',
                            fontWeight: '600',
                            color: '#111827',
                            marginBottom: '24px'
                        }}>
                            생성된 음성
                        </h2>
                        {ttsResult.map(({ group, script, audioUrl, duration, allAudioFiles }) => (
                            <div key={group.id} style={{
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                padding: '20px',
                                marginBottom: '20px',
                                backgroundColor: '#f9fafb'
                            }}>
                                <div style={{
                                    fontWeight: '600',
                                    marginBottom: '12px',
                                    fontSize: '18px',
                                    color: '#111827'
                                }}>
                                    {group.title} ({duration}초)
                                </div>

                                {/* 각 섹션별 오디오 플레이어 */}
                                {allAudioFiles && allAudioFiles.map((audioFile: any, index: number) => {
                                    const sectionNames = ['Hook', 'Core Message', 'CTA'];
                                    const sectionName = sectionNames[index] || `Section ${index + 1}`;

                                    return (
                                        <div key={audioFile.filename} style={{
                                            marginBottom: '16px',
                                            padding: '12px',
                                            backgroundColor: 'white',
                                            borderRadius: '6px',
                                            border: '1px solid #e5e7eb'
                                        }}>
                                            <div style={{
                                                fontSize: '14px',
                                                fontWeight: '600',
                                                color: '#374151',
                                                marginBottom: '8px'
                                            }}>
                                                {sectionName} ({audioFile.duration}초)
                                            </div>
                                            <audio
                                                controls
                                                style={{
                                                    width: '100%',
                                                    marginBottom: '8px'
                                                }}
                                            >
                                                <source src={`http://localhost:3001/audio/${audioFile.filename}`} type="audio/mpeg" />
                                                브라우저가 오디오를 지원하지 않습니다.
                                            </audio>
                                        </div>
                                    );
                                })}

                                <div style={{
                                    fontSize: '14px',
                                    color: '#6b7280',
                                    marginBottom: '8px',
                                    marginTop: '16px'
                                }}>
                                    <strong>스크립트 미리보기:</strong>
                                </div>
                                <div style={{
                                    backgroundColor: 'white',
                                    padding: '12px',
                                    borderRadius: '4px',
                                    border: '1px solid #e5e7eb',
                                    fontSize: '12px',
                                    color: '#374151',
                                    maxHeight: '100px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}>
                                    {script.hook}... {script.coreMessage}... {script.cta}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {error && (
                    <div style={{
                        marginBottom: '24px',
                        padding: '12px 16px',
                        backgroundColor: '#fef2f2',
                        borderRadius: '8px',
                        color: '#dc2626',
                        textAlign: 'center'
                    }}>
                        {error}
                    </div>
                )}

                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <button
                        onClick={handleBack}
                        style={{
                            padding: '12px 24px',
                            backgroundColor: '#6b7280',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '16px'
                        }}
                    >
                        ← 뒤로가기
                    </button>

                    <button
                        onClick={handleContinue}
                        disabled={!ttsResult || ttsResult.length === 0}
                        style={{
                            padding: '12px 24px',
                            backgroundColor: (!ttsResult || ttsResult.length === 0) ? '#d1d5db' : '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: (!ttsResult || ttsResult.length === 0) ? 'not-allowed' : 'pointer',
                            fontSize: '16px'
                        }}
                    >
                        다음 단계 →
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TTSPage; 