'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProgressBar from '../../components/ProgressBar';
import { getScriptData, setScriptData, clearGroupData } from '../../utils/sessionStorage';
import { API_URL } from '../../config/env';
import { StoryboardResponse, StoryboardScene } from '../../types/storyboard';

interface GeneratedImage {
    id: string;
    url: string;
    prompt: string;
    metadata: {
        provider: string;
        model: string;
        size: string;
        createdAt: string;
    };
}

interface StoryboardImageResult {
    sceneNumber: number;
    image: GeneratedImage;
    narrative: string;
    prompt: string;
}

interface StoryboardImagesResponse {
    images: StoryboardImageResult[];
    errors: Array<{
        sceneNumber: number;
        error: string;
    }>;
    totalScenes: number;
    successCount: number;
    errorCount: number;
    storyboard: {
        characters: string[];
        artStyle: string;
        estimatedDuration: number;
    };
}

const StoryboardImagesPage: React.FC = () => {
    const router = useRouter();
    const [storyboardData, setStoryboardData] = useState<StoryboardResponse | null>(null);
    const [generatingImages, setGeneratingImages] = useState(false);
    const [imageResults, setImageResults] = useState<StoryboardImagesResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        // 세션에서 스토리보드 데이터 가져오기
        const scriptData = getScriptData();
        if (!scriptData || !scriptData.storyboardResult) {
            setError('스토리보드 데이터가 없습니다. 스토리보드를 먼저 생성해주세요.');
            return;
        }

        setStoryboardData(scriptData.storyboardResult);
    }, []);

    const generateImages = async () => {
        if (!storyboardData) {
            setError('스토리보드 데이터가 없습니다.');
            return;
        }

        setGeneratingImages(true);
        setError(null);
        setImageResults(null);
        setProgress(0);

        try {
            console.log('API 호출 시작:', API_URL + '/api/generate-storyboard-images');
            console.log('요청 데이터:', storyboardData);

            const response = await fetch(API_URL + '/api/generate-storyboard-images', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    storyboard: storyboardData
                })
            });

            console.log('응답 상태:', response.status, response.statusText);
            console.log('응답 헤더:', response.headers);

            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (jsonError) {
                    console.error('JSON 파싱 오류:', jsonError);
                    const textResponse = await response.text();
                    console.error('텍스트 응답:', textResponse);
                    errorMessage = `서버 응답 오류: ${textResponse.substring(0, 200)}...`;
                }
                throw new Error(errorMessage);
            }

            const responseText = await response.text();
            console.log('응답 텍스트:', responseText.substring(0, 500) + '...');

            let data: { success: boolean; data: StoryboardImagesResponse };
            try {
                data = JSON.parse(responseText);
            } catch (parseError) {
                console.error('JSON 파싱 오류:', parseError);
                throw new Error('서버에서 유효하지 않은 JSON 응답을 받았습니다: ' + responseText.substring(0, 200));
            }

            console.log('스토리보드 이미지 생성 응답:', data);

            if (data.success && data.data) {
                setImageResults(data.data);
                setProgress(100);
            } else {
                throw new Error('Invalid response format from generate-storyboard-images API');
            }
        } catch (e: any) {
            console.error('스토리보드 이미지 생성 오류:', e);
            setError('이미지 생성 중 오류 발생: ' + (e?.message || e));
        } finally {
            setGeneratingImages(false);
        }
    };

    const handleContinue = () => {
        if (!imageResults) {
            setError('이미지를 먼저 생성해주세요.');
            return;
        }

        // 세션에 이미지 결과 저장
        const scriptData = getScriptData();
        setScriptData({
            ...scriptData,
            storyboardImages: imageResults,
            generationMode: 'storyboard-images'
        });

        // TTS 생성 페이지로 이동
        router.push('/tts');
    };

    const handleBack = () => {
        router.push('/script');
    };

    if (error && !storyboardData) {
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
                            스토리보드 생성으로 돌아가기
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
                        스토리보드 이미지 생성
                    </h1>
                    <p style={{
                        fontSize: '18px',
                        color: '#6b7280',
                        marginBottom: '32px'
                    }}>
                        스토리보드의 각 장면에 맞는 이미지를 생성합니다
                    </p>
                </div>

                {/* 스토리보드 정보 표시 */}
                {storyboardData && (
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
                            스토리보드 정보
                        </h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                            <div>
                                <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>총 장면 수</div>
                                <div style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>
                                    {storyboardData.scenes.length}개
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>예상 시간</div>
                                <div style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>
                                    {storyboardData.estimatedDuration}초
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>아트 스타일</div>
                                <div style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>
                                    {storyboardData.artStyle}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>캐릭터</div>
                                <div style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>
                                    {storyboardData.characters.length}명
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 이미지 생성 버튼 */}
                {!imageResults && (
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        padding: '32px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        marginBottom: '32px',
                        textAlign: 'center'
                    }}>
                        <div style={{
                            fontSize: '18px',
                            color: '#374151',
                            marginBottom: '24px'
                        }}>
                            스토리보드의 각 장면에 맞는 이미지를 생성하시겠습니까?
                        </div>
                        <button
                            onClick={generateImages}
                            disabled={generatingImages}
                            style={{
                                padding: '16px 32px',
                                backgroundColor: generatingImages ? '#d1d5db' : '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: generatingImages ? 'not-allowed' : 'pointer',
                                fontSize: '18px',
                                fontWeight: '600'
                            }}
                        >
                            {generatingImages ? '이미지 생성 중...' : '이미지 생성 시작'}
                        </button>
                    </div>
                )}

                {/* 진행 상황 표시 */}
                {generatingImages && (
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        padding: '32px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        marginBottom: '32px'
                    }}>
                        <div style={{
                            fontSize: '18px',
                            fontWeight: '600',
                            color: '#111827',
                            marginBottom: '16px',
                            textAlign: 'center'
                        }}>
                            이미지 생성 중...
                        </div>
                        <div style={{
                            width: '100%',
                            height: '8px',
                            backgroundColor: '#e5e7eb',
                            borderRadius: '4px',
                            overflow: 'hidden',
                            marginBottom: '16px'
                        }}>
                            <div style={{
                                width: `${progress}%`,
                                height: '100%',
                                backgroundColor: '#3b82f6',
                                transition: 'width 0.3s ease'
                            }} />
                        </div>
                        <div style={{
                            fontSize: '14px',
                            color: '#6b7280',
                            textAlign: 'center'
                        }}>
                            {progress}% 완료
                        </div>
                    </div>
                )}

                {/* 생성된 이미지 결과 표시 */}
                {imageResults && (
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
                                생성된 이미지
                            </h2>
                            <p style={{
                                fontSize: '14px',
                                color: '#6b7280',
                                margin: 0
                            }}>
                                성공: {imageResults.successCount}개 / 전체: {imageResults.totalScenes}개
                            </p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            {imageResults.images.map((result, index) => (
                                <div
                                    key={result.sceneNumber}
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
                                        장면 {result.sceneNumber}
                                    </h3>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', alignItems: 'start' }}>
                                        {/* 이미지 */}
                                        <div style={{
                                            aspectRatio: '9/16',
                                            backgroundColor: '#f3f4f6',
                                            borderRadius: '8px',
                                            overflow: 'hidden',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            border: '2px solid #e5e7eb'
                                        }}>
                                            <img
                                                src={result.image.url}
                                                alt={`장면 ${result.sceneNumber}`}
                                                style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'cover'
                                                }}
                                                onError={(e) => {
                                                    console.error('이미지 로드 실패:', e);
                                                    console.error('이미지 URL:', result.image.url);
                                                    e.currentTarget.style.display = 'none';
                                                }}
                                                onLoad={() => {
                                                    console.log('이미지 로드 성공:', result.image.url);
                                                }}
                                            />
                                        </div>

                                        {/* 텍스트 정보 */}
                                        <div>
                                            <div style={{ marginBottom: '16px' }}>
                                                <div style={{
                                                    fontSize: '14px',
                                                    fontWeight: '600',
                                                    color: '#374151',
                                                    marginBottom: '8px'
                                                }}>
                                                    내레이션
                                                </div>
                                                <div style={{
                                                    fontSize: '14px',
                                                    lineHeight: '1.6',
                                                    color: '#6b7280',
                                                    backgroundColor: 'white',
                                                    padding: '12px',
                                                    borderRadius: '6px',
                                                    border: '1px solid #e5e7eb'
                                                }}>
                                                    {result.narrative}
                                                </div>
                                            </div>

                                            <div>
                                                <div style={{
                                                    fontSize: '14px',
                                                    fontWeight: '600',
                                                    color: '#374151',
                                                    marginBottom: '8px'
                                                }}>
                                                    이미지 프롬프트
                                                </div>
                                                <div style={{
                                                    fontSize: '12px',
                                                    lineHeight: '1.5',
                                                    color: '#6b7280',
                                                    backgroundColor: 'white',
                                                    padding: '12px',
                                                    borderRadius: '6px',
                                                    border: '1px solid #e5e7eb',
                                                    fontFamily: 'monospace',
                                                    maxHeight: '100px',
                                                    overflow: 'auto'
                                                }}>
                                                    {result.prompt}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* 에러 표시 */}
                        {imageResults.errors.length > 0 && (
                            <div style={{
                                marginTop: '24px',
                                padding: '16px',
                                backgroundColor: '#fef2f2',
                                borderRadius: '8px',
                                border: '1px solid #fecaca'
                            }}>
                                <div style={{
                                    fontSize: '16px',
                                    fontWeight: '600',
                                    color: '#dc2626',
                                    marginBottom: '12px'
                                }}>
                                    생성 실패한 장면들
                                </div>
                                {imageResults.errors.map((error, index) => (
                                    <div key={index} style={{
                                        fontSize: '14px',
                                        color: '#dc2626',
                                        marginBottom: '8px'
                                    }}>
                                        장면 {error.sceneNumber}: {error.error}
                                    </div>
                                ))}
                            </div>
                        )}
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
                        disabled={!imageResults}
                        style={{
                            padding: '12px 24px',
                            backgroundColor: !imageResults ? '#d1d5db' : '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: !imageResults ? 'not-allowed' : 'pointer',
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

export default StoryboardImagesPage;
