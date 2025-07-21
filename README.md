# 📅 작업 내역 요약 (2025-07-08)

## 1. Task Master AI(MCP) 및 GitHub MCP 연동

- **Task Master AI(MCP) 설치 및 프로젝트 초기화**
  - `task-master-ai`를 프로젝트에 도입하여, AI 기반 Task 관리 자동화 시작
  - PRD(요구사항 문서) 작성 및 파싱 → tasks.json 자동 생성

- **GitHub MCP 연동**
  - 로컬 git 레포지토리와 GitHub 원격 저장소(`joogaem/autoShorts`) 연결
  - MCP GitHub 도구를 통해 Task Master의 tasks를 GitHub Issue로 자동 생성

---

## 2. 주요 Task 진행/해결 내역

- **프로젝트 구조 및 환경 세팅**
  - Next.js(프론트엔드), Node.js(백엔드) 기반 모노레포 구조 설계 및 초기화
  - TypeScript, MUI(Material-UI) 적용, 환경 변수 관리, Docker 컨테이너화 등 개발 환경 구축

- **Task Master 기반 Task 관리**
  - PRD 기반 tasks 자동 생성 및 세부 서브태스크 분해
  - 각 단계별 진행상황(Task 상태: done, in-progress, pending 등) 관리

- **GitHub Issue 자동화**
  - Task Master의 주요 Task 12개를 GitHub Issue로 자동 등록
    - [Setup Project Structure and Dependencies](https://github.com/joogaem/autoShorts/issues/1)
    - [Implement File Upload System](https://github.com/joogaem/autoShorts/issues/2)
    - [Develop PowerPoint Parsing Module](https://github.com/joogaem/autoShorts/issues/3)
    - [Implement LangChain + GPT Integration](https://github.com/joogaem/autoShorts/issues/4)
    - [Develop Visual Analysis and Generation System](https://github.com/joogaem/autoShorts/issues/5)
    - [Implement Text-to-Speech Service](https://github.com/joogaem/autoShorts/issues/6)
    - [Develop Subtitle Generation System](https://github.com/joogaem/autoShorts/issues/7)
    - [Implement Video Composition Engine](https://github.com/joogaem/autoShorts/issues/8)
    - [Develop Frontend UI for Script Preview and Editing](https://github.com/joogaem/autoShorts/issues/9)
    - [Implement Video Preview and Download System](https://github.com/joogaem/autoShorts/issues/10)
    - [Implement End-to-End Workflow Integration](https://github.com/joogaem/autoShorts/issues/11)
    - [Implement Security, Privacy, and Deployment Features](https://github.com/joogaem/autoShorts/issues/12)

---

## 3. 오늘의 주요 자동화/성과

- Task Master 기반 Task 관리 → GitHub Issue 자동화 성공
- 프로젝트 구조, 환경, 자동화 파이프라인까지 체계적으로 정리
- 앞으로도 Task Master와 GitHub Issue를 연동하여 효율적인 협업 및 개발 진행 가능

---

# 📅 작업 내역 요약 (2025-07-20) - 오늘의 진행사항

## 🎯 **오늘 완료된 주요 기능들**

### **1. PowerPoint/PDF 파싱 모듈 완성** ✅
- **PowerPoint 파싱**: `pptx2json` 라이브러리 사용하여 슬라이드 텍스트 및 이미지 추출
- **PDF 파싱**: `pdf-parse` 라이브러리로 페이지별 텍스트 분할 및 처리
- **이미지 처리**: 슬라이드 이미지를 임시 디렉토리에 저장하고 정적 서빙
- **표준화된 출력**: PPTX와 PDF 모두 동일한 JSON 구조로 통일
- **에러 처리**: 파싱 실패 시 적절한 fallback 응답 제공

### **2. LangChain + OpenAI GPT 통합** ✅
- **OpenAI GPT-4o 모델 연동**: LangChain을 통한 안정적인 API 호출
- **스크립트 생성 서비스**: Hook → Core Message → CTA 구조의 쇼츠 비디오 스크립트 생성
- **한국어 최적화**: 한국어 프롬프트 및 지속 시간 계산 (3.5음절/초)
- **캐싱 시스템**: 중복 API 호출 방지를 위한 메모리 캐싱
- **다양한 스타일 지원**: 교육적/엔터테인먼트/전문적/캐주얼 스타일
- **다양한 톤 지원**: 친근한/공식적/활기찬/차분한 톤

### **3. 슬라이드 그룹화 시스템** ✅
- **자동 그룹화**: 최대 3개 슬라이드, 60초 이내로 최적 그룹화
- **지능적 분할**: 텍스트 길이와 지속 시간을 고려한 그룹 생성
- **썸네일 UI**: 각 그룹을 카드 형태로 표시, 선택 가능
- **413 Payload Too Large 오류 해결**: 파싱 단계에서 그룹화하여 페이로드 크기 최적화
- **선택적 스크립트 생성**: 전체 또는 선택된 그룹만으로 스크립트 생성

### **4. 프론트엔드 UI 개선** ✅
- **드래그 앤 드롭 업로드**: 직관적인 파일 업로드 인터페이스
- **진행률 표시**: 업로드 및 파싱 진행 상황 실시간 표시
- **파싱 결과 표시**: 슬라이드별 텍스트, 이미지, 시각적 요소 정보
- **그룹 선택 UI**: 썸네일 그리드로 그룹 선택 및 하이라이트
- **스크립트 결과 표시**: 생성된 스크립트, 예상 지속 시간, 스타일, 톤 정보

## 🔧 **해결된 기술적 문제들**

### **1. 413 Payload Too Large 오류**
- **문제**: 파싱된 슬라이드 데이터가 너무 커서 API 호출 실패
- **해결**: 파싱 단계에서 바로 그룹화하여 페이로드 크기 최적화
- **결과**: 큰 파일도 여러 개의 작은 그룹으로 분할하여 처리 가능

### **2. PDF 파싱 라이브러리 오류**
- **문제**: "TT: undefined function: 32" 등 PDF 파싱 라이브러리 경고/오류
- **해결**: try-catch로 라이브러리 오류 감지 및 fallback 응답 제공
- **결과**: 손상된 PDF나 지원되지 않는 형식도 안전하게 처리

### **3. OpenAI API 키 인증**
- **문제**: 401 Incorrect API key provided 오류
- **해결**: 환경 변수 설정 확인 및 올바른 API 키 설정
- **결과**: LangChain + GPT 통합 정상 작동

## 📊 **현재 프로젝트 상태**

### **완료된 작업**
- ✅ **작업 1**: 프로젝트 구조 및 의존성 설정
- ✅ **작업 2**: 파일 업로드 시스템 구현
- ✅ **작업 4**: LangChain + GPT 통합

### **진행 중인 작업**
- 🔄 **작업 3**: PowerPoint 파싱 모듈 개발 (기본 기능 완료, 추가 개선 필요)

### **대기 중인 작업**
- ⏳ **작업 6**: Text-to-Speech 서비스 구현
- ⏳ **작업 5**: 시각적 분석 및 생성 시스템 개발
- ⏳ **작업 7**: 자막 생성 시스템 개발
- ⏳ **작업 8**: 비디오 구성 엔진 구현
- ⏳ **작업 9**: 스크립트 미리보기 및 편집용 프론트엔드 UI 개발
- ⏳ **작업 10**: 비디오 미리보기 및 다운로드 시스템 구현
- ⏳ **작업 11**: End-to-End 워크플로우 통합
- ⏳ **작업 12**: 보안, 개인정보보호 및 배포 기능 구현

---

> **작성일:** 2025-07-08  
> **작성자:** young joo (joogaem)

> **업데이트일:** 2025-01-08  
> **업데이트 내용:** PowerPoint/PDF 파싱, LangChain+GPT 통합, 슬라이드 그룹화 시스템 완성

---

# 📅 작업 내역 요약 (2025-07-21) - 오늘의 진행사항

## 🎯 **오늘 완료된 주요 기능**

### **Text-to-Speech (TTS) 서비스 구현** ✅
- **Google Cloud TTS 통합**: 한국어 여성 음성(`ko-KR-Neural2-A`) 사용
- **스크립트 분할 처리**: Hook, Core Message, CTA 섹션별로 개별 음성 파일 생성
- **MP3 형식 지원**: 고품질 오디오 출력 (speakingRate: 1.0, pitch: 0.0)
- **오디오 파일 관리**: 자동 디렉토리 생성 및 파일 정보 추출
- **API 엔드포인트**: `/api/tts/generate` (스크립트용), `/api/tts/simple` (단일 텍스트용)
- **정적 파일 서빙**: `/audio` 경로로 생성된 오디오 파일 접근 가능

### **프론트엔드 TTS UI 추가** ✅
- **음성 변환 버튼**: 스크립트 생성 후 "🎤 음성으로 변환" 버튼 추가
- **오디오 플레이어**: 각 섹션별 음성 파일을 브라우저에서 직접 재생 가능
- **파일 정보 표시**: 재생 시간, 파일 크기 등 상세 정보 제공
- **진행 상태 표시**: 음성 생성 중 로딩 상태 및 에러 처리

## 🔧 **기술적 구현 세부사항**

### **백엔드 TTS 서비스**
```typescript
// Google Cloud TTS 설정
voice: {
  languageCode: 'ko-KR',
  name: 'ko-KR-Neural2-A', // 한국어 여성 음성
  ssmlGender: 'FEMALE'
},
audioConfig: {
  audioEncoding: 'MP3',
  speakingRate: 1.0, // 정상 속도
  pitch: 0.0 // 정상 피치
}
```

### **스크립트 분할 처리**
- **Hook 섹션**: 시청자 관심을 끄는 도입부
- **Core Message 섹션**: 핵심 내용 전달
- **CTA 섹션**: 행동 유도 마무리
- 각 섹션별로 개별 MP3 파일 생성하여 유연한 편집 가능

### **오디오 파일 관리**
- **저장 위치**: `backend/uploads/audio/` 디렉토리
- **파일명 형식**: `{baseFilename}_{section}.mp3`
- **자동 정리**: 24시간 후 자동 삭제 (cron job)
- **정적 서빙**: `http://localhost:3001/audio/{filename}` 접근

## 📊 **업데이트된 프로젝트 상태**

### **완료된 작업**
- ✅ **작업 1**: 프로젝트 구조 및 의존성 설정
- ✅ **작업 2**: 파일 업로드 시스템 구현
- ✅ **작업 3**: PowerPoint 파싱 모듈 개발
- ✅ **작업 4**: LangChain + GPT 통합
- ✅ **작업 6**: Text-to-Speech 서비스 구현

### **대기 중인 작업**
- ⏳ **작업 5**: 시각적 분석 및 생성 시스템 개발
- ⏳ **작업 7**: 자막 생성 시스템 개발
- ⏳ **작업 8**: 비디오 구성 엔진 구현
- ⏳ **작업 9**: 스크립트 미리보기 및 편집용 프론트엔드 UI 개발
- ⏳ **작업 10**: 비디오 미리보기 및 다운로드 시스템 구현
- ⏳ **작업 11**: End-to-End 워크플로우 통합
- ⏳ **작업 12**: 보안, 개인정보보호 및 배포 기능 구현

## 🚀 **다음 단계 제안**

### **우선순위 1: 자막 생성 시스템 (작업 7)**
- TTS 완료 후 음성과 동기화된 자막 생성
- SRT/VTT 형식 지원 및 한국어 특화 처리
- **예상 소요시간**: 2-3일

### **우선순위 2: 비디오 구성 엔진 (작업 8)**
- 이미지, 음성, 자막을 결합한 최종 쇼츠 비디오 생성
- FFmpeg/Remotion을 통한 자동 타이밍 및 전환 효과
- **예상 소요시간**: 3-4일

---

## 🆕 (2025-07-21) 그룹별 스크립트 생성 및 filename 기반 워크플로우 개선

- **백엔드**
  - `/api/group-slides`, `/api/generate-script`가 slides 없이 filename만 받아서 동작하도록 개선
  - filename만 전달하면 서버에서 직접 파일을 읽어 슬라이드 추출/그룹핑/스크립트 생성까지 처리
  - 프론트엔드와의 데이터 교환이 훨씬 단순해짐
- **프론트엔드**
  - FileUpload.tsx에서 slides 없이 filename만 넘기고, 그룹/스크립트 결과를 API raw 데이터로 바로 보여줌
  - slides 의존성 완전 제거, 전체 워크플로우 단순화
  - 스크립트 생성 결과를 JSON(raw)로 바로 확인 가능 (디버깅/확장성 향상)
- **기타**
  - 전체 코드 리팩토링 및 문서화

---

> **업데이트일:** 2025-01-08  
> **업데이트 내용:** Text-to-Speech 서비스 구현 완료, 음성 변환 기능 추가
