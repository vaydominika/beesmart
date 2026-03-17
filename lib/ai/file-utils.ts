// Add polyfills for pdf.js in Node.js environment where browser globals aren't available
if (typeof global.DOMMatrix === 'undefined') {
    (global as any).DOMMatrix = class DOMMatrix {
        constructor() { }
    };
}
if (typeof global.ImageData === 'undefined') {
    (global as any).ImageData = class ImageData {
        constructor() { }
    };
}
if (typeof global.Path2D === 'undefined') {
    (global as any).Path2D = class Path2D {
        constructor() { }
    };
}

const { getData } = require('pdf-parse/worker');
const { PDFParse } = require('pdf-parse');

// Explicitly set the worker source to avoid "expression is too dynamic" errors in Next.js
PDFParse.setWorker(getData());

import mammoth from 'mammoth';

/**
 * Extracts raw text from various file types for LLM consumption.
 */
export async function extractTextFromFile(file: File): Promise<string> {
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileType = file.type;

    try {
        if (fileType === 'application/pdf') {
            const parser = new PDFParse({ data: buffer });
            try {
                const data = await parser.getText();
                return data.text;
            } finally {
                await parser.destroy();
            }
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
