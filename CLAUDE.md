# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AutoShorts is an AI-powered short-form video generation system that transforms presentations (PPTX, PDF) or text input into TikTok/YouTube Shorts-style videos. It's a TypeScript monorepo with a Next.js frontend and Express.js backend.

## Development Commands

### Backend (port 3001)
```bash
cd backend
yarn dev          # Run with ts-node (hot-reload)
yarn build        # Compile TypeScript to dist/
```

### Frontend (port 3000)
```bash
cd frontend
yarn dev          # Next.js dev server
yarn build        # Production build
yarn lint         # ESLint
```

### Docker (recommended for full stack)
```bash
docker-compose up         # Start both services
docker-compose up --build # Rebuild and start
```

## Required Environment Variables

Copy `.env.example` to `.env` at the project root. Critical keys:

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | GPT-4o for script generation and section refinement |
| `GOOGLE_API_KEY` | Gemini API for image generation |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to Google Cloud service account JSON |
| `GOOGLE_CLOUD_PROJECT_ID` | Google Cloud project ID for TTS |
| `STABILITY_API_KEY` | (Optional) Stable Diffusion fallback |

Frontend reads API URLs via `NEXT_PUBLIC_*` env vars (e.g., `NEXT_PUBLIC_API_URL=http://localhost:3001`).

## Architecture

### Data Flow (8-step pipeline)

```
1. Input           → File upload (PPTX/PDF) or raw text
2. Parse           → pdfjs-dist / pptx parsing → Slide[] objects
3. Refine          → sectionRefiner (GPT-4o) → title, keyPoints[], summary
4. Script          → scriptGenerator (LangChain + GPT-4o) → Hook/Core/CTA
5. TTS             → Google Cloud TTS → MP3 per section
6. Images          → Gemini (primary) / DALL-E 3 (fallback) → saved to /temp-images/
7. Video           → FFmpeg assembly (images + audio + drawtext subtitles) → MP4
8. Merge           → FFmpeg concat of multiple section videos → final MP4
```

### Backend Services (`backend/src/services/`)

- **`scriptGenerator.ts`** — LangChain + ChatOpenAI (gpt-4o); includes in-memory caching to prevent duplicate API calls; calculates Korean speech timing at 3.5 syllables/second
- **`imageGenerationService.ts`** — Dual-provider image generation; always use 1:1 square aspect ratio (hardcoded to prevent rotation issues); saves to `/temp-images/` and returns URLs (not base64)
- **`ttsService.ts`** — Google Cloud TTS with SSML; generates MP3 to `/uploads/audio/`; uses FFmpeg to extract audio duration
- **`sectionRefiner.ts`** — GPT-4o powered refinement of raw parsed sections
- **`storyboardGenerator.ts`** — Creates narrative scenes + image prompts for storyboards
- **`visualAnalysisService.ts`** / **`visualDecisionEngine.ts`** — Analyzes whether slides need additional images

### Frontend Architecture (`frontend/src/app/`)

Multi-page workflow using Next.js App Router. State is persisted across pages via **browser `localStorage`** (`frontend/src/utils/sessionStorage.ts`):

```
/ → /script → /tts → /images → /video → /result
```

Additional pages: `/groups`, `/storyboard-images`, `/video-merge`

### Key API Endpoints

```
POST /api/upload                     - File upload (PPTX/PDF)
POST /api/generate-from-text         - Text input → 5-way section split
POST /api/generate-script            - Script generation (Hook/Core/CTA)
POST /api/generate-storyboard        - Storyboard scene generation
POST /api/generate-storyboard-images - Image prompts for storyboard
POST /api/tts/generate               - Text-to-speech
POST /api/generate-image             - Image generation (Gemini/DALL-E)
POST /api/generate-video             - Video composition with FFmpeg
POST /api/merge-videos               - Multi-video merge
POST /api/translate                  - Language translation
```

Static files served from backend: `/temp-images/`, `/temp-videos/`, `/audio/`

### File Lifecycle

Temp files (`/temp-images/`, `/temp-videos/`, `/uploads/audio/`) are auto-deleted by `node-cron` jobs after 24 hours, defined in `backend/src/index.ts`.

## Key Implementation Notes

- **Image aspect ratio:** Always 1:1 square. The 9:16 portrait ratio was removed to prevent rotation bugs.
- **Session state:** All inter-page state flows through `localStorage` utilities — check `frontend/src/utils/sessionStorage.ts` before adding new state.
- **LangChain pattern:** Services use `PromptTemplate → ChatOpenAI → JsonOutputParser` with Zod schema validation.
- **Video text overlay:** Uses FFmpeg `drawtext` filter; font paths must be valid on the host OS.
- **CORS:** Backend allows only `localhost:3000` and `localhost:3001`.
