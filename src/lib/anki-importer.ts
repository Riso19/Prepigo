import JSZip from 'jszip';
import initSqlJs, { Database } from 'sql.js';
import { DeckData, FlashcardData, BasicFlashcard, ClozeFlashcard, SrsData, Sm2State } from '@/data/decks';

// Per Anki schema, fields are separated by this character.
const ANKI_FIELD_SEPARATOR = '\x1f';

// --- Type definitions for raw Anki data based on schema ---
interface AnkiModel {
  id: number;
  name: string;
  flds: { name: string; ord: number }[];
  tmpls: { name: string; qfmt: string; afmt: string; ord: number }[];
  type: number; // 0 for standard, 1 for cloze
}

interface AnkiDeck {
  id: number;
  name: string;
}

// --- Helper function to convert Anki's scheduling data ---
const convertAnkiSchedulingData = (
  cardRow: any[],
  collectionCreationTimestamp: number
): SrsData => {
  const [
    _id, _nid, _did, _ord, _mod, _usn,
    type, queue, due, ivl, factor, reps, lapses
  ] = cardRow as [number, number, number, number, number, number, number, number, number, number, number, number, number];

  const isSuspended = queue === -1;
  let state: Sm2State['state'];
  let dueDate: Date;
  const now = new Date();

  switch (type) {
    case 0: state = 'new'; dueDate = now; break;
    case 1: state = 'learning'; dueDate = new Date(due * 1000); break;
    case 2: state = 'review';
      const creationDate = new Date(collectionCreationTimestamp * 1000);
      creationDate.setDate(creationDate.getDate() + due);
      dueDate = creationDate;
      break;
    case 3: state = 'relearning'; dueDate = new Date(due * 1000); break;
    default: state = 'new'; dueDate = now; break;
  }

  const sm2: Sm2State = {
    due: dueDate.toISOString(),
    easinessFactor: Math.max(1.3, factor / 1000),
    interval: ivl,
    repetitions: reps,
    lapses: lapses,
    state: state,
  };

  return { sm2, isSuspended, newCardOrder: type === 0 ? due : undefined };
};

