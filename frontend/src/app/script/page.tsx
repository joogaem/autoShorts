'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProgressBar from '../../components/ProgressBar';
import { getGroupData, setScriptData, clearGroupData } from '../../utils/sessionStorage';

const ScriptPage: React.FC = () => {
    const router = useRouter();
    const [groupData, setGroupDataState] = useState<any>(null);
    const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
    const [slideGroups, setSlideGroups] = useState<any[]>([]);
    const [generatingScript, setGeneratingScript] = useState(false);
    const [scriptResult, setScriptResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // 세션에서 그룹 데이터 가져오기
        const data = getGroupData();
        if (!data) {
            setError('그룹 데이터가 없습니다. 처음부터 다시 시작해주세요.');
            return;
        }

        setGroupDataState(data);
        setSelectedGroups(data.selectedGroups);
        setSlideGroups(data.slideGroups);
    }, []);

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
                        body: JSON.stringify({
                            slides: group.slides,
                            style: 'educational',
                            tone: 'friendly',
                            targetDuration: group.estimatedDuration
                        }),
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
                    }

                    const data = await response.json();
                    console.log('스크립트 생성 응답:', data);

                    // 백엔드에서 반환하는 구조: { success: true, data: [groupScripts] }
                    if (data.success && data.data && Array.isArray(data.data)) {
                        // 단일 스크립트 결과 (첫 번째 요소)
                        const scriptResult = data.data[0];
                        if (scriptResult && scriptResult.script) {
                            return { group, script: scriptResult.script };
                        } else {
                            throw new Error('No script found in response');
                        }
                    } else {
                        throw new Error('Invalid response format from generate-script API');
                    }
                })
            );
            setScriptResult(results);
        } catch (e: any) {
            console.error('스크립트 생성 오류:', e);
            setError('스크립트 생성 중 오류 발생: ' + (e?.message || e));
        } finally {
            setGeneratingScript(false);
        }
    };

    const handleContinue = () => {
        if (!scriptResult || scriptResult.length === 0) {
            setError('스크립트를 먼저 생성해주세요.');
            return;
        }

        // 세션에 스크립트 데이터 저장
        setScriptData({
            scriptResult
        });

        // TTS 생성 페이지로 이동
        router.push('/tts');
    };

    const handleBack = () => {
        clearGroupData();
        router.push('/groups');
    };

    if (error && !groupData) {
        return (
            <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
                <ProgressBar currentStep={2} />
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
                            그룹 선택으로 돌아가기
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
            <ProgressBar currentStep={2} />

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
                        스크립트 생성
                    </h1>
                    <p style={{
                        fontSize: '18px',
                        color: '#6b7280'
                    }}>
                        선택된 그룹에 대한 스크립트를 생성합니다
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
                            선택된 그룹 ({selectedGroups.length}개)
                        </h2>
                        <button
                            onClick={generateScriptsForSelectedGroups}
                            disabled={generatingScript}
                            style={{
                                padding: '12px 24px',
                                backgroundColor: generatingScript ? '#d1d5db' : '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: generatingScript ? 'not-allowed' : 'pointer',
                                fontSize: '16px'
                            }}
                        >
                            {generatingScript ? '스크립트 생성 중...' : '스크립트 생성'}
                        </button>
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                        gap: '24px'
                    }}>
                        {slideGroups
                            .filter(group => selectedGroups.includes(group.id))
                            .map((group) => (
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
                                        {group.slides.length}개 슬라이드 • 예상 {group.estimatedDuration}초
                                    </div>
                                    {group.thumbnail && (
                                        <img
                                            src={`http://localhost:3001${group.thumbnail}`}
                                            alt={group.title}
                                            style={{
                                                width: '100%',
                                                height: '120px',
                                                objectFit: 'cover',
                                                borderRadius: '8px',
                                                border: '1px solid #e5e7eb'
                                            }}
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                            }}
                                        />
                                    )}
                                </div>
                            ))}
                    </div>
                </div>

                {/* 생성된 스크립트 표시 */}
                {scriptResult && Array.isArray(scriptResult) && scriptResult.length > 0 && (
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
                            생성된 스크립트
                        </h2>
                        {scriptResult.map(({ group, script }, idx) => (
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
                                    {group.title} (예상 {group.estimatedDuration}초)
                                </div>
                                <div style={{ marginBottom: '8px' }}>
                                    <strong>스타일:</strong> {script.style}
                                </div>
                                <div style={{ marginBottom: '16px' }}>
                                    <strong>톤:</strong> {script.tone}
                                </div>
                                <div style={{ marginBottom: '16px' }}>
                                    <strong>스크립트:</strong>
                                </div>
                                {script.hook && (
                                    <div style={{ marginBottom: '12px' }}>
                                        <div style={{
                                            fontWeight: 'bold',
                                            color: '#1976d2',
                                            marginBottom: '4px'
                                        }}>
                                            🎯 Hook (도입부)
                                        </div>
                                        <div style={{
                                            whiteSpace: 'pre-wrap',
                                            lineHeight: '1.6',
                                            backgroundColor: 'white',
                                            padding: '12px',
                                            borderRadius: '4px',
                                            border: '1px solid #e3f2fd',
                                            fontSize: '14px'
                                        }}>
                                            {script.hook}
                                        </div>
                                    </div>
                                )}
                                {script.coreMessage && (
                                    <div style={{ marginBottom: '12px' }}>
                                        <div style={{
                                            fontWeight: 'bold',
                                            color: '#2e7d32',
                                            marginBottom: '4px'
                                        }}>
                                            💡 Core Message (핵심 내용)
                                        </div>
                                        <div style={{
                                            whiteSpace: 'pre-wrap',
                                            lineHeight: '1.6',
                                            backgroundColor: 'white',
                                            padding: '12px',
                                            borderRadius: '4px',
                                            border: '1px solid #c8e6c9',
                                            fontSize: '14px'
                                        }}>
                                            {script.coreMessage}
                                        </div>
                                    </div>
                                )}
                                {script.cta && (
                                    <div style={{ marginBottom: '12px' }}>
                                        <div style={{
                                            fontWeight: 'bold',
                                            color: '#f57c00',
                                            marginBottom: '4px'
                                        }}>
                                            📢 CTA (행동 유도)
                                        </div>
                                        <div style={{
                                            whiteSpace: 'pre-wrap',
                                            lineHeight: '1.6',
                                            backgroundColor: 'white',
                                            padding: '12px',
                                            borderRadius: '4px',
                                            border: '1px solid #ffe0b2',
                                            fontSize: '14px'
                                        }}>
                                            {script.cta}
                                        </div>
                                    </div>
                                )}
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
                        disabled={!scriptResult || scriptResult.length === 0}
                        style={{
                            padding: '12px 24px',
                            backgroundColor: (!scriptResult || scriptResult.length === 0) ? '#d1d5db' : '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: (!scriptResult || scriptResult.length === 0) ? 'not-allowed' : 'pointer',
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

export default ScriptPage; 