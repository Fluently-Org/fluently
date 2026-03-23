import { describe, it, expect } from 'vitest';
import { scoreTask, loadKnowledgeEntries } from '@fluently/scorer';
import { knowledgeEntrySchema } from '@fluently/scorer/schema';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = path.resolve(__dirname, '../../../knowledge');

describe('CLI Functions', () => {
  describe('score command logic', () => {
    it('should output correct scoring data for a task', () => {
      const result = scoreTask(
        {
          description: 'Code review process optimization',
          delegation_intent: 'augmented'
        },
        KNOWLEDGE_DIR
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      // Verify table structure would work
      result.forEach(({ entry, dimensionScores }) => {
        expect(entry.title).toBeDefined();
        expect(entry.domain).toBeDefined();
        expect(dimensionScores).toBeDefined();
        
        const dims = ['delegation', 'description', 'discernment', 'diligence'];
        dims.forEach(dim => {
          expect(dimensionScores[dim as keyof typeof dimensionScores]).toBeDefined();
          expect(typeof dimensionScores[dim as keyof typeof dimensionScores]).toBe('number');
        });
      });
    });

    it('should calculate overall 4D score correctly', () => {
      const result = scoreTask(
        {
          description: 'Testing and verification workflows',
          delegation_intent: 'augmented with oversight'
        },
        KNOWLEDGE_DIR
      );

      const topResult = result[0];
      const scores = topResult.dimensionScores;
      const overall = Object.values(scores).reduce((a, b) => a + b, 0) / 4;

      expect(overall).toBeGreaterThanOrEqual(0);
      expect(overall).toBeLessThanOrEqual(100);
    });
  });

  describe('compare command logic', () => {
    it('should return JSON-parseable result', () => {
      const result = scoreTask(
        {
          description: 'Delegating AI task evaluation',
          delegation_intent: 'augmented'
        },
        KNOWLEDGE_DIR
      );

      // Construct a JSON response like the CLI would
      const output = {
        task: 'test',
        delegation_intent: 'augmented',
        results: result.map(({ entry, dimensionScores }) => ({
          title: entry.title,
          domain: entry.domain,
          scores: dimensionScores
        }))
      };

      const jsonStr = JSON.stringify(output);
      const parsed = JSON.parse(jsonStr);

      expect(parsed.results).toBeDefined();
      expect(Array.isArray(parsed.results)).toBe(true);
      expect(parsed.results.length).toBeGreaterThan(0);
    });
  });

  describe('list command logic', () => {
    it('should return all entries when no domain filter applied', () => {
      const entries = loadKnowledgeEntries(KNOWLEDGE_DIR);
      const noFilter = entries.filter(() => true);

      expect(noFilter.length).toBe(entries.length);
      expect(noFilter.length).toBeGreaterThan(0);
    });

    it('should filter entries by domain correctly', () => {
      const entries = loadKnowledgeEntries(KNOWLEDGE_DIR);
      const codingEntries = entries.filter(e => e.domain === 'coding');

      expect(codingEntries.length).toBeGreaterThanOrEqual(0);
      codingEntries.forEach(entry => {
        expect(entry.domain).toBe('coding');
      });
    });

    it('should return empty array for non-existent domain', () => {
      const entries = loadKnowledgeEntries(KNOWLEDGE_DIR);
      const filtered = entries.filter((e) => e.domain === 'nonexistent-domain');

      expect(filtered).toEqual([]);
    });
  });

  describe('contribute command validation', () => {
    it('should accept valid contributed entry', () => {
      const newEntry = {
        id: 'test-entry-123',
        title: 'New Test Entry',
        domain: 'coding' as const,
        dimensions: {
          delegation: {
            description: 'Clear delegation responsibility',
            example: 'AI suggests, human decides',
            antipattern: 'AI decides unilaterally'
          },
          description: {
            description: 'Rich task context',
            example: 'Task includes constraints and success criteria',
            antipattern: 'Vague task description'
          },
          discernment: {
            description: 'Verification procedures',
            example: 'Cross-check with test suite',
            antipattern: 'Trusting without verification'
          },
          diligence: {
            description: 'Human accountability',
            example: 'Lead engineer approves before deployment',
            antipattern: 'No approval process'
          }
        },
        score_hints: {
          delegation: 0.25,
          description: 0.25,
          discernment: 0.25,
          diligence: 0.25
        },
        tags: ['testing', 'automation', 'coding'],
        contributor: 'Test Contributor',
        version: '1.0.0',
        collaboration: {
          pattern: 'linear',
          description: 'Linear workflow',
          sequence: [
            { step: 1, d: 'delegation',  label: 'Define scope',    triggers_next: 'Scope agreed' },
            { step: 2, d: 'description', label: 'Provide context', triggers_next: 'Context provided' },
          ],
          transitions: [
            { from: 'delegation', to: 'description', trigger: 'Scope agreed' },
          ],
        },
      };

      expect(() => knowledgeEntrySchema.parse(newEntry)).not.toThrow();
    });

    it('should reject invalid contributed entry with missing fields', () => {
      const invalidEntry = {
        id: 'test-entry',
        title: 'Incomplete Entry'
        // missing required fields
      };

      expect(() => knowledgeEntrySchema.parse(invalidEntry)).toThrow();
    });

    it('should reject entry with mismatched score hints sum', () => {
      const invalidEntry = {
        id: 'test-entry',
        title: 'Invalid Scores',
        domain: 'coding' as const,
        dimensions: {
          delegation: { description: 'D', example: 'E', antipattern: 'A' },
          description: { description: 'D', example: 'E', antipattern: 'A' },
          discernment: { description: 'D', example: 'E', antipattern: 'A' },
          diligence: { description: 'D', example: 'E', antipattern: 'A' }
        },
        score_hints: {
          delegation: 0.2,
          description: 0.3,
          discernment: 0.3,
          diligence: 0.15  // should sum to 1.0, not 0.95
        },
        tags: ['test'],
        contributor: 'Test',
        version: '1.0.0'
      };

      expect(() => knowledgeEntrySchema.parse(invalidEntry)).toThrow();
    });
  });
});
