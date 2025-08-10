import JSZip from 'jszip';
import initSqlJs, { Database } from 'sql.js';
import { DeckData, FlashcardData, BasicFlashcard, ClozeFlashcard, SrsData, Sm2State, ImageOcclusionFlashcard, Occlusion } from '@/data/decks';

const ANKI_FIELD_SEPARATOR = '\x1f';

interface AnkiModel {
  id: number;
  name: string;
  flds: { name: string; ord: number }[];
  tmpls: { name: string; qfmt: string; afmt: string; ord: number }[];
  type: number;
  css: string;
}

interface AnkiDeck {
  id: number;
  name: string;
}

const convertAnkiSchedulingData = (cardRow: any[], collectionCreationTimestamp: number): SrsData => {
  const [ _id, _nid, _did, _ord, _mod, _usn, type, queue, due, ivl, factor, reps, lapses ] = cardRow as number[];
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

  return {
    sm2: {
      due: dueDate.toISOString(),
      easinessFactor: Math.max(1.3, factor / 1000),
      interval: ivl,
      repetitions: reps,
      lapses: lapses,
      state: state,
    },
    isSuspended,
    newCardOrder: type === 0 ? due : undefined,
  };
};

const parseOcclusionsFromSvg = (svg: string): Occlusion[] => {
  if (!svg) return [];
  const occlusions: Occlusion[] = [];
  const rectRegex = /<rect([^>]+)\/>/g;
  const attrRegex = /([a-zA-Z0-9\-:]+)="([^"]+)"/g;
  
  let match;
  let index = 0;
  while ((match = rectRegex.exec(svg)) !== null) {
    const attrsStr = match[1];
    const attrs: { [key: string]: string } = {};
    let attrMatch;
    while ((attrMatch = attrRegex.exec(attrsStr)) !== null) {
      attrs[attrMatch[1]] = attrMatch[2];
    }

    if (attrs.x && attrs.y && attrs.width && attrs.height) {
      occlusions.push({
        id: parseFloat(attrs['data-id'] || attrs.id || `${Date.now()}${index}`),
        x: parseFloat(attrs.x),
        y: parseFloat(attrs.y),
        width: parseFloat(attrs.width),
        height: parseFloat(attrs.height),
      });
      index++;
    }
  }
  return occlusions;
};

