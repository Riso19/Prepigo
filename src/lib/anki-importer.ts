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
// This function is rewritten to strictly follow the provided schema for the 'cards' table.
const convertAnkiSchedulingData = (
  cardRow: any[],
  collectionCreationTimestamp: number
): SrsData => {
  // Destructure based on the 'cards' table schema
  const [
    _id, _nid, _did, _ord, _mod, _usn,
    type, queue, due, ivl, factor, reps, lapses
  ] = cardRow as [number, number, number, number, number, number, number, number, number, number, number, number, number];

  const isSuspended = queue === -1;

  let state: Sm2State['state'];
  let dueDate: Date;
  const now = new Date();

  // Determine state and due date based on card type
  switch (type) {
    case 0: // New card
      state = 'new';
      // For new cards, 'due' is an order number, not a date. The card is due now.
      dueDate = now;
      break;
    case 1: // Learning card
      state = 'learning';
      // 'due' is an epoch timestamp in seconds
      dueDate = new Date(due * 1000);
      break;
    case 2: // Review card
      state = 'review';
      // 'due' is days relative to collection creation date
      const creationDate = new Date(collectionCreationTimestamp * 1000);
      creationDate.setDate(creationDate.getDate() + due);
      dueDate = creationDate;
      break;
    case 3: // Relearning card
      state = 'relearning';
      // 'due' is an epoch timestamp in seconds
      dueDate = new Date(due * 1000);
      break;
    default: // Should not happen
      state = 'new';
      dueDate = now;
      break;
  }

  const sm2: Sm2State = {
    due: dueDate.toISOString(),
    // 'factor' is in permille (e.g., 2500 for 2.5x)
    easinessFactor: Math.max(1.3, factor / 1000),
    interval: ivl,
    repetitions: reps,
    lapses: lapses,
    state: state,
  };

  return {
    sm2,
    isSuspended,
    // For new cards, use 'due' as the sorting order
    newCardOrder: type === 0 ? due : undefined,
  };
};

