'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProgressBar from '../../components/ProgressBar';
import { getTTSData, setImageData, clearTTSData } from '../../utils/sessionStorage';
import { API_URL } from '../../config/env';

const ImagesPage: React.FC = () => {
    const router = useRouter();
    const [ttsData, setTTSDataState] = useState<any>(null);
    const [audioResult, setAudioResult] = useState<any[]>([]);
    const [generatingImages, setGeneratingImages] = useState(false);
    const [generatedImages, setGeneratedImages] = useState<any[]>([]);
    const [imageScripts, setImageScripts] = useState<any[]>([]);
    const [showScripts, setShowScripts] = useState(false);
    const [generatingScripts, setGeneratingScripts] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [imageGenerationProgress, setImageGenerationProgress] = useState<{ [groupId: string]: string }>({});
    const [failedImages, setFailedImages] = useState<string[]>([]);

    useEffect(() => {
        // API_URL 디버깅
        console.log('🔧 Frontend API_URL:', API_URL);

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

    const generateImageScripts = async () => {
        console.log('=== generateImageScripts 함수 시작 ===');
        console.log('audioResult:', audioResult);

        if (!audioResult || audioResult.length === 0) {
            console.error('audioResult가 없거나 비어있음');
            setError('TTS 데이터가 없습니다.');
            return;
        }

        setGeneratingScripts(true);
        setError(null);

        try {
            console.log('AI 이미지 스크립트 생성 시작...');
            console.log('처리할 그룹 수:', audioResult.length);

            const scriptResults = await Promise.all(
                audioResult.map(async ({ group, script, audioUrl, duration }, index) => {
                    console.log(`=== 그룹 ${index + 1}/${audioResult.length} 처리 시작 ===`);
                    console.log('그룹 정보:', {
                        id: group.id,
                        title: group.title,
                        slides: group.slides
                    });
                    console.log('스크립트 정보:', {
                        hasCoreMessage: !!script.coreMessage,
                        coreMessageLength: script.coreMessage?.length || 0,
                        coreMessage: script.coreMessage ? script.coreMessage.substring(0, 100) + '...' : '없음'
                    });

                    // 그룹 슬라이드는 더 이상 사용하지 않음
                    const requestBody = {
                        groups: [{ id: group.id, title: group.title }],
                        slides: [],
                        coreMessages: [{
                            groupId: group.id,
                            coreMessage: script.coreMessage || ''
                        }]
                    };

                    console.log('API 요청 바디:', {
                        groupsCount: requestBody.groups.length,
                        slidesCount: requestBody.slides.length,
                        coreMessagesCount: requestBody.coreMessages.length,
                        coreMessage: requestBody.coreMessages[0].coreMessage.substring(0, 100) + '...'
                    });

                    console.log('API 호출 시작...');
                    const scriptResponse = await fetch(API_URL + '/api/generate-image-scripts', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify(requestBody),
                    });

                    console.log('API 응답 상태:', scriptResponse.status, scriptResponse.statusText);

                    if (!scriptResponse.ok) {
                        const errorData = await scriptResponse.json();
                        console.error('API 오류 응답:', errorData);
                        throw new Error(errorData.error || `HTTP ${scriptResponse.status}: ${scriptResponse.statusText}`);
                    }

                    const scriptData = await scriptResponse.json();
                    console.log('API 응답 데이터:', scriptData);
                    console.log(`그룹 ${group.title} 스크립트 생성 완료:`, scriptData.data?.groups?.[0]?.imageScripts?.length || 0, '개');

                    // 동적 프롬프트 확인
                    const imageScripts = scriptData.data?.groups?.[0]?.imageScripts || [];
                    console.log('=== 생성된 동적 스크립트 상세 분석 ===');
                    imageScripts.forEach((script: any, index: number) => {
                        console.log(`동적 스크립트 ${index + 1}:`, {
                            id: script.id,
                            description: script.description,
                            promptLength: script.prompt?.length || 0,
                            promptPreview: script.prompt?.substring(0, 150) + '...',
                            isDynamic: script.prompt?.includes('동적') || script.prompt?.includes('분석') || script.prompt?.includes('구체적') || script.prompt?.includes('watercolor') || script.prompt?.includes('illustration')
                        });
                    });

                    return {
                        group,
                        script,
                        audioUrl,
                        duration,
                        imageScripts: imageScripts
                    };
                })
            );

            console.log('모든 그룹 처리 완료:', scriptResults.length, '개');
            setImageScripts(scriptResults);
            setShowScripts(true);
            console.log('모든 그룹의 AI 스크립트 생성 완료');
        } catch (e: any) {
            console.error('=== AI 이미지 스크립트 생성 오류 ===');
            console.error('에러 상세:', e);
            console.error('에러 메시지:', e?.message);
            setError('AI 스크립트 생성 중 오류 발생: ' + (e?.message || e));
        } finally {
            setGeneratingScripts(false);
        }
    };

    const generateImagesForGroups = async () => {
        if (!imageScripts || imageScripts.length === 0) {
            setError('이미지 스크립트가 없습니다. 먼저 스크립트를 생성해주세요.');
            return;
        }
        setGeneratingImages(true);
        setError(null);
        setGeneratedImages([]);
        setImageGenerationProgress({});
        setFailedImages([]);

        try {
            console.log('이미지 생성 시작...');
            const results = await Promise.all(
                imageScripts.map(async ({ group, script, audioUrl, duration, imageScripts }) => {
                    // 활성화된 스크립트만 필터링
                    const enabledScripts = imageScripts.filter((script: any) => script.enabled !== false);

                    if (enabledScripts.length === 0) {
                        console.warn(`그룹 ${group.title}에 활성화된 스크립트가 없습니다.`);
                        return {
                            group,
                            script,
                            audioUrl,
                            duration,
                            images: [],
                            imageScripts: []
                        };
                    }

                    const requestBody = {
                        groups: [{ id: group.id, title: group.title }],
                        slides: [],
                        imageScripts: [{
                            groupId: group.id,
                            imageScripts: enabledScripts
                        }]
                    };

                    const response = await fetch(API_URL + '/api/generate-images-for-groups', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify(requestBody),
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
                    }

                    const data = await response.json();
                    console.log('이미지 생성 응답:', data);

                    if (data.success && data.data) {
                        const images = Array.isArray(data.data.images) ? data.data.images : [];

                        if (images.length === 0) {
                            console.warn(`그룹 ${group.title}에 대해 이미지가 생성되지 않았습니다. API 키를 확인해주세요.`);
                            if (!window.localStorage.getItem('apiKeyWarningShown')) {
                                setError('이미지 생성에 실패했습니다. API 키를 설정해주세요. (이 메시지는 한 번만 표시됩니다)');
                                window.localStorage.setItem('apiKeyWarningShown', 'true');
                            }
                        }

                        return {
                            group,
                            script,
                            audioUrl,
                            duration,
                            images: images,
                            imageScripts: enabledScripts
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

        // 영상 생성 페이지로 이동
        router.push('/video');
    };

    const handleBack = () => {
        clearTTSData();
        router.push('/tts');
    };

    const handleScriptEdit = (groupIndex: number, scriptIndex: number, newPrompt: string) => {
        const updatedScripts = [...imageScripts];
        updatedScripts[groupIndex].imageScripts[scriptIndex].prompt = newPrompt;
        setImageScripts(updatedScripts);
    };

    const handleScriptToggle = (groupIndex: number, scriptIndex: number) => {
        const updatedScripts = [...imageScripts];
        updatedScripts[groupIndex].imageScripts[scriptIndex].enabled =
            !updatedScripts[groupIndex].imageScripts[scriptIndex].enabled;
        setImageScripts(updatedScripts);
    };

    if (error && !ttsData) {
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
                        이미지 생성
                    </h1>
                    <p style={{
                        fontSize: '18px',
                        color: '#6b7280',
                        marginBottom: '16px'
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
                        <div style={{ display: 'flex', gap: '12px' }}>
                            {!showScripts && (
                                <button
                                    onClick={generateImageScripts}
                                    disabled={generatingScripts}
                                    style={{
                                        padding: '12px 24px',
                                        backgroundColor: generatingScripts ? '#d1d5db' : '#10b981',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: generatingScripts ? 'not-allowed' : 'pointer',
                                        fontSize: '16px'
                                    }}
                                >
                                    {generatingScripts ? 'Core Message 기반 동적 스크립트 생성 중...' : 'Core Message로 동적 스크립트 생성'}
                                </button>
                            )}
                            {showScripts && (
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
                            )}
                        </div>
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
                                    {duration}초
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

                {/* 이미지 스크립트 미리보기 */}
                {showScripts && imageScripts && imageScripts.length > 0 && (
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
                            동적 이미지 스크립트 미리보기 (Core Message 기반)
                            {imageScripts.length > 0 && (
                                <span style={{
                                    fontSize: '16px',
                                    color: '#6b7280',
                                    fontWeight: 'normal',
                                    marginLeft: '12px'
                                }}>
                                    - 총 {imageScripts.reduce((total, group) =>
                                        total + group.imageScripts.filter((s: any) => s.enabled !== false).length, 0
                                    )}개 활성
                                </span>
                            )}
                        </h2>
                        <p style={{
                            fontSize: '14px',
                            color: '#6b7280',
                            marginBottom: '24px'
                        }}>
                            각 그룹의 Core Message를 기반으로 동적 분석을 통해 4개의 고품질 이미지 스크립트를 생성했습니다.
                            Core Message가 없는 그룹은 동적 프롬프트 생성을 위해 Core Message가 필요합니다.
                            필요에 따라 수정한 후 이미지를 생성하세요.
                            {imageScripts.length > 0 && (
                                <span style={{ color: '#10b981', fontWeight: '600' }}>
                                    {' '}✓ Core Message 기반 동적 스크립트 생성 완료
                                </span>
                            )}
                        </p>

                        {imageScripts.map(({ group, imageScripts }, groupIndex) => {
                            // 해당 그룹의 script 정보 찾기
                            const groupScript = audioResult.find(({ group: g }) => g.id === group.id)?.script;

                            return (
                                <div key={group.id} style={{
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px',
                                    padding: '20px',
                                    marginBottom: '20px',
                                    backgroundColor: '#f9fafb'
                                }}>
                                    <div style={{
                                        fontWeight: '600',
                                        fontSize: '18px',
                                        color: '#111827',
                                        marginBottom: '16px'
                                    }}>
                                        {group.title} - 동적 이미지 스크립트 ({imageScripts.filter((s: any) => s.enabled !== false).length}/{imageScripts.length} 활성)
                                        {groupScript?.coreMessage ? (
                                            <span style={{
                                                fontSize: '14px',
                                                color: '#10b981',
                                                fontWeight: 'normal',
                                                marginLeft: '8px'
                                            }}>
                                                ✓ Core Message 기반 동적 분석
                                            </span>
                                        ) : (
                                            <span style={{
                                                fontSize: '14px',
                                                color: '#dc2626',
                                                fontWeight: 'normal',
                                                marginLeft: '8px'
                                            }}>
                                                ❌ Core Message 필요
                                            </span>
                                        )}
                                    </div>

                                    {/* Core Message 미리보기 */}
                                    {groupScript?.coreMessage && (
                                        <div style={{
                                            backgroundColor: '#f0f9ff',
                                            border: '1px solid #0ea5e9',
                                            borderRadius: '8px',
                                            padding: '12px',
                                            marginBottom: '16px'
                                        }}>
                                            <div style={{
                                                fontSize: '12px',
                                                color: '#0369a1',
                                                fontWeight: '600',
                                                marginBottom: '4px'
                                            }}>
                                                📝 Core Message (이미지 스크립트 생성 기준)
                                            </div>
                                            <div style={{
                                                fontSize: '14px',
                                                color: '#0c4a6e',
                                                lineHeight: '1.4'
                                            }}>
                                                {groupScript.coreMessage}
                                            </div>
                                        </div>
                                    )}

                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                                        gap: '16px'
                                    }}>
                                        {imageScripts.map((script: any, scriptIndex: number) => (
                                            <div key={script.id} style={{
                                                border: '1px solid #e5e7eb',
                                                borderRadius: '8px',
                                                padding: '16px',
                                                backgroundColor: 'white',
                                                opacity: script.enabled !== false ? 1 : 0.6
                                            }}>
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    marginBottom: '8px'
                                                }}>
                                                    <div style={{
                                                        fontSize: '12px',
                                                        color: '#6b7280',
                                                        fontWeight: '600'
                                                    }}>
                                                        스크립트 {scriptIndex + 1}: {script.description}
                                                    </div>
                                                    <div style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px'
                                                    }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={script.enabled !== false}
                                                            onChange={() => handleScriptToggle(groupIndex, scriptIndex)}
                                                            style={{
                                                                width: '16px',
                                                                height: '16px',
                                                                accentColor: '#3b82f6'
                                                            }}
                                                        />
                                                        <span style={{
                                                            fontSize: '10px',
                                                            color: script.enabled !== false ? '#10b981' : '#6b7280'
                                                        }}>
                                                            {script.enabled !== false ? '활성' : '비활성'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <textarea
                                                    value={script.prompt}
                                                    onChange={(e) => handleScriptEdit(groupIndex, scriptIndex, e.target.value)}
                                                    style={{
                                                        width: '100%',
                                                        minHeight: '80px',
                                                        padding: '8px',
                                                        border: '1px solid #d1d5db',
                                                        borderRadius: '4px',
                                                        fontSize: '12px',
                                                        fontFamily: 'monospace',
                                                        resize: 'vertical',
                                                        backgroundColor: script.enabled !== false ? 'white' : '#f9fafb'
                                                    }}
                                                    placeholder="이미지 생성 프롬프트를 수정하세요..."
                                                    disabled={script.enabled === false}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

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
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '12px'
                                }}>
                                    <div style={{
                                        fontWeight: '600',
                                        fontSize: '18px',
                                        color: '#111827'
                                    }}>
                                        {group.title} ({duration}초)
                                    </div>
                                    <div style={{
                                        fontSize: '12px',
                                        color: '#6b7280',
                                        backgroundColor: '#f3f4f6',
                                        padding: '4px 8px',
                                        borderRadius: '4px'
                                    }}>
                                        이미지: {images.length}개
                                    </div>
                                </div>

                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                                    gap: '16px',
                                    marginBottom: '16px'
                                }}>
                                    {images && Array.isArray(images) && images.length > 0 ? images.map((image: any, idx: number) => (
                                        <div key={idx} style={{
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '8px',
                                            overflow: 'hidden',
                                            backgroundColor: 'white'
                                        }}>
                                            <img
                                                src={(() => {
                                                    const constructedUrl = image.url.startsWith('data:image') ? image.url :
                                                        image.url.startsWith('http') ? image.url :
                                                            `${API_URL}${image.url}`;
                                                    console.log('🔍 Image URL Debug:', {
                                                        originalUrl: image.url,
                                                        apiUrl: API_URL,
                                                        constructedUrl: constructedUrl,
                                                        isDataUrl: image.url.startsWith('data:image'),
                                                        isHttpUrl: image.url.startsWith('http')
                                                    });
                                                    return constructedUrl;
                                                })()}
                                                alt={`Generated image ${idx + 1}`}
                                                style={{
                                                    width: '100%',
                                                    height: '150px',
                                                    objectFit: 'cover'
                                                }}
                                                onError={(e) => {
                                                    console.error('이미지 로드 실패:', image.url);
                                                    console.error('이미지 URL 타입:', {
                                                        isDataUrl: image.url.startsWith('data:image'),
                                                        isHttpUrl: image.url.startsWith('http'),
                                                        urlLength: image.url.length,
                                                        urlPrefix: image.url.substring(0, 100)
                                                    });

                                                    // base64 데이터가 잘린 경우 처리
                                                    if (image.url.startsWith('data:image') && image.url.length < 200) {
                                                        console.error('Base64 데이터가 잘렸습니다. 이미지를 다시 생성해주세요.');
                                                        e.currentTarget.style.display = 'none';
                                                        // 에러 메시지와 재시도 버튼 표시
                                                        const errorDiv = document.createElement('div');
                                                        errorDiv.innerHTML = `
                                                            <div style="padding: 8px; color: #dc2626; font-size: 12px; text-align: center;">
                                                                <div style="margin-bottom: 8px;">이미지 데이터 오류</div>
                                                                <button onclick="window.location.reload()" style="
                                                                    background: #dc2626; 
                                                                    color: white; 
                                                                    border: none; 
                                                                    padding: 4px 8px; 
                                                                    border-radius: 4px; 
                                                                    cursor: pointer; 
                                                                    font-size: 11px;
                                                                ">새로고침</button>
                                                            </div>
                                                        `;
                                                        e.currentTarget.parentNode?.appendChild(errorDiv);
                                                    } else {
                                                        e.currentTarget.style.display = 'none';
                                                        // 일반적인 이미지 로드 실패 메시지
                                                        const errorDiv = document.createElement('div');
                                                        errorDiv.innerHTML = `
                                                            <div style="padding: 8px; color: #dc2626; font-size: 12px; text-align: center;">
                                                                <div style="margin-bottom: 8px;">이미지 로드 실패</div>
                                                                <button onclick="window.location.reload()" style="
                                                                    background: #dc2626; 
                                                                    color: white; 
                                                                    border: none; 
                                                                    padding: 4px 8px; 
                                                                    border-radius: 4px; 
                                                                    cursor: pointer; 
                                                                    font-size: 11px;
                                                                ">새로고침</button>
                                                            </div>
                                                        `;
                                                        e.currentTarget.parentNode?.appendChild(errorDiv);
                                                    }
                                                }}
                                                onLoad={() => {
                                                    console.log('이미지 로드 성공:', image.url);
                                                    console.log('이미지 URL 타입:', {
                                                        isDataUrl: image.url.startsWith('data:image'),
                                                        isHttpUrl: image.url.startsWith('http'),
                                                        urlLength: image.url.length
                                                    });
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
                                                <div><strong>크기:</strong> {image.metadata.size}</div>
                                            </div>
                                        </div>
                                    )) : (
                                        <div style={{
                                            padding: '20px',
                                            textAlign: 'center',
                                            color: '#6b7280',
                                            fontSize: '14px'
                                        }}>
                                            이 그룹에 대해 생성된 이미지가 없습니다.
                                        </div>
                                    )}
                                </div>

                                {/* 진행 상황 표시 */}
                                {imageGenerationProgress && imageGenerationProgress[group.id] && (
                                    <div style={{
                                        padding: '8px 12px',
                                        backgroundColor: '#f0f9ff',
                                        border: '1px solid #0ea5e9',
                                        borderRadius: '6px',
                                        marginBottom: '12px',
                                        fontSize: '14px',
                                        color: '#0369a1'
                                    }}>
                                        📊 {imageGenerationProgress[group.id]}
                                    </div>
                                )}

                                {/* 실패 상태 표시 */}
                                {failedImages && failedImages.includes(group.id) && (
                                    <div style={{
                                        padding: '8px 12px',
                                        backgroundColor: '#fef2f2',
                                        border: '1px solid #dc2626',
                                        borderRadius: '6px',
                                        marginBottom: '12px',
                                        fontSize: '14px',
                                        color: '#dc2626'
                                    }}>
                                        ❌ 이미지 생성에 실패했습니다. 다시 시도해주세요.
                                    </div>
                                )}

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
                        {error.includes('API') && (
                            <div style={{ marginTop: '8px', fontSize: '14px' }}>
                                <p>💡 <strong>해결 방법:</strong></p>
                                <p>1. 백엔드 폴더에 <code>.env</code> 파일을 생성하세요</p>
                                <p>2. <code>GOOGLE_API_KEY</code>를 설정하세요</p>
                                <p>3. 백엔드 서버를 재시작하세요</p>
                            </div>
                        )}
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