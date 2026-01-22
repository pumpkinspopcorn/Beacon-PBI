/**
 * Chunk Utility Functions
 * 
 * Pure functions for chunk filtering and navigation logic
 * that can be property-tested independently of React components.
 * 
 * Requirements: 2.5, 2.2, 4.1, 4.2
 */

import { ChunkData } from './textMatcher';

/**
 * Filters chunks to return only those on a specific page.
 * 
 * Requirements: 2.5
 * 
 * @param chunks - Array of chunk data
 * @param page - The page number to filter by
 * @returns Array of chunks that belong to the specified page
 */
export function getChunksForPage(chunks: ChunkData[], page: number): ChunkData[] {
  if (!chunks || !Array.isArray(chunks)) {
    return [];
  }
  return chunks.filter(chunk => chunk.page === page);
}

/**
 * Determines the initial page to navigate to based on chunk data.
 * Returns the first chunk's page if valid, otherwise returns 1.
 * 
 * Requirements: 2.2
 * 
 * @param chunks - Array of chunk data
 * @param totalPages - Total number of pages in the PDF
 * @returns The page number to navigate to initially
 */
export function getInitialPage(chunks: ChunkData[], totalPages: number): number {
  if (!chunks || chunks.length === 0) {
    return 1;
  }
  
  const firstChunk = chunks[0];
  
  // If page is null or invalid, stay on page 1
  if (firstChunk.page === null || firstChunk.page <= 0 || firstChunk.page > totalPages) {
    return 1;
  }
  
  return firstChunk.page;
}

/**
 * Validates and clamps a chunk index to valid bounds.
 * 
 * Requirements: 4.1, 4.2
 * 
 * @param index - The requested chunk index
 * @param totalChunks - Total number of chunks
 * @returns A valid chunk index in range [0, totalChunks - 1], or 0 if no chunks
 */
export function clampChunkIndex(index: number, totalChunks: number): number {
  if (totalChunks <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(index, totalChunks - 1));
}

/**
 * Truncates text to a maximum length with ellipsis.
 * 
 * Requirements: 5.4
 * 
 * @param text - The text to truncate
 * @param maxLength - Maximum length before truncation (default 200)
 * @returns Truncated text with "..." if longer than maxLength
 */
export function truncateText(text: string, maxLength: number = 200): string {
  if (!text) {
    return '';
  }
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + '...';
}

/**
 * Checks if chunk data is valid and can be used for highlighting.
 * 
 * Requirements: 6.1
 * 
 * @param chunk - The chunk data to validate
 * @returns true if the chunk has valid structure for highlighting
 */
export function isValidChunk(chunk: ChunkData | null | undefined): chunk is ChunkData {
  if (!chunk) {
    return false;
  }
  if (typeof chunk.chunk_id !== 'string') {
    return false;
  }
  if (typeof chunk.text !== 'string') {
    return false;
  }
  // page can be null or a number
  if (chunk.page !== null && typeof chunk.page !== 'number') {
    return false;
  }
  return true;
}

/**
 * Filters an array of chunks to only include valid ones.
 * 
 * Requirements: 6.1
 * 
 * @param chunks - Array of potentially invalid chunk data
 * @returns Array of valid chunks only
 */
export function filterValidChunks(chunks: (ChunkData | null | undefined)[]): ChunkData[] {
  if (!chunks || !Array.isArray(chunks)) {
    return [];
  }
  return chunks.filter(isValidChunk);
}

/**
 * Validation result for chunk data
 */
export interface ChunkValidationResult {
  validChunks: ChunkData[];
  invalidCount: number;
  warnings: string[];
}

/**
 * Validates chunk data and returns validation result with warnings.
 * This function is used for graceful handling of malformed chunk data.
 * 
 * Requirements: 6.1
 * 
 * @param chunks - Array of potentially invalid chunk data
 * @returns Validation result with valid chunks and warnings
 */