export const importAnkiFile = async (
  file: File,
  includeScheduling: boolean,
  onProgress: (progress: { message: string; value: number }) => void
): Promise<{ decks: DeckData[]; media: Map<string, Blob> }> => {
  const SQL = await initSqlJs({ locateFile: file => `https://sql.js.org/dist/${file}` });
  let dbBytes: Uint8Array;
  const mediaToStore = new Map<string, Blob>();

  onProgress({ message: 'Unzipping package...', value: 5 });
  if (file.name.endsWith('.apkg')) {
    const zip = await JSZip.loadAsync(file);
    const dbFileEntry = zip.file('collection.anki21b') || zip.file('collection.anki21') || zip.file('collection.anki2');
    if (!dbFileEntry) throw new Error('Database file not found in .apkg.');
    dbBytes = await dbFileEntry.async('uint8array');

    const mediaFile = zip.file('media');
    if (mediaFile) {
        onProgress({ message: 'Reading media map...', value: 10 });
        const mediaBytes = await mediaFile.async('uint8array');
        const decoder = new TextDecoder("utf-8", { fatal: false });
        let mediaString = decoder.decode(mediaBytes);

        mediaString = mediaString.trim().replace(/^\uFEFF/, '');
        mediaString = mediaString.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

        let mediaJSON: { [key: string]: string } = {};
        try {
            mediaJSON = JSON.parse(mediaString);
        } catch (e) {
            console.warn("Could not parse media JSON file. Attempting to recover mappings with regex.", e);
            const regex = /"(\d+)":\s*"([^"]+)"/g;
            let match;
            while ((match = regex.exec(mediaString)) !== null) {
                mediaJSON[match[1]] = match[2];
            }
        }

        const mediaFiles = Object.keys(mediaJSON);
        if (mediaFiles.length > 0) {
            onProgress({ message: 'Extracting media...', value: 15 });
            for (let i = 0; i < mediaFiles.length; i++) {
                const key = mediaFiles[i];
                const fileName = mediaJSON[key];
                const fileEntry = zip.file(key);
                if (fileEntry) {
                    const blob = await fileEntry.async('blob');
                    mediaToStore.set(fileName, blob);
                }
                if (i % 20 === 0 || i === mediaFiles.length - 1) {
                    onProgress({ message: `Extracting media... (${i + 1}/${mediaFiles.length})`, value: 15 + (i / mediaFiles.length) * 15 });
                }
            }
        }
    }
  } else {
    dbBytes = new Uint8Array(await file.arrayBuffer());
  }

  onProgress({ message: 'Loading database...', value: 30 });
  const db = new SQL.Database(dbBytes);

  onProgress({ message: 'Reading tables...', value: 40 });
  const colResult = db.exec("SELECT models, decks, crt FROM col")[0].values[0] as [string, string, number];
  const [modelsJSON, decksJSON, crt] = colResult;
  const models: { [id: string]: AnkiModel } = JSON.parse(modelsJSON);
  const ankiDecks: { [id: string]: AnkiDeck } = JSON.parse(decksJSON);
  const notesData = db.exec("SELECT id, mid, flds, tags FROM notes")[0]?.values ?? [];
  const cardsData = db.exec("SELECT id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses FROM cards")[0]?.values ?? [];

  const replaceMediaSrc = (html: string): string => {
    if (!html) return '';
    return html.replace(/src="([^"]+)"/g, (_match, fileName) => `src="media://${fileName}"`);
  };

  const deckDataMap: Map<string, DeckData> = new Map();
  Object.values(ankiDecks).forEach(d => {
    deckDataMap.set(d.id.toString(), { id: `anki-${d.id}`, name: d.name, flashcards: [], subDecks: [] });
  });

  onProgress({ message: 'Processing cards...', value: 50 });
  for (let i = 0; i < cardsData.length; i++) {
    const cardRow = cardsData[i];
    const [_id, noteId, deckId, ord] = cardRow as number[];
    const noteRow = notesData.find(n => n[0] === noteId);
    if (!noteRow) continue;

    const [_noteId, modelId, fieldsStr, tagsStr] = noteRow as [number, number, string, string];
    const model = models[modelId.toString()];
    const deck = deckDataMap.get(deckId.toString());
    if (!model || !deck) continue;

    const fields = fieldsStr.split(ANKI_FIELD_SEPARATOR);
    const template = model.tmpls[ord];
    if (!template) continue;

    let flashcard: FlashcardData | null = null;
    const fieldMap: { [key: string]: string } = {};
    model.flds.forEach(fld => { fieldMap[fld.name] = fields[fld.ord] ?? ''; });

    // --- Improved IOE Detection ---
    let isIOE = false;
    const modelNameLower = model.name.toLowerCase();
    const templateFormat = template.qfmt + template.afmt;

    if (modelNameLower.includes('image occlusion')) {
        isIOE = true;
    }
    if (!isIOE && templateFormat.includes('{{#Image}}') && templateFormat.includes('{{/Image}}')) {
        isIOE = true;
    }
    if (!isIOE && model.type === 1) { // is cloze type model
        for (const fieldName in fieldMap) {
            if (fieldMap[fieldName].includes('image-occlusion:rect')) {
                isIOE = true;
                break;
            }
        }
    }
    
    let parsedAsIOE = false;

    if (isIOE) {
        const descriptionFieldNames = ['Header', 'Footer', 'Remarks', 'Sources', 'Extra 1', 'Extra 2', 'Extra'];
        const descriptionParts: string[] = [];
        model.flds.sort((a, b) => a.ord - b.ord).forEach(fld => {
            if (descriptionFieldNames.some(name => fld.name.toLowerCase() === name.toLowerCase())) {
                const content = fieldMap[fld.name];
                if (content) descriptionParts.push(content);
            }
        });
        const combinedDescription = descriptionParts.join('<hr>');

        let imageFieldName: string | null = null;
        let masksFieldName: string | null = null;
        
        const imageField = model.flds.find(f => f.name.toLowerCase() === 'image');
        if (imageField) imageFieldName = imageField.name;
        const masksField = model.flds.find(f => f.name.toLowerCase() === 'masks');
        if (masksField) masksFieldName = masksField.name;

        if (!imageFieldName || !masksFieldName) {
            for (const fld of model.flds) {
                const fieldContent = fieldMap[fld.name];
                if (!imageFieldName && fieldContent && fieldContent.includes('<img')) imageFieldName = fld.name;
                if (!masksFieldName && fieldContent && fieldContent.includes('<svg') && fieldContent.includes('<rect')) masksFieldName = fld.name;
            }
        }

        if (imageFieldName && masksFieldName) {
            const imageFieldContent = fieldMap[imageFieldName] || '';
            const masksFieldContent = fieldMap[masksFieldName] || '';
            
            const imageUrlMatch = imageFieldContent.match(/src="([^"]+)"/);
            const rawImageUrl = imageUrlMatch ? imageUrlMatch[1] : null;
            const occlusions = parseOcclusionsFromSvg(masksFieldContent);

            if (rawImageUrl && occlusions.length > 0) {
                const questionOcclusion = occlusions.find(o => o.id === ord + 1);
                if (questionOcclusion) {
                    flashcard = {
                        id: `anki-c-${_id}`, noteId: `anki-n-${noteId}`, type: 'imageOcclusion',
                        imageUrl: `media://${rawImageUrl}`, occlusions: occlusions,
                        questionOcclusionId: questionOcclusion.id, description: replaceMediaSrc(combinedDescription),
                    } as ImageOcclusionFlashcard;
                    parsedAsIOE = true;
                }
            }
        }

        if (!parsedAsIOE) {
            let clozeTextFieldName: string | null = null;
            if (!imageFieldName) {
                for (const fld of model.flds) {
                    if (fieldMap[fld.name] && fieldMap[fld.name].includes('<img')) { imageFieldName = fld.name; break; }
                }
            }
            for (const fld of model.flds) {
                if (fieldMap[fld.name] && fieldMap[fld.name].includes('{{c') && fieldMap[fld.name].includes('image-occlusion:rect')) {
                    clozeTextFieldName = fld.name; break;
                }
            }

            if (imageFieldName && clozeTextFieldName) {
                const imageFieldContent = fieldMap[imageFieldName];
                const clozeTextFieldContent = fieldMap[clozeTextFieldName];
                const imageUrlMatch = imageFieldContent.match(/src="([^"]+)"/);
                const rawImageUrl = imageUrlMatch ? imageUrlMatch[1] : null;

                const clozeRegex = /{{c(\d+)::([^}]+)}}/g;
                let match;
                const parsedOcclusions: Occlusion[] = [];
                const clozeMap = new Map<number, Occlusion>();

                while ((match = clozeRegex.exec(clozeTextFieldContent)) !== null) {
                    const clozeIndex = parseInt(match[1], 10);
                    const content = match[2];

                    if (content.startsWith('image-occlusion:rect')) {
                        const params = content.split(':');
                        const coords: any = {};
                        params.forEach(p => {
                            const [key, value] = p.split('=');
                            if (['left', 'top', 'width', 'height'].includes(key)) coords[key] = parseFloat(value);
                        });

                        if (coords.left !== undefined && coords.top !== undefined && coords.width !== undefined && coords.height !== undefined) {
                            const newOcclusion: Occlusion = { id: clozeIndex, x: coords.left, y: coords.top, width: coords.width, height: coords.height };
                            parsedOcclusions.push(newOcclusion);
                            clozeMap.set(clozeIndex, newOcclusion);
                        }
                    }
                }

                if (rawImageUrl && parsedOcclusions.length > 0) {
                    const targetClozeIndex = ord + 1;
                    const questionOcclusion = clozeMap.get(targetClozeIndex);

                    if (questionOcclusion) {
                        flashcard = {
                            id: `anki-c-${_id}`, noteId: `anki-n-${noteId}`, type: 'imageOcclusion',
                            imageUrl: `media://${rawImageUrl}`, occlusions: parsedOcclusions,
                            questionOcclusionId: questionOcclusion.id, description: replaceMediaSrc(combinedDescription),
                        } as ImageOcclusionFlashcard;
                        parsedAsIOE = true;
                    }
                }
            }
        }
    }
    
    if (!parsedAsIOE) {
        if (model.type === 1 || template.qfmt.includes('{{cloze:')) {
            flashcard = {
                id: `anki-c-${_id}`, noteId: `anki-n-${noteId}`, type: 'cloze',
                text: replaceMediaSrc(fieldMap[model.flds[0].name] ?? ''),
                description: replaceMediaSrc(fieldMap[model.flds[1]?.name] ?? ''),
            } as ClozeFlashcard;
        } else {
            let question = template.qfmt;
            let answer = template.afmt;

            answer = answer.replace(/{{FrontSide}}/g, '');
            answer = answer.replace(/<hr id=answer>/g, '');

            for (const key in fieldMap) {
                const fieldContent = fieldMap[key] || '';
                question = question.replace(new RegExp(`{{${key}}}`, 'g'), fieldContent);
                answer = answer.replace(new RegExp(`{{${key}}}`, 'g'), fieldContent);
            }
            
            flashcard = {
                id: `anki-c-${_id}`, noteId: `anki-n-${noteId}`, type: 'basic',
                question: replaceMediaSrc(question), answer: replaceMediaSrc(answer.trim()),
            } as BasicFlashcard;
        }
    }

    if (flashcard) {
      flashcard.tags = (tagsStr || '').trim().split(' ').filter(Boolean);
      if (includeScheduling) flashcard.srs = convertAnkiSchedulingData(cardRow, crt);
      deck.flashcards.push(flashcard);
    }
    if (i % 100 === 0) {
        onProgress({ message: `Processing cards... (${i}/${cardsData.length})`, value: 50 + (i / cardsData.length) * 40 });
    }
  }

  onProgress({ message: 'Finalizing decks...', value: 95 });
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

  onProgress({ message: 'Import complete!', value: 100 });
  return { decks: rootDecks, media: mediaToStore };
};