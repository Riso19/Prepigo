import JSZip from 'jszip';
import initSqlJs from 'sql.js';
import { DeckData, FlashcardData, BasicFlashcard, ClozeFlashcard } from '@/data/decks';

// Anki's field separator
const ANKI_FIELD_SEPARATOR = '\x1f';

// --- Interfaces for raw Anki data ---
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

// --- Main Importer Function ---
export const importApkg = async (file: File): Promise<DeckData[]> => {
  const zip = await JSZip.loadAsync(file);

  // 1. Find and load the SQLite database
  const dbFileEntry = zip.file(/collection\.anki2(1)?/)[0];
  if (!dbFileEntry) {
    throw new Error('Could not find collection.anki2 or collection.anki21 in the .apkg file.');
  }
  const dbFile = await dbFileEntry.async('uint8array');

  // 2. Initialize sql.js
  const SQL = await initSqlJs({
    locateFile: file => `https://sql.js.org/dist/${file}`
  });
  const db = new SQL.Database(dbFile);

  // 3. Extract data from the database
  const colData = db.exec("SELECT models, decks FROM col")[0].values[0];
  const models: { [id: string]: AnkiModel } = JSON.parse(colData[0] as string);
  const ankiDecks: { [id: string]: AnkiDeck } = JSON.parse(colData[1] as string);
  
  const notesData = db.exec("SELECT id, mid, flds FROM notes")[0]?.values || [];
  const cardsData = db.exec("SELECT id, nid, did, ord FROM cards")[0]?.values || [];

  // 4. Process media files into data URLs
  const mediaMap: { [key: string]: string } = {};
  const mediaFile = zip.file('media');
  if (mediaFile) {
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
  }

  const replaceMediaSrc = (html: string): string => {
    if (!html) return '';
    return html.replace(/src="([^"]+)"/g, (match, fileName) => {
      if (mediaMap[fileName]) {
        return `src="${mediaMap[fileName]}"`;
      }
      return match;
    });
  };

  // 5. Create all deck objects
  const deckDataMap: { [id: string]: DeckData } = {};
  Object.values(ankiDecks).forEach(d => {
    deckDataMap[d.id.toString()] = {
      id: d.id.toString(),
      name: d.name,
      flashcards: [],
      subDecks: []
    };
  });

  // 6. Create flashcards and add them to the correct deck
  cardsData.forEach(cardValue => {
    const [cardId, noteId, deckId, ord] = cardValue as [number, number, number, number];
    const note = notesData.find(n => n[0] === noteId);
    if (!note) return;

    const [, modelId, fieldsStr] = note as [number, number, string];
    const model = models[modelId.toString()];
    if (!model) return;

    const deck = deckDataMap[deckId.toString()];
    if (!deck) return;

    const fields = fieldsStr.split(ANKI_FIELD_SEPARATOR);
    const template = model.tmpls[ord];
    if (!template) return;

    let flashcard: FlashcardData | null = null;

    if (model.type === 1 || template.qfmt.includes('{{cloze:')) {
      const textField = fields[0];
      const descriptionField = fields.length > 1 ? fields[1] : '';
      
      flashcard = {
        id: `anki-${cardId}`,
        noteId: `anki-${noteId}`,
        type: 'cloze',
        text: replaceMediaSrc(textField),
        description: replaceMediaSrc(descriptionField),
      } as ClozeFlashcard;
    } else {
      const fieldMap: { [key: string]: string } = {};
      model.flds.forEach(fld => {
        fieldMap[fld.name] = fields[fld.ord];
      });

      let question = template.qfmt;
      let answer = template.afmt;

      // Replace field placeholders like {{Front}}
      for (const key in fieldMap) {
        question = question.replace(new RegExp(`{{${key}}}`, 'g'), fieldMap[key]);
        answer = answer.replace(new RegExp(`{{${key}}}`, 'g'), fieldMap[key]);
      }
      
      // Handle special {{FrontSide}} placeholder on back of card
      answer = answer.replace(/{{FrontSide}}/, fieldMap[model.flds[0].name]);

      flashcard = {
        id: `anki-${cardId}`,
        noteId: `anki-${noteId}`,
        type: 'basic',
        question: replaceMediaSrc(question),
        answer: replaceMediaSrc(answer),
      } as BasicFlashcard;
    }

    if (flashcard) {
      deck.flashcards.push(flashcard);
    }
  });

  // 7. Build the deck hierarchy
  const deckList = Object.values(deckDataMap);
  const deckNameMap: { [name: string]: DeckData } = {};
  
  deckList.sort((a, b) => a.name.localeCompare(b.name)).forEach(deck => {
    deckNameMap[deck.name] = deck;
  });

  deckList.forEach(deck => {
    const parts = deck.name.split('::');
    if (parts.length > 1) {
      const parentName = parts.slice(0, -1).join('::');
      const parentDeck = deckNameMap[parentName];
      if (parentDeck) {
        // Rename child to not include parent path
        deck.name = parts[parts.length - 1];
        parentDeck.subDecks!.push(deck);
      }
    }
  });

  return deckList.filter(deck => !deck.name.includes('::'));
};