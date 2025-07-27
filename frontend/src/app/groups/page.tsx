'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProgressBar from '../../components/ProgressBar';
import { getUploadData, setGroupData, clearUploadData } from '../../utils/sessionStorage';

const GroupsPage: React.FC = () => {
    const router = useRouter();
    const [uploadData, setUploadDataState] = useState<any>(null);
    const [slideGroups, setSlideGroups] = useState<any[]>([]);
    const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // 세션에서 업로드 데이터 가져오기
        const data = getUploadData();
        if (!data) {
            setError('업로드 데이터가 없습니다. 파일을 다시 업로드해주세요.');
            setLoading(false);
            return;
        }

        setUploadDataState(data);

        // 그룹핑 데이터 가져오기
        const fetchGroups = async () => {
            try {
                const groupRes = await fetch(process.env.NEXT_PUBLIC_GROUP_URL || 'http://localhost:3001/api/group-slides', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename: data.filename }),
                });
                const groupData = await groupRes.json();

                if (groupRes.ok && groupData.data && Array.isArray(groupData.data.groups)) {
                    setSlideGroups(groupData.data.groups);
                } else {
                    setError('그룹핑 실패: ' + (groupData.error || 'Unknown error'));
                }
            } catch (e: any) {
                setError('그룹핑 요청 중 오류 발생: ' + (e?.message || e));
            } finally {
                setLoading(false);
            }
        };

        fetchGroups();
    }, []);

    const handleGroupSelect = (groupId: string) => {
        setSelectedGroups(prev =>
            prev.includes(groupId)
                ? prev.filter(id => id !== groupId)
                : [...prev, groupId]
        );
    };

    const handleContinue = () => {
        if (selectedGroups.length === 0) {
            setError('최소 하나의 그룹을 선택해주세요.');
            return;
        }

        // 세션에 그룹 데이터 저장
        setGroupData({
            selectedGroups,
            slideGroups
        });

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
                        <div style={{ fontSize: '24px', marginBottom: '16px' }}>🔄</div>
                        <div style={{ fontSize: '18px', color: '#374151' }}>그룹을 불러오는 중...</div>
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
                        그룹 선택
                    </h1>
                    <p style={{
                        fontSize: '18px',
                        color: '#6b7280'
                    }}>
                        처리할 쇼츠 그룹을 선택해주세요
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
                            쇼츠 그룹 ({slideGroups.length}개)
                        </h2>
                        <div style={{
                            fontSize: '14px',
                            color: '#6b7280'
                        }}>
                            {selectedGroups.length}개 선택됨
                        </div>
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                        gap: '24px'
                    }}>
                        {slideGroups.map((group) => (
                            <div
                                key={group.id}
                                style={{
                                    border: selectedGroups.includes(group.id) ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                                    borderRadius: '12px',
                                    padding: '20px',
                                    cursor: 'pointer',
                                    backgroundColor: selectedGroups.includes(group.id) ? '#eff6ff' : 'white',
                                    transition: 'all 0.2s ease'
                                }}
                                onClick={() => handleGroupSelect(group.id)}
                            >
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    marginBottom: '12px'
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedGroups.includes(group.id)}
                                        onChange={() => handleGroupSelect(group.id)}
                                        style={{
                                            marginRight: '12px',
                                            transform: 'scale(1.2)'
                                        }}
                                    />
                                    <h3 style={{
                                        fontSize: '18px',
                                        fontWeight: '600',
                                        color: '#111827',
                                        margin: 0
                                    }}>
                                        {group.title}
                                    </h3>
                                </div>

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

                                <div style={{
                                    fontSize: '12px',
                                    color: '#9ca3af',
                                    marginTop: '8px'
                                }}>
                                    슬라이드: {group.slides.join(', ')}
                                </div>
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
                        disabled={selectedGroups.length === 0}
                        style={{
                            padding: '12px 24px',
                            backgroundColor: selectedGroups.length === 0 ? '#d1d5db' : '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: selectedGroups.length === 0 ? 'not-allowed' : 'pointer',
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

export default GroupsPage; 