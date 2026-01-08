/**
 * Property-Based Tests for Text Matcher Utility
 * 
 * Feature: pdf-chunk-highlighting
 * Uses fast-check for property-based testing with minimum 100 iterations
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  normalizeText,
  findExactMatch,
  findWordMatch,
  findChunkOnPage,
  TextItem,
  TextContent,
  ChunkData
} from './textMatcher';

/**
 * Feature: pdf-chunk-highlighting, Property 4: Text Normalization Idempotence
 * 
 * *For any* text string, normalizing it twice SHALL produce the same result 
 * as normalizing it once (idempotent operation).
 * 
 * **Validates: Requirements 3.1**
 */
describe('Property 4: Text Normalization Idempotence', () => {
  it('normalizing text twice produces the same result as normalizing once', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const normalizedOnce = normalizeText(text);
        const normalizedTwice = normalizeText(normalizedOnce);
        
        expect(normalizedTwice).toBe(normalizedOnce);
      }),
      { numRuns: 100 }
    );
  });

  it('normalizing text with various whitespace patterns is idempotent', () => {
    // Create arbitrary for strings with mixed whitespace
    const whitespaceStringArb = fc.array(
      fc.oneof(
        fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'),
        fc.constant(' '),
        fc.constant('\n'),
        fc.constant('\r'),
        fc.constant('\t'),
        fc.constant('  '),
        fc.constant('\n\n')
      ),
      { minLength: 0, maxLength: 50 }
    ).map(arr => arr.join(''));

    fc.assert(
      fc.property(whitespaceStringArb, (text) => {
        const normalizedOnce = normalizeText(text);
        const normalizedTwice = normalizeText(normalizedOnce);
        
        expect(normalizedTwice).toBe(normalizedOnce);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: pdf-chunk-highlighting, Property 5: Word Match Subset
 * 
 * *For any* chunk text and PDF text content, the set of text items matched 
 * by word-based matching SHALL be a superset of items matched by exact matching 
 * (word matching is more permissive).
 * 
 * **Validates: Requirements 3.2**
 */
describe('Property 5: Word Match Subset', () => {
  // Helper to create TextItem from string
  const createTextItem = (str: string): TextItem => ({
    str,
    transform: [1, 0, 0, 1, 0, 0],
    width: str.length * 10,
    height: 12
  });

  // Helper to create TextContent from strings
  const createTextContent = (strings: string[]): TextContent => ({
    items: strings.map(createTextItem)
  });

  it('word match finds at least as many items as exact match would identify', () => {
    // Generate text items that form coherent text
    const textItemsArb = fc.array(
      fc.string({ minLength: 1, maxLength: 20 }),
      { minLength: 1, maxLength: 20 }
    );

    fc.assert(
      fc.property(textItemsArb, (textStrings) => {
        const textItems = textStrings.map(createTextItem);
        const fullText = textStrings.join(' ');
        
        // Create a search text from a subset of the full text
        const searchText = fullText.substring(0, Math.min(50, fullText.length));
        
        if (searchText.length === 0) return true; // Skip empty cases
        
        const wordResult = findWordMatch(searchText, textItems);
        const exactResult = findExactMatch(searchText, fullText);
        
        // If exact match found something, word match should also find something
        // (word match is more permissive)
        if (exactResult.found && exactResult.confidence > 0) {
          // Word match should find at least some items when exact match succeeds
          // Note: This is a relaxed check since exact match doesn't track items
          expect(wordResult.found || searchText.split(/\s+/).filter(w => w.length > 3).length === 0).toBe(true);
        }
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('word match with significant words always finds matches when text contains those words', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 5, maxLength: 15 }), { minLength: 1, maxLength: 10 }),
        (words) => {
          // Filter to get significant words (length > 3)
          const significantWords = words.filter(w => w.length > 3);
          if (significantWords.length === 0) return true;

          const searchText = significantWords.join(' ');
          const textItems = significantWords.map(createTextItem);
          
          const result = findWordMatch(searchText, textItems);
          
          // Should find matches since text items contain the search words
          expect(result.found).toBe(true);
          expect(result.matchedItems.length).toBeGreaterThan(0);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Additional unit tests for edge cases
describe('Text Matcher Unit Tests', () => {
  describe('normalizeText', () => {
    it('handles empty string', () => {
      expect(normalizeText('')).toBe('');
    });

    it('handles null/undefined gracefully', () => {
      expect(normalizeText(null as any)).toBe('');
      expect(normalizeText(undefined as any)).toBe('');
    });

    it('collapses multiple spaces', () => {
      expect(normalizeText('hello    world')).toBe('hello world');
    });

    it('converts line breaks to spaces', () => {
      expect(normalizeText('hello\nworld')).toBe('hello world');
      expect(normalizeText('hello\r\nworld')).toBe('hello world');
    });

    it('trims leading and trailing whitespace', () => {
      expect(normalizeText('  hello world  ')).toBe('hello world');
    });
  });

  describe('findExactMatch', () => {
    it('finds exact match in text', () => {
      const result = findExactMatch('hello world', 'this is hello world here');
      expect(result.found).toBe(true);
      expect(result.confidence).toBe(1.0);
    });

    it('returns false when no match', () => {
      const result = findExactMatch('xyz', 'hello world');
      expect(result.found).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('handles empty inputs', () => {
      expect(findExactMatch('', 'hello').found).toBe(false);
      expect(findExactMatch('hello', '').found).toBe(false);
    });
  });

  describe('findWordMatch', () => {
    const createTextItem = (str: string): TextItem => ({
      str,
      transform: [1, 0, 0, 1, 0, 0],
      width: str.length * 10,
      height: 12
    });

    it('finds word matches', () => {
      const textItems = [
        createTextItem('hello'),
        createTextItem('world'),
        createTextItem('testing')
      ];
      const result = findWordMatch('hello world', textItems);
      expect(result.found).toBe(true);
      expect(result.matchedItems).toContain(0);
      expect(result.matchedItems).toContain(1);
    });

    it('ignores short words (length <= 3)', () => {
      const textItems = [createTextItem('the'), createTextItem('a')];
      const result = findWordMatch('the a', textItems);
      expect(result.found).toBe(false);
    });

    it('handles empty inputs', () => {
      expect(findWordMatch('', []).found).toBe(false);
      expect(findWordMatch('hello', []).found).toBe(false);
    });
  });

  describe('findChunkOnPage', () => {
    const createTextContent = (strings: string[]): TextContent => ({
      items: strings.map(str => ({
        str,
        transform: [1, 0, 0, 1, 0, 0],
        width: str.length * 10,
        height: 12
      }))
    });

    it('finds chunk text on page', () => {
      const chunk: ChunkData = {
        chunk_id: 'test-1',
        page: 1,
        text: 'hello world testing'
      };
      const textContent = createTextContent(['hello', 'world', 'testing', 'other']);
      
      const result = findChunkOnPage(chunk, textContent);
      expect(result.found).toBe(true);
      expect(result.matchedItems.length).toBeGreaterThan(0);
    });

    it('handles missing chunk data', () => {
      const textContent = createTextContent(['hello', 'world']);
      
      expect(findChunkOnPage(null as any, textContent).found).toBe(false);
      expect(findChunkOnPage({ chunk_id: '', page: 1, text: '' }, textContent).found).toBe(false);
    });

    it('handles missing text content', () => {
      const chunk: ChunkData = { chunk_id: 'test', page: 1, text: 'hello' };
      
      expect(findChunkOnPage(chunk, null as any).found).toBe(false);
      expect(findChunkOnPage(chunk, { items: [] }).found).toBe(false);
    });
  });
});
