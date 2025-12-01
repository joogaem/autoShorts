'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProgressBar from '../../components/ProgressBar';
import { getVideoData, setFinalVideoUrl } from '../../utils/sessionStorage';
import { API_URL } from '../../config/env';

const VideoMergePage: React.FC = () => {
    const router = useRouter();
    const [videos, setVideos] = useState<any[]>([]);
    const [finalVideoUrl, setFinalUrlState] = useState<string | null>(null);
    const [merging, setMerging] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const vd = getVideoData();
        if (!vd || !vd.videos || vd.videos.length === 0) {
            setError('병합할 영상이 없습니다. 이전 단계에서 영상을 생성해주세요.');
            return;
        }
        setVideos(vd.videos);
    }, []);

    const mergeVideos = async () => {
        if (!videos || videos.length === 0) return;
        setMerging(true);
        setError(null);
        try {
            const videoUrls = videos.map((v: any) => v.videoUrl);
            const response = await fetch(API_URL + '/api/merge-videos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ videoUrls })
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || `HTTP ${response.status}`);
            }
            const data = await response.json();
            if (data.success && data.data?.videoUrl) {
                setFinalUrlState(data.data.videoUrl);
                setFinalVideoUrl(data.data.videoUrl);
            } else {
                throw new Error('Invalid response from merge API');
            }
        } catch (e: any) {
            setError('영상 병합 중 오류 발생: ' + (e?.message || e));
        } finally {
            setMerging(false);
        }
    };

    const handleBack = () => {
        router.push('/video');
    };

    const handleContinue = () => {
        if (!finalVideoUrl) {
            setError('최종 영상이 아직 없습니다. 병합을 먼저 실행해주세요.');
            return;
        }
        router.push('/result');
    };

    if (error && videos.length === 0) {
        return (
            <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
                <ProgressBar currentStep={6} />
                <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
                    <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px' }}>최종 영상 병합</h1>
                    <p style={{ color: '#ef4444' }}>{error}</p>
                    <div style={{ marginTop: '24px' }}>
                        <button onClick={() => router.push('/video')} style={{ padding: '12px 24px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px' }}>이전으로</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
            <ProgressBar currentStep={6} />
            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>최종 영상 병합</h1>
                <p style={{ color: '#6b7280', marginBottom: '24px' }}>생성된 5개의 영상을 순서대로 이어 붙여 하나의 영상으로 만듭니다.</p>

                {error && (
                    <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px' }}>{error}</div>
                )}

                {!finalVideoUrl && (
                    <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>대상 영상 (총 {videos.length}개)</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '12px' }}>
                            {videos.map((v: any, idx: number) => (
                                <div key={idx} style={{ fontSize: '14px', color: '#374151', backgroundColor: '#f3f4f6', padding: '8px', borderRadius: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {idx + 1}. {v?.group?.title || '영상'}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button onClick={handleBack} style={{ padding: '12px 24px', backgroundColor: '#6b7280', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px' }}>← 뒤로가기</button>

                    {!finalVideoUrl ? (
                        <button onClick={mergeVideos} disabled={merging || videos.length === 0} style={{ padding: '12px 24px', backgroundColor: merging || videos.length === 0 ? '#d1d5db' : '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: merging || videos.length === 0 ? 'not-allowed' : 'pointer', fontSize: '16px' }}>
                            {merging ? '병합 중...' : '영상 병합 시작'}
                        </button>
                    ) : (
                        <button onClick={handleContinue} style={{ padding: '12px 24px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px' }}>다음 단계 →</button>
                    )}
                </div>

                {finalVideoUrl && (
                    <div style={{ marginTop: '24px' }}>
                        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>최종 영상 미리보기</h2>
                        <video src={API_URL + finalVideoUrl} controls style={{ width: '100%', borderRadius: '12px', border: '1px solid #e5e7eb' }} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default VideoMergePage;


