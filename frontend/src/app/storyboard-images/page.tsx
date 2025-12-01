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
    generating?: boolean; // 재시도 중 상태
    error?: string; // 에러 메시지
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
                // errors 배열을 images 배열로 병합
                const combinedImages = [...data.data.images];

                // 실패한 장면들도 표시하기 위해 errors를 images 배열에 추가
                if (data.data.errors && data.data.errors.length > 0) {
                    data.data.errors.forEach((error: { sceneNumber: number; error: string }) => {
                        // 해당 장면의 원본 데이터 찾기
                        const scene = storyboardData?.scenes.find(s => s.scene_number === error.sceneNumber);

                        combinedImages.push({
                            sceneNumber: error.sceneNumber,
                            image: {
                                id: `error_${error.sceneNumber}`,
                                url: '',
                                prompt: scene?.image_prompt_english || '',
                                metadata: {
                                    provider: 'error',
                                    model: 'unknown',
                                    size: 'unknown',
                                    createdAt: new Date().toISOString()
                                }
                            },
                            narrative: scene?.narrative_korean || scene?.narrative_english || '',
                            prompt: scene?.image_prompt_english || '',
                            error: error.error,
                            generating: false
                        });
                    });
                }

                // 장면 번호 순으로 정렬
                combinedImages.sort((a, b) => a.sceneNumber - b.sceneNumber);

                setImageResults({
                    ...data.data,
                    images: combinedImages
                });
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

        // 세션에 이미지 결과 저장 (이미지 URL만 저장)
        const scriptData = getScriptData();

        // storyboardImages 최적화 - 전체 이미지 객체 대신 URL만 저장
        const optimizedStoryboardImages = {
            ...imageResults,
            images: imageResults.images.map(img => ({
                sceneNumber: img.sceneNumber,
                narrative: img.narrative.substring(0, 300), // 짧게 잘라서 저장
                prompt: img.prompt.substring(0, 200), // 프롬프트도 일부만
                image: {
                    id: img.image.id,
                    url: img.image.url, // URL만 저장
                    prompt: img.image.prompt.substring(0, 200),
                    metadata: img.image.metadata
                }
            }))
        };

        setScriptData({
            ...scriptData,
            storyboardImages: optimizedStoryboardImages,
            generationMode: 'storyboard-images'
        });

        // TTS 생성 페이지로 이동
        router.push('/tts');
    };

    const handleBack = () => {
        router.push('/script');
    };

    // 개별 이미지 재시도 함수
    const retryImageGeneration = async (sceneNumber: number) => {
        if (!storyboardData || !imageResults) return;

        // 해당 장면의 재시도 상태 설정
        const updatedImages = imageResults.images.map(img =>
            img.sceneNumber === sceneNumber
                ? { ...img, generating: true, error: undefined }
                : img
        );
        setImageResults({ ...imageResults, images: updatedImages });

        try {
            // 해당 장면의 데이터 가져오기
            const scene = storyboardData.scenes.find(s => s.scene_number === sceneNumber);
            if (!scene) {
                throw new Error('장면 데이터를 찾을 수 없습니다.');
            }

            // 개별 이미지 생성 API 호출
            const response = await fetch(API_URL + '/api/generate-storyboard-images', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    storyboard: {
                        scenes: [scene], // 단일 장면만
                        characters: storyboardData.characters,
                        artStyle: storyboardData.artStyle
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            const { success, data } = await response.json();

            if (success && data.images && data.images.length > 0) {
                // 성공: 해당 장면의 이미지를 업데이트
                const updated = imageResults.images.map(img =>
                    img.sceneNumber === sceneNumber
                        ? {
                            ...data.images[0],
                            generating: false,
                            error: undefined
                        }
                        : img
                );

                setImageResults({
                    ...imageResults,
                    images: updated,
                    successCount: updated.filter(img => !img.error).length,
                    errorCount: updated.filter(img => img.error).length
                });
            } else {
                throw new Error('이미지 생성 실패: 서버 응답이 올바르지 않습니다.');
            }
        } catch (error: any) {
            console.error('이미지 재시도 실패:', error);
            // 에러 상태로 표시
            const updatedImages = imageResults.images.map(img =>
                img.sceneNumber === sceneNumber
                    ? {
                        ...img,
                        generating: false,
                        error: error.message || '이미지 생성 실패'
                    }
                    : img
            );
            setImageResults({
                ...imageResults,
                images: updatedImages,
                errorCount: updatedImages.filter(img => img.error).length
            });
        }
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
        <>
            <style>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .loading-spinner {
                    animation: spin 1s linear infinite;
                }
            `}</style>
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
                                            border: `2px solid ${result.error ? '#dc2626' : '#e5e7eb'}`,
                                            borderRadius: '8px',
                                            padding: '20px',
                                            backgroundColor: result.error ? '#fef2f2' : '#f9fafb'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                            <h3 style={{
                                                fontSize: '18px',
                                                fontWeight: '600',
                                                color: '#111827',
                                            }}>
                                                장면 {result.sceneNumber}
                                            </h3>
                                            {result.error && (
                                                <button
                                                    onClick={() => retryImageGeneration(result.sceneNumber)}
                                                    disabled={result.generating}
                                                    style={{
                                                        padding: '8px 16px',
                                                        backgroundColor: result.generating ? '#d1d5db' : '#3b82f6',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        cursor: result.generating ? 'not-allowed' : 'pointer',
                                                        fontSize: '14px',
                                                        fontWeight: '600'
                                                    }}
                                                >
                                                    {result.generating ? '재시도 중...' : '재시도'}
                                                </button>
                                            )}
                                        </div>

                                        {/* 에러 메시지 표시 */}
                                        {result.error && (
                                            <div style={{
                                                padding: '12px',
                                                backgroundColor: '#fee2e2',
                                                borderRadius: '6px',
                                                marginBottom: '16px',
                                                border: '1px solid #fecaca'
                                            }}>
                                                <div style={{
                                                    fontSize: '14px',
                                                    color: '#dc2626',
                                                    fontWeight: '600',
                                                    marginBottom: '4px'
                                                }}>
                                                    ⚠️ 이미지 생성 실패
                                                </div>
                                                <div style={{
                                                    fontSize: '13px',
                                                    color: '#991b1b',
                                                    fontFamily: 'monospace',
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-all'
                                                }}>
                                                    {result.error}
                                                </div>
                                            </div>
                                        )}

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
                                                border: '2px solid #e5e7eb',
                                                position: 'relative'
                                            }}>
                                                {result.generating ? (
                                                    // 재시도 중 로딩 스피너
                                                    <div style={{
                                                        width: '100%',
                                                        height: '100%',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                                        position: 'absolute',
                                                        top: 0,
                                                        left: 0,
                                                        zIndex: 10
                                                    }}>
                                                        <div
                                                            className="loading-spinner"
                                                            style={{
                                                                width: '48px',
                                                                height: '48px',
                                                                border: '4px solid #e5e7eb',
                                                                borderTop: '4px solid #3b82f6',
                                                                borderRadius: '50%',
                                                                marginBottom: '16px'
                                                            }}
                                                        />
                                                        <div style={{
                                                            fontSize: '14px',
                                                            fontWeight: '600',
                                                            color: '#3b82f6'
                                                        }}>
                                                            이미지 생성 중...
                                                        </div>
                                                    </div>
                                                ) : null}

                                                {result.image.url ? (
                                                    <img
                                                        src={result.image.url}
                                                        alt={`장면 ${result.sceneNumber}`}
                                                        style={{
                                                            width: '100%',
                                                            height: '100%',
                                                            objectFit: 'cover',
                                                            opacity: result.generating ? 0.3 : 1,
                                                            transition: 'opacity 0.3s ease'
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
                                                ) : (
                                                    // 이미지가 없는 경우 플레이스홀더 표시
                                                    <div style={{
                                                        width: '100%',
                                                        height: '100%',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: '#9ca3af',
                                                        padding: '20px',
                                                        textAlign: 'center'
                                                    }}>
                                                        <div style={{
                                                            fontSize: '48px',
                                                            marginBottom: '12px'
                                                        }}>
                                                            🖼️
                                                        </div>
                                                        <div style={{
                                                            fontSize: '14px',
                                                            fontWeight: '600',
                                                            marginBottom: '4px'
                                                        }}>
                                                            이미지 없음
                                                        </div>
                                                        <div style={{
                                                            fontSize: '12px'
                                                        }}>
                                                            생성 실패
                                                        </div>
                                                    </div>
                                                )}
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
        </>
    );
};

export default StoryboardImagesPage;
