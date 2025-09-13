import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';

interface RefinedSection {
    id: number;
    originalText: string;
    refinedText: string;
    title: string;
    keyPoints: string[];
    summary: string;
    sectionType: 'introduction' | 'main-point-1' | 'main-point-2' | 'main-point-3' | 'conclusion';
}

// OpenAI 모델 초기화
const model = new ChatOpenAI({
    modelName: 'gpt-4o',
    temperature: 0.3,
    maxTokens: 1000,
});

// 섹션 다듬기 프롬프트 템플릿
const sectionRefinePromptTemplate = PromptTemplate.fromTemplate(`
당신은 전문적인 콘텐츠 편집자입니다. 
주어진 텍스트에서 "외국어습득론1주차1교시", "1주차", "1교시", "제1장", "Chapter 1" 등의 제목이나 구조적 요소들을 제거하고, 순수한 내용만을 줄글로 다듬어서 쇼츠 비디오에 적합한 섹션으로 만들어주세요.

**섹션 타입**: {sectionType}
**원본 텍스트**:
{originalText}

**요구사항**:
1. **제목**: 섹션의 핵심 내용을 한 줄로 표현하는 매력적인 제목 (구조적 제목 제외)
2. **핵심 포인트**: 3-5개의 핵심 내용을 간결하게 정리
3. **요약**: 전체 내용을 2-3문장으로 압축한 요약
4. **다듬어진 텍스트**: 원본의 핵심 내용만을 유지하면서 읽기 쉽고 흥미롭게 재구성한 줄글

**제거해야 할 요소들**:
- "외국어습득론1주차1교시", "1주차", "1교시" 등의 제목
- "제1장", "Chapter 1", "Section 1" 등의 구조적 표시
- "학습목표", "학습내용", "요약" 등의 메타데이터
- 페이지 번호, 날짜, 시간 등의 참조 정보

**출력 형식** (JSON):
{{
  "title": "내용 중심의 섹션 제목",
  "keyPoints": ["핵심 포인트 1", "핵심 포인트 2", "핵심 포인트 3"],
  "summary": "섹션 요약",
  "refinedText": "구조적 요소를 제거하고 내용만으로 구성된 다듬어진 텍스트"
}}

**주의사항**:
- 한국어로 작성
- 쇼츠 비디오에 적합한 간결하고 임팩트 있는 표현 사용
- 원본의 핵심 내용은 반드시 포함하되, 구조적 요소는 완전히 제거
- 읽기 쉽고 자연스러운 줄글로 구성
- 제목이나 구조적 표시 없이 순수한 내용만 포함
`);

export class SectionRefinerService {
    private static instance: SectionRefinerService;
    private cache = new Map<string, RefinedSection[]>();

    public static getInstance(): SectionRefinerService {
        if (!SectionRefinerService.instance) {
            SectionRefinerService.instance = new SectionRefinerService();
        }
        return SectionRefinerService.instance;
    }

    private generateCacheKey(sections: string[]): string {
        const content = sections.join('|');
        return Buffer.from(content).toString('base64');
    }

    public async refineSections(sections: string[]): Promise<RefinedSection[]> {
        const cacheKey = this.generateCacheKey(sections);

        // 캐시 확인
        if (this.cache.has(cacheKey)) {
            console.log('캐시된 섹션 다듬기 결과 사용');
            return this.cache.get(cacheKey)!;
        }

        try {
            console.log('섹션 다듬기 시작:', {
                sectionsCount: sections.length
            });

            const refinedSections: RefinedSection[] = [];

            for (let i = 0; i < sections.length; i++) {
                const sectionText = sections[i];

                if (!sectionText || sectionText.trim() === '') {
                    // 빈 섹션 처리
                    refinedSections.push({
                        id: i + 1,
                        originalText: sectionText,
                        refinedText: '',
                        title: `섹션 ${i + 1}`,
                        keyPoints: [],
                        summary: '',
                        sectionType: this.getSectionType(i)
                    });
                    continue;
                }

                console.log(`섹션 ${i + 1} 다듬기 시작`);

                // 프롬프트 생성
                const prompt = await sectionRefinePromptTemplate.format({
                    sectionType: this.getSectionTypeName(i),
                    originalText: sectionText
                });

                // OpenAI API 호출
                const aiResponse = await model.invoke(prompt);
                const responseText = aiResponse.content as string;

                // JSON 파싱
                let refinedData;
                try {
                    // JSON 부분만 추출 (```json으로 감싸진 경우 처리)
                    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                    const jsonText = jsonMatch ? jsonMatch[0] : responseText;
                    refinedData = JSON.parse(jsonText);
                } catch (parseError) {
                    console.warn(`섹션 ${i + 1} JSON 파싱 실패, 기본값 사용:`, parseError);
                    refinedData = {
                        title: `섹션 ${i + 1}`,
                        keyPoints: [],
                        summary: sectionText.substring(0, 100) + '...',
                        refinedText: sectionText
                    };
                }

                const refinedSection: RefinedSection = {
                    id: i + 1,
                    originalText: sectionText,
                    refinedText: refinedData.refinedText || sectionText,
                    title: refinedData.title || `섹션 ${i + 1}`,
                    keyPoints: Array.isArray(refinedData.keyPoints) ? refinedData.keyPoints : [],
                    summary: refinedData.summary || '',
                    sectionType: this.getSectionType(i)
                };

                refinedSections.push(refinedSection);
                console.log(`섹션 ${i + 1} 다듬기 완료`);
            }

            // 캐시에 저장
            this.cache.set(cacheKey, refinedSections);

            console.log('섹션 다듬기 완료:', {
                refinedSectionsCount: refinedSections.length
            });

            return refinedSections;

        } catch (error) {
            console.error('섹션 다듬기 중 오류:', error);
            throw new Error(`섹션 다듬기 실패: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private getSectionType(index: number): 'introduction' | 'main-point-1' | 'main-point-2' | 'main-point-3' | 'conclusion' {
        switch (index) {
            case 0: return 'introduction';
            case 1: return 'main-point-1';
            case 2: return 'main-point-2';
            case 3: return 'main-point-3';
            case 4: return 'conclusion';
            default: return 'introduction';
        }
    }

    private getSectionTypeName(index: number): string {
        switch (index) {
            case 0: return '도입부 (Introduction)';
            case 1: return '핵심 포인트 1 (Main Point 1)';
            case 2: return '핵심 포인트 2 (Main Point 2)';
            case 3: return '핵심 포인트 3 (Main Point 3)';
            case 4: return '결론부 (Conclusion)';
            default: return '섹션';
        }
    }

    public clearCache(): void {
        this.cache.clear();
        console.log('섹션 다듬기 캐시 초기화 완료');
    }

    public getCacheSize(): number {
        return this.cache.size;
    }
}

export default SectionRefinerService;
