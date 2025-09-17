import React, { useState } from 'react';
import { StoryboardScene, StoryboardResponse } from '../types/storyboard';

interface StoryboardEditorProps {
    storyboard: StoryboardResponse;
    onSceneUpdate: (sceneIndex: number, updatedScene: StoryboardScene) => void;
    onSave: () => void;
    onCancel: () => void;
}

const StoryboardEditor: React.FC<StoryboardEditorProps> = ({
    storyboard,
    onSceneUpdate,
    onSave,
    onCancel
}) => {
    const [editingScene, setEditingScene] = useState<number | null>(null);
    const [editedNarrative, setEditedNarrative] = useState<string>('');
    const [editedImagePrompt, setEditedImagePrompt] = useState<string>('');

    const handleEditScene = (sceneIndex: number) => {
        const scene = storyboard.scenes[sceneIndex];
        setEditingScene(sceneIndex);
        setEditedNarrative(scene.narrative_korean);
        setEditedImagePrompt(scene.image_prompt_english);
    };

    const handleSaveScene = () => {
        if (editingScene !== null) {
            const updatedScene: StoryboardScene = {
                scene_number: editingScene + 1,
                narrative_korean: editedNarrative,
                image_prompt_english: editedImagePrompt
            };
            onSceneUpdate(editingScene, updatedScene);
            setEditingScene(null);
            setEditedNarrative('');
            setEditedImagePrompt('');
        }
    };

    const handleCancelEdit = () => {
        setEditingScene(null);
        setEditedNarrative('');
        setEditedImagePrompt('');
    };

    return (
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
                    color: '#111827',
                    margin: 0
                }}>
                    스토리보드 에디터
                </h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={onCancel}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#6b7280',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        취소
                    </button>
                    <button
                        onClick={onSave}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        저장
                    </button>
                </div>
            </div>

            {/* 스토리보드 메타데이터 */}
            <div style={{
                backgroundColor: '#f9fafb',
                padding: '16px',
                borderRadius: '8px',
                marginBottom: '24px'
            }}>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                    <div>
                        <strong>총 장면 수:</strong> {storyboard.scenes.length}
                    </div>
                    <div>
                        <strong>예상 지속시간:</strong> {storyboard.estimatedDuration}초
                    </div>
                    <div>
                        <strong>아트 스타일:</strong> {storyboard.artStyle}
                    </div>
                </div>
                {storyboard.characters.length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                        <strong>캐릭터:</strong> {storyboard.characters.join(', ')}
                    </div>
                )}
            </div>

            {/* 장면 목록 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {storyboard.scenes.map((scene, index) => (
                    <div
                        key={scene.scene_number}
                        style={{
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            padding: '20px',
                            backgroundColor: editingScene === index ? '#f0f9ff' : 'white'
                        }}
                    >
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '16px'
                        }}>
                            <h3 style={{
                                fontSize: '18px',
                                fontWeight: '600',
                                color: '#111827',
                                margin: 0
                            }}>
                                장면 {scene.scene_number}
                            </h3>
                            {editingScene !== index && (
                                <button
                                    onClick={() => handleEditScene(index)}
                                    style={{
                                        padding: '6px 12px',
                                        backgroundColor: '#f3f4f6',
                                        color: '#374151',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '12px'
                                    }}
                                >
                                    ✏️ 편집
                                </button>
                            )}
                        </div>

                        {editingScene === index ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div>
                                    <label style={{
                                        display: 'block',
                                        fontWeight: '600',
                                        marginBottom: '8px',
                                        color: '#374151'
                                    }}>
                                        내레이션 (한국어)
                                    </label>
                                    <textarea
                                        value={editedNarrative}
                                        onChange={(e) => setEditedNarrative(e.target.value)}
                                        style={{
                                            width: '100%',
                                            minHeight: '80px',
                                            padding: '12px',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '6px',
                                            fontSize: '14px',
                                            lineHeight: '1.5',
                                            resize: 'vertical'
                                        }}
                                        placeholder="장면의 내레이션을 입력하세요..."
                                    />
                                </div>
                                <div>
                                    <label style={{
                                        display: 'block',
                                        fontWeight: '600',
                                        marginBottom: '8px',
                                        color: '#374151'
                                    }}>
                                        이미지 프롬프트 (영어)
                                    </label>
                                    <textarea
                                        value={editedImagePrompt}
                                        onChange={(e) => setEditedImagePrompt(e.target.value)}
                                        style={{
                                            width: '100%',
                                            minHeight: '100px',
                                            padding: '12px',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '6px',
                                            fontSize: '14px',
                                            lineHeight: '1.5',
                                            resize: 'vertical'
                                        }}
                                        placeholder="이미지 생성을 위한 영어 프롬프트를 입력하세요..."
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                    <button
                                        onClick={handleCancelEdit}
                                        style={{
                                            padding: '8px 16px',
                                            backgroundColor: '#6b7280',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontSize: '14px'
                                        }}
                                    >
                                        취소
                                    </button>
                                    <button
                                        onClick={handleSaveScene}
                                        style={{
                                            padding: '8px 16px',
                                            backgroundColor: '#3b82f6',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontSize: '14px'
                                        }}
                                    >
                                        저장
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div>
                                    <div style={{
                                        fontWeight: '600',
                                        marginBottom: '8px',
                                        color: '#374151'
                                    }}>
                                        내레이션
                                    </div>
                                    <div style={{
                                        padding: '12px',
                                        backgroundColor: '#f9fafb',
                                        borderRadius: '6px',
                                        fontSize: '14px',
                                        lineHeight: '1.6',
                                        color: '#374151',
                                        whiteSpace: 'pre-wrap'
                                    }}>
                                        {scene.narrative_korean}
                                    </div>
                                </div>
                                <div>
                                    <div style={{
                                        fontWeight: '600',
                                        marginBottom: '8px',
                                        color: '#374151'
                                    }}>
                                        이미지 프롬프트
                                    </div>
                                    <div style={{
                                        padding: '12px',
                                        backgroundColor: '#f9fafb',
                                        borderRadius: '6px',
                                        fontSize: '14px',
                                        lineHeight: '1.6',
                                        color: '#374151',
                                        whiteSpace: 'pre-wrap',
                                        fontFamily: 'monospace'
                                    }}>
                                        {scene.image_prompt_english}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default StoryboardEditor;
