import React from 'react';
import { useRouter } from 'next/navigation';

interface ProgressBarProps {
    currentStep: number;
    totalSteps?: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ currentStep, totalSteps = 6 }) => {
    const router = useRouter();

    const steps = [
        { name: '업로드', path: '/' },
        { name: '그룹 선택', path: '/groups' },
        { name: '스크립트', path: '/script' },
        { name: 'TTS', path: '/tts' },
        { name: '이미지', path: '/images' },
        { name: '결과', path: '/result' }
    ];

    const progress = (currentStep / totalSteps) * 100;

    return (
        <div style={{
            position: 'sticky',
            top: 0,
            backgroundColor: 'white',
            borderBottom: '1px solid #e5e7eb',
            padding: '16px 0',
            zIndex: 100
        }}>
            <div style={{
                maxWidth: '1200px',
                margin: '0 auto',
                padding: '0 24px'
            }}>
                {/* 진행률 바 */}
                <div style={{
                    width: '100%',
                    height: '4px',
                    backgroundColor: '#e5e7eb',
                    borderRadius: '2px',
                    marginBottom: '16px'
                }}>
                    <div style={{
                        width: `${progress}%`,
                        height: '100%',
                        backgroundColor: '#3b82f6',
                        borderRadius: '2px',
                        transition: 'width 0.3s ease'
                    }} />
                </div>

                {/* 단계 표시 */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    {steps.map((step, index) => (
                        <div
                            key={index}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                cursor: index <= currentStep ? 'pointer' : 'default',
                                opacity: index <= currentStep ? 1 : 0.5
                            }}
                            onClick={() => {
                                if (index <= currentStep) {
                                    router.push(step.path);
                                }
                            }}
                        >
                            <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                backgroundColor: index < currentStep ? '#10b981' :
                                    index === currentStep ? '#3b82f6' : '#e5e7eb',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '14px',
                                fontWeight: 'bold',
                                marginBottom: '4px'
                            }}>
                                {index < currentStep ? '✓' : index + 1}
                            </div>
                            <span style={{
                                fontSize: '12px',
                                color: index <= currentStep ? '#374151' : '#9ca3af',
                                textAlign: 'center'
                            }}>
                                {step.name}
                            </span>
                        </div>
                    ))}
                </div>

                {/* 현재 단계 표시 */}
                <div style={{
                    textAlign: 'center',
                    marginTop: '8px',
                    fontSize: '14px',
                    color: '#6b7280'
                }}>
                    단계 {currentStep + 1} / {totalSteps}: {steps[currentStep]?.name}
                </div>
            </div>
        </div>
    );
};

export default ProgressBar; 