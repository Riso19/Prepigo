import { McqData } from '@/data/questionBanks';
import { openDB } from 'idb';

// AI Explanation interface
export interface AIExplanation {
  id: string;
  mcqId: string;
  explanation: string;
  reasoning: string;
  keyPoints: string[];
  createdAt: number;
  updatedAt: number;
  // Optional semantic version for forward/backward compatibility
  version?: 1;
}

// IndexedDB store name for AI explanations
export const AI_EXPLANATIONS_STORE = 'ai_explanations';

// Cache for in-memory storage to avoid repeated DB calls
const explanationCache = new Map<string, AIExplanation>();

// Internal: read Gemini API key from Settings DB (same store used by SettingsContext)
async function getGeminiApiKeyFromSettings(): Promise<string | undefined> {
  try {
    const db = await openDB('PrepigoSettingsDB', 1);
    const settings = (await db.get('settings', 'srsSettings')) as
      | { geminiApiKey?: string }
      | undefined;
    return settings?.geminiApiKey || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Get AI explanation from cache or IndexedDB
 */
export async function getAIExplanation(mcqId: string): Promise<AIExplanation | null> {
  // Check cache first
  if (explanationCache.has(mcqId)) {
    return explanationCache.get(mcqId)!;
  }

  try {
    // Import storage functions dynamically to avoid circular dependencies
    const { table } = await import('@/lib/storage');
    const explanationsTable = await table<AIExplanation>(AI_EXPLANATIONS_STORE);
    const explanation = await explanationsTable.get(mcqId);

    if (explanation) {
      explanationCache.set(mcqId, explanation);
      return explanation;
    }
  } catch (error) {
    console.error('Error fetching AI explanation from DB:', error);
  }

  return null;
}

/**
 * Save AI explanation to IndexedDB and cache
 */
export async function saveAIExplanation(explanation: AIExplanation): Promise<void> {
  try {
    const { table } = await import('@/lib/storage');
    const explanationsTable = await table<AIExplanation>(AI_EXPLANATIONS_STORE);

    // Ensure version defaults
    const payload: AIExplanation = { version: 1, ...explanation };

    await explanationsTable.put(payload, payload.mcqId);
    explanationCache.set(payload.mcqId, payload);

    // Broadcast storage write for multi-tab sync
    const { postMessage } = await import('@/lib/broadcast');
    postMessage({ type: 'storage-write', resource: AI_EXPLANATIONS_STORE, id: payload.mcqId });

    // Enqueue sync op (best-effort, dynamic import to avoid tight coupling in tests)
    try {
      // Import the storage module and type the enqueueSyncOp function
      interface StorageModule {
        enqueueSyncOp?: (op: {
          resource: string;
          opType: 'create' | 'update' | 'delete' | 'upsert' | 'bulk-upsert';
          id?: string;
          payload?: unknown;
          priority?: number;
        }) => Promise<unknown>;
      }

      interface SyncModule {
        scheduleSyncNow?: () => Promise<unknown>;
      }

      const storageModule = await import('@/lib/storage').catch((): StorageModule => ({}));
      const syncModule = await import('@/lib/sync').catch((): SyncModule => ({}));

      const typedStorageModule = storageModule as StorageModule;
      const typedSyncModule = syncModule as SyncModule;

      if (typedStorageModule.enqueueSyncOp) {
        await typedStorageModule.enqueueSyncOp({
          resource: AI_EXPLANATIONS_STORE,
          opType: 'upsert',
          id: payload.mcqId,
          payload,
          priority: 3,
        });

        if (typedSyncModule.scheduleSyncNow) {
          await typedSyncModule.scheduleSyncNow();
        }
      }
    } catch {
      /* noop */
    }
  } catch (error) {
    console.error('Error saving AI explanation:', error);
    throw error;
  }
}

/**
 * Generate AI explanation for an MCQ
 * This is a mock implementation - replace with actual AI service call
 */
export async function generateAIExplanation(mcq: McqData): Promise<AIExplanation> {
  // Return cached if present
  const existing = await getAIExplanation(mcq.id);
  if (existing) return existing;

  // Require API key; if missing, surface error instead of creating mock
  const apiKey = await getGeminiApiKeyFromSettings();
  if (!apiKey) {
    throw new Error('AI explanation unavailable: Gemini API key not configured in Settings');
  }
  return generateAIExplanationWithService(mcq, apiKey);
}

/**
 * Generate AI explanation with actual AI service (placeholder for future implementation)
 */
export async function generateAIExplanationWithService(
  mcq: McqData,
  _apiKey?: string,
): Promise<AIExplanation> {
  // Check cache/DB first
  const existing = await getAIExplanation(mcq.id);
  if (existing) return existing;

  // Resolve API key: param overrides settings
  const apiKey = _apiKey || (await getGeminiApiKeyFromSettings());
  if (!apiKey) {
    throw new Error('AI explanation unavailable: missing API key');
  }

  // Build prompt and call Gemini (JSON response requested)
  const correct = mcq.options.find((o) => o.isCorrect)?.text ?? '';
  const optionsText = mcq.options
    .map((o, i) => `${i + 1}. ${o.text}${o.isCorrect ? ' (Correct)' : ''}`)
    .join('\n');

  const systemInstruction = `You are a medical exam tutor. Produce concise, educational explanations for MCQs.
Respond strictly in JSON with keys: explanation (string), reasoning (string), keyPoints (string[]).
Ensure reasoning covers why the correct option is right AND why each incorrect option is wrong. Include common mistakes/misunderstandings.`;

  const userPrompt = `Question: ${mcq.question}\n\nOptions:\n${optionsText}\n\nGiven source explanation (may be brief/incomplete): ${mcq.explanation}\n\nPlease provide:\n1) A detailed explanation of why the correct answer is right\n2) Specific reasoning for each incorrect option explaining what misconception it represents\n3) 3-6 key learning points (bulleted)\n4) List common mistakes and misunderstandings to avoid\n\nCorrect answer text: ${correct}`;

  try {
    const url =
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent' +
      `?key=${encodeURIComponent(apiKey)}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: systemInstruction }] },
          { role: 'user', parts: [{ text: userPrompt }] },
        ],
        generationConfig: {
          response_mime_type: 'application/json',
        },
      }),
    });

    if (!resp.ok) throw new Error(`Gemini error: ${resp.status}`);
    interface GeminiResponse {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
            inline_data?: unknown;
          }>;
        };
      }>;
    }
    const data = (await resp.json()) as GeminiResponse;
    const firstText: string | undefined =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      (typeof data?.candidates?.[0]?.content?.parts?.[0]?.inline_data === 'string'
        ? data.candidates[0].content.parts[0].inline_data
        : undefined);

    let parsed: { explanation?: string; reasoning?: string; keyPoints?: string[] } = {};
    if (typeof firstText === 'string') {
      try {
        parsed = JSON.parse(firstText);
      } catch {
        // Non-JSON: coerce
        parsed = { explanation: firstText, reasoning: '', keyPoints: [] };
      }
    } else if (firstText && typeof firstText === 'object') {
      parsed = firstText as { explanation?: string; reasoning?: string; keyPoints?: string[] };
    }

    const correctOption = mcq.options.find((o) => o.isCorrect);
    const fallbackExplanation = `The correct answer is "${correctOption?.text ?? ''}" because ${mcq.explanation}`;

    const explanation: AIExplanation = {
      id: `ai-exp-${mcq.id}`,
      mcqId: mcq.id,
      explanation: parsed.explanation || fallbackExplanation,
      reasoning:
        parsed.reasoning ||
        'This question evaluates understanding of core concepts and differentiating incorrect options.',
      keyPoints:
        Array.isArray(parsed.keyPoints) && parsed.keyPoints.length
          ? parsed.keyPoints
          : [
              `Correct answer: ${correctOption?.text ?? ''}`,
              'Recall the key concept and avoid common distractors.',
            ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };

    await saveAIExplanation(explanation);
    return explanation;
  } catch (e) {
    // Surface error to UI; components will show error state with regenerate
    const message = e instanceof Error ? e.message : 'Unknown error generating AI explanation';
    throw new Error(message);
  }
}

/**
 * Clear explanation cache (useful for memory management)
 */
export function clearExplanationCache(): void {
  explanationCache.clear();
}

/**
 * Get cache size for debugging
 */
export function getExplanationCacheSize(): number {
  return explanationCache.size;
}

/**
 * Delete AI explanation
 */
export async function deleteAIExplanation(mcqId: string): Promise<void> {
  try {
    const { table } = await import('@/lib/storage');
    const explanationsTable = await table<AIExplanation>(AI_EXPLANATIONS_STORE);

    await explanationsTable.delete(mcqId);
    explanationCache.delete(mcqId);

    // Broadcast storage write for multi-tab sync
    const { postMessage } = await import('@/lib/broadcast');
    postMessage({ type: 'storage-write', resource: AI_EXPLANATIONS_STORE, id: mcqId });

    // Enqueue delete op (best-effort)
    try {
      interface StorageModule {
        enqueueSyncOp?: (op: {
          resource: string;
          opType: 'create' | 'update' | 'delete' | 'upsert' | 'bulk-upsert';
          id?: string;
          payload?: unknown;
          priority?: number;
        }) => Promise<unknown>;
      }
      interface SyncModule {
        scheduleSyncNow?: () => Promise<unknown>;
      }

      const storageModule = await import('@/lib/storage').catch((): StorageModule => ({}));
      const syncModule = await import('@/lib/sync').catch((): SyncModule => ({}));

      const { enqueueSyncOp } = storageModule as StorageModule;
      const { scheduleSyncNow } = syncModule as SyncModule;

      if (enqueueSyncOp) {
        await enqueueSyncOp({
          resource: AI_EXPLANATIONS_STORE,
          opType: 'delete',
          id: mcqId,
          payload: { mcqId },
          priority: 4,
        });
        if (scheduleSyncNow) await scheduleSyncNow();
      }
    } catch {
      /* noop */
    }
  } catch (error) {
    console.error('Error deleting AI explanation:', error);
    throw error;
  }
}
