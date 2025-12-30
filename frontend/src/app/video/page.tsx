'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProgressBar from '../../components/ProgressBar';
import { getTTSData, getImageData, getScriptData, setVideoData } from '../../utils/sessionStorage';
import { API_URL } from '../../config/env';

const VideoPage: React.FC = () => {
    const router = useRouter();
    const [ttsData, setTTSDataState] = useState<any>(null);
    const [imageData, setImageDataState] = useState<any>(null);
    const [scriptData, setScriptDataState] = useState<any>(null);
    const [generatingVideo, setGeneratingVideo] = useState(false);
    const [videoResults, setVideoResults] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [currentGroup, setCurrentGroup] = useState<string | null>(null);

    useEffect(() => {
        // 세션에서 TTS 데이터와 이미지 데이터 가져오기
        const tts = getTTSData();
        let images = getImageData();
        const script = getScriptData();

        if (!tts) {
            setError('TTS 데이터가 없습니다. 처음부터 다시 시작해주세요.');
            return;
        }

        // scriptData 저장
        if (script) {
            setScriptDataState(script);
        }

        // 이미지 데이터가 없으면 스토리보드에서 구성
        if (!images) {
            const storyboardImages = script?.storyboardImages?.images || [];

            if (Array.isArray(storyboardImages) && storyboardImages.length > 0) {
                try {
                    const generatedFromStoryboard = (tts.audioResult || []).map((item: any) => {
                        const groupId: string = item.group?.id || '';
                        const sceneNum = parseInt(String(groupId).replace('scene-', ''));
                        const match = storyboardImages.find((s: any) => s.sceneNumber === sceneNum);
                        const url = match?.image?.url || match?.url || '';
                        const id = match?.image?.id || `scene_${sceneNum}`;
                        const imagesArr = url ? [{ id, url }] : [];
                        return {
                            group: item.group,
                            images: imagesArr
                        };
                    });

                    images = { generatedImages: generatedFromStoryboard };
                } catch (e) {
                    console.error('스토리보드 기반 이미지 구성 실패:', e);
                }
            }
        }

        setTTSDataState(tts);
        if (images) {
            setImageDataState(images);
        } else {
            setError('이미지 데이터가 없습니다. 스토리보드에서 이미지를 먼저 생성해주세요.');
        }
    }, []);

    const generateVideos = async () => {
        if (!ttsData || !imageData) {
            setError('TTS 데이터와 이미지 데이터가 모두 필요합니다.');
            return;
        }

        setGeneratingVideo(true);
        setError(null);
        setVideoResults([]);
        setProgress(0);

        try {
            console.log('영상 생성 시작...');

            const response = await fetch(API_URL + '/api/generate-video', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    ttsData: ttsData,
                    imageData: imageData,
                    scriptData: getScriptData() // 스토리보드 나레이션을 위한 데이터
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            const data = await response.json();
            console.log('영상 생성 응답:', data);

            if (data.success && data.data) {
                setVideoResults(data.data.videos || []);
                setProgress(100);
            } else {
                throw new Error('Invalid response format from video generation API');
            }
        } catch (e: any) {
            console.error('영상 생성 오류:', e);
            setError('영상 생성 중 오류 발생: ' + (e?.message || e));
        } finally {
            setGeneratingVideo(false);
            setCurrentGroup(null);
        }
    };

    const handleContinue = () => {
        if (!videoResults || videoResults.length === 0) {
            setError('영상을 먼저 생성해주세요.');
            return;
        }

        // 세션에 비디오 결과 저장 후 병합 페이지로 이동
        setVideoData({ videos: videoResults });
        router.push('/video-merge');
    };

    const handleBack = () => {
        router.push('/tts');
    };

    // 영상별 자막 스크립트 가져오기
    const getVideoScript = (video: any): string => {
        if (!scriptData || !ttsData) return '';

        // 1. 스토리보드 나레이션에서 찾기
        const storyboardScenes = scriptData?.storyboardResult?.scenes || [];
        const groupId = video.group?.id || '';
        const sceneNum = parseInt(groupId.toString().replace(/scene-?/i, '')) || null;

        if (sceneNum) {
            const scene = storyboardScenes.find((s: any) => 
                (s.scene_number || s.sceneNumber) === sceneNum
            );
            if (scene?.narrative_korean) {
                return scene.narrative_korean;
            }
        }

        // 2. TTS 스크립트에서 찾기
        const ttsItem = ttsData.audioResult?.find((item: any) => 
            item.group?.id === groupId
        );
        if (ttsItem?.script) {
            // script가 객체인 경우 coreMessage 추출, 문자열인 경우 그대로 사용
            if (typeof ttsItem.script === 'string') {
                return ttsItem.script;
            } else if (ttsItem.script.coreMessage) {
                return ttsItem.script.coreMessage;
            }
        }

        return '';
    };

    if (error && (!ttsData || !imageData)) {
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
                        영상 생성
                    </h1>
                    <p style={{
                        fontSize: '18px',
                        color: '#6b7280',
                        marginBottom: '32px'
                    }}>
                        각 장면의 TTS 오디오와 이미지를 조합하여 영상을 생성합니다. 각 장면은 TTS 시간 동안 하나의 이미지를 유지합니다.
                    </p>
                </div>

                {/* 영상 생성 버튼 */}
                {!videoResults || videoResults.length === 0 ? (
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
                            TTS 오디오와 이미지를 조합하여 영상을 생성하시겠습니까?
                        </div>
                        <button
                            onClick={generateVideos}
                            disabled={generatingVideo}
                            style={{
                                padding: '16px 32px',
                                backgroundColor: generatingVideo ? '#d1d5db' : '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: generatingVideo ? 'not-allowed' : 'pointer',
                                fontSize: '18px',
                                fontWeight: '600'
                            }}
                        >
                            {generatingVideo ? '영상 생성 중...' : '영상 생성 시작'}
                        </button>
                    </div>
                ) : null}

                {/* 진행 상황 표시 */}
                {generatingVideo && (
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
                            영상 생성 중...
                        </div>
                        {currentGroup && (
                            <div style={{
                                fontSize: '14px',
                                color: '#6b7280',
                                marginBottom: '16px',
                                textAlign: 'center'
                            }}>
                                현재 처리 중: {currentGroup}
                            </div>
                        )}
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

                {/* 생성된 영상 결과 표시 */}
                {videoResults && videoResults.length > 0 && (
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
                            생성된 영상 ({videoResults.length}개)
                        </h2>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            {videoResults.map((video, index) => (
                                <div
                                    key={video.group.id}
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
                                        {video.group.title}
                                    </h3>

                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 2fr',
                                        gap: '20px',
                                        alignItems: 'start'
                                    }}>
                                        {/* 영상 플레이어 */}
                                        <div style={{
                                            aspectRatio: '9/16',
                                            backgroundColor: '#f3f4f6',
                                            borderRadius: '8px',
                                            overflow: 'hidden',
                                            border: '2px solid #e5e7eb'
                                        }}>
                                            <video
                                                src={API_URL + video.videoUrl}
                                                controls
                                                style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'contain'
                                                }}
                                            />
                                        </div>

                                        {/* 영상 정보 */}
                                        <div>
                                            <div style={{ marginBottom: '16px' }}>
                                                <div style={{
                                                    fontSize: '14px',
                                                    fontWeight: '600',
                                                    color: '#374151',
                                                    marginBottom: '8px'
                                                }}>
                                                    영상 정보
                                                </div>
                                                <div style={{
                                                    fontSize: '14px',
                                                    color: '#6b7280',
                                                    backgroundColor: 'white',
                                                    padding: '12px',
                                                    borderRadius: '6px',
                                                    border: '1px solid #e5e7eb'
                                                }}>
                                                    <div style={{ marginBottom: '8px' }}>영상 길이: {video.duration}초 (TTS 시간에 맞춤)</div>
                                                    <div>해상도: 1080x1920 (9:16)</div>
                                                </div>
                                            </div>

                                            {/* 자막 스크립트 */}
                                            {(() => {
                                                const script = getVideoScript(video);
                                                return script ? (
                                                    <div style={{ marginBottom: '16px' }}>
                                                        <div style={{
                                                            fontSize: '14px',
                                                            fontWeight: '600',
                                                            color: '#374151',
                                                            marginBottom: '8px'
                                                        }}>
                                                            📝 자막 스크립트
                                                        </div>
                                                        <div style={{
                                                            fontSize: '14px',
                                                            color: '#111827',
                                                            backgroundColor: 'white',
                                                            padding: '16px',
                                                            borderRadius: '6px',
                                                            border: '1px solid #e5e7eb',
                                                            lineHeight: '1.6',
                                                            whiteSpace: 'pre-wrap',
                                                            maxHeight: '200px',
                                                            overflowY: 'auto'
                                                        }}>
                                                            {script}
                                                        </div>
                                                    </div>
                                                ) : null;
                                            })()}

                                            <div>
                                                <a
                                                    href={API_URL + video.videoUrl}
                                                    download
                                                    style={{
                                                        display: 'inline-block',
                                                        padding: '12px 24px',
                                                        backgroundColor: '#3b82f6',
                                                        color: 'white',
                                                        textDecoration: 'none',
                                                        borderRadius: '6px',
                                                        fontSize: '14px',
                                                        fontWeight: '600'
                                                    }}
                                                >
                                                    영상 다운로드
                                                </a>
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
                        disabled={!videoResults || videoResults.length === 0}
                        style={{
                            padding: '12px 24px',
                            backgroundColor: !videoResults || videoResults.length === 0 ? '#d1d5db' : '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: !videoResults || videoResults.length === 0 ? 'not-allowed' : 'pointer',
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

export default VideoPage;