// --- Main Importer Function ---
export const importAnkiFile = async (file: File, includeScheduling: boolean): Promise<DeckData[]> => {
  const SQL = await initSqlJs({ locateFile: file => `https://sql.js.org/dist/${file}` });
  let dbBytes: Uint8Array;
  const mediaMap: { [key: string]: string } = {};

  // 1. Extract the database file bytes
  if (file.name.endsWith('.apkg')) {
    const zip = await JSZip.loadAsync(file);
    const dbFileEntry = zip.file(/collection\.anki2(1)?/)[0];
    if (!dbFileEntry) throw new Error('Database file (collection.anki2 or .anki21) not found in .apkg archive.');
    dbBytes = await dbFileEntry.async('uint8array');
    
    const mediaFile = zip.file('media');
    if (mediaFile) {
      try {
        const mediaJSON = JSON.parse(await mediaFile.async('string'));
        for (const key in mediaJSON) {
          const fileName = mediaJSON[key];
          const fileEntry = zip.file(key);
          if (fileEntry) {
            const blob = await fileEntry.async('blob');
            const dataUrl = await new Promise<string>(resolve => {
              const reader = new FileReader();
              reader.onload = e => resolve(e.target!.result as string);
              reader.readAsDataURL(blob);
            });
            mediaMap[fileName] = dataUrl;
          }
        }
      } catch (e) { console.warn("Could not parse 'media' file. Media may not be displayed.", e); }
    }
  } else if (file.name.endsWith('.anki2') || file.name.endsWith('.anki21')) {
    dbBytes = new Uint8Array(await file.arrayBuffer());
  } else {
    throw new Error('Unsupported file type. Please provide a .apkg, .anki2, or .anki21 file.');
  }

  // 2. Verify and open the database
  let db: Database;
  try {
    db = new SQL.Database(dbBytes);
  } catch (e) {
    console.error("SQLite initialization failed:", e);
    throw new Error("Failed to open the Anki file. It may be corrupt, password-protected, or not a valid Anki database.");
  }

  // 3. Extract data from the database
  const colResult = db.exec("SELECT models, decks, crt FROM col");
  if (!colResult?.[0]?.values?.[0]) throw new Error("Could not read collection data. The file may be corrupt.");
  
  const [modelsJSON, decksJSON, collectionCreationTimestamp] = colResult[0].values[0] as [string, string, number];
  const models: { [id: string]: AnkiModel } = JSON.parse(modelsJSON);
  const ankiDecks: { [id: string]: AnkiDeck } = JSON.parse(decksJSON);
  const notesData = db.exec("SELECT id, mid, flds, tags FROM notes")[0]?.values ?? [];
  const cardsData = db.exec("SELECT id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses FROM cards")[0]?.values ?? [];

  const replaceMediaSrc = (html: string): string => {
    if (!html) return '';
    return html.replace(/src="([^"]+)"/g, (match, fileName) => mediaMap[fileName] ? `src="${mediaMap[fileName]}"` : match);
  };

  // 4. Prepare deck structure
  const deckDataMap: Map<string, DeckData> = new Map();
  Object.values(ankiDecks).forEach(d => {
    deckDataMap.set(d.id.toString(), { id: `anki-${d.id}`, name: d.name, flashcards: [], subDecks: [] });
  });

  // 5. Process each card
  cardsData.forEach(cardRow => {
    const [_id, noteId, deckId, ord] = cardRow as [number, number, number, number];
    const noteRow = notesData.find(n => n[0] === noteId);
    if (!noteRow) return;

    const [_noteId, modelId, fieldsStr, tagsStr] = noteRow as [number, number, string, string];
    const model = models[modelId.toString()];
    const deck = deckDataMap.get(deckId.toString());
    if (!model || !deck) return;

    const fields = fieldsStr.split(ANKI_FIELD_SEPARATOR);
    const template = model.tmpls[ord];
    if (!template) return;

    let flashcard: FlashcardData | null = null;
    if (model.type === 1 || template.qfmt.includes('{{cloze:')) {
      flashcard = {
        id: `anki-c-${_id}`, noteId: `anki-n-${noteId}`, type: 'cloze',
        text: replaceMediaSrc(fields[0] ?? ''),
        description: replaceMediaSrc(fields.length > 1 ? fields[1] : ''),
      } as ClozeFlashcard;
    } else {
      const fieldMap: { [key: string]: string } = {};
      model.flds.forEach(fld => { fieldMap[fld.name] = fields[fld.ord] ?? ''; });
      let question = template.qfmt;
      let answer = template.afmt;
      for (const key in fieldMap) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        question = question.replace(regex, fieldMap[key]);
        answer = answer.replace(regex, fieldMap[key]);
      }
      answer = answer.replace(/{{FrontSide}}/g, question);
      flashcard = {
        id: `anki-c-${_id}`, noteId: `anki-n-${noteId}`, type: 'basic',
        question: replaceMediaSrc(question), answer: replaceMediaSrc(answer),
      } as BasicFlashcard;
    }

    if (flashcard) {
      flashcard.tags = (tagsStr || '').trim().split(' ').filter(Boolean);
      if (includeScheduling) flashcard.srs = convertAnkiSchedulingData(cardRow, collectionCreationTimestamp);
      deck.flashcards.push(flashcard);
    }
  });

  // 6. Assemble deck hierarchy
  const rootDecks: DeckData[] = [];
  const allDecks = Array.from(deckDataMap.values());
  allDecks.forEach(deck => {
    const parts = deck.name.split('::');
    if (parts.length > 1) {
      const parentName = parts.slice(0, -1).join('::');
      const parentDeck = allDecks.find(d => d.name === parentName);
      if (parentDeck) {
        deck.name = parts[parts.length - 1];
        parentDeck.subDecks!.push(deck);
      } else {
        rootDecks.push(deck);
      }
    } else {
      rootDecks.push(deck);
    }
  });

  return rootDecks;
};