export function validateChunks(chunks: unknown): ChunkValidationResult {
  const result: ChunkValidationResult = {
    validChunks: [],
    invalidCount: 0,
    warnings: []
  };

  // Handle null/undefined input
  if (chunks === null || chunks === undefined) {
    result.warnings.push('Chunk data is null or undefined');
    return result;
  }

  // Handle non-array input
  if (!Array.isArray(chunks)) {
    result.warnings.push(`Expected array of chunks, got ${typeof chunks}`);
    return result;
  }

  // Validate each chunk
  chunks.forEach((chunk, index) => {
    if (chunk === null || chunk === undefined) {
      result.invalidCount++;
      result.warnings.push(`Chunk at index ${index} is null or undefined`);
      return;
    }

    if (typeof chunk !== 'object') {
      result.invalidCount++;
      result.warnings.push(`Chunk at index ${index} is not an object (got ${typeof chunk})`);
      return;
    }

    const chunkObj = chunk as Record<string, unknown>;

    // Validate chunk_id
    if (typeof chunkObj.chunk_id !== 'string') {
      result.invalidCount++;
      result.warnings.push(`Chunk at index ${index} has invalid chunk_id (expected string, got ${typeof chunkObj.chunk_id})`);
      return;
    }

    // Validate text
    if (typeof chunkObj.text !== 'string') {
      result.invalidCount++;
      result.warnings.push(`Chunk at index ${index} has invalid text (expected string, got ${typeof chunkObj.text})`);
      return;
    }

    // Validate page (can be null or number)
    if (chunkObj.page !== null && typeof chunkObj.page !== 'number') {
      result.invalidCount++;
      result.warnings.push(`Chunk at index ${index} has invalid page (expected number or null, got ${typeof chunkObj.page})`);
      return;
    }

    // Chunk is valid
    result.validChunks.push(chunkObj as unknown as ChunkData);
  });

  return result;
}

/**
 * Safely processes chunks and returns empty array for any malformed data.
 * Logs warnings for debugging but never throws exceptions.
 * 
 * Requirements: 6.1
 * 
 * @param chunks - Potentially malformed chunk data
 * @param logWarnings - Whether to log warnings to console (default: true)
 * @returns Array of valid chunks (empty if all data is malformed)
 */
export function safeProcessChunks(chunks: unknown, logWarnings: boolean = true): ChunkData[] {
  try {
    const validation = validateChunks(chunks);
    
    if (logWarnings && validation.warnings.length > 0) {
      console.warn('[PDFViewer] Chunk validation warnings:', validation.warnings);
    }
    
    return validation.validChunks;
  } catch (error) {
    if (logWarnings) {
      console.warn('[PDFViewer] Error processing chunk data:', error);
    }
    return [];
  }
}

/**
 * Determines if the banner should be displayed based on chunk data.
 * The banner should be displayed whenever there is valid chunk data,
 * regardless of whether highlights were found on the page.
 * 
 * Requirements: 2.4, 6.3
 * 
 * @param chunks - Array of chunk data
 * @param currentChunkIndex - The current chunk index being viewed
 * @returns true if banner should be displayed, false otherwise
 */
export function shouldDisplayBanner(chunks: ChunkData[], currentChunkIndex: number): boolean {
  if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
    return false;
  }
  
  const validIndex = clampChunkIndex(currentChunkIndex, chunks.length);
  const currentChunk = chunks[validIndex];
  
  // Banner should display if there's a valid current chunk
  return isValidChunk(currentChunk);
}

/**
 * Gets the banner text to display for the current chunk.
 * Returns the truncated chunk text or empty string if no valid chunk.
 * 
 * Requirements: 2.4, 5.4, 6.3
 * 
 * @param chunks - Array of chunk data
 * @param currentChunkIndex - The current chunk index being viewed
 * @param maxLength - Maximum length for truncation (default 200)
 * @returns The banner text to display
 */
