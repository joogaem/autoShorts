'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProgressBar from '../../components/ProgressBar';
import RefinedSectionDisplay from '../../components/RefinedSectionDisplay';
import { getGroupData, setScriptData, clearGroupData } from '../../utils/sessionStorage';
import { API_URL } from '../../config/env';
import { StoryboardResponse, StoryboardScene, StoryboardApiResponse } from '../../types/storyboard';

const ScriptPage: React.FC = () => {
    const router = useRouter();
    const [groupData, setGroupDataState] = useState<any>(null);
    const [keyPoints, setKeyPoints] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [editableSections, setEditableSections] = useState<string[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedSectionIndex, setSelectedSectionIndex] = useState<number | null>(null);
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [selectedSectionContent, setSelectedSectionContent] = useState<string>('');

    // 스토리보드 관련 상태
    const [generatingStoryboard, setGeneratingStoryboard] = useState(false);
    const [storyboardResult, setStoryboardResult] = useState<StoryboardResponse | null>(null);

    useEffect(() => {
        // 세션에서 그룹 데이터 가져오기
        const data = getGroupData();
        if (!data) {
            setError('중요 내용 데이터가 없습니다. 처음부터 다시 시작해주세요.');
            return;
        }

        setGroupDataState(data);

        // groups 페이지에서 선택된 섹션 정보가 있는지 확인
        if ((data as any).selectedSectionIndex !== undefined) {
            setSelectedSectionIndex((data as any).selectedSectionIndex);
            // 선택된 섹션의 내용을 미리 설정
            if ((data as any).selectedSection) {
                setSelectedSectionContent((data as any).selectedSection.content || '');
            }
        }

        // slideGroups에서 keyPoints 추출
        const allKeyPoints = data.slideGroups?.flatMap((group: any) => group.slides || []) || [];
        setKeyPoints(allKeyPoints);

        // 5개 섹션으로 나누기
        const sections = splitIntoFiveSections(allKeyPoints);
        setEditableSections(sections);

        // editableSections가 설정된 후, selectedSectionIndex가 있으면 해당 섹션의 내용을 selectedSectionContent에 설정
        if ((data as any).selectedSectionIndex !== undefined && sections.length > 0) {
            const sectionIndex = (data as any).selectedSectionIndex;
            if (sectionIndex >= 0 && sectionIndex < sections.length) {
                // groupData의 selectedSection.content가 있으면 우선 사용, 없으면 editableSections에서 가져오기
                const sectionContent = (data as any).selectedSection?.content || sections[sectionIndex];
                setSelectedSectionContent(sectionContent);
                console.log('선택된 섹션 내용 설정:', {
                    sectionIndex,
                    contentLength: sectionContent.length,
                    contentPreview: sectionContent.substring(0, 100) + '...'
                });
            }
        }
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

    const handleSectionSelect = (index: number) => {
        if (selectedSectionIndex === index) {
            // 이미 선택된 섹션을 클릭하면 선택 취소
            setSelectedSectionIndex(null);
            setSelectedSectionContent('');
        } else {
            // 다른 섹션 선택
            setSelectedSectionIndex(index);
            // 선택된 섹션의 내용을 selectedSectionContent에 설정
            setSelectedSectionContent(editableSections[index] || '');
        }
    };


    const generateStoryboard = async () => {
        if (!editableSections.length) {
            setError('편집 가능한 섹션이 없습니다.');
            return;
        }

        if (selectedSectionIndex === null) {
            setShowErrorModal(true);
            return;
        }

        setGeneratingStoryboard(true);
        setError(null);
        setStoryboardResult(null);

        try {
            // 선택된 섹션을 사용자 프롬프트로 변환
            // selectedSectionContent가 있으면 우선 사용, 없으면 editableSections에서 가져오기
            const selectedSection = selectedSectionContent || editableSections[selectedSectionIndex];
            const userPrompt = `교육 내용: ${selectedSection}`;

            // 디버깅: 전송되는 프롬프트 확인
            console.log('=== 스토리보드 생성 요청 ===');
            console.log('선택된 섹션 인덱스:', selectedSectionIndex);
            console.log('selectedSectionContent:', selectedSectionContent ? selectedSectionContent.substring(0, 100) + '...' : '(없음)');
            console.log('editableSections[selectedSectionIndex]:', editableSections[selectedSectionIndex] ? editableSections[selectedSectionIndex].substring(0, 100) + '...' : '(없음)');
            console.log('실제 사용된 섹션 내용:', selectedSection.substring(0, 200) + '...');
            console.log('전송되는 userPrompt:', userPrompt.substring(0, 200) + '...');

            const response = await fetch(API_URL + '/api/generate-storyboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userPrompt,
                    style: 'educational',
                    tone: 'friendly'
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data: StoryboardApiResponse = await response.json();
            console.log('스토리보드 생성 응답:', data);

            if (data.success && data.data && data.data.storyboard) {
                setStoryboardResult(data.data.storyboard);
            } else {
                throw new Error('Invalid response format from generate-storyboard API');
            }
        } catch (e: any) {
            console.error('스토리보드 생성 오류:', e);
            setError('스토리보드 생성 중 오류 발생: ' + (e?.message || e));
        } finally {
            setGeneratingStoryboard(false);
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

    // 스토리보드 관련 핸들러들
    const handleStoryboardSceneUpdate = (sceneIndex: number, field: 'narrative_korean' | 'image_prompt_english', value: string) => {
        if (storyboardResult) {
            const updatedScenes = [...storyboardResult.scenes];
            updatedScenes[sceneIndex] = {
                ...updatedScenes[sceneIndex],
                [field]: value
            };
            setStoryboardResult({
                ...storyboardResult,
                scenes: updatedScenes
            });
        }
    };


    const handleContinue = () => {
        if (!storyboardResult) {
            setError('스토리보드를 먼저 생성해주세요.');
            return;
        }

        // 세션에 스토리보드 데이터 저장
        setScriptData({
            storyboardResult,
            generationMode: 'storyboard'
        });

        // 스토리보드 이미지 생성 페이지로 이동
        router.push('/storyboard-images');
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
                        스토리보드 생성
                    </h1>
                    <p style={{
                        fontSize: '18px',
                        color: '#6b7280',
                        marginBottom: '32px'
                    }}>
                        선택한 섹션을 바탕으로 5장면 스토리보드를 생성합니다
                    </p>
                </div>

                {/* 선택된 섹션 표시 */}
                {selectedSectionIndex !== null && (
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
                            marginBottom: '16px'
                        }}>
                            선택된 섹션 {selectedSectionIndex + 1}
                        </h2>
                        <div style={{
                            border: '2px solid #3b82f6',
                            borderRadius: '8px',
                            padding: '20px',
                            backgroundColor: '#eff6ff'
                        }}>
                            <div style={{
                                fontSize: '14px',
                                lineHeight: '1.6',
                                color: '#374151',
                                whiteSpace: 'pre-wrap'
                            }}>
                                {selectedSectionContent || editableSections[selectedSectionIndex]}
                            </div>
                        </div>
                        <div style={{
                            marginTop: '20px',
                            textAlign: 'center'
                        }}>
                            <button
                                onClick={generateStoryboard}
                                disabled={generatingStoryboard}
                                style={{
                                    padding: '12px 24px',
                                    backgroundColor: generatingStoryboard ? '#d1d5db' : '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: generatingStoryboard ? 'not-allowed' : 'pointer',
                                    fontSize: '16px',
                                    fontWeight: '600'
                                }}
                            >
                                {generatingStoryboard ? '스토리보드 생성 중...' : '이 섹션으로 스토리보드 생성'}
                            </button>
                        </div>
                    </div>
                )}


                {/* 생성된 스토리보드 표시 */}
                {storyboardResult && (
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        padding: '32px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        marginBottom: '32px'
                    }}>
                        <div style={{
                            marginBottom: '24px'
                        }}>
                            <h2 style={{
                                fontSize: '24px',
                                fontWeight: '600',
                                color: '#111827',
                                margin: 0,
                                marginBottom: '8px'
                            }}>
                                생성된 스토리보드
                            </h2>
                            <p style={{
                                fontSize: '14px',
                                color: '#6b7280',
                                margin: 0
                            }}>
                                각 장면의 내용을 직접 편집할 수 있습니다.
                            </p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {storyboardResult.scenes.map((scene, index) => (
                                <div
                                    key={scene.scene_number}
                                    style={{
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '8px',
                                        padding: '20px',
                                        backgroundColor: '#f9fafb'
                                    }}
                                >
                                    <h3 style={{
                                        fontSize: '18px',
                                        fontWeight: '600',
                                        color: '#111827',
                                        marginBottom: '16px'
                                    }}>
                                        장면 {scene.scene_number}
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        <div>
                                            <label style={{
                                                display: 'block',
                                                fontWeight: '600',
                                                marginBottom: '8px',
                                                color: '#374151'
                                            }}>
                                                내레이션 (한국어)
                                            </label>
                                            <textarea
                                                value={scene.narrative_korean}
                                                onChange={(e) => handleStoryboardSceneUpdate(index, 'narrative_korean', e.target.value)}
                                                style={{
                                                    width: '100%',
                                                    minHeight: '80px',
                                                    padding: '12px',
                                                    border: '1px solid #d1d5db',
                                                    borderRadius: '6px',
                                                    fontSize: '14px',
                                                    lineHeight: '1.6',
                                                    resize: 'vertical',
                                                    fontFamily: 'inherit',
                                                    backgroundColor: 'white'
                                                }}
                                                placeholder="장면의 내레이션을 입력하세요..."
                                            />
                                        </div>


                                        <div>
                                            <label style={{
                                                display: 'block',
                                                fontWeight: '600',
                                                marginBottom: '8px',
                                                color: '#374151'
                                            }}>
                                                이미지 프롬프트 (영어)
                                            </label>
                                            <textarea
                                                value={scene.image_prompt_english}
                                                onChange={(e) => handleStoryboardSceneUpdate(index, 'image_prompt_english', e.target.value)}
                                                style={{
                                                    width: '100%',
                                                    minHeight: '100px',
                                                    padding: '12px',
                                                    border: '1px solid #d1d5db',
                                                    borderRadius: '6px',
                                                    fontSize: '14px',
                                                    lineHeight: '1.6',
                                                    resize: 'vertical',
                                                    fontFamily: 'monospace',
                                                    backgroundColor: 'white'
                                                }}
                                                placeholder="이미지 생성을 위한 영어 프롬프트를 입력하세요..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
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
                        disabled={!storyboardResult}
                        style={{
                            padding: '12px 24px',
                            backgroundColor: !storyboardResult ? '#d1d5db' : '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: !storyboardResult ? 'not-allowed' : 'pointer',
                            fontSize: '16px'
                        }}
                    >
                        다음 단계 →
                    </button>
                </div>
            </div>

            {/* 에러 모달 */}
            {showErrorModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        padding: '32px',
                        maxWidth: '400px',
                        width: '90%',
                        textAlign: 'center',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                    }}>
                        <div style={{
                            fontSize: '48px',
                            marginBottom: '16px'
                        }}>
                            ⚠️
                        </div>
                        <h3 style={{
                            fontSize: '20px',
                            fontWeight: '600',
                            color: '#111827',
                            marginBottom: '12px'
                        }}>
                            섹션을 선택해주세요
                        </h3>
                        <p style={{
                            fontSize: '16px',
                            color: '#6b7280',
                            marginBottom: '24px',
                            lineHeight: '1.5'
                        }}>
                            스토리보드를 생성하기 위해 5개 섹션 중 하나를 선택해주세요.
                        </p>
                        <button
                            onClick={() => setShowErrorModal(false)}
                            style={{
                                padding: '12px 24px',
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '16px',
                                fontWeight: '500'
                            }}
                        >
                            확인
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ScriptPage; 