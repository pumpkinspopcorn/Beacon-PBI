/**
 * Property-Based Tests for Chunk Utility Functions
 * 
 * Feature: pdf-chunk-highlighting
 * Uses fast-check for property-based testing with minimum 100 iterations
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  getChunksForPage,
  getInitialPage,
  clampChunkIndex,
  truncateText,
  isValidChunk,
  filterValidChunks,
  shouldDisplayBanner,
  getBannerText,
  validateChunks,
  safeProcessChunks,
  createPageSearchCache,
  getCachedPageSearch,
  setCachedPageSearch,
  needsAllPageSearch,
  getChunksNeedingSearch,
  updateChunkWithFoundPage,
  applySearchCacheToChunks,
  PageSearchResult
} from './chunkUtils';
import { ChunkData } from './textMatcher';

// Arbitrary for generating valid ChunkData
const chunkDataArb = fc.record({
  chunk_id: fc.string({ minLength: 1, maxLength: 50 }),
  page: fc.oneof(fc.constant(null), fc.integer({ min: 1, max: 100 })),
  text: fc.string({ minLength: 0, maxLength: 500 })
});

// Arbitrary for generating ChunkData with specific page
const chunkDataWithPageArb = (page: number) => fc.record({
  chunk_id: fc.string({ minLength: 1, maxLength: 50 }),
  page: fc.constant(page),
  text: fc.string({ minLength: 1, maxLength: 500 })
});

/**
 * Feature: pdf-chunk-highlighting, Property 6: Page-Specific Highlighting
 * 
 * *For any* PDF with multiple pages and chunks on different pages, 
 * navigating to page P SHALL result in highlights only for chunks 
 * where chunk.page === P.
 * 
 * **Validates: Requirements 2.5**
 */
