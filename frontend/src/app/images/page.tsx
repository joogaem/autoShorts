'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProgressBar from '../../components/ProgressBar';
import { getTTSData, setImageData, clearTTSData } from '../../utils/sessionStorage';

const ImagesPage: React.FC = () => {
    const router = useRouter();
    const [ttsData, setTTSDataState] = useState<any>(null);
    const [audioResult, setAudioResult] = useState<any[]>([]);
    const [generatingImages, setGeneratingImages] = useState(false);
    const [generatedImages, setGeneratedImages] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // 세션에서 TTS 데이터 가져오기
        const data = getTTSData();
        if (!data) {
            setError('TTS 데이터가 없습니다. 처음부터 다시 시작해주세요.');
            return;
        }

        setTTSDataState(data);
        setAudioResult(data.audioResult);

        // 그룹 정보가 있으면 사용
        if (data.slideGroups) {
            console.log('TTS 데이터에서 그룹 정보 가져옴:', data.slideGroups);
        }
    }, []);

    const generateImagesForGroups = async () => {
        if (!audioResult || audioResult.length === 0) {
            setError('TTS 데이터가 없습니다.');
            return;
        }
        setGeneratingImages(true);
        setError(null);
        setGeneratedImages([]);

        try {
            const results = await Promise.all(
                audioResult.map(async ({ group, script, audioUrl, duration }) => {
                    // TTS 데이터에서 그룹 정보 가져오기
                    const slideGroups = ttsData?.slideGroups || [];
                    const fullGroup = slideGroups.find((g: any) => g.id === group.id);

                    if (!fullGroup) {
                        console.error('그룹 정보를 찾을 수 없음:', group.id);
                        throw new Error(`그룹 ${group.id}의 정보를 찾을 수 없습니다.`);
                    }

                    const response = await fetch('http://localhost:3001/api/generate-images-for-groups', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            groups: [fullGroup],
                            slides: fullGroup.slides || []
                        }),
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
                    }

                    const data = await response.json();
                    console.log('이미지 생성 응답:', data);

                    if (data.success && data.data && Array.isArray(data.data.images)) {
                        return {
                            group,
                            script,
                            audioUrl,
                            duration,
                            images: data.data.images
                        };
                    } else {
                        throw new Error('Invalid response format from image generation API');
                    }
                })
            );
            setGeneratedImages(results);
        } catch (e: any) {
            console.error('이미지 생성 오류:', e);
            setError('이미지 생성 중 오류 발생: ' + (e?.message || e));
        } finally {
            setGeneratingImages(false);
        }
    };

    const handleContinue = () => {
        if (!generatedImages || generatedImages.length === 0) {
            setError('이미지를 먼저 생성해주세요.');
            return;
        }

        // 세션에 이미지 데이터 저장
        setImageData({
            generatedImages
        });

        // 결과 확인 페이지로 이동
        router.push('/result');
    };

    const handleBack = () => {
        clearTTSData();
        router.push('/tts');
    };

    if (error && !ttsData) {
        return (
            <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
                <ProgressBar currentStep={4} />
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
                            TTS 생성으로 돌아가기
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
            <ProgressBar currentStep={4} />

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
                        이미지 생성
                    </h1>
                    <p style={{
                        fontSize: '18px',
                        color: '#6b7280'
                    }}>
                        선택된 그룹에 대한 AI 이미지를 생성합니다
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
                            그룹 ({audioResult.length}개)
                        </h2>
                        <button
                            onClick={generateImagesForGroups}
                            disabled={generatingImages}
                            style={{
                                padding: '12px 24px',
                                backgroundColor: generatingImages ? '#d1d5db' : '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: generatingImages ? 'not-allowed' : 'pointer',
                                fontSize: '16px'
                            }}
                        >
                            {generatingImages ? '이미지 생성 중...' : '이미지 생성'}
                        </button>
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                        gap: '24px'
                    }}>
                        {audioResult.map(({ group, script, audioUrl, duration }) => (
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
                                    {duration}초 • {group.slides.length}개 슬라이드
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
                                    color: '#9ca3af'
                                }}>
                                    <strong>톤:</strong> {script.tone}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 생성된 이미지 표시 */}
                {generatedImages && Array.isArray(generatedImages) && generatedImages.length > 0 && (
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
                            생성된 이미지
                        </h2>
                        {generatedImages.map(({ group, script, audioUrl, duration, images }) => (
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

                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                                    gap: '16px',
                                    marginBottom: '16px'
                                }}>
                                    {images && Array.isArray(images) && images.map((image: any, idx: number) => (
                                        <div key={idx} style={{
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '8px',
                                            overflow: 'hidden',
                                            backgroundColor: 'white'
                                        }}>
                                            <img
                                                src={`http://localhost:3001${image.url}`}
                                                alt={`Generated image ${idx + 1}`}
                                                style={{
                                                    width: '100%',
                                                    height: '150px',
                                                    objectFit: 'cover'
                                                }}
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                }}
                                            />
                                            <div style={{
                                                padding: '8px',
                                                fontSize: '12px',
                                                color: '#6b7280'
                                            }}>
                                                <div><strong>프롬프트:</strong> {image.prompt}</div>
                                                <div><strong>제공자:</strong> {image.metadata.provider}</div>
                                                <div><strong>모델:</strong> {image.metadata.model}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div style={{
                                    fontSize: '14px',
                                    color: '#6b7280',
                                    marginBottom: '8px'
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
                        disabled={!generatedImages || generatedImages.length === 0}
                        style={{
                            padding: '12px 24px',
                            backgroundColor: (!generatedImages || generatedImages.length === 0) ? '#d1d5db' : '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: (!generatedImages || generatedImages.length === 0) ? 'not-allowed' : 'pointer',
                            fontSize: '16px'
                        }}
                    >
                        결과 확인 →
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImagesPage; 