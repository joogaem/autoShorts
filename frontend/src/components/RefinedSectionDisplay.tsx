import React from 'react';

interface RefinedSection {
    id: number;
    title: string;
    keyPoints: string[];
    summary: string;
    refinedText: string;
    originalText: string;
    sectionType: 'introduction' | 'main-point-1' | 'main-point-2' | 'main-point-3' | 'conclusion';
}

interface RefinedSectionDisplayProps {
    sections: RefinedSection[];
    showDetails?: boolean;
}

const RefinedSectionDisplay: React.FC<RefinedSectionDisplayProps> = ({
    sections,
    showDetails = false
}) => {
    const getSectionTypeName = (sectionType: string) => {
        switch (sectionType) {
            case 'introduction': return '도입부';
            case 'main-point-1': return '핵심 포인트 1';
            case 'main-point-2': return '핵심 포인트 2';
            case 'main-point-3': return '핵심 포인트 3';
            case 'conclusion': return '결론부';
            default: return '섹션';
        }
    };

    const getSectionTypeColor = (sectionType: string) => {
        switch (sectionType) {
            case 'introduction': return '#3b82f6';
            case 'main-point-1': return '#10b981';
            case 'main-point-2': return '#f59e0b';
            case 'main-point-3': return '#ef4444';
            case 'conclusion': return '#8b5cf6';
            default: return '#6b7280';
        }
    };

    return (
        <div style={{ marginBottom: '16px' }}>
            <div style={{
                fontWeight: 'bold',
                color: '#1976d2',
                marginBottom: '12px',
                fontSize: '16px'
            }}>
                📝 다듬어진 5개 섹션
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '12px'
            }}>
                {sections.map((section) => (
                    <div key={section.id} style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        padding: '16px',
                        backgroundColor: '#f9fafb'
                    }}>
                        {/* 섹션 헤더 */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            marginBottom: '8px'
                        }}>
                            <div style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: getSectionTypeColor(section.sectionType),
                                marginRight: '8px'
                            }} />
                            <div style={{
                                fontWeight: '600',
                                fontSize: '14px',
                                color: '#374151'
                            }}>
                                {getSectionTypeName(section.sectionType)}
                            </div>
                        </div>

                        {/* 섹션 제목 */}
                        <div style={{
                            fontWeight: '600',
                            fontSize: '16px',
                            color: '#111827',
                            marginBottom: '8px',
                            lineHeight: '1.4'
                        }}>
                            {section.title}
                        </div>

                        {/* 핵심 포인트 */}
                        {section.keyPoints && section.keyPoints.length > 0 && (
                            <div style={{ marginBottom: '8px' }}>
                                <div style={{
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    color: '#6b7280',
                                    marginBottom: '4px'
                                }}>
                                    핵심 포인트:
                                </div>
                                <ul style={{
                                    margin: 0,
                                    paddingLeft: '16px',
                                    fontSize: '12px',
                                    color: '#4b5563'
                                }}>
                                    {section.keyPoints.map((point, index) => (
                                        <li key={index} style={{ marginBottom: '2px' }}>
                                            {point}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* 요약 */}
                        {section.summary && (
                            <div style={{ marginBottom: '8px' }}>
                                <div style={{
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    color: '#6b7280',
                                    marginBottom: '4px'
                                }}>
                                    요약:
                                </div>
                                <div style={{
                                    fontSize: '12px',
                                    color: '#4b5563',
                                    lineHeight: '1.4'
                                }}>
                                    {section.summary}
                                </div>
                            </div>
                        )}

                        {/* 상세 내용 (showDetails가 true일 때만) */}
                        {showDetails && (
                            <div>
                                <div style={{
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    color: '#6b7280',
                                    marginBottom: '4px'
                                }}>
                                    다듬어진 내용:
                                </div>
                                <div style={{
                                    fontSize: '12px',
                                    color: '#4b5563',
                                    lineHeight: '1.4',
                                    maxHeight: '100px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}>
                                    {section.refinedText}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RefinedSectionDisplay;