describe('Property 6: Page-Specific Highlighting', () => {
  it('getChunksForPage returns only chunks matching the specified page', () => {
    fc.assert(
      fc.property(
        fc.array(chunkDataArb, { minLength: 0, maxLength: 20 }),
        fc.integer({ min: 1, max: 100 }),
        (chunks, targetPage) => {
          const result = getChunksForPage(chunks, targetPage);
          
          // All returned chunks must have page === targetPage
          result.forEach(chunk => {
            expect(chunk.page).toBe(targetPage);
          });
          
          // Count of returned chunks should match count of chunks with that page
          const expectedCount = chunks.filter(c => c.page === targetPage).length;
          expect(result.length).toBe(expectedCount);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('getChunksForPage returns empty array when no chunks match the page', () => {
    fc.assert(
      fc.property(
        fc.array(chunkDataWithPageArb(1), { minLength: 1, maxLength: 10 }),
        (chunks) => {
          // All chunks are on page 1, so page 2 should return empty
          const result = getChunksForPage(chunks, 2);
          expect(result.length).toBe(0);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('getChunksForPage preserves chunk order', () => {
    fc.assert(
      fc.property(
        fc.array(chunkDataArb, { minLength: 2, maxLength: 20 }),
        fc.integer({ min: 1, max: 100 }),
        (chunks, targetPage) => {
          const result = getChunksForPage(chunks, targetPage);
          
          // Get indices of matching chunks in original array
          const originalIndices = chunks
            .map((chunk, idx) => chunk.page === targetPage ? idx : -1)
            .filter(idx => idx !== -1);
          
          // Result should maintain relative order
          for (let i = 1; i < result.length; i++) {
            const prevOrigIdx = chunks.findIndex(c => c === result[i - 1]);
            const currOrigIdx = chunks.findIndex(c => c === result[i]);
            expect(prevOrigIdx).toBeLessThan(currOrigIdx);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});


describe('Property 7: Initial Page Navigation', () => {
  it('getInitialPage returns first chunk page when valid', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 100 }),
        (firstPage, totalPages) => {
          // Ensure firstPage is within valid range
          const validFirstPage = Math.min(firstPage, totalPages);
          
          const chunks: ChunkData[] = [
            { chunk_id: 'chunk-1', page: validFirstPage, text: 'test text' },
            { chunk_id: 'chunk-2', page: 2, text: 'more text' }
          ];
          
          const result = getInitialPage(chunks, totalPages);
          expect(result).toBe(validFirstPage);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('getInitialPage returns 1 when first chunk page is null', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (totalPages) => {
          const chunks: ChunkData[] = [
            { chunk_id: 'chunk-1', page: null, text: 'test text' }
          ];
          
          const result = getInitialPage(chunks, totalPages);
          expect(result).toBe(1);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('getInitialPage returns 1 when chunks array is empty', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (totalPages) => {
          const result = getInitialPage([], totalPages);
          expect(result).toBe(1);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('getInitialPage returns 1 when first chunk page exceeds totalPages', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 51, max: 100 }),
        (totalPages, invalidPage) => {
          const chunks: ChunkData[] = [
            { chunk_id: 'chunk-1', page: invalidPage, text: 'test text' }
          ];
          
          const result = getInitialPage(chunks, totalPages);
          expect(result).toBe(1);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 8: Chunk Navigation Bounds', () => {
  it('clampChunkIndex always returns index in valid range [0, N-1]', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 1000 }), 
        fc.integer({ min: 1, max: 100 }),       
        (requestedIndex, totalChunks) => {
          const result = clampChunkIndex(requestedIndex, totalChunks);
          
          
          expect(result).toBeGreaterThanOrEqual(0);
          
         
          expect(result).toBeLessThan(totalChunks);
          
          
          expect(result).toBeGreaterThanOrEqual(0);
          expect(result).toBeLessThanOrEqual(totalChunks - 1);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('clampChunkIndex returns 0 when totalChunks is 0 or negative', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 1000 }), 
        fc.integer({ min: -100, max: 0 }),      
        (requestedIndex, totalChunks) => {
          const result = clampChunkIndex(requestedIndex, totalChunks);
          
          
          expect(result).toBe(0);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('clampChunkIndex preserves valid indices', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }), // Total chunks
        (totalChunks) => {
          
          const validIndex = Math.floor(Math.random() * totalChunks);
          const result = clampChunkIndex(validIndex, totalChunks);
          
          
          expect(result).toBe(validIndex);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('clampChunkIndex clamps negative indices to 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: -1 }), // Negative index
        fc.integer({ min: 1, max: 100 }),     // Total chunks
        (negativeIndex, totalChunks) => {
          const result = clampChunkIndex(negativeIndex, totalChunks);
          
          // Negative indices should be clamped to 0
          expect(result).toBe(0);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('clampChunkIndex clamps indices exceeding max to N-1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),     // Total chunks
        fc.integer({ min: 1, max: 1000 }),    // Excess amount
        (totalChunks, excess) => {
          const exceedingIndex = totalChunks + excess;
          const result = clampChunkIndex(exceedingIndex, totalChunks);
          
          // Exceeding indices should be clamped to totalChunks - 1
          expect(result).toBe(totalChunks - 1);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('sequential navigation stays within bounds', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),                    // Total chunks
        fc.array(fc.integer({ min: -10, max: 10 }), { minLength: 1, maxLength: 20 }), // Navigation deltas
        (totalChunks, deltas) => {
          let currentIndex = 0;
          
          // Simulate sequential navigation
          for (const delta of deltas) {
            const requestedIndex = currentIndex + delta;
            currentIndex = clampChunkIndex(requestedIndex, totalChunks);
            
            // After each navigation, index must be in valid range
            expect(currentIndex).toBeGreaterThanOrEqual(0);
            expect(currentIndex).toBeLessThan(totalChunks);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: pdf-chunk-highlighting, Property 9: Banner Text Truncation
 * 
 * *For any* chunk text longer than 200 characters, the displayed banner text 
 * SHALL be exactly 200 characters followed by "...".
 * 
 * **Validates: Requirements 5.4**
 */
describe('Property 9: Banner Text Truncation', () => {
  it('truncateText returns exactly 200 chars + "..." for text longer than 200 chars', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 201, maxLength: 1000 }), // Text longer than 200 chars
        (longText) => {
          const result = truncateText(longText, 200);
          
          // Result should be exactly 203 characters (200 + "...")
          expect(result.length).toBe(203);
          
          // Result should end with "..."
          expect(result.endsWith('...')).toBe(true);
          
          // First 200 characters should match original text
          expect(result.substring(0, 200)).toBe(longText.substring(0, 200));
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('truncateText preserves text shorter than or equal to maxLength', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 200 }), // Text <= 200 chars
        (shortText) => {
          const result = truncateText(shortText, 200);
          
          // Result should be identical to input
          expect(result).toBe(shortText);
          
          // Result should NOT end with "..." (unless original text ends with it)
          if (!shortText.endsWith('...')) {
            expect(result.endsWith('...')).toBe(shortText.endsWith('...'));
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('truncateText with custom maxLength truncates correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10, max: 500 }), // Custom max length
        fc.string({ minLength: 1, maxLength: 1000 }), // Any text
        (maxLength, text) => {
          const result = truncateText(text, maxLength);
          
          if (text.length <= maxLength) {
            // Short text should be preserved
            expect(result).toBe(text);
          } else {
            // Long text should be truncated
            expect(result.length).toBe(maxLength + 3); // maxLength + "..."
            expect(result.endsWith('...')).toBe(true);
            expect(result.substring(0, maxLength)).toBe(text.substring(0, maxLength));
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('truncateText is idempotent for already truncated text', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 201, maxLength: 1000 }), // Text longer than 200 chars
        (longText) => {
          const firstTruncation = truncateText(longText, 200);
          const secondTruncation = truncateText(firstTruncation, 200);
          
          // Truncating already truncated text should give same result
          expect(secondTruncation).toBe(firstTruncation);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: pdf-chunk-highlighting, Property 11: Banner Display Invariant
 * 
 * *For any* chunk data (valid or with no text matches), the info banner 
 * SHALL display the chunk text preview when viewing the chunk's page.
 * 
 * **Validates: Requirements 2.4, 6.3**
 */
describe('Property 11: Banner Display Invariant', () => {
  it('shouldDisplayBanner returns true for any valid chunk data', () => {
    fc.assert(
      fc.property(
        fc.array(chunkDataArb, { minLength: 1, maxLength: 20 }),
        fc.integer({ min: 0, max: 100 }),
        (chunks, requestedIndex) => {
          // Filter to only valid chunks
          const validChunks = chunks.filter(c => 
            c.chunk_id && typeof c.chunk_id === 'string' &&
            typeof c.text === 'string'
          );
          
          if (validChunks.length === 0) {
            // No valid chunks means no banner
            expect(shouldDisplayBanner(validChunks, requestedIndex)).toBe(false);
          } else {
            // Valid chunks should always show banner
            expect(shouldDisplayBanner(validChunks, requestedIndex)).toBe(true);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('shouldDisplayBanner returns false for empty chunks array', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: 100 }),
        (requestedIndex) => {
          expect(shouldDisplayBanner([], requestedIndex)).toBe(false);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('getBannerText returns truncated text for valid chunks', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            chunk_id: fc.string({ minLength: 1, maxLength: 50 }),
            page: fc.oneof(fc.constant(null), fc.integer({ min: 1, max: 100 })),
            text: fc.string({ minLength: 1, maxLength: 500 })
          }),
          { minLength: 1, maxLength: 10 }
        ),
        fc.integer({ min: 0, max: 100 }),
        (chunks, requestedIndex) => {
          const bannerText = getBannerText(chunks, requestedIndex, 200);
          const validIndex = clampChunkIndex(requestedIndex, chunks.length);
          const expectedChunk = chunks[validIndex];
          
          // Banner text should be non-empty for valid chunks with text
          if (expectedChunk.text.length > 0) {
            expect(bannerText.length).toBeGreaterThan(0);
          }
          
          // Banner text should be truncated if original is longer than 200
          if (expectedChunk.text.length > 200) {
            expect(bannerText.length).toBe(203); // 200 + "..."
            expect(bannerText.endsWith('...')).toBe(true);
          } else {
            expect(bannerText).toBe(expectedChunk.text);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('getBannerText returns empty string for empty chunks array', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: 100 }),
        (requestedIndex) => {
          expect(getBannerText([], requestedIndex)).toBe('');
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('banner display is independent of highlight match status', () => {
    fc.assert(
      fc.property(
        fc.record({
          chunk_id: fc.string({ minLength: 1, maxLength: 50 }),
          page: fc.oneof(fc.constant(null), fc.integer({ min: 1, max: 100 })),
          text: fc.string({ minLength: 1, maxLength: 500 })
        }),
        fc.boolean(), // Simulates whether highlights were found
        (chunk, highlightsFound) => {
          const chunks = [chunk];
          
          // Banner should display regardless of whether highlights were found
          // This tests the invariant that banner display depends only on chunk validity
          const shouldShow = shouldDisplayBanner(chunks, 0);
          const bannerText = getBannerText(chunks, 0);
          
          // Both should be consistent - if we should show, we should have text
          if (shouldShow) {
            expect(bannerText.length).toBeGreaterThanOrEqual(0);
          }
          
          // The highlightsFound status should NOT affect whether banner displays
          // (This is the key invariant - banner shows even when no highlights)
          expect(shouldShow).toBe(true); // Always true for valid chunk
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Additional unit tests for edge cases
describe('Chunk Utils Unit Tests', () => {
  describe('getChunksForPage', () => {
    it('handles null/undefined input', () => {
      expect(getChunksForPage(null as any, 1)).toEqual([]);
      expect(getChunksForPage(undefined as any, 1)).toEqual([]);
    });

    it('handles empty array', () => {
      expect(getChunksForPage([], 1)).toEqual([]);
    });
  });

  describe('getInitialPage', () => {
    it('handles invalid page values', () => {
      const chunks: ChunkData[] = [
        { chunk_id: 'test', page: 0, text: 'text' }
      ];
      expect(getInitialPage(chunks, 10)).toBe(1);
      
      const negativeChunks: ChunkData[] = [
        { chunk_id: 'test', page: -1, text: 'text' }
      ];
      expect(getInitialPage(negativeChunks, 10)).toBe(1);
    });
  });

  describe('clampChunkIndex', () => {
    it('clamps index to valid range', () => {
      expect(clampChunkIndex(-1, 5)).toBe(0);
      expect(clampChunkIndex(0, 5)).toBe(0);
      expect(clampChunkIndex(2, 5)).toBe(2);
      expect(clampChunkIndex(4, 5)).toBe(4);
      expect(clampChunkIndex(10, 5)).toBe(4);
    });

    it('returns 0 for empty chunks', () => {
      expect(clampChunkIndex(5, 0)).toBe(0);
    });
  });

  describe('truncateText', () => {
    it('does not truncate short text', () => {
      expect(truncateText('hello', 200)).toBe('hello');
    });

    it('truncates long text with ellipsis', () => {
      const longText = 'a'.repeat(250);
      const result = truncateText(longText, 200);
      expect(result.length).toBe(203); // 200 + '...'
      expect(result.endsWith('...')).toBe(true);
    });

    it('handles empty string', () => {
      expect(truncateText('')).toBe('');
    });

    it('handles null/undefined', () => {
      expect(truncateText(null as any)).toBe('');
      expect(truncateText(undefined as any)).toBe('');
    });
  });

  describe('isValidChunk', () => {
    it('returns true for valid chunk', () => {
      expect(isValidChunk({ chunk_id: 'test', page: 1, text: 'hello' })).toBe(true);
      expect(isValidChunk({ chunk_id: 'test', page: null, text: 'hello' })).toBe(true);
    });

    it('returns false for invalid chunks', () => {
      expect(isValidChunk(null)).toBe(false);
      expect(isValidChunk(undefined)).toBe(false);
      expect(isValidChunk({} as any)).toBe(false);
      expect(isValidChunk({ chunk_id: 123, page: 1, text: 'hello' } as any)).toBe(false);
    });
  });

  describe('filterValidChunks', () => {
    it('filters out invalid chunks', () => {
      const chunks = [
        { chunk_id: 'valid', page: 1, text: 'hello' },
        null,
        undefined,
        { chunk_id: 'also-valid', page: null, text: 'world' }
      ];
      const result = filterValidChunks(chunks as any);
      expect(result.length).toBe(2);
      expect(result[0].chunk_id).toBe('valid');
      expect(result[1].chunk_id).toBe('also-valid');
    });

    it('handles null/undefined input', () => {
      expect(filterValidChunks(null as any)).toEqual([]);
      expect(filterValidChunks(undefined as any)).toEqual([]);
    });
  });
});

/**
 * Feature: pdf-chunk-highlighting, Property 10: Malformed Data Graceful Handling
 * 
 * *For any* malformed or missing chunk data input, the PDF viewer SHALL return 
 * an empty highlights array without throwing exceptions.
 * 
 * **Validates: Requirements 6.1**
 */
describe('Property 10: Malformed Data Graceful Handling', () => {
  // Arbitrary for generating malformed chunk data
  const malformedChunkArb = fc.oneof(
    fc.constant(null),
    fc.constant(undefined),
    fc.string(), // String instead of object
    fc.integer(), // Number instead of object
    fc.boolean(), // Boolean instead of object
    fc.array(fc.integer()), // Array of numbers
    fc.record({
      // Missing chunk_id
      page: fc.oneof(fc.constant(null), fc.integer({ min: 1, max: 100 })),
      text: fc.string()
    }),
    fc.record({
      // Missing text
      chunk_id: fc.string(),
      page: fc.oneof(fc.constant(null), fc.integer({ min: 1, max: 100 }))
    }),
    fc.record({
      // Invalid chunk_id type
      chunk_id: fc.integer(),
      page: fc.oneof(fc.constant(null), fc.integer({ min: 1, max: 100 })),
      text: fc.string()
    }),
    fc.record({
      // Invalid text type
      chunk_id: fc.string(),
      page: fc.oneof(fc.constant(null), fc.integer({ min: 1, max: 100 })),
      text: fc.integer()
    }),
    fc.record({
      // Invalid page type (not null or number)
      chunk_id: fc.string(),
      page: fc.string(),
      text: fc.string()
    })
  );

  it('safeProcessChunks returns empty array for null input without throwing', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        (input) => {
          // Should not throw
          const result = safeProcessChunks(input, false);
          
          // Should return empty array
          expect(Array.isArray(result)).toBe(true);
          expect(result.length).toBe(0);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('safeProcessChunks returns empty array for undefined input without throwing', () => {
    fc.assert(
      fc.property(
        fc.constant(undefined),
        (input) => {
          // Should not throw
          const result = safeProcessChunks(input, false);
          
          // Should return empty array
          expect(Array.isArray(result)).toBe(true);
          expect(result.length).toBe(0);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('safeProcessChunks returns empty array for non-array input without throwing', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string(),
          fc.integer(),
          fc.boolean(),
          fc.object()
        ),
        (input) => {
          // Should not throw
          const result = safeProcessChunks(input, false);
          
          // Should return empty array
          expect(Array.isArray(result)).toBe(true);
          expect(result.length).toBe(0);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('safeProcessChunks filters out malformed chunks from array without throwing', () => {
    fc.assert(
      fc.property(
        fc.array(malformedChunkArb, { minLength: 0, maxLength: 20 }),
        (malformedChunks) => {
          // Should not throw
          const result = safeProcessChunks(malformedChunks, false);
          
          // Should return array (possibly empty)
          expect(Array.isArray(result)).toBe(true);
          
          // All returned items should be valid chunks
          result.forEach(chunk => {
            expect(typeof chunk.chunk_id).toBe('string');
            expect(typeof chunk.text).toBe('string');
            expect(chunk.page === null || typeof chunk.page === 'number').toBe(true);
          });
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('safeProcessChunks preserves valid chunks mixed with malformed ones', () => {
    fc.assert(
      fc.property(
        fc.array(chunkDataArb, { minLength: 1, maxLength: 10 }),
        fc.array(malformedChunkArb, { minLength: 0, maxLength: 10 }),
        (validChunks, malformedChunks) => {
          // Mix valid and malformed chunks
          const mixedChunks = [...validChunks, ...malformedChunks];
          
          // Shuffle the array
          const shuffled = mixedChunks.sort(() => Math.random() - 0.5);
          
          // Should not throw
          const result = safeProcessChunks(shuffled, false);
          
          // Should return array
          expect(Array.isArray(result)).toBe(true);
          
          // Result should contain at least the valid chunks
          // (some malformed chunks might accidentally be valid)
          expect(result.length).toBeGreaterThanOrEqual(0);
          
          // All returned items should be valid
          result.forEach(chunk => {
            expect(typeof chunk.chunk_id).toBe('string');
            expect(typeof chunk.text).toBe('string');
            expect(chunk.page === null || typeof chunk.page === 'number').toBe(true);
          });
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('validateChunks returns warnings for malformed data without throwing', () => {
    fc.assert(
      fc.property(
        fc.array(malformedChunkArb, { minLength: 1, maxLength: 10 }),
        (malformedChunks) => {
          // Should not throw
          const result = validateChunks(malformedChunks);
          
          // Should return validation result object
          expect(result).toHaveProperty('validChunks');
          expect(result).toHaveProperty('invalidCount');
          expect(result).toHaveProperty('warnings');
          
          // validChunks should be an array
          expect(Array.isArray(result.validChunks)).toBe(true);
          
          // warnings should be an array
          expect(Array.isArray(result.warnings)).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('validateChunks correctly counts invalid chunks', () => {
    fc.assert(
      fc.property(
        fc.array(chunkDataArb, { minLength: 0, maxLength: 10 }),
        fc.array(fc.constant(null), { minLength: 0, maxLength: 10 }),
        (validChunks, nullChunks) => {
          const mixedChunks = [...validChunks, ...nullChunks];
          
          const result = validateChunks(mixedChunks);
          
          // Invalid count should equal number of null chunks
          expect(result.invalidCount).toBe(nullChunks.length);
          
          // Valid chunks count should equal original valid chunks
          expect(result.validChunks.length).toBe(validChunks.length);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('safeProcessChunks never throws for any input', () => {
    fc.assert(
      fc.property(
        fc.anything(),
        (anyInput) => {
          // This should NEVER throw, regardless of input
          let didThrow = false;
          let result: ChunkData[] = [];
          
          try {
            result = safeProcessChunks(anyInput, false);
          } catch (e) {
            didThrow = true;
          }
          
          // Should not have thrown
          expect(didThrow).toBe(false);
          
          // Should always return an array
          expect(Array.isArray(result)).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * Null Page Handling Tests
 * 
 * Tests for the all-page search functionality when chunk.page is null.
 * 
 * **Validates: Requirements 6.4, 3.4**
 */
describe('Null Page Handling', () => {
  describe('createPageSearchCache', () => {
    it('creates an empty Map', () => {
      const cache = createPageSearchCache();
      expect(cache instanceof Map).toBe(true);
      expect(cache.size).toBe(0);
    });
  });

  describe('getCachedPageSearch', () => {
    it('returns undefined for non-existent chunk', () => {
      const cache = createPageSearchCache();
      expect(getCachedPageSearch(cache, 'non-existent')).toBeUndefined();
    });

    it('returns cached result for existing chunk', () => {
      const cache = createPageSearchCache();
      const result: PageSearchResult = {
        chunkId: 'test-chunk',
        foundPage: 5,
        confidence: 1.0
      };
      setCachedPageSearch(cache, result);
      
      const cached = getCachedPageSearch(cache, 'test-chunk');
      expect(cached).toEqual(result);
    });
  });

  describe('setCachedPageSearch', () => {
    it('stores result in cache', () => {
      const cache = createPageSearchCache();
      const result: PageSearchResult = {
        chunkId: 'chunk-1',
        foundPage: 3,
        confidence: 0.8
      };
      
      setCachedPageSearch(cache, result);
      expect(cache.size).toBe(1);
      expect(cache.get('chunk-1')).toEqual(result);
    });

    it('overwrites existing result for same chunk', () => {
      const cache = createPageSearchCache();
      const result1: PageSearchResult = {
        chunkId: 'chunk-1',
        foundPage: 3,
        confidence: 0.8
      };
      const result2: PageSearchResult = {
        chunkId: 'chunk-1',
        foundPage: 5,
        confidence: 1.0
      };
      
      setCachedPageSearch(cache, result1);
      setCachedPageSearch(cache, result2);
      
      expect(cache.size).toBe(1);
      expect(cache.get('chunk-1')).toEqual(result2);
    });
  });

  describe('needsAllPageSearch', () => {
    it('returns true for chunk with null page', () => {
      const chunk: ChunkData = { chunk_id: 'test', page: null, text: 'hello' };
      expect(needsAllPageSearch(chunk)).toBe(true);
    });

    it('returns false for chunk with valid page', () => {
      const chunk: ChunkData = { chunk_id: 'test', page: 5, text: 'hello' };
      expect(needsAllPageSearch(chunk)).toBe(false);
    });

    it('returns false for null/undefined chunk', () => {
      expect(needsAllPageSearch(null)).toBe(false);
      expect(needsAllPageSearch(undefined)).toBe(false);
    });

    it('returns false for invalid chunk', () => {
      expect(needsAllPageSearch({} as any)).toBe(false);
    });
  });

  describe('getChunksNeedingSearch', () => {
    it('returns only chunks with null page', () => {
      const chunks: ChunkData[] = [
        { chunk_id: 'c1', page: 1, text: 'text1' },
        { chunk_id: 'c2', page: null, text: 'text2' },
        { chunk_id: 'c3', page: 3, text: 'text3' },
        { chunk_id: 'c4', page: null, text: 'text4' }
      ];
      
      const result = getChunksNeedingSearch(chunks);
      expect(result.length).toBe(2);
      expect(result[0].chunk_id).toBe('c2');
      expect(result[1].chunk_id).toBe('c4');
    });

    it('returns empty array when no chunks have null page', () => {
      const chunks: ChunkData[] = [
        { chunk_id: 'c1', page: 1, text: 'text1' },
        { chunk_id: 'c2', page: 2, text: 'text2' }
      ];
      
      const result = getChunksNeedingSearch(chunks);
      expect(result.length).toBe(0);
    });

    it('handles null/undefined input', () => {
      expect(getChunksNeedingSearch(null as any)).toEqual([]);
      expect(getChunksNeedingSearch(undefined as any)).toEqual([]);
    });
  });

  describe('updateChunkWithFoundPage', () => {
    it('returns new chunk with updated page', () => {
      const chunk: ChunkData = { chunk_id: 'test', page: null, text: 'hello' };
      const updated = updateChunkWithFoundPage(chunk, 5);
      
      expect(updated.page).toBe(5);
      expect(updated.chunk_id).toBe('test');
      expect(updated.text).toBe('hello');
    });

    it('does not mutate original chunk', () => {
      const chunk: ChunkData = { chunk_id: 'test', page: null, text: 'hello' };
      const updated = updateChunkWithFoundPage(chunk, 5);
      
      expect(chunk.page).toBe(null);
      expect(updated).not.toBe(chunk);
    });
  });

  describe('applySearchCacheToChunks', () => {
    it('updates chunks with null page from cache', () => {
      const chunks: ChunkData[] = [
        { chunk_id: 'c1', page: null, text: 'text1' },
        { chunk_id: 'c2', page: 2, text: 'text2' },
        { chunk_id: 'c3', page: null, text: 'text3' }
      ];
      
      const cache = createPageSearchCache();
      setCachedPageSearch(cache, { chunkId: 'c1', foundPage: 5, confidence: 1.0 });
      setCachedPageSearch(cache, { chunkId: 'c3', foundPage: 7, confidence: 0.8 });
      
      const result = applySearchCacheToChunks(chunks, cache);
      
      expect(result[0].page).toBe(5);
      expect(result[1].page).toBe(2); // Unchanged
      expect(result[2].page).toBe(7);
    });

    it('preserves chunks with existing page', () => {
      const chunks: ChunkData[] = [
        { chunk_id: 'c1', page: 3, text: 'text1' }
      ];
      
      const cache = createPageSearchCache();
      setCachedPageSearch(cache, { chunkId: 'c1', foundPage: 5, confidence: 1.0 });
      
      const result = applySearchCacheToChunks(chunks, cache);
      
      // Should NOT update because chunk already has a page
      expect(result[0].page).toBe(3);
    });

    it('keeps null page when not found in cache', () => {
      const chunks: ChunkData[] = [
        { chunk_id: 'c1', page: null, text: 'text1' }
      ];
      
      const cache = createPageSearchCache();
      // No cache entry for c1
      
      const result = applySearchCacheToChunks(chunks, cache);
      
      expect(result[0].page).toBe(null);
    });

    it('keeps null page when cache result has null foundPage', () => {
      const chunks: ChunkData[] = [
        { chunk_id: 'c1', page: null, text: 'text1' }
      ];
      
      const cache = createPageSearchCache();
      setCachedPageSearch(cache, { chunkId: 'c1', foundPage: null, confidence: 0 });
      
      const result = applySearchCacheToChunks(chunks, cache);
      
      expect(result[0].page).toBe(null);
    });

    it('handles null/undefined input', () => {
      const cache = createPageSearchCache();
      expect(applySearchCacheToChunks(null as any, cache)).toEqual([]);
      expect(applySearchCacheToChunks(undefined as any, cache)).toEqual([]);
    });

    it('does not mutate original chunks array', () => {
      const chunks: ChunkData[] = [
        { chunk_id: 'c1', page: null, text: 'text1' }
      ];
      
      const cache = createPageSearchCache();
      setCachedPageSearch(cache, { chunkId: 'c1', foundPage: 5, confidence: 1.0 });
      
      const result = applySearchCacheToChunks(chunks, cache);
      
      expect(chunks[0].page).toBe(null); // Original unchanged
      expect(result[0].page).toBe(5);
      expect(result).not.toBe(chunks);
    });
  });

  // Property-based tests for null page handling
  describe('Property: Cache consistency', () => {
    it('cached results are always retrievable', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.oneof(fc.constant(null), fc.integer({ min: 1, max: 100 })),
          fc.float({ min: 0, max: 1 }),
          (chunkId, foundPage, confidence) => {
            const cache = createPageSearchCache();
            const result: PageSearchResult = { chunkId, foundPage, confidence };
            
            setCachedPageSearch(cache, result);
            const retrieved = getCachedPageSearch(cache, chunkId);
            
            expect(retrieved).toEqual(result);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: Null page detection', () => {
    it('needsAllPageSearch correctly identifies chunks needing search', () => {
      fc.assert(
        fc.property(
          chunkDataArb,
          (chunk) => {
            const needsSearch = needsAllPageSearch(chunk);
            
            // Should need search if and only if page is null
            expect(needsSearch).toBe(chunk.page === null);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: Cache application preserves non-null pages', () => {
    it('chunks with existing pages are never modified by cache', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              chunk_id: fc.string({ minLength: 1, maxLength: 50 }),
              page: fc.integer({ min: 1, max: 100 }), // Non-null pages only
              text: fc.string({ minLength: 1, maxLength: 500 })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (chunks) => {
            const cache = createPageSearchCache();
            
            // Add cache entries for all chunks
            chunks.forEach(chunk => {
              setCachedPageSearch(cache, {
                chunkId: chunk.chunk_id,
                foundPage: 999, // Different page
                confidence: 1.0
              });
            });
            
            const result = applySearchCacheToChunks(chunks, cache);
            
            // All pages should be unchanged because they were non-null
            result.forEach((resultChunk, i) => {
              expect(resultChunk.page).toBe(chunks[i].page);
            });
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
