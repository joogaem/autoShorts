'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ProgressBar from '../components/ProgressBar';
import { setUploadData, getCurrentStep } from '../utils/sessionStorage';

const MAX_SIZE = 100 * 1024 * 1024; // 100MB

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

const UploadPage: React.FC = () => {
  const router = useRouter();
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseResult, setParseResult] = useState<{ type: string; warning?: string } | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [visualAnalysisResults, setVisualAnalysisResults] = useState<any[]>([]);
  const [slideGroups, setSlideGroups] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'pptx' && ext !== 'pdf') {
      return 'PPTX 또는 PDF 파일만 업로드할 수 있습니다.';
    }
    if (file.size > MAX_SIZE) {
      return '100MB 이하의 파일만 업로드할 수 있습니다.';
    }
    return null;
  };

  const handleFile = async (file: File) => {
    setError(null);
    setStatus(null);
    setWarning(null);
    setProgress(0);
    setParseResult(null);
    const err = validateFile(file);
    if (err) {
      setError(err);
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', process.env.NEXT_PUBLIC_UPLOAD_URL || 'http://localhost:3001/api/upload', true);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = async () => {
        if (xhr.status === 200) {
          setStatus('업로드 성공!');
          try {
            setParsing(true);
            const { filename } = JSON.parse(xhr.responseText);

            // 1. 파싱 요청
            const parseRes = await fetch(process.env.NEXT_PUBLIC_PARSE_URL || 'http://localhost:3001/api/parse', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filename }),
            });
            const parseData = await parseRes.json();

            // 2. 파싱 성공 여부는 filename/type으로만 판단
            if (parseRes.ok && parseData.filename && parseData.type) {
              // 3. 슬라이드 데이터 추출 (파싱 결과에서)
              if (parseData.slides && Array.isArray(parseData.slides)) {
                setSlides(parseData.slides);

                // 4. 시각적 분석 요청 (최적화된 데이터만 전송)
                let analysisResults: any[] = [];
                try {
                  // 분석에 필요한 최소한의 데이터만 전송
                  const slidesForAnalysis = parseData.slides.map((slide: any) => ({
                    id: slide.id,
                    text: slide.text,
                    images: slide.images,
                    visualMetadata: slide.visualMetadata
                  }));

                  const analysisRes = await fetch('http://localhost:3001/api/analyze-slides', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ slides: slidesForAnalysis }),
                  });
                  const analysisData = await analysisRes.json();
                  if (analysisRes.ok && analysisData.data?.analysis) {
                    analysisResults = analysisData.data.analysis;
                    setVisualAnalysisResults(analysisResults);
                  }
                } catch (analysisError) {
                  console.warn('시각적 분석 실패:', analysisError);
                  // 분석 실패해도 계속 진행
                }

                // 5. 그룹핑 요청 (filename만 전달)
                const groupRes = await fetch(process.env.NEXT_PUBLIC_GROUP_URL || 'http://localhost:3001/api/group-slides', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ filename: parseData.filename }),
                });
                const groupData = await groupRes.json();
                if (groupRes.ok && groupData.data && Array.isArray(groupData.data.groups)) {
                  setSlideGroups(groupData.data.groups);
                  setParseResult({ type: parseData.type, warning: parseData.warning });

                  // 세션 스토리지에 업로드 데이터 저장
                  setUploadData({
                    filename: parseData.filename,
                    slides: parseData.slides,
                    parseResult: { type: parseData.type, warning: parseData.warning },
                    visualAnalysisResults: analysisResults
                  });

                  // 그룹 선택 페이지로 이동
                  router.push('/groups');
                } else {
                  setError('그룹핑 실패: ' + (groupData.error || 'Unknown error'));
                }
              } else {
                setError('슬라이드 데이터가 없습니다.');
              }
            } else {
              setError('파싱 실패: ' + (parseData.error || JSON.stringify(parseData) || 'Unknown error'));
            }
          } catch (e: any) {
            setError('파싱/그룹핑 요청 중 오류 발생: ' + (e?.message || e));
          } finally {
            setParsing(false);
          }
        } else {
          setError('업로드 실패: ' + xhr.responseText);
        }
      };
      xhr.onerror = () => {
        setError('네트워크 오류로 업로드 실패');
      };
      xhr.send(formData);
    } catch (e) {
      setError('업로드 중 오류 발생');
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <ProgressBar currentStep={0} />

      <div style={{
        maxWidth: '800px',
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
            AutoShorts
          </h1>
          <p style={{
            fontSize: '18px',
            color: '#6b7280',
            marginBottom: '8px'
          }}>
            PPTX/PDF 파일을 업로드하여 쇼츠 영상용 콘텐츠를 자동으로 생성하세요
          </p>
          <p style={{
            fontSize: '14px',
            color: '#9ca3af'
          }}>
            지원 형식: PPTX, PDF (최대 100MB)
          </p>
        </div>

        <div
          style={{
            border: '2px dashed #d1d5db',
            borderRadius: '12px',
            padding: '48px 24px',
            textAlign: 'center',
            backgroundColor: dragActive ? '#f3f4f6' : 'white',
            transition: 'all 0.2s ease',
            cursor: 'pointer'
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            type="file"
            accept=".pptx,.pdf"
            style={{ display: 'none' }}
            ref={inputRef}
            onChange={onChange}
          />
          <div style={{
            fontSize: '48px',
            marginBottom: '16px'
          }}>
            📄
          </div>
          <p style={{ margin: 0, fontWeight: 500, fontSize: '18px', color: '#374151' }}>
            {dragActive ? '여기에 파일을 놓으세요!' : '여기를 클릭하거나 드래그하여 파일을 업로드하세요'}
          </p>
          <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#6b7280' }}>
            PPTX 또는 PDF 파일 (최대 100MB)
          </p>
        </div>

        {progress > 0 && progress < 100 && (
          <div style={{ marginTop: '24px' }}>
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: '#e5e7eb',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${progress}%`,
                height: '100%',
                backgroundColor: '#3b82f6',
                transition: 'width 0.3s ease'
              }} />
            </div>
            <div style={{
              textAlign: 'center',
              marginTop: '8px',
              fontSize: '14px',
              color: '#6b7280'
            }}>
              업로드 중... {progress}%
            </div>
          </div>
        )}

        {parsing && (
          <div style={{
            marginTop: '24px',
            textAlign: 'center',
            padding: '16px',
            backgroundColor: '#eff6ff',
            borderRadius: '8px',
            color: '#1e40af'
          }}>
            파일을 분석하고 있습니다...
          </div>
        )}

        {status && (
          <div style={{
            marginTop: '16px',
            padding: '12px 16px',
            backgroundColor: '#f0fdf4',
            borderRadius: '8px',
            color: '#166534',
            textAlign: 'center'
          }}>
            {status}
          </div>
        )}

        {error && (
          <div style={{
            marginTop: '16px',
            padding: '12px 16px',
            backgroundColor: '#fef2f2',
            borderRadius: '8px',
            color: '#dc2626',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        {warning && (
          <div style={{
            marginTop: '16px',
            padding: '12px 16px',
            backgroundColor: '#fffbeb',
            borderRadius: '8px',
            color: '#d97706',
            textAlign: 'center'
          }}>
            {warning}
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadPage;
