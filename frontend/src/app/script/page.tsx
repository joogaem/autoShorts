'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProgressBar from '../../components/ProgressBar';
import RefinedSectionDisplay from '../../components/RefinedSectionDisplay';
import { getGroupData, setScriptData, clearGroupData } from '../../utils/sessionStorage';
import { API_URL } from '../../config/env';

const ScriptPage: React.FC = () => {
    const router = useRouter();
    const [groupData, setGroupDataState] = useState<any>(null);
    const [keyPoints, setKeyPoints] = useState<any[]>([]);
    const [generatingScript, setGeneratingScript] = useState(false);
    const [scriptResult, setScriptResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [editableSections, setEditableSections] = useState<string[]>([]);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        // 세션에서 그룹 데이터 가져오기
        const data = getGroupData();
        if (!data) {
            setError('중요 내용 데이터가 없습니다. 처음부터 다시 시작해주세요.');
            return;
        }

        setGroupDataState(data);
        // slideGroups에서 keyPoints 추출
        const allKeyPoints = data.slideGroups?.flatMap((group: any) => group.slides || []) || [];
        setKeyPoints(allKeyPoints);

        // 5개 섹션으로 나누기
        const sections = splitIntoFiveSections(allKeyPoints);
        setEditableSections(sections);
    }, []);

    // 내용을 5개 섹션으로 나누는 함수
    const splitIntoFiveSections = (keyPoints: any[]) => {
        const sections: string[] = [];
        const totalPoints = keyPoints.length;
        const pointsPerSection = Math.ceil(totalPoints / 5);

        for (let i = 0; i < 5; i++) {
            const startIndex = i * pointsPerSection;
            const endIndex = Math.min(startIndex + pointsPerSection, totalPoints);
            const sectionPoints = keyPoints.slice(startIndex, endIndex);

            // 제목에서 "외국어습득론1주차1교시" 같은 패턴 제거
            const cleanContent = sectionPoints.map(point => {
                let cleanTitle = point.title || '';
                // 숫자+주차+숫자+교시 패턴 제거
                cleanTitle = cleanTitle.replace(/\d+주차\d+교시/g, '').trim();
                // 앞뒤 공백 제거
                cleanTitle = cleanTitle.replace(/^\s*[-•]\s*/, '').trim();

                return `${cleanTitle ? cleanTitle + ': ' : ''}${point.content || ''}`;
            }).join(' ');

            sections.push(cleanContent);
        }

        return sections;
    };

    const generateScript = async () => {
        if (!editableSections.length) {
            setError('편집 가능한 섹션이 없습니다.');
            return;
        }
        setGeneratingScript(true);
        setError(null);
        setScriptResult(null);

        try {
            const response = await fetch(API_URL + '/api/generate-script', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sections: editableSections,
                    style: 'educational',
                    tone: 'friendly',
                    targetDuration: 60
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('스크립트 생성 응답:', data);

            // 백엔드에서 반환하는 구조: { success: true, data: [scriptResult] }
            if (data.success && data.data && Array.isArray(data.data)) {
                // 단일 스크립트 결과 (첫 번째 요소)
                const scriptResult = data.data[0];
                if (scriptResult && scriptResult.script) {
                    setScriptResult(scriptResult);
                } else {
                    throw new Error('No script found in response');
                }
            } else {
                throw new Error('Invalid response format from generate-script API');
            }
        } catch (e: any) {
            console.error('스크립트 생성 오류:', e);
            setError('스크립트 생성 중 오류 발생: ' + (e?.message || e));
        } finally {
            setGeneratingScript(false);
        }
    };

    // 섹션 내용 업데이트 함수
    const updateSection = (index: number, content: string) => {
        const newSections = [...editableSections];
        newSections[index] = content;
        setEditableSections(newSections);
    };

    // 편집 모드 토글
    const toggleEditMode = () => {
        setIsEditing(!isEditing);
    };

    const handleContinue = () => {
        if (!scriptResult) {
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

    if (error && !keyPoints.length) {
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
                            중요 내용 선택으로 돌아가기
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
                        중요 내용을 바탕으로 스크립트를 생성합니다
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
                            내용 5부분 ({editableSections.length}개 섹션)
                        </h2>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={toggleEditMode}
                                style={{
                                    padding: '12px 24px',
                                    backgroundColor: isEditing ? '#10b981' : '#6b7280',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '16px'
                                }}
                            >
                                {isEditing ? '편집 완료' : '편집하기'}
                            </button>
                            <button
                                onClick={generateScript}
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
                    </div>

                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px'
                    }}>
                        {editableSections.map((section, index) => (
                            <div
                                key={index}
                                style={{
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '12px',
                                    padding: '20px',
                                    backgroundColor: isEditing ? '#f8fafc' : '#fafafa'
                                }}
                            >
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '12px'
                                }}>
                                    <h3 style={{
                                        fontSize: '16px',
                                        fontWeight: '600',
                                        color: '#111827',
                                        margin: 0
                                    }}>
                                        섹션 {index + 1}
                                    </h3>
                                    {isEditing && (
                                        <div style={{
                                            fontSize: '12px',
                                            color: '#10b981',
                                            backgroundColor: '#d1fae5',
                                            padding: '4px 8px',
                                            borderRadius: '12px'
                                        }}>
                                            편집 중
                                        </div>
                                    )}
                                </div>
                                {isEditing ? (
                                    <textarea
                                        value={section}
                                        onChange={(e) => updateSection(index, e.target.value)}
                                        style={{
                                            width: '100%',
                                            minHeight: '120px',
                                            padding: '12px',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '8px',
                                            fontSize: '14px',
                                            lineHeight: '1.6',
                                            color: '#374151',
                                            backgroundColor: 'white',
                                            resize: 'vertical',
                                            fontFamily: 'inherit'
                                        }}
                                        placeholder={`섹션 ${index + 1}의 내용을 입력하세요...`}
                                    />
                                ) : (
                                    <div style={{
                                        fontSize: '14px',
                                        color: '#374151',
                                        lineHeight: '1.6',
                                        whiteSpace: 'pre-wrap'
                                    }}>
                                        {section}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* 생성된 스크립트 표시 */}
                {scriptResult && (
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
                        <div style={{
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            padding: '20px',
                            backgroundColor: '#f9fafb'
                        }}>
                            <div style={{
                                fontWeight: '600',
                                marginBottom: '12px',
                                fontSize: '18px',
                                color: '#111827'
                            }}>
                                생성된 스크립트 (예상 {scriptResult.estimatedDuration}초)
                            </div>
                            <div style={{ marginBottom: '8px' }}>
                                <strong>스타일:</strong> {scriptResult.style}
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <strong>톤:</strong> {scriptResult.tone}
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <strong>다듬어진 섹션 기반 스크립트:</strong>
                            </div>

                            {/* 다듬어진 섹션 표시 */}
                            {keyPoints && keyPoints.length > 0 && (
                                <RefinedSectionDisplay
                                    sections={keyPoints.map((kp: any, index: number) => ({
                                        id: index + 1,
                                        title: kp.title || `섹션 ${index + 1}`,
                                        keyPoints: kp.keyPoints || [],
                                        summary: kp.summary || '',
                                        refinedText: kp.content || '',
                                        originalText: kp.originalText || kp.content || '',
                                        sectionType: index === 0 ? 'introduction' :
                                            index === 1 ? 'main-point-1' :
                                                index === 2 ? 'main-point-2' :
                                                    index === 3 ? 'main-point-3' : 'conclusion'
                                    }))}
                                    showDetails={true}
                                />
                            )}

                            {/* 스크립트 내용 표시 */}
                            <div style={{
                                backgroundColor: 'white',
                                padding: '16px',
                                borderRadius: '8px',
                                border: '1px solid #e5e7eb',
                                marginBottom: '16px'
                            }}>
                                <div style={{
                                    fontSize: '14px',
                                    lineHeight: '1.6',
                                    color: '#374151',
                                    whiteSpace: 'pre-wrap'
                                }}>
                                    {scriptResult.script}
                                </div>
                            </div>

                            {scriptResult.hook && (
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
                                        {scriptResult.hook}
                                    </div>
                                </div>
                            )}
                            {scriptResult.coreMessage && (
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
                                        {scriptResult.coreMessage}
                                    </div>
                                </div>
                            )}
                            {scriptResult.cta && (
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
                                        {scriptResult.cta}
                                    </div>
                                </div>
                            )}
                        </div>
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
                        disabled={!scriptResult}
                        style={{
                            padding: '12px 24px',
                            backgroundColor: !scriptResult ? '#d1d5db' : '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: !scriptResult ? 'not-allowed' : 'pointer',
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