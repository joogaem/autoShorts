# 🎨 AutoShorts - AI 기반 쇼츠 비디오 자동 생성 시스템

## 🚀 **주요 기능**

### **이미지 생성 시스템**
- **Stable Diffusion (기본)**: Stability AI의 고품질 이미지 생성
- **DALL-E (백업)**: OpenAI의 DALL-E 3를 백업 서비스로 사용
- **다양한 모델 지원**: SDXL 1.0, SD 1.6, SD 2.1 등
- **비용 효율적**: Stable Diffusion이 DALL-E 대비 1/5 비용

### **완전한 워크플로우**
1. **파일 업로드**: PPTX/PDF 파일 드래그 앤 드롭
2. **자동 파싱**: PDF/PPTX에서 텍스트 추출 및 5등분 분할
3. **AI 섹션 다듬기**: GPT-4o를 사용한 쇼츠 비디오용 섹션 최적화
4. **스크립트 생성**: Hook + Core Message + CTA 구조
5. **음성 변환**: Google Cloud TTS (한국어 여성 음성)
6. **이미지 생성**: Stable Diffusion 기반 고품질 이미지
7. **결과 확인**: 모든 생성된 콘텐츠 통합 미리보기

---

## 🧭 **최소 사용 플로우 (실사용 기준)**

1. 파일 업로드 → 파싱
   - `POST /api/upload` (또는 `POST /api/parse`)로 PPTX/PDF 업로드 및 콘텐츠 추출

2. 스크립트 생성
   - `POST /api/generate-script` (Hook/Core/CTA 구조)

3. 스토리보드 생성 (선택)
   - `POST /api/generate-storyboard` (장면별 내레이션 확보 시 유용)

4. 음성 변환 (TTS)
   - `POST /api/tts/generate` (섹션별 MP3 생성)

5. 이미지 생성
   - `POST /api/generate-image` (기본: Gemini 이미지, 백업: DALL-E 3)

6. 영상 생성
   - `POST /api/generate-video`
   - 스토리보드의 내레이션 텍스트를 FFmpeg `drawtext`로 번인 자막 처리(별도 SRT/VTT 파일 미사용)

참고:
- 자막은 “나레이션 번인” 방식으로 처리되며, SRT/VTT 파일은 생성하지 않습니다.
- 비디오 프리뷰/다운로드, 엔드투엔드 오케스트레이션 등 부가 플로우는 현재 목록에서 슬림화되었습니다.

## 🔧 **환경 설정**

### **통합 환경 변수 설정**
프로젝트 루트에 `.env` 파일을 생성하고 다음 환경 변수들을 설정하세요:

```bash
# 서버 설정
PORT=3001
NODE_ENV=development

# API 키 설정
# Stability AI (Stable Diffusion) - 기본 이미지 생성 서비스
STABILITY_API_KEY=your_stability_api_key_here

# OpenAI (DALL-E) - 백업 이미지 생성 서비스
OPENAI_API_KEY=your_openai_api_key_here

# Google AI (Gemini) - 이미지 생성 및 분석
GOOGLE_API_KEY=your_google_api_key_here

# Google Cloud TTS 설정
GOOGLE_APPLICATION_CREDENTIALS=path/to/your/google-credentials.json
GOOGLE_CLOUD_PROJECT_ID=your_google_cloud_project_id

# 디버깅 설정
TTS_DEBUG=false

# Frontend API URLs
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_UPLOAD_URL=http://localhost:3001/api/upload
NEXT_PUBLIC_PARSE_URL=http://localhost:3001/api/parse
NEXT_PUBLIC_GROUP_URL=http://localhost:3001/api/group-slides
```

