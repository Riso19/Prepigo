import { McqData, McqOption } from '@/data/questionBanks';
import { saveSingleMediaToDB } from '@/lib/idb';

// Helper to convert Base64 to Blob
const base64ToBlob = (base64: string): Blob => {
    const parts = base64.split(';base64,');
    const contentType = parts[0].split(':')[1];
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], { type: contentType });
};

// Process images within an HTML string
const processImages = async (html: string): Promise<string> => {
    const imgRegex = /<img src="(data:image\/[^;]+;base64,[^"]+)">/g;
    let processedHtml = html;
    const matches = [...html.matchAll(imgRegex)];

    for (const match of matches) {
        const originalSrcWithQuotes = match[0];
        const originalSrc = match[1];
        const blob = base64ToBlob(originalSrc);
        const fileExtension = blob.type.split('/')[1] || 'png';
        const fileName = `imported-media-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExtension}`;
        
        await saveSingleMediaToDB(fileName, blob);
        
        const newSrc = `media://${fileName}`;
        processedHtml = processedHtml.replace(originalSrc, newSrc);
    }
    return processedHtml;
};

const parseMcqBlock = async (block: string): Promise<McqData | null> => {
    try {
        const lines = block.split('<br>').map(line => line.trim()).filter(Boolean);
        if (lines.length < 4) return null;

        // 1. Extract Question
        const questionLine = lines[0];
        const questionMatch = questionLine.match(/<b>Q\.\d+\)<\/b>(.*)/);
        if (!questionMatch) return null;
        let question = await processImages(questionMatch[1].trim());

        // 2. Extract Options
        const options: Omit<McqOption, 'isCorrect'>[] = [];
        let lineIndex = 1;
        while (lineIndex < lines.length && /^[a-d]\)/.test(lines[lineIndex])) {
            const optionText = await processImages(lines[lineIndex].substring(2).trim());
            options.push({ id: `opt${Date.now()}-${options.length}`, text: optionText });
            lineIndex++;
        }

        if (options.length === 0) return null;

        // 3. Extract Answer
        const answerLine = lines[lineIndex];
        const answerMatch = answerLine?.match(/<b>Ans\.\s*([a-d])<\/b>/);
        if (!answerMatch) return null;
        const correctLetter = answerMatch[1];
        const correctIndex = correctLetter.charCodeAt(0) - 'a'.charCodeAt(0);
        lineIndex++;

        const finalOptions: McqOption[] = options.map((opt, index) => ({
            ...opt,
            isCorrect: index === correctIndex,
        }));

        // 4. Extract Explanation
        const explanationLine = lines[lineIndex];
        const explanationMatch = explanationLine?.match(/<b>Explanation:<\/b>(.*)/);
        let explanation = "";
        if (explanationMatch) {
            const remainingLines = [explanationMatch[1].trim(), ...lines.slice(lineIndex + 1)];
            explanation = await processImages(remainingLines.join('<br>'));
        }

        return {
            id: `mcq-html-${Date.now()}-${Math.random()}`,
            question,
            options: finalOptions,
            explanation,
            tags: ['html-import'],
        };

    } catch (error) {
        console.error("Failed to parse MCQ block:", error, "\nBlock content:", block);
        return null;
    }
};

export const importHtmlMcqs = async (
    htmlContent: string,
    onProgress: (progress: { message: string; value: number }) => void
): Promise<McqData[]> => {
    onProgress({ message: 'Preparing file...', value: 5 });
    
    const cleanedContent = htmlContent
        .replace(/(\r\n|\n|\r)/gm, "<br>") // Normalize line breaks
        .replace(/<p[^>]*>/g, '') // Remove opening p tags
        .replace(/<\/p>/g, '<br>') // Replace closing p tags with line breaks
        .replace(/&nbsp;/g, ' '); // Replace non-breaking spaces

    const blocks = cleanedContent.split(/<b>Q\.\d+\)<\/b>/).filter(block => block.trim() !== '');
    
    const mcqs: McqData[] = [];
    let processedCount = 0;

    onProgress({ message: `Found ${blocks.length} potential questions...`, value: 10 });

    for (let i = 0; i < blocks.length; i++) {
        const blockContent = `<b>Q.${i + 1})</b>` + blocks[i];
        const mcq = await parseMcqBlock(blockContent);
        if (mcq) {
            mcqs.push(mcq);
        }
        processedCount++;
        if (processedCount % 5 === 0 || processedCount === blocks.length) {
            onProgress({
                message: `Parsing questions... (${processedCount}/${blocks.length})`,
                value: 10 + (processedCount / blocks.length) * 85,
            });
        }
    }

    onProgress({ message: 'Parsing complete!', value: 100 });
    return mcqs;
};