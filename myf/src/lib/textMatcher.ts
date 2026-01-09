/**
 * Text Matching Utility Module
 * 
 * Provides robust text matching between chunk content and PDF text,
 * handling minor formatting differences through normalization and
 * fallback word-based matching.
 * 
 * Requirements: 3.1, 3.2, 3.3
 */

/**
 * Represents a text item from PDF.js text content
 */
export interface TextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

/**
 * Represents the text content from a PDF page
 */
export interface TextContent {
  items: TextItem[];
}

/**
 * Result of a text matching operation
 */
export interface TextMatchResult {
  found: boolean;
  matchedItems: number[];  // Indices of matched text items
  confidence: number;      // 0-1 matching confidence
}

/**
 * Chunk data structure
 */
export interface ChunkData {
  chunk_id: string;
  page: number | null;
  text: string;
}

/**
 * Normalizes text by collapsing whitespace and line breaks.
 * This function is idempotent - normalizing twice produces the same result as normalizing once.
 * 
 * Requirements: 3.1
 * 
 * @param text - The text to normalize
 * @returns Normalized text with collapsed whitespace
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  
  // Replace all whitespace characters (including line breaks, tabs, etc.) with single spaces
  // Then trim leading/trailing whitespace
  return text
    .replace(/[\s\r\n\t]+/g, ' ')
    .trim();
}

/**
 * Finds an exact match of search text within page text.
 * Uses normalized text comparison for better matching.
 * 
 * Requirements: 3.1
 * 
 * @param searchText - The text to search for
 * @param pageText - The full text content of the page
 * @returns TextMatchResult with found=true if exact match exists
 */
export function findExactMatch(searchText: string, pageText: string): TextMatchResult {
  if (!searchText || !pageText) {
    return { found: false, matchedItems: [], confidence: 0 };
  }

  const normalizedSearch = normalizeText(searchText).toLowerCase();
  const normalizedPage = normalizeText(pageText).toLowerCase();

  const found = normalizedPage.includes(normalizedSearch);
  
  return {
    found,
    matchedItems: [], // Exact match doesn't track individual items
    confidence: found ? 1.0 : 0
  };
}

/**
 * Finds matches using word-based matching for significant words (length > 3 characters).
 * This is a fallback when exact matching fails.
 * 
 * Requirements: 3.2
 * 
 * @param searchText - The text to search for
 * @param textItems - Array of text items from PDF
 * @returns TextMatchResult with indices of matched text items
 */
export function findWordMatch(searchText: string, textItems: TextItem[]): TextMatchResult {
  if (!searchText || !textItems || textItems.length === 0) {
    return { found: false, matchedItems: [], confidence: 0 };
  }

  const normalizedSearch = normalizeText(searchText).toLowerCase();
  
  // Extract significant words (length > 3 characters)
  const searchWords = normalizedSearch
    .split(/\s+/)
    .filter(word => word.length > 3);

  if (searchWords.length === 0) {
    return { found: false, matchedItems: [], confidence: 0 };
  }

  const matchedItems: number[] = [];
  let matchedWordCount = 0;

  // Check each text item for matching words
  textItems.forEach((item, index) => {
    const normalizedItemText = normalizeText(item.str).toLowerCase();
    
    for (const word of searchWords) {
      if (normalizedItemText.includes(word)) {
        if (!matchedItems.includes(index)) {
          matchedItems.push(index);
        }
        matchedWordCount++;
        break; // Count each item only once
      }
    }
  });

  const found = matchedItems.length > 0;
  // Confidence based on proportion of search words that found matches
  const confidence = found ? Math.min(matchedWordCount / searchWords.length, 1.0) : 0;

  return {
    found,
    matchedItems,
    confidence
  };
}

/**
 * Combines exact and word-based matching strategies to find chunk text on a page.
 * First attempts exact match, then falls back to word-based matching.
 * 
 * Requirements: 3.1, 3.2, 3.3
 * 
 * @param chunk - The chunk data containing text to find
 * @param textContent - The text content from the PDF page
 * @returns TextMatchResult with matched items and confidence
 */
export function findChunkOnPage(chunk: ChunkData, textContent: TextContent): TextMatchResult {
  if (!chunk || !chunk.text || !textContent || !textContent.items) {
    return { found: false, matchedItems: [], confidence: 0 };
  }

  const textItems = textContent.items;
  
  // Build full page text from items
  const fullPageText = textItems.map(item => item.str).join(' ');

  // Try exact match first
  const exactResult = findExactMatch(chunk.text, fullPageText);
  
  if (exactResult.found) {
    // For exact match, find all text items that contain parts of the search text
    const normalizedSearch = normalizeText(chunk.text).toLowerCase();
    const searchWords = normalizedSearch.split(/\s+/).filter(w => w.length > 3);
    
    const matchedItems: number[] = [];
    textItems.forEach((item, index) => {
      const normalizedItem = normalizeText(item.str).toLowerCase();
      for (const word of searchWords) {
        if (normalizedItem.includes(word)) {
          matchedItems.push(index);
          break;
        }
      }
    });

    return {
      found: true,
      matchedItems,
      confidence: 1.0
    };
  }

  // Fall back to word-based matching
  const wordResult = findWordMatch(chunk.text, textItems);
  
  return wordResult;
}
