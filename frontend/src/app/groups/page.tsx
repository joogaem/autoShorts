'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProgressBar from '../../components/ProgressBar';
import RefinedSectionDisplay from '../../components/RefinedSectionDisplay';
import { getUploadData, setGroupData, clearUploadData } from '../../utils/sessionStorage';
import { API_URL } from '../../config/env';

interface KeyPoint {
    id: string;
    title: string;
    content: string;
    estimatedDuration: number;
    thumbnail?: string;
    // 다듬어진 섹션 정보
    originalText?: string;
    keyPoints?: string[];
    summary?: string;
    refinedText?: string;
    sectionType?: 'introduction' | 'main-point-1' | 'main-point-2' | 'main-point-3' | 'conclusion';
}

const GroupsPage: React.FC = () => {
    const router = useRouter();
    const [uploadData, setUploadDataState] = useState<any>(null);
    const [keyPoints, setKeyPoints] = useState<KeyPoint[]>([]);
    const [editingKeyPoint, setEditingKeyPoint] = useState<string | null>(null);
    const [editingContent, setEditingContent] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedSectionIndex, setSelectedSectionIndex] = useState<number | null>(null);
    const [showErrorModal, setShowErrorModal] = useState(false);

    useEffect(() => {
        // 세션에서 업로드 데이터 가져오기
        const data = getUploadData();
        if (!data) {
            setError('업로드 데이터가 없습니다. 파일을 다시 업로드해주세요.');
            setLoading(false);
            return;
        }

        setUploadDataState(data);

        // 파싱 결과에서 다듬어진 섹션 추출
        const extractRefinedSections = () => {
            try {
                if (data.slides && Array.isArray(data.slides)) {
                    // parse.ts에서 반환된 다듬어진 섹션을 KeyPoint 형태로 변환
                    const refinedSections = data.slides.map((slide: any, index: number) => ({
                        id: `section-${index + 1}`,
                        title: slide.title || `섹션 ${index + 1}`,
                        content: slide.text || slide.refinedText || '',
                        estimatedDuration: 60, // 기본값
                        originalText: slide.originalText || slide.text || '',
                        keyPoints: slide.keyPoints || [],
                        summary: slide.summary || '',
                        refinedText: slide.refinedText || slide.text || '',
                        sectionType: slide.sectionType || (index === 0 ? 'introduction' :
                            index === 1 ? 'main-point-1' :
                                index === 2 ? 'main-point-2' :
                                    index === 3 ? 'main-point-3' : 'conclusion')
                    }));

                    setKeyPoints(refinedSections);
                } else {
                    setError('다듬어진 섹션 데이터가 없습니다.');
                }
            } catch (e: any) {
                setError('섹션 데이터 처리 중 오류 발생: ' + (e?.message || e));
            } finally {
                setLoading(false);
            }
        };

        extractRefinedSections();
    }, []);

    const handleEditStart = (keyPoint: KeyPoint) => {
        setEditingKeyPoint(keyPoint.id);
        setEditingContent(keyPoint.content);
    };

    const handleEditSave = () => {
        if (editingKeyPoint) {
            setKeyPoints(prev => prev.map(kp =>
                kp.id === editingKeyPoint
                    ? { ...kp, content: editingContent, title: editingContent.length > 50 ? editingContent.substring(0, 50) + '...' : editingContent }
                    : kp
            ));
            setEditingKeyPoint(null);
            setEditingContent('');
        }
    };

    const handleEditCancel = () => {
        setEditingKeyPoint(null);
        setEditingContent('');
    };

    const handleSectionSelect = (index: number) => {
        if (selectedSectionIndex === index) {
            // 이미 선택된 섹션을 클릭하면 선택 취소
            setSelectedSectionIndex(null);
        } else {
            // 다른 섹션 선택
            setSelectedSectionIndex(index);
        }
    };

    const handleContinue = () => {
        if (selectedSectionIndex === null) {
            setShowErrorModal(true);
            return;
        }

        // 세션에 중요 내용 데이터 저장 (선택된 섹션 정보 포함)
        setGroupData({
            selectedGroups: [],
            slideGroups: [],
            keyPoints,
            selectedSectionIndex,
            selectedSection: keyPoints[selectedSectionIndex]
        } as any);

        // 스크립트 생성 페이지로 이동
        router.push('/script');
    };

    const handleBack = () => {
        clearUploadData();
        router.push('/');
    };

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
                <ProgressBar currentStep={1} />
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
                        <div style={{ fontSize: '24px', marginBottom: '16px' }}>🔍</div>
                        <div style={{ fontSize: '18px', color: '#374151' }}>중요 내용을 분석하는 중...</div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
                <ProgressBar currentStep={1} />
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
                            처음으로 돌아가기
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
            <ProgressBar currentStep={1} />

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
                        다듬어진 5개 섹션 확인 및 편집
                    </h1>
                    <p style={{
                        fontSize: '18px',
                        color: '#6b7280'
                    }}>
                        AI가 다듬어준 5개의 섹션을 확인하고 필요시 편집해주세요
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
                            다듬어진 섹션 ({keyPoints.length}개)
                        </h2>
                        <div style={{
                            fontSize: '14px',
                            color: '#6b7280',
                            marginTop: '8px'
                        }}>
                            {selectedSectionIndex !== null
                                ? `선택된 섹션: ${keyPoints[selectedSectionIndex]?.title || `섹션 ${selectedSectionIndex + 1}`}`
                                : '영상을 만들 섹션을 선택해주세요'
                            }
                        </div>
                    </div>

                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '24px',
                        marginTop: '24px'
                    }}>
                        {keyPoints.map((keyPoint, index) => (
                            <div
                                key={keyPoint.id}
                                style={{
                                    border: selectedSectionIndex === index ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                                    borderRadius: '12px',
                                    padding: '24px',
                                    backgroundColor: selectedSectionIndex === index ? '#eff6ff' : '#fafafa',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    marginBottom: '16px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{
                                            fontSize: '16px',
                                            fontWeight: '600',
                                            color: '#3b82f6',
                                            backgroundColor: '#eff6ff',
                                            padding: '4px 12px',
                                            borderRadius: '20px'
                                        }}>
                                            {keyPoint.title || `섹션 ${index + 1}`}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{
                                            fontSize: '14px',
                                            color: '#6b7280'
                                        }}>
                                            예상 {keyPoint.estimatedDuration}초
                                        </div>
                                        <button
                                            onClick={() => handleSectionSelect(index)}
                                            style={{
                                                width: '24px',
                                                height: '24px',
                                                borderRadius: '50%',
                                                border: selectedSectionIndex === index ? '2px solid #3b82f6' : '2px solid #d1d5db',
                                                backgroundColor: selectedSectionIndex === index ? '#3b82f6' : 'white',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transition: 'all 0.2s ease',
                                                position: 'relative'
                                            }}
                                        >
                                            {selectedSectionIndex === index && (
                                                <div style={{
                                                    color: 'white',
                                                    fontSize: '14px',
                                                    fontWeight: 'bold'
                                                }}>
                                                    ✓
                                                </div>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {editingKeyPoint === keyPoint.id ? (
                                    <div>
                                        <textarea
                                            value={editingContent}
                                            onChange={(e) => setEditingContent(e.target.value)}
                                            style={{
                                                width: '100%',
                                                minHeight: '120px',
                                                padding: '12px',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '8px',
                                                fontSize: '14px',
                                                fontFamily: 'inherit',
                                                resize: 'vertical',
                                                marginBottom: '12px'
                                            }}
                                            placeholder="중요 내용을 입력하세요..."
                                        />
                                        <div style={{
                                            display: 'flex',
                                            gap: '8px',
                                            justifyContent: 'flex-end'
                                        }}>
                                            <button
                                                onClick={handleEditCancel}
                                                style={{
                                                    padding: '8px 16px',
                                                    backgroundColor: '#6b7280',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    fontSize: '14px'
                                                }}
                                            >
                                                취소
                                            </button>
                                            <button
                                                onClick={handleEditSave}
                                                style={{
                                                    padding: '8px 16px',
                                                    backgroundColor: '#3b82f6',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    fontSize: '14px'
                                                }}
                                            >
                                                저장
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <div style={{
                                            fontSize: '16px',
                                            fontWeight: '500',
                                            color: '#111827',
                                            marginBottom: '8px'
                                        }}>
                                            {keyPoint.title}
                                        </div>

                                        {/* 핵심 포인트 표시 */}
                                        {keyPoint.keyPoints && keyPoint.keyPoints.length > 0 && (
                                            <div style={{ marginBottom: '12px' }}>
                                                <div style={{
                                                    fontSize: '12px',
                                                    fontWeight: '600',
                                                    color: '#6b7280',
                                                    marginBottom: '4px'
                                                }}>
                                                    핵심 포인트:
                                                </div>
                                                <ul style={{
                                                    margin: 0,
                                                    paddingLeft: '16px',
                                                    fontSize: '12px',
                                                    color: '#4b5563'
                                                }}>
                                                    {keyPoint.keyPoints.map((point, idx) => (
                                                        <li key={idx} style={{ marginBottom: '2px' }}>
                                                            {point}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {/* 요약 표시 */}
                                        {keyPoint.summary && (
                                            <div style={{ marginBottom: '12px' }}>
                                                <div style={{
                                                    fontSize: '12px',
                                                    fontWeight: '600',
                                                    color: '#6b7280',
                                                    marginBottom: '4px'
                                                }}>
                                                    요약:
                                                </div>
                                                <div style={{
                                                    fontSize: '12px',
                                                    color: '#4b5563',
                                                    lineHeight: '1.4',
                                                    fontStyle: 'italic'
                                                }}>
                                                    {keyPoint.summary}
                                                </div>
                                            </div>
                                        )}

                                        <div style={{
                                            fontSize: '14px',
                                            color: '#374151',
                                            lineHeight: '1.6',
                                            marginBottom: '12px',
                                            whiteSpace: 'pre-wrap'
                                        }}>
                                            {keyPoint.content}
                                        </div>
                                        <button
                                            onClick={() => handleEditStart(keyPoint)}
                                            style={{
                                                padding: '6px 12px',
                                                backgroundColor: '#f3f4f6',
                                                color: '#374151',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontSize: '12px'
                                            }}
                                        >
                                            ✏️ 편집
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

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
                        disabled={selectedSectionIndex === null}
                        style={{
                            padding: '12px 24px',
                            backgroundColor: selectedSectionIndex === null ? '#d1d5db' : '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: selectedSectionIndex === null ? 'not-allowed' : 'pointer',
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
                            영상을 만들기 위해 5개 섹션 중 하나를 선택해주세요.
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

export default GroupsPage; 