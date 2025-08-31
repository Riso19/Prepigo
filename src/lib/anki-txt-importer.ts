import { DeckData, FlashcardData, BasicFlashcard, ClozeFlashcard } from '@/data/decks';

const createNestedDecks = (deckName: string, deckMap: Map<string, DeckData>): DeckData => {
  const parts = deckName.split('::');
  let currentDeckKey = '';
  let parentDeck: DeckData | undefined;

  for (const part of parts) {
    const parentKey = currentDeckKey;
    currentDeckKey += (currentDeckKey ? '::' : '') + part;

    if (!deckMap.has(currentDeckKey)) {
      const newDeck: DeckData = {
        id: `txt-deck-${currentDeckKey}`,
        name: part,
        flashcards: [],
        subDecks: [],
      };
      deckMap.set(currentDeckKey, newDeck);
      
      if (parentKey) {
        parentDeck = deckMap.get(parentKey);
        parentDeck?.subDecks?.push(newDeck);
      }
    }
  }
  return deckMap.get(currentDeckKey)!;
};


export const importAnkiTxtFile = async (
  file: File,
  onProgress: (progress: { message: string; value: number }) => void
): Promise<{ decks: DeckData[]; media: Map<string, Blob> }> => {
  onProgress({ message: 'Reading text file...', value: 5 });
  const text = await file.text();
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);

  const headers: { [key: string]: number } = {};
  let dataStartIndex = 0;
  let separator = '\t';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('#')) {
      dataStartIndex = i + 1;
      const [key, value] = line.substring(1).split(':');
      if (key && value) {
        if (key.trim() === 'separator') {
          if (value.trim() === 'tab') separator = '\t';
          else separator = value.trim();
        } else if (key.trim().endsWith(' column')) {
          const colName = key.trim().split(' ')[0];
          headers[colName] = parseInt(value.trim(), 10) - 1; // 0-indexed
        }
      }
    } else {
      break;
    }
  }

  const dataLines = lines.slice(dataStartIndex);
  const deckMap = new Map<string, DeckData>();

  onProgress({ message: 'Processing notes...', value: 20 });

  dataLines.forEach((line, index) => {
    const fields = line.split(separator);
    
    const guid = fields[headers['guid']];
    const noteType = fields[headers['notetype']];
    const deckName = fields[headers['deck']];
    const tags = headers['tags'] ? fields[headers['tags']]?.split(' ').filter(Boolean) : [];

    if (!guid || !noteType || !deckName) {
      console.warn(`Skipping invalid line ${index + 1}:`, line);
      return;
    }

    const deck = createNestedDecks(deckName, deckMap);
    let flashcard: FlashcardData | null = null;
    const noteId = `txt-n-${guid}`;

    const contentFieldIndexes = Object.values(headers);
    const contentFields = fields.filter((_, i) => !contentFieldIndexes.includes(i));
    
    // Variable declarations for switch cases
    let question: string;
    let answer: string;
    let cleanedAnswer: string;

    switch (noteType) {
      case 'Basic':
      case 'Basic (and reversed card)':
        flashcard = {
          id: `txt-c-${guid}`,
          noteId,
          type: 'basic',
          question: contentFields[0] || '',
          answer: contentFields[1] || '',
          tags,
        } as BasicFlashcard;
        break;
      
      case 'Cloze':
        flashcard = {
          id: `txt-c-${guid}`,
          noteId,
          type: 'cloze',
          text: contentFields[0] || '',
          description: contentFields[1] || '',
          tags,
        } as ClozeFlashcard;
        break;

      case 'Image Occlusion':
        question = contentFields[0] || '';
        answer = contentFields[1] || '';
        cleanedAnswer = answer.replace(/src=""([^"]+)""/g, 'src="$1"');
        flashcard = {
            id: `txt-c-${guid}`,
            noteId,
            type: 'basic',
            question: `${question}<br>${cleanedAnswer}`,
            answer: 'This was an Image Occlusion card. Full support for this format is limited.',
            tags,
        } as BasicFlashcard;
        break;

      default:
        console.warn(`Unsupported note type "${noteType}" on line ${index + 1}. Importing as Basic.`);
        flashcard = {
            id: `txt-c-${guid}`,
            noteId,
            type: 'basic',
            question: contentFields.join('<br>'),
            answer: `Unsupported note type: ${noteType}`,
            tags,
        } as BasicFlashcard;
        break;
    }

    if (flashcard) {
      deck.flashcards.push(flashcard);
    }

    if (index % 100 === 0) {
      onProgress({ message: `Processing notes... (${index}/${dataLines.length})`, value: 20 + (index / dataLines.length) * 75 });
    }
  });

  onProgress({ message: 'Import complete!', value: 100 });
  
  const rootDecks: DeckData[] = [];
  deckMap.forEach((deck, key) => {
      if (!key.includes('::')) {
          rootDecks.push(deck);
      }
  });

  return { decks: rootDecks, media: new Map() };
};