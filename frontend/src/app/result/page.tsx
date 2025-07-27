'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProgressBar from '../../components/ProgressBar';
import { getImageData, clearAllSessionData } from '../../utils/sessionStorage';

const ResultPage: React.FC = () => {
    const router = useRouter();
    const [imageData, setImageDataState] = useState<any>(null);
    const [generatedImages, setGeneratedImages] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // 세션에서 이미지 데이터 가져오기
        const data = getImageData();
        if (!data) {
            setError('결과 데이터가 없습니다. 처음부터 다시 시작해주세요.');
            return;
        }

        setImageDataState(data);
        setGeneratedImages(data.generatedImages);
    }, []);

    const handleStartOver = () => {
        clearAllSessionData();
        router.push('/');
    };

    const handleDownloadAll = () => {
        // TODO: 모든 결과를 ZIP으로 다운로드하는 기능 구현
        alert('다운로드 기능은 추후 구현 예정입니다.');
    };

    if (error && !imageData) {
        return (
            <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
                <ProgressBar currentStep={5} />
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
                            onClick={handleStartOver}
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
                            처음부터 다시 시작
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
            <ProgressBar currentStep={5} />

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
                        🎉 생성 완료!
                    </h1>
                    <p style={{
                        fontSize: '18px',
                        color: '#6b7280'
                    }}>
                        쇼츠 영상용 콘텐츠가 성공적으로 생성되었습니다
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
                            생성된 콘텐츠 ({generatedImages.length}개 그룹)
                        </h2>
                        <button
                            onClick={handleDownloadAll}
                            style={{
                                padding: '12px 24px',
                                backgroundColor: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '16px'
                            }}
                        >
                            📥 전체 다운로드
                        </button>
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                        gap: '24px'
                    }}>
                        {generatedImages.map(({ group, script, audioUrl, duration, images }) => (
                            <div key={group.id} style={{
                                border: '1px solid #e5e7eb',
                                borderRadius: '12px',
                                padding: '20px',
                                backgroundColor: '#f9fafb'
                            }}>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    marginBottom: '16px'
                                }}>
                                    <div>
                                        <h3 style={{
                                            fontSize: '18px',
                                            fontWeight: '600',
                                            color: '#111827',
                                            marginBottom: '4px'
                                        }}>
                                            {group.title}
                                        </h3>
                                        <div style={{
                                            fontSize: '14px',
                                            color: '#6b7280'
                                        }}>
                                            {duration}초 • {group.slides.length}개 슬라이드
                                        </div>
                                    </div>
                                    <div style={{
                                        padding: '4px 8px',
                                        backgroundColor: '#10b981',
                                        color: 'white',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        fontWeight: '500'
                                    }}>
                                        완료
                                    </div>
                                </div>

                                {/* 오디오 플레이어 */}
                                <div style={{ marginBottom: '16px' }}>
                                    <div style={{
                                        fontSize: '14px',
                                        fontWeight: '500',
                                        color: '#374151',
                                        marginBottom: '8px'
                                    }}>
                                        🔊 음성
                                    </div>
                                    <audio
                                        controls
                                        style={{
                                            width: '100%'
                                        }}
                                    >
                                        <source src={`http://localhost:3001${audioUrl}`} type="audio/mpeg" />
                                        브라우저가 오디오를 지원하지 않습니다.
                                    </audio>
                                </div>

                                {/* 생성된 이미지들 */}
                                <div style={{ marginBottom: '16px' }}>
                                    <div style={{
                                        fontSize: '14px',
                                        fontWeight: '500',
                                        color: '#374151',
                                        marginBottom: '8px'
                                    }}>
                                        🖼️ 이미지 ({images.length}개)
                                    </div>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                                        gap: '8px'
                                    }}>
                                        {images && Array.isArray(images) && images.map((image: any, idx: number) => (
                                            <div key={idx} style={{
                                                border: '1px solid #e5e7eb',
                                                borderRadius: '4px',
                                                overflow: 'hidden',
                                                backgroundColor: 'white'
                                            }}>
                                                <img
                                                    src={`http://localhost:3001${image.url}`}
                                                    alt={`Generated image ${idx + 1}`}
                                                    style={{
                                                        width: '100%',
                                                        height: '60px',
                                                        objectFit: 'cover'
                                                    }}
                                                    onError={(e) => {
                                                        e.currentTarget.style.display = 'none';
                                                    }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* 스크립트 미리보기 */}
                                <div>
                                    <div style={{
                                        fontSize: '14px',
                                        fontWeight: '500',
                                        color: '#374151',
                                        marginBottom: '8px'
                                    }}>
                                        📝 스크립트
                                    </div>
                                    <div style={{
                                        backgroundColor: 'white',
                                        padding: '12px',
                                        borderRadius: '4px',
                                        border: '1px solid #e5e7eb',
                                        fontSize: '12px',
                                        color: '#374151',
                                        maxHeight: '120px',
                                        overflow: 'hidden'
                                    }}>
                                        <div style={{ marginBottom: '4px' }}>
                                            <strong>Hook:</strong> {script.hook}
                                        </div>
                                        <div style={{ marginBottom: '4px' }}>
                                            <strong>Core:</strong> {script.coreMessage}
                                        </div>
                                        <div>
                                            <strong>CTA:</strong> {script.cta}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{
                    backgroundColor: '#eff6ff',
                    borderRadius: '12px',
                    padding: '24px',
                    marginBottom: '32px'
                }}>
                    <h3 style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        color: '#1e40af',
                        marginBottom: '12px'
                    }}>
                        💡 다음 단계
                    </h3>
                    <div style={{
                        fontSize: '14px',
                        color: '#374151',
                        lineHeight: '1.6'
                    }}>
                        <p style={{ marginBottom: '8px' }}>
                            • 생성된 음성과 이미지를 영상 편집 소프트웨어에서 조합하세요
                        </p>
                        <p style={{ marginBottom: '8px' }}>
                            • 각 그룹별로 개별 쇼츠 영상을 제작할 수 있습니다
                        </p>
                        <p style={{ marginBottom: '8px' }}>
                            • 필요에 따라 스크립트를 수정하고 다시 생성할 수 있습니다
                        </p>
                        <p>
                            • 다른 파일로 새로운 콘텐츠를 생성하려면 처음부터 다시 시작하세요
                        </p>
                    </div>
                </div>

                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '16px'
                }}>
                    <button
                        onClick={handleStartOver}
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
                        🚀 새로운 파일로 시작
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ResultPage; 