import React from 'react';

interface VisualAnalysisResult {
    hasSufficientVisuals: boolean;
    needsAdditionalVisuals: boolean;
    visualScore: number;
    recommendedImagePrompt?: string;
    slideType: 'text-heavy' | 'image-heavy' | 'balanced' | 'minimal';
}

interface Slide {
    id: number;
    text: string;
    images: string[];
    hasVisuals: boolean;
    visualMetadata?: {
        textLength: number;
        imageCount: number;
        slideType: 'text-heavy' | 'image-heavy' | 'balanced' | 'minimal';
    };
}

interface VisualAnalysisDisplayProps {
    slides: Slide[];
    analysisResults?: VisualAnalysisResult[];
    onGenerateImages?: (slides: Slide[]) => void;
    onGenerateImagesForGroups?: (selectedGroups: string[]) => void;
    generatingImages?: boolean;
    slideGroups?: Array<{ id: string; title: string; slides: number[] }>;
    selectedGroups?: string[];
}

const VisualAnalysisDisplay: React.FC<VisualAnalysisDisplayProps> = ({
    slides,
    analysisResults,
    onGenerateImages,
    onGenerateImagesForGroups,
    generatingImages = false,
    slideGroups = [],
    selectedGroups = []
}) => {
    const getSlideTypeColor = (slideType: string) => {
        switch (slideType) {
            case 'text-heavy':
                return { backgroundColor: '#fee2e2', color: '#991b1b', borderColor: '#fecaca' };
            case 'image-heavy':
                return { backgroundColor: '#dcfce7', color: '#166534', borderColor: '#bbf7d0' };
            case 'balanced':
                return { backgroundColor: '#dbeafe', color: '#1e40af', borderColor: '#bfdbfe' };
            case 'minimal':
                return { backgroundColor: '#f3f4f6', color: '#374151', borderColor: '#d1d5db' };
            default:
                return { backgroundColor: '#f3f4f6', color: '#374151', borderColor: '#d1d5db' };
        }
    };

    const getSlideTypeLabel = (slideType: string) => {
        switch (slideType) {
            case 'text-heavy':
                return '텍스트 위주';
            case 'image-heavy':
                return '이미지 위주';
            case 'balanced':
                return '균형잡힌';
            case 'minimal':
                return '최소한';
            default:
                return '알 수 없음';
        }
    };

    const getVisualScoreColor = (score: number) => {
        if (score >= 0.6) return '#059669';
        if (score >= 0.3) return '#d97706';
        return '#dc2626';
    };

    const getVisualScoreLabel = (score: number) => {
        if (score >= 0.6) return '우수';
        if (score >= 0.3) return '보통';
        return '개선 필요';
    };

    const slidesNeedingImages = analysisResults?.filter(result => result.needsAdditionalVisuals).length || 0;
    const totalSlides = slides.length;

    return (
        <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            padding: '24px',
            marginBottom: '24px'
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px'
            }}>
                <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#111827'
                }}>시각적 분석 결과</h3>
                {slidesNeedingImages > 0 && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {onGenerateImages && (
                            <button
                                onClick={() => onGenerateImages(slides)}
                                disabled={generatingImages}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: generatingImages ? '#6b7280' : '#2563eb',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: generatingImages ? 'not-allowed' : 'pointer',
                                    opacity: generatingImages ? 0.5 : 1
                                }}
                            >
                                {generatingImages ? '이미지 생성 중...' : `${slidesNeedingImages}개 슬라이드에 이미지 생성`}
                            </button>
                        )}
                        {onGenerateImagesForGroups && slideGroups.length > 0 && (
                            <button
                                onClick={() => onGenerateImagesForGroups(selectedGroups.length > 0 ? selectedGroups : slideGroups.map(g => g.id))}
                                disabled={generatingImages}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: generatingImages ? '#6b7280' : '#059669',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: generatingImages ? 'not-allowed' : 'pointer',
                                    opacity: generatingImages ? 0.5 : 1
                                }}
                            >
                                {generatingImages ? '그룹별 이미지 생성 중...' : `그룹별 이미지 생성 (${selectedGroups.length > 0 ? selectedGroups.length : slideGroups.length}개 그룹)`}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* 요약 통계 */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                marginBottom: '24px'
            }}>
                <div style={{
                    backgroundColor: '#eff6ff',
                    padding: '16px',
                    borderRadius: '8px'
                }}>
                    <div style={{
                        fontSize: '24px',
                        fontWeight: 'bold',
                        color: '#2563eb'
                    }}>{totalSlides}</div>
                    <div style={{
                        fontSize: '14px',
                        color: '#2563eb'
                    }}>전체 슬라이드</div>
                </div>
                <div style={{
                    backgroundColor: '#f0fdf4',
                    padding: '16px',
                    borderRadius: '8px'
                }}>
                    <div style={{
                        fontSize: '24px',
                        fontWeight: 'bold',
                        color: '#16a34a'
                    }}>
                        {analysisResults?.filter(r => r.hasSufficientVisuals).length || 0}
                    </div>
                    <div style={{
                        fontSize: '14px',
                        color: '#16a34a'
                    }}>충분한 시각적 요소</div>
                </div>
                <div style={{
                    backgroundColor: '#fefce8',
                    padding: '16px',
                    borderRadius: '8px'
                }}>
                    <div style={{
                        fontSize: '24px',
                        fontWeight: 'bold',
                        color: '#ca8a04'
                    }}>{slidesNeedingImages}</div>
                    <div style={{
                        fontSize: '14px',
                        color: '#ca8a04'
                    }}>이미지 생성 필요</div>
                </div>
                <div style={{
                    backgroundColor: '#faf5ff',
                    padding: '16px',
                    borderRadius: '8px'
                }}>
                    <div style={{
                        fontSize: '24px',
                        fontWeight: 'bold',
                        color: '#9333ea'
                    }}>
                        {analysisResults?.filter(r => r.slideType === 'text-heavy').length || 0}
                    </div>
                    <div style={{
                        fontSize: '14px',
                        color: '#9333ea'
                    }}>텍스트 위주 슬라이드</div>
                </div>
            </div>

            {/* 슬라이드별 상세 분석 */}
            <div style={{ marginTop: '16px' }}>
                <h4 style={{
                    fontSize: '16px',
                    fontWeight: '500',
                    color: '#111827',
                    marginBottom: '16px'
                }}>슬라이드별 분석</h4>
                {slides.map((slide, index) => {
                    const analysis = analysisResults?.[index];
                    const metadata = slide.visualMetadata;

                    return (
                        <div key={slide.id} style={{
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            padding: '16px',
                            backgroundColor: '#f9fafb',
                            marginBottom: '16px'
                        }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: '8px'
                            }}>
                                <h5 style={{
                                    fontWeight: '500',
                                    color: '#111827'
                                }}>슬라이드 {slide.id}</h5>
                                {metadata && (
                                    <span style={{
                                        padding: '4px 8px',
                                        borderRadius: '9999px',
                                        fontSize: '12px',
                                        fontWeight: '500',
                                        border: '1px solid',
                                        ...getSlideTypeColor(metadata.slideType)
                                    }}>
                                        {getSlideTypeLabel(metadata.slideType)}
                                    </span>
                                )}
                            </div>

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                                gap: '16px',
                                fontSize: '14px'
                            }}>
                                <div>
                                    <span style={{ color: '#6b7280' }}>텍스트 길이:</span>
                                    <span style={{ marginLeft: '8px', fontWeight: '500' }}>{metadata?.textLength || slide.text.length}자</span>
                                </div>
                                <div>
                                    <span style={{ color: '#6b7280' }}>이미지 개수:</span>
                                    <span style={{ marginLeft: '8px', fontWeight: '500' }}>{metadata?.imageCount || slide.images.length}개</span>
                                </div>
                                {analysis && (
                                    <div>
                                        <span style={{ color: '#6b7280' }}>시각적 점수:</span>
                                        <span style={{
                                            marginLeft: '8px',
                                            fontWeight: '500',
                                            color: getVisualScoreColor(analysis.visualScore)
                                        }}>
                                            {getVisualScoreLabel(analysis.visualScore)} ({(analysis.visualScore * 100).toFixed(0)}%)
                                        </span>
                                    </div>
                                )}
                            </div>

                            {slide.text && (
                                <div style={{ marginTop: '8px' }}>
                                    <span style={{ color: '#6b7280', fontSize: '14px' }}>텍스트 미리보기:</span>
                                    <p style={{
                                        fontSize: '14px',
                                        color: '#374151',
                                        marginTop: '4px',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden'
                                    }}>
                                        {slide.text.length > 100 ? `${slide.text.substring(0, 100)}...` : slide.text}
                                    </p>
                                </div>
                            )}

                            {analysis?.recommendedImagePrompt && (
                                <div style={{
                                    marginTop: '12px',
                                    padding: '12px',
                                    backgroundColor: '#eff6ff',
                                    borderRadius: '6px'
                                }}>
                                    <span style={{
                                        fontSize: '14px',
                                        fontWeight: '500',
                                        color: '#1e40af'
                                    }}>추천 이미지 프롬프트:</span>
                                    <p style={{
                                        fontSize: '14px',
                                        color: '#1d4ed8',
                                        marginTop: '4px'
                                    }}>{analysis.recommendedImagePrompt}</p>
                                </div>
                            )}

                            {slide.images.length > 0 && (
                                <div style={{ marginTop: '12px' }}>
                                    <span style={{ fontSize: '14px', color: '#6b7280' }}>기존 이미지:</span>
                                    <div style={{
                                        display: 'flex',
                                        gap: '8px',
                                        marginTop: '4px'
                                    }}>
                                        {slide.images.map((image, imgIndex) => (
                                            <img
                                                key={imgIndex}
                                                src={image}
                                                alt={`Slide ${slide.id} image ${imgIndex + 1}`}
                                                style={{
                                                    width: '64px',
                                                    height: '64px',
                                                    objectFit: 'cover',
                                                    borderRadius: '4px',
                                                    border: '1px solid #e5e7eb'
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* 개선 제안 */}
            {slidesNeedingImages > 0 && (
                <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
                    <h4 className="text-md font-medium text-yellow-800 mb-2">개선 제안</h4>
                    <ul className="text-sm text-yellow-700 space-y-1">
                        <li>• {slidesNeedingImages}개 슬라이드에 시각적 요소가 부족합니다</li>
                        <li>• AI 이미지 생성을 통해 시각적 매력을 높일 수 있습니다</li>
                        <li>• 텍스트 위주 슬라이드는 관련 이미지 추가를 권장합니다</li>
                    </ul>
                </div>
            )}
        </div>
    );
};

export default VisualAnalysisDisplay; 