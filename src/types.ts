export type TeamId = 'A' | 'B';
export type QuestionType = 'short-answer' | 'multiple-choice';
export type ChoiceLabel = 'W' | 'X' | 'Y' | 'Z';
export const labels: ChoiceLabel[] = ['W', 'X', 'Y', 'Z'];
export type PdfBounds = [number, number, number, number]; // PDF-space left, bottom, right, top
export interface SourceSpan { page: number; startOffset: number; endOffset: number; bounds?: PdfBounds }
export interface Question {
  id: string; number: number | null; category: string; type: QuestionType | null; text: string;
  choices: Record<ChoiceLabel, string> | null; answer: string;
  acceptedAnswers: string[]; rejectedAnswers: string[]; answerNotes: string[];
  answerChoice: ChoiceLabel | null; source: SourceSpan[]; rawBlock: string;
  preferSource?: boolean;
  playbackWarnings?: string[];
}
export interface DraftQuestion extends Omit<Question, 'number' | 'type'> {
  number: number | null; type: QuestionType | null; kind: 'tossup' | 'bonus';
  excluded: boolean; acknowledged: string[]; parseIssues: string[];
}
export interface QuestionPair { id: string; number: number | null; tossup: Question; bonus: Question | null }
export interface DraftQuestionPair { id: string; tossup: DraftQuestion; bonus: DraftQuestion | null; missingBonusAcknowledged: boolean }
export interface Diagnostic { id: string; code: string; severity: 'error' | 'warning'; message: string; blockId?: string; pages: number[]; resolution: 'unresolved' | 'fixed' | 'acknowledged' | 'excluded' }
export interface SourceSegment { id: string; text: string; pages: number[]; excluded: boolean }
export interface ParseResult { draftPairs: DraftQuestionPair[]; unassignedBlocks: DraftQuestion[]; unparsedSegments: SourceSegment[]; diagnostics: Diagnostic[]; stats: { pages: number; tossups: number; bonuses: number; pairs: number } }
export interface TextItem { str: string; transform: number[]; width: number; height: number; fontName: string; hasEOL: boolean }
export interface ExtractedPage { page: number; text: string; items?: TextItem[]; notationRanges?: { start: number; end: number }[]; regions?: { start: number; end: number; bounds: PdfBounds }[]; removed?: string[] }
export interface ExtractedDocument { pages: ExtractedPage[] }
export interface Packet { id: string; fileName: string; fileHash: string; pairs: QuestionPair[]; competition?: import('./game/competition').CompetitionConfig }