export function getBannerText(chunks: ChunkData[], currentChunkIndex: number, maxLength: number = 200): string {
  if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
    return '';
  }
  
  const validIndex = clampChunkIndex(currentChunkIndex, chunks.length);
  const currentChunk = chunks[validIndex];
  
  if (!isValidChunk(currentChunk)) {
    return '';
  }
  
  return truncateText(currentChunk.text, maxLength);
}

/**
 * Result of searching for a chunk across all pages
 */
export interface PageSearchResult {
  chunkId: string;
  foundPage: number | null;
  confidence: number;
}

/**
 * Cache for storing page search results to avoid repeated searches.
 * Maps chunk_id to the page where the chunk was found.
 * 
 * Requirements: 6.4, 3.4
 */
export type PageSearchCache = Map<string, PageSearchResult>;

/**
 * Creates a new empty page search cache.
 * 
 * Requirements: 6.4
 * 
 * @returns A new empty PageSearchCache
 */
export function createPageSearchCache(): PageSearchCache {
  return new Map<string, PageSearchResult>();
}

/**
 * Gets a cached search result for a chunk.
 * 
 * Requirements: 6.4
 * 
 * @param cache - The page search cache
 * @param chunkId - The chunk ID to look up
 * @returns The cached result or undefined if not cached
 */
export function getCachedPageSearch(cache: PageSearchCache, chunkId: string): PageSearchResult | undefined {
  return cache.get(chunkId);
}

/**
 * Stores a search result in the cache.
 * 
 * Requirements: 6.4
 * 
 * @param cache - The page search cache
 * @param result - The search result to cache
 */
export function setCachedPageSearch(cache: PageSearchCache, result: PageSearchResult): void {
  cache.set(result.chunkId, result);
}

/**
 * Checks if a chunk needs all-page search (i.e., has null page).
 * 
 * Requirements: 6.4
 * 
 * @param chunk - The chunk to check
 * @returns true if the chunk has a null page and needs searching
 */
export function needsAllPageSearch(chunk: ChunkData | null | undefined): boolean {
  if (!isValidChunk(chunk)) {
    return false;
  }
  return chunk.page === null;
}

/**
 * Gets chunks that need all-page search (have null page).
 * 
 * Requirements: 6.4
 * 
 * @param chunks - Array of chunks
 * @returns Array of chunks with null page
 */
export function getChunksNeedingSearch(chunks: ChunkData[]): ChunkData[] {
  if (!chunks || !Array.isArray(chunks)) {
    return [];
  }
  return chunks.filter(needsAllPageSearch);
}

/**
 * Updates a chunk with a discovered page number from search.
 * Returns a new chunk object with the updated page.
 * 
 * Requirements: 6.4
 * 
 * @param chunk - The original chunk
 * @param foundPage - The page where the chunk was found
 * @returns A new chunk with the updated page
 */
export function updateChunkWithFoundPage(chunk: ChunkData, foundPage: number): ChunkData {
  return {
    ...chunk,
    page: foundPage
  };
}

/**
 * Applies cached search results to chunks, updating null pages with found pages.
 * Returns a new array with updated chunks.
 * 
 * Requirements: 6.4
 * 
 * @param chunks - Array of chunks
 * @param cache - The page search cache with results
 * @returns New array with chunks updated from cache
 */
export function applySearchCacheToChunks(chunks: ChunkData[], cache: PageSearchCache): ChunkData[] {
  if (!chunks || !Array.isArray(chunks)) {
    return [];
  }
  
  return chunks.map(chunk => {
    if (!isValidChunk(chunk)) {
      return chunk;
    }
    
    // Only update chunks with null page
    if (chunk.page !== null) {
      return chunk;
    }
    
    const cached = cache.get(chunk.chunk_id);
    if (cached && cached.foundPage !== null) {
      return updateChunkWithFoundPage(chunk, cached.foundPage);
    }
    
    return chunk;
  });
}