### **API 키 설정 방법**
1. **Stability AI**: [Stability AI](https://platform.stability.ai/)에서 API 키 발급
2. **OpenAI**: [OpenAI Platform](https://platform.openai.com/)에서 API 키 발급
3. **Google AI**: [Google AI Studio](https://makersuite.google.com/)에서 API 키 발급
4. **Google Cloud**: [Google Cloud Console](https://console.cloud.google.com/)에서 TTS API 활성화

### **환경 변수 파일 생성**
```bash
# 1. 프로젝트 루트에서 템플릿 파일을 복사
cp env.example .env

# 2. .env 파일을 편집하여 실제 API 키 값들을 입력
# 예시:
# STABILITY_API_KEY=sk-실제_키_값_입력
# OPENAI_API_KEY=sk-실제_키_값_입력
# GOOGLE_API_KEY=실제_키_값_입력
```

### **환경 변수 파일 구조**
- **`env.example`**: 템플릿 파일 (Git에 포함됨) - 실제 키 값 없음
- **`.env`**: 실제 환경 변수 파일 (Git에 포함되지 않음) - 실제 키 값 입력

---

## 📡 **API 엔드포인트**

### **이미지 생성**
```bash
# Stable Diffusion 전용 이미지 생성
POST /api/generate-image-stable-diffusion
{
  "prompt": "한국어 설명",
  "model": "stable-diffusion-xl-1024-v1-0", // 선택사항
  "aspectRatio": "1:1" // 1:1, 16:9, 9:16
}

# 일반 이미지 생성 (Stable Diffusion 우선, 실패시 DALL-E)
POST /api/generate-image
{
  "prompt": "한국어 설명",
  "style": "photographic",
  "aspectRatio": "9:16",
  "quality": "standard"
}
```

### **모델 정보**
```bash
# 사용 가능한 Stable Diffusion 모델 조회
GET /api/stable-diffusion-models

# API 키 상태 확인
GET /api/check-api-keys
```

---

## 💰 **비용 비교**

| 서비스 | 512x512 | 1024x1024 | 품질 |
|--------|---------|------------|------|
| **Stable Diffusion** | $0.002 | $0.008 | 고품질 |
| **DALL-E 3** | $0.018 | $0.040 | 고품질 |

**Stable Diffusion이 DALL-E 대비 약 5배 저렴합니다!**

---

# 📅 작업 내역 요약 (2025-10-30) - 스토리보드/스크립트 개선 사항

## 🎯 핵심 변경점

- 스토리보드 프롬프트를 "내용 전달" 위주에서 벗어나, 이해를 돕는 일화/에피소드/예시 중심의 전문적 스토리텔링으로 전환
- 사람(캐릭터) 비필수화: 개념·프로세스·환경·도표 등 "개념을 가장 잘 보여주는 비주얼"을 우선하도록 지침 추가
- 톤 가이드 강화: 유아틱 표현 지양, 다큐멘터리/전문 교육 내레이션 톤 유지
- 시각 스타일 옵션화 준비: 실사(photorealistic) ↔ 카툰(cartoon) 중 선택 가능하도록 요구사항 정리
- Gemini 응답 로깅·디버깅 강화: 원본 응답, JSON 추출 문자열, 파싱 성공/실패 로그 추가

## 🧠 구현 상세

- `backend/src/services/storyboardGenerator.ts`
  - 프롬프트: 사례연구/일화/비유를 활용해 추상 개념을 구체화하도록 지시 강화
  - 비주얼 가이드: 인물은 선택 사항, 프로세스/환경/다이어그램 등으로 개념 시각화 허용
  - 로깅: 원본 응답 길이/앞·뒤 500자/전체 출력, JSON 추출 문자열 출력, 파싱 성공 로그
  - 아트 스타일: 카툰 일러스트(간결·친근) 예시 추가 및 구성 가능
- `backend/src/services/scriptGenerator.ts`
  - 교육용 스크립트 프롬프트로 개편: 일화/예시를 포함하여 Hook/Core/CTA 구성

## 🔧 다음 단계 (제안)

- 비주얼 스타일을 요청 파라미터(`styleVisual`: `photorealistic` | `cartoon`)로 설정 가능하도록 API 확장
- 프론트엔드 옵션 UI 추가: 스토리보드 생성 시 시각 스타일 선택
- 스토리보드 결과 내 `metadata.artStyle` 노출 및 화면 표시 개선

> 업데이트일: 2025-10-30

---

## 📅 작업 내역 추가 (2025-10-30) - 이미지 생성 모델 전환 및 안정화

### 🎯 핵심 변경점

- 기본 이미지 생성 엔진을 DALL-E 3에서 Gemini 내장 이미지 생성 모델로 전환
- 비율/품질 기본값 정리: 1:1, standard 고정 (회전 이슈 방지 및 일관성 유지)
- 응답/저장 방식 개선: Base64 전체를 반환하지 않고 `temp-images` 경량 URL만 반환

### 🧠 구현 상세

- `backend/src/services/imageGenerationService.ts`
  - OpenAI DALL-E 백업 유지 + `@google/genai` 기반 Gemini 이미지 생성 기본화
  - `GeneratedImage.metadata.provider`: `'gemini-image' | 'dall-e'`로 확장
  - `convertAspectRatio`, `getImageSize` 유틸 추가로 비율 안전 변환
  - `saveImageToFile`가 Base64 대신 상대 URL(`/temp-images/{file}.png`) 반환하도록 변경
  - 기본 비율 `1:1`, 기본 품질 `standard`로 고정하여 회전/크롭 문제 최소화

### 🔐 환경 변수

```bash
OPENAI_API_KEY=...     # 백업용 DALL-E 3
GOOGLE_API_KEY=...     # 기본 Gemini 이미지 모델
```

### 💰 비용 메모

- DALL-E 3 (1024x1024, standard): 약 $0.040/장 (백업 경로)
- Gemini 내장 이미지: 토큰 기반 과금, 현재 설정에서 저비용/무료 구간 활용

> 업데이트일: 2025-10-30

---

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

# 📅 작업 내역 요약 (2025-09-13) - 최근 업데이트

## 🔧 **코드 정리 및 워크플로우 최적화** ✅

### **1. 불필요한 API 제거 및 워크플로우 단순화**
- **group-slides API 제거**: 핵심 포인트 추출 로직이 불필요하여 완전 제거
- **parse.ts 최적화**: PDF/PPTX 파싱 후 직접 5등분 분할 및 AI 섹션 다듬기
- **워크플로우 단순화**: 파일 업로드 → 파싱 → AI 다듬기 → 완료 (3단계)

### **2. 프론트엔드 컴포넌트 정리**
- **FileUpload 컴포넌트 단순화**: 파일 업로드와 파싱만 담당하도록 수정
- **groups 페이지 개선**: parse 결과에서 직접 다듬어진 섹션 추출
- **불필요한 상태 변수 제거**: 그룹 관련 복잡한 상태 관리 로직 정리

### **3. 백엔드 코드 정리**
- **라우터 정리**: group-slides 라우트 완전 제거
- **타입 정의 통합**: 필요한 타입들을 각 파일에서 직접 정의
- **import 정리**: 삭제된 모듈 참조 제거

### **4. 환경 설정 정리**
- **환경 변수 정리**: GROUP_URL 등 불필요한 설정 제거
- **의존성 정리**: 사용하지 않는 라이브러리 참조 제거

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

# 📅 작업 내역 요약 (2025-07-28) - 오늘의 진행사항

## 🎯 **오늘 완료된 주요 기능**

### **이미지 생성 시스템 완성** ✅
- **VisualDecisionEngine**: 슬라이드 내용을 분석하여 이미지 생성 필요성 판단
- **OpenAI DALL-E 통합**: 고품질 이미지 생성 (9:16 세로 비율, 쇼츠 비디오 최적화)
- **그룹별 이미지 생성**: TTS 그룹과 동일한 단위로 이미지 일괄 생성
- **API 엔드포인트**: `/api/generate-images-for-groups`, `/api/generate-images-for-slides`
- **비용 효율적 전략**: 이미지 생성이 필요한 슬라이드만 선별하여 처리

### **완전한 워크플로우 구현** ✅
- **6단계 프로세스**: Upload → Groups → Script → TTS → Images → Result
- **세션 스토리지 관리**: 각 단계별 데이터 자동 저장 및 복원
- **ProgressBar 컴포넌트**: 진행 상황 시각적 표시
- **에러 처리 및 검증**: 각 단계별 입력 검증 및 오류 처리

### **TTS API 오류 수정** ✅
- **엔드포인트 수정**: `/api/tts` → `/api/tts/generate`로 올바른 경로 수정
- **데이터 구조 개선**: 스크립트 객체 구조로 요청 본문 변경
- **섹션별 오디오 플레이어**: Hook, Core Message, CTA 각각 개별 재생
- **그룹 정보 전달**: TTS에서 이미지 생성으로 그룹 정보 연속성 보장

### **프론트엔드 UI 완성** ✅
- **그룹 선택 페이지**: 썸네일 그리드로 그룹 선택 및 하이라이트
- **스크립트 생성 페이지**: 선택된 그룹으로 스크립트 생성 및 미리보기
- **TTS 생성 페이지**: 스크립트를 음성으로 변환, 섹션별 오디오 재생
- **이미지 생성 페이지**: 그룹별 이미지 생성 및 미리보기
- **결과 확인 페이지**: 최종 생성된 모든 콘텐츠 통합 표시

## 🔧 **기술적 구현 세부사항**

### **VisualDecisionEngine**
```typescript
// 슬라이드 분석 및 이미지 생성 판단
public async generateImagesForSlides(slides: Slide[]): Promise<GeneratedImage[]>
public async suggestCostEffectiveStrategy(slides: Slide[]): Promise<Strategy>
```

### **이미지 생성 서비스**
```typescript
// OpenAI DALL-E 설정
const imageRequest: ImageGenerationRequest = {
    prompt: "고품질 쇼츠 비디오용 이미지",
    style: 'professional',
    aspectRatio: '9:16', // 세로 비율
    quality: 'standard'
};
```

### **세션 스토리지 관리**
```typescript
// 6단계 데이터 흐름
UploadData → GroupData → ScriptData → TTSData → ImageData → Result
```

### **API 엔드포인트 구조**
```
POST /api/upload - 파일 업로드 및 파싱
POST /api/group-slides - 슬라이드 그룹화
POST /api/generate-script - 스크립트 생성
POST /api/tts/generate - TTS 생성
POST /api/generate-images-for-groups - 이미지 생성
```

## 📊 **최종 프로젝트 상태**

### **완료된 작업 (MVP 완성)** ✅
- ✅ **파일 업로드 시스템**: PPTX/PDF 파싱 및 그룹화
- ✅ **스크립트 생성**: LangChain + GPT-4o 통합
- ✅ **TTS 서비스**: Google Cloud TTS (한국어)
- ✅ **이미지 생성**: OpenAI DALL-E 통합
- ✅ **완전한 워크플로우**: 6단계 End-to-End 처리
- ✅ **프론트엔드 UI**: 모든 단계별 사용자 인터페이스

### **MVP 기능 요약**
1. **파일 업로드**: PPTX/PDF 파일 드래그 앤 드롭
2. **자동 그룹화**: 최대 3개 슬라이드, 60초 이내 그룹 생성
3. **스크립트 생성**: Hook + Core Message + CTA 구조
4. **음성 변환**: 한국어 여성 음성으로 섹션별 변환
5. **이미지 생성**: 슬라이드 내용 기반 고품질 이미지
6. **결과 확인**: 모든 생성된 콘텐츠 통합 미리보기

## 🚀 **다음 단계 제안**

### **우선순위 1: 비디오 구성 엔진**
- 이미지, 음성, 자막을 결합한 최종 쇼츠 비디오 생성
- FFmpeg/Remotion을 통한 자동 타이밍 및 전환 효과
- **예상 소요시간**: 3-4일

### **우선순위 2: 자막 생성 시스템**
- TTS와 동기화된 자막 생성
- SRT/VTT 형식 지원 및 한국어 특화 처리
- **예상 소요시간**: 2-3일

### **우선순위 3: 배포 및 최적화**
- Docker 컨테이너화 및 클라우드 배포
- 성능 최적화 및 에러 처리 강화
- **예상 소요시간**: 2-3일

---

> **업데이트일:** 2025-07-28  
> **업데이트 내용:** 이미지 생성 시스템 완성, 완전한 6단계 워크플로우 구현, TTS API 오류 수정

---

# 📅 작업 내역 요약 (2025-08-01) - 오늘의 진행사항

## 🎯 **오늘 완료된 주요 기능**

### **Core Message 기반 이미지 스크립트 생성 시스템** ✅
- **저장된 Core Message 재사용**: TTS 데이터에서 이미 생성된 `script.coreMessage`를 가져와서 사용
- **4가지 스타일 스크립트**: 각 Core Message당 개념도/다이어그램, 인포그래픽, 실용적 예시, 핵심 요약
- **자연스러운 프롬프트**: "대본 내용에 맞는 이미지 생성해줘" 형태의 직관적인 프롬프트
- **스크립트 미리보기 및 편집**: 생성된 스크립트를 미리보기하고 필요에 따라 수정 가능
- **활성화/비활성화 기능**: 각 스크립트를 개별적으로 활성화/비활성화하여 선택적 이미지 생성

### **향상된 사용자 경험** ✅
- **Core Message 미리보기**: 각 그룹별로 사용된 Core Message 내용을 시각적으로 표시
- **스크립트 생성 상태 표시**: Core Message 기반 vs 그룹 내용 기반 구분 표시
- **실시간 스크립트 수정**: 텍스트 에디터로 프롬프트 직접 수정 가능
- **체크박스 기반 선택**: 원하는 스크립트만 선택하여 이미지 생성

### **백엔드 API 개선** ✅
- **Core Message 전달**: 프론트엔드에서 Core Message를 백엔드로 전달하는 구조
- **스크립트 생성 로직 개선**: Core Message 우선, 없을 경우 그룹 내용 사용
- **상세한 로깅**: Core Message 사용 여부 및 스크립트 생성 과정 상세 로깅
- **에러 처리 강화**: Core Message가 없는 경우에 대한 fallback 처리

## 🔧 **기술적 구현 세부사항**

### **Core Message 기반 스크립트 생성**
```typescript
// Core Message가 있는 경우 우선 사용
if (coreMessage && coreMessage.trim()) {
    const imageScripts = [
        {
            prompt: `${coreMessage}에 대한 교육적인 개념도나 다이어그램을 생성해줘.`,
            description: '개념도/다이어그램'
        },
        {
            prompt: `${coreMessage} 내용을 시각화한 인포그래픽을 생성해줘.`,
            description: '인포그래픽'
        },
        // ... 4가지 스타일
    ];
}
```

### **프론트엔드 UI 개선**
```typescript
// Core Message 미리보기 섹션
{groupScript?.coreMessage && (
    <div style={{ backgroundColor: '#f0f9ff', border: '1px solid #0ea5e9' }}>
        <div>📝 Core Message (이미지 스크립트 생성 기준)</div>
        <div>{groupScript.coreMessage}</div>
    </div>
)}
```

### **스크립트 활성화/비활성화**
```typescript
// 체크박스로 스크립트 선택
<input
    type="checkbox"
    checked={script.enabled !== false}
    onChange={() => handleScriptToggle(groupIndex, scriptIndex)}
/>
```

## 📊 **업데이트된 프로젝트 상태**

### **완료된 작업**
- ✅ **파일 업로드 시스템**: PPTX/PDF 파싱 및 그룹화
- ✅ **스크립트 생성**: LangChain + GPT-4o 통합
- ✅ **TTS 서비스**: Google Cloud TTS (한국어)
- ✅ **이미지 생성**: OpenAI DALL-E 통합
- ✅ **Core Message 기반 스크립트**: 저장된 Core Message 재사용
- ✅ **완전한 워크플로우**: 6단계 End-to-End 처리
- ✅ **프론트엔드 UI**: 모든 단계별 사용자 인터페이스

### **개선된 워크플로우**
1. **파일 업로드**: PPTX/PDF 파일 드래그 앤 드롭
2. **자동 그룹화**: 최대 3개 슬라이드, 60초 이내 그룹 생성
3. **스크립트 생성**: Hook + Core Message + CTA 구조
4. **음성 변환**: 한국어 여성 음성으로 섹션별 변환 (Core Message 저장)
5. **이미지 스크립트 생성**: Core Message 기반 4가지 스타일 스크립트
6. **이미지 생성**: 선택된 스크립트로 고품질 이미지 생성
7. **결과 확인**: 모든 생성된 콘텐츠 통합 미리보기

## 🚀 **다음 단계 제안**

### **우선순위 1: 비디오 구성 엔진**
- 이미지, 음성, 자막을 결합한 최종 쇼츠 비디오 생성
- FFmpeg/Remotion을 통한 자동 타이밍 및 전환 효과
- **예상 소요시간**: 3-4일

### **우선순위 2: 자막 생성 시스템**
- TTS와 동기화된 자막 생성
- SRT/VTT 형식 지원 및 한국어 특화 처리
- **예상 소요시간**: 2-3일

### **우선순위 3: 배포 및 최적화**
- Docker 컨테이너화 및 클라우드 배포
- 성능 최적화 및 에러 처리 강화
- **예상 소요시간**: 2-3일

---

> **업데이트일:** 2025-08-01  
> **업데이트 내용:** Core Message 기반 이미지 스크립트 생성 시스템 완성, 스크립트 미리보기 및 편집 기능 추가, 사용자 경험 개선

---

# 📅 작업 내역 요약 (2025-08-05) - 오늘의 진행사항

## 🎯 **오늘 완료된 주요 기능**

### **이미지 프롬프트 파싱 시스템 대폭 개선** ✅
- **기존 문제점**: 한글 텍스트 매칭으로 인한 불안정한 파싱
- **개선 사항**: 
  - JSON 파싱 우선 시도 → 마크다운 형식 fallback → 줄바꿈 기반 분할
  - 다중 fallback 시스템으로 파싱 성공률 대폭 향상
  - 응답이 잘려도 부분적으로라도 파싱 가능하도록 개선
  - 상세한 디버깅 로그 추가로 문제 진단 용이

### **AI 프롬프트 템플릿 최적화** ✅
- **프롬프트 간소화**: 복잡한 설명 제거, 핵심만 요청
- **명확한 형식 지정**: 정확한 응답 형식 명시
- **토큰 절약**: 짧고 명확한 지시로 응답 완성도 향상
- **LangChain f-string 오류 해결**: JSON 예시의 중괄호 이스케이프 처리

### **파싱 로직 완전 재작성** ✅
- **3단계 파싱 시스템**:
  1. 완전한 Prompt 패턴 매칭 (4개 모두)
  2. 부분 Prompt 패턴 매칭 (1-3개)
  3. 줄바꿈 기반 분할 (최후의 수단)
- **성공 조건 완화**: 1개라도 파싱되면 성공으로 처리
- **실시간 디버깅**: 응답 길이, 시작/끝 부분, 매치 개수 로그

### **한글 프롬프트 생성 문제 해결** ✅
- **문제 발견**: `generateSpecificPrompt` 함수에서 "한국어로 작성" 지시
- **해결**: 모든 이미지 프롬프트 생성 함수를 영어로 통일
- **일관성 확보**: DALL-E 3 최적화된 영어 프롬프트로 통일

## 🔧 **기술적 구현 세부사항**

### **개선된 파싱 시스템**
```typescript
// 방법 1: 완전한 Prompt 패턴
const fullMatches = result.match(/=== Prompt\d+ ===\s*([\s\S]*?)(?=== Prompt\d+ ===|$)/g);

// 방법 2: 부분 Prompt 패턴 (1-3개만 있어도 OK)
const partialMatches = result.match(/=== Prompt\d+ ===\s*([\s\S]*?)(?=== Prompt\d+ ===|$)/g);

// 방법 3: 줄바꿈 기반 분할 (최후의 수단)
const lines = result.split('\n');
// ... 줄 단위 분석 로직
```

### **LangChain 템플릿 수정**
```typescript
// JSON 예시의 중괄호 이스케이프 처리
**Option 1 - JSON format (preferred)**:
{{
  "prompts": [
    "English image prompt for part 1",
    "English image prompt for part 2", 
    "English image prompt for part 3",
    "English image prompt for part 4"
  ]
}}
```

### **프롬프트 템플릿 최적화**
```typescript
// 간소화된 프롬프트
const promptTemplate = PromptTemplate.fromTemplate(`
    Create 4 short English prompts for DALL-E 3 images.
    
    Content: {message}
    Title: {groupTitle}
    
    Write 4 brief prompts, each under 50 words. Include "watercolor style, no text" in each.
    
    === Prompt1 ===
    [Brief prompt 1]
    
    === Prompt2 ===
    [Brief prompt 2]
    
    === Prompt3 ===
    [Brief prompt 3]
    
    === Prompt4 ===
    [Brief prompt 4]
    `);
```

## 📊 **해결된 문제들**

### **1. 파싱 실패 문제**
- **기존**: 한글 "프롬프트" 텍스트 매칭으로 불안정
- **해결**: 영어 "Prompt" 패턴으로 안정적 파싱
- **결과**: 파싱 성공률 대폭 향상

### **2. 응답 잘림 문제**
- **기존**: 토큰 제한으로 응답이 중간에 잘림
- **해결**: 부분 파싱 시스템으로 일부라도 추출
- **결과**: 완전하지 않아도 최대한 많은 프롬프트 추출

### **3. LangChain 오류**
- **기존**: f-string 오류로 템플릿 파싱 실패
- **해결**: JSON 예시의 중괄호 이스케이프 처리
- **결과**: 템플릿 정상 작동

### **4. 한글 프롬프트 문제**
- **기존**: 일부 함수에서 한글로 프롬프트 생성
- **해결**: 모든 함수를 영어로 통일
- **결과**: DALL-E 3 최적화된 일관된 프롬프트

## 🚀 **다음 단계 제안**

### **우선순위 1: 비디오 구성 엔진**
- 이미지, 음성, 자막을 결합한 최종 쇼츠 비디오 생성
- FFmpeg/Remotion을 통한 자동 타이밍 및 전환 효과
- **예상 소요시간**: 3-4일

### **우선순위 2: 자막 생성 시스템**
- TTS와 동기화된 자막 생성
- SRT/VTT 형식 지원 및 한국어 특화 처리
- **예상 소요시간**: 2-3일

### **우선순위 3: 배포 및 최적화**
- Docker 컨테이너화 및 클라우드 배포
- 성능 최적화 및 에러 처리 강화
- **예상 소요시간**: 2-3일

---

> **업데이트일:** 2025-08-05  
> **업데이트 내용:** 이미지 프롬프트 파싱 시스템 대폭 개선, AI 프롬프트 템플릿 최적화, 한글 프롬프트 생성 문제 해결

---

# 📅 작업 내역 요약 (2025-07-08)
