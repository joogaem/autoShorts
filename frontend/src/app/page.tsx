'use client';

import React from 'react';
import ProgressBar from '../components/ProgressBar';
import FileUpload from '../components/FileUpload';

const UploadPage: React.FC = () => {

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
            텍스트를 입력하거나 PPTX/PDF 파일을 업로드하여 쇼츠 영상용 콘텐츠를 자동으로 생성하세요
          </p>
          <p style={{
            fontSize: '14px',
            color: '#9ca3af'
          }}>
            텍스트 입력 또는 파일 업로드 (PPTX, PDF 최대 100MB)
          </p>
        </div>

        <FileUpload />
      </div>
    </div>
  );
};

export default UploadPage;