// --- Main Importer Function ---
export const importAnkiFile = async (file: File, includeScheduling: boolean): Promise<DeckData[]> => {
  // 1. Initialize SQL.js and load the database file
  const SQL = await initSqlJs({ locateFile: file => `https://sql.js.org/dist/${file}` });
  let db: Database;
  const mediaMap: { [key: string]: string } = {};

  if (file.name.endsWith('.apkg')) {
    const zip = await JSZip.loadAsync(file);
    const dbFileEntry = zip.file(/collection\.anki2(1)?/)[0];
    if (!dbFileEntry) {
      throw new Error('Database file (collection.anki2 or .anki21) not found in .apkg archive.');
    }
    const dbFile = await dbFileEntry.async('uint8array');
    db = new SQL.Database(dbFile);

    // Extract media files if they exist
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
      } catch (e) {
        console.warn("Could not parse the 'media' file. Media content may not be displayed correctly.", e);
      }
    }
  } else if (file.name.endsWith('.anki2') || file.name.endsWith('.anki21')) {
    const fileBuffer = await file.arrayBuffer();
    db = new SQL.Database(new Uint8Array(fileBuffer));
  } else {
    throw new Error('Unsupported file type. Please provide a .apkg, .anki2, or .anki21 file.');
  }

  // 2. Extract core collection data
  const colResult = db.exec("SELECT models, decks, crt FROM col");
  if (!colResult?.[0]?.values?.[0]) {
    throw new Error("Could not read collection data from the database. The file may be corrupt or empty.");
  }
  const [modelsJSON, decksJSON, collectionCreationTimestamp] = colResult[0].values[0] as [string, string, number];

  let models: { [id: string]: AnkiModel };
  try {
    models = JSON.parse(modelsJSON);
  } catch (e) {
    throw new Error("Failed to parse 'Note Types' (models) from the database. The data may be corrupt.");
  }

  let ankiDecks: { [id: string]: AnkiDeck };
  try {
    ankiDecks = JSON.parse(decksJSON);
  } catch (e) {
    throw new Error("Failed to parse 'Decks' from the database. The data may be corrupt.");
  }

  // 3. Fetch all notes and cards
  const notesData = db.exec("SELECT id, mid, flds, tags FROM notes")[0]?.values ?? [];
  const cardsData = db.exec("SELECT id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses FROM cards")[0]?.values ?? [];

  // Helper to replace local media references with data URLs
  const replaceMediaSrc = (html: string): string => {
    if (!html) return '';
    return html.replace(/src="([^"]+)"/g, (match, fileName) => {
      return mediaMap[fileName] ? `src="${mediaMap[fileName]}"` : match;
    });
  };

  // 4. Prepare deck structure
  const deckDataMap: Map<string, DeckData> = new Map();
  Object.values(ankiDecks).forEach(d => {
    deckDataMap.set(d.id.toString(), {
      id: `anki-${d.id}`,
      name: d.name,
      flashcards: [],
      subDecks: []
    });
  });

  // 5. Process each card and associate it with a note and deck
  cardsData.forEach(cardRow => {
    const cardId = cardRow[0] as number;
    const noteId = cardRow[1] as number;
    const deckId = cardRow[2] as number;
    const ord = cardRow[3] as number;

    const noteRow = notesData.find(n => n[0] === noteId);
    if (!noteRow) return; // Skip orphaned cards

    const modelId = noteRow[1] as number;
    const fieldsStr = noteRow[2] as string;
    const tagsStr = noteRow[3] as string;

    const model = models[modelId.toString()];
    const deck = deckDataMap.get(deckId.toString());
    if (!model || !deck) return; // Skip cards with missing model or deck

    const fields = fieldsStr.split(ANKI_FIELD_SEPARATOR);
    const template = model.tmpls[ord];
    if (!template) return; // Skip cards with missing template

    let flashcard: FlashcardData | null = null;

    // Determine card type (Cloze or Basic)
    if (model.type === 1 || template.qfmt.includes('{{cloze:')) {
      const textField = fields[0] ?? '';
      const descriptionField = fields.length > 1 ? fields[1] : '';
      flashcard = {
        id: `anki-c-${cardId}`,
        noteId: `anki-n-${noteId}`,
        type: 'cloze',
        text: replaceMediaSrc(textField),
        description: replaceMediaSrc(descriptionField),
      } as ClozeFlashcard;
    } else {
      const fieldMap: { [key: string]: string } = {};
      model.flds.forEach(fld => {
        fieldMap[fld.name] = fields[fld.ord] ?? '';
      });

      let question = template.qfmt;
      let answer = template.afmt;

      // Replace field placeholders
      for (const key in fieldMap) {
        question = question.replace(new RegExp(`{{${key}}}`, 'g'), fieldMap[key]);
        answer = answer.replace(new RegExp(`{{${key}}}`, 'g'), fieldMap[key]);
      }
      // Handle special {{FrontSide}} placeholder
      answer = answer.replace(/{{FrontSide}}/g, question);

      flashcard = {
        id: `anki-c-${cardId}`,
        noteId: `anki-n-${noteId}`,
        type: 'basic',
        question: replaceMediaSrc(question),
        answer: replaceMediaSrc(answer),
      } as BasicFlashcard;
    }

    if (flashcard) {
      flashcard.tags = (tagsStr || '').trim().split(' ').filter(Boolean);
      if (includeScheduling) {
        flashcard.srs = convertAnkiSchedulingData(cardRow, collectionCreationTimestamp);
      }
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
        deck.name = parts[parts.length - 1]; // Keep only the subdeck name
        parentDeck.subDecks!.push(deck);
      } else {
        rootDecks.push(deck); // Parent not found, treat as root
      }
    } else {
      rootDecks.push(deck);
    }
  });

  return rootDecks;
};