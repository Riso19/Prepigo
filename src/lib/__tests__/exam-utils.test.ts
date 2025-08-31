import { describe, it, expect } from 'vitest';
import { getCardsForExam, getMcqsForExam } from '../../lib/exam-utils';
import type { DeckData, FlashcardData } from '../../data/decks';
import type { ExamData } from '../../data/exams';
import type { QuestionBankData, McqData } from '../../data/questionBanks';
import type { SrsSettings } from '../../contexts/SettingsContext';

function makeSettings(scheduler: 'fsrs' | 'fsrs6' | 'sm2' = 'fsrs'): SrsSettings {
  // Only fields used by exam-utils logic are relevant to tests
  return {
    scheduler,
    fsrsParameters: { request_retention: 0.9, maximum_interval: 36500, w: Array(17).fill(1) as number[] },
    mcqFsrsParameters: { request_retention: 0.9, maximum_interval: 36500, w: Array(17).fill(1) as number[] },
    fsrs6Parameters: { request_retention: 0.9, maximum_interval: 36500, w: Array(21).fill(1) as number[] },
    mcqFsrs6Parameters: { request_retention: 0.9, maximum_interval: 36500, w: Array(21).fill(1) as number[] },
    sm2StartingEase: 2.5,
    sm2MinEasinessFactor: 1.3,
    sm2EasyBonus: 1.3,
    sm2IntervalModifier: 1,
    sm2HardIntervalMultiplier: 1.2,
    sm2LapsedIntervalMultiplier: 0.6,
    sm2MaximumInterval: 365,
    sm2GraduatingInterval: 1,
    sm2EasyInterval: 4,
    sm2MinimumInterval: 1,
    learningSteps: '1 10',
    relearningSteps: '10',
    leechThreshold: 8,
    leechAction: 'tag',
    newCardsPerDay: 20,
    maxReviewsPerDay: 200,
    mcqNewCardsPerDay: 20,
    mcqMaxReviewsPerDay: 200,
    mcqDisplayOrder: 'sequential',
    mcqNewVsReviewOrder: 'mix',
    mcqReviewSortOrder: 'dueDate',
    mcqBurySiblings: false,
    mcqInterleaveBanks: true,
    mcqShuffleOptions: true,
    newCardInsertionOrder: 'sequential',
    newCardGatherOrder: 'deck',
    newCardSortOrder: 'typeThenGathered',
    newReviewOrder: 'mix',
    interdayLearningReviewOrder: 'mix',
    reviewSortOrder: 'dueDateRandom',
    buryNewSiblings: false,
    buryReviewSiblings: false,
    buryInterdayLearningSiblings: false,
    newCardsIgnoreReviewLimit: false,
    limitsStartFromTop: false,
    disableFlipAnimation: false,
  };
}

function makeDeck(id: string, flashcards: FlashcardData[]): DeckData {
  return { id, name: id, flashcards, subDecks: [] };
}

function makeBank(id: string, mcqs: McqData[]): QuestionBankData {
  return { id, name: id, mcqs, subBanks: [] } as unknown as QuestionBankData;
}

describe('exam-utils filters', () => {
  const now = Date.now();
  const past = new Date(now - 24 * 3600 * 1000).toISOString();
  const future = new Date(now + 24 * 3600 * 1000).toISOString();

  const cardNew: FlashcardData = { id: 'c-new', type: 'basic', question: 'f', answer: 'b', tags: ['t1'], srs: { fsrs: { state: 0, due: future, difficulty: 5 } as const } } as FlashcardData;
  const cardDue: FlashcardData = { id: 'c-due', type: 'basic', question: 'f', answer: 'b', tags: ['t2'], srs: { fsrs: { state: 1, due: past, difficulty: 7 } as const } } as FlashcardData;
  const cardHard: FlashcardData = { id: 'c-hard', type: 'basic', question: 'f', answer: 'b', tags: ['t1','t2'], srs: { fsrs: { state: 1, due: past, difficulty: 9 } as const } } as FlashcardData;

  const mcqNew: McqData = { id: 'm-new', stem: 's', options: [], answer: 0, tags: ['t1'], srs: { fsrs: { state: 0, due: future, difficulty: 4 } as const } } as McqData;
  const mcqDue: McqData = { id: 'm-due', stem: 's', options: [], answer: 0, tags: ['t2'], srs: { fsrs: { state: 1, due: past, difficulty: 6 } as const } } as McqData;

  const decks: DeckData[] = [ makeDeck('D1', [cardNew, cardDue, cardHard]) ];
  const banks: QuestionBankData[] = [ makeBank('B1', [mcqNew, mcqDue]) ];

  const baseExam: ExamData = {
    id: 'e1',
    name: 'Exam',
    date: new Date(now + 7 * 24 * 3600 * 1000).toISOString(),
    deckIds: ['D1'],
    questionBankIds: ['B1'],
    tags: [],
    tagFilterType: 'any',
    filterMode: 'all',
  };
  it('returns all items when filterMode=all', () => {
    const settings = makeSettings('fsrs');
    const cards = getCardsForExam(baseExam, decks, settings);
    const mcqs = getMcqsForExam(baseExam, banks, settings);
    expect(cards.map(c => c.id).sort()).toEqual(['c-due','c-hard','c-new'].sort());
    expect(mcqs.map(m => m.id).sort()).toEqual(['m-due','m-new'].sort());
  });

  it('filters due items only when filterMode=due', () => {
    const settings = makeSettings('fsrs');
    const exam = { ...baseExam, filterMode: 'due' } as ExamData;
    const cards = getCardsForExam(exam, decks, settings);
    const mcqs = getMcqsForExam(exam, banks, settings);
    expect(cards.map(c => c.id)).toEqual(['c-due','c-hard']);
    expect(mcqs.map(m => m.id)).toEqual(['m-due']);
  });

  it('filters by difficulty range when filterMode=difficulty', () => {
    const settings = makeSettings('fsrs');
    const exam = { ...baseExam, filterMode: 'difficulty', filterDifficultyMin: 6, filterDifficultyMax: 8 } as ExamData;
    const cards = getCardsForExam(exam, decks, settings);
    const mcqs = getMcqsForExam(exam, banks, settings);
    expect(cards.map(c => c.id)).toEqual(['c-due']);
    expect(mcqs.map(m => m.id)).toEqual(['m-due']);
  });

  it('applies tag filter any/all', () => {
    const settings = makeSettings('fsrs');
    const withTags: ExamData = { ...baseExam, tags: ['t1','t2'], tagFilterType: 'any' } as ExamData;
    const anyCards = getCardsForExam(withTags, decks, settings).map(c => c.id).sort();
    const anyMcqs = getMcqsForExam(withTags, banks, settings).map(m => m.id).sort();
    expect(anyCards).toEqual(['c-due','c-hard','c-new'].sort()); // any of t1 or t2
    expect(anyMcqs).toEqual(['m-due','m-new'].sort());

    const allTags: ExamData = { ...baseExam, tags: ['t1','t2'], tagFilterType: 'all' } as ExamData;
    const allCards = getCardsForExam(allTags, decks, settings).map(c => c.id);
    const allMcqs = getMcqsForExam(allTags, banks, settings).map(m => m.id);
    expect(allCards).toEqual(['c-hard']);
    expect(allMcqs).toEqual([]);
  });
});
