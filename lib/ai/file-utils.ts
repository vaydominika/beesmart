const pdf = require('pdf-parse');
import mammoth from 'mammoth';

/**
 * Extracts raw text from various file types for LLM consumption.
 */
export async function extractTextFromFile(file: File): Promise<string> {
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileType = file.type;

    try {
        if (fileType === 'application/pdf') {
            const data = await pdf(buffer);
            return data.text;
        }

        if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const result = await mammoth.extractRawText({ buffer });
            return result.value;
        }

        if (fileType.startsWith('text/') || fileType === 'application/json' || file.name.endsWith('.md')) {
            return new TextDecoder().decode(buffer);
        }

        // Fallback/Default for other potential text-like files
        return new TextDecoder().decode(buffer);

    } catch (error) {
        console.error(`Error extracting text from ${file.name}:`, error);
        throw new Error(`Failed to extract text from file: ${file.name}`);
    }
}
