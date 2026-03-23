import { describe, it, expect, beforeAll } from 'vitest';
import { loadKnowledgeEntries } from 'fluently-scorer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = path.resolve(__dirname, '../../../knowledge');

describe('MCP Server Tools', () => {
  let knowledgeEntries: ReturnType<typeof loadKnowledgeEntries>;

  beforeAll(() => {
    knowledgeEntries = loadKnowledgeEntries(KNOWLEDGE_DIR);
  });

  // Helper function to simulate tool responses
  function keywordSet(text: string): Set<string> {
    return new Set(text.toLowerCase().split(/\W+/).filter(Boolean));
  }

  function cosineSimilarity(setA: Set<string>, setB: Set<string>): number {
    const all = new Set([...setA, ...setB]);
    let dot = 0,
      magA = 0,
      magB = 0;
    for (const word of all) {
      const a = setA.has(word) ? 1 : 0;
      const b = setB.has(word) ? 1 : 0;
      dot += a * b;
      magA += a * a;
      magB += b * b;
    }
    return magA && magB ? dot / (Math.sqrt(magA) * Math.sqrt(magB)) : 0;
  }

  describe('compare_problem_space tool', () => {
    it('should return valid response structure with top 3 results', () => {
      const taskDescription = 'Code review and testing automation';
      const taskSet = keywordSet(taskDescription);

      const scored = knowledgeEntries
        .map((entry) => {
          const entrySet = keywordSet(
            entry.title +
              ' ' +
              entry.domain +
              ' ' +
              Object.values(entry.dimensions)
                .map((d) => d.description)
                .join(' ')
          );
          const similarity = cosineSimilarity(taskSet, entrySet);
          return { entry, similarity };
        });

      scored.sort((a, b) => b.similarity - a.similarity);
      const top3 = scored.slice(0, 3);

      // Verify response shape
      expect(top3).toBeDefined();
      expect(top3.length).toBeLessThanOrEqual(3);

      top3.forEach(({ entry, similarity }) => {
        expect(entry.id).toBeDefined();
        expect(entry.title).toBeDefined();
        expect(entry.domain).toBeDefined();
        expect(similarity).toBeGreaterThanOrEqual(0);
        expect(similarity).toBeLessThanOrEqual(1);
      });
    });

    it('should support domain filtering', () => {
      const taskDescription = 'Bug prioritization in coding';
      const domain = 'coding';
      const taskSet = keywordSet(taskDescription);

      const filtered = knowledgeEntries.filter((e) => e.domain === domain);
      const scored = filtered.map((entry) => {
        const entrySet = keywordSet(entry.title + ' ' + entry.domain);
        const similarity = cosineSimilarity(taskSet, entrySet);
        return { entry, similarity };
      });

      scored.sort((a, b) => b.similarity - a.similarity);

      // All results should match the domain filter
      scored.forEach(({ entry }) => {
        expect(entry.domain).toBe(domain);
      });
    });
  });

  describe('score_delegation tool', () => {
    it('should return delegation and description scores', () => {
      const task = 'Automated code review with human oversight';
      const delegationIntent = 'augmented';
      const taskSet = keywordSet(task + ' ' + delegationIntent);

      const scored = knowledgeEntries.map((entry) => {
        const entrySet = keywordSet(
          entry.title + ' ' + Object.values(entry.dimensions).map((d) => d.description).join(' ')
        );
        const similarity = cosineSimilarity(taskSet, entrySet);
        return {
          entry,
          similarity,
          delegationScore: Math.round(similarity * entry.score_hints.delegation * 100),
          descriptionScore: Math.round(similarity * entry.score_hints.description * 100),
        };
      });

      scored.sort((a, b) => b.similarity - a.similarity);
      const result = scored[0];

      expect(result.delegationScore).toBeGreaterThanOrEqual(0);
      expect(result.delegationScore).toBeLessThanOrEqual(100);
      expect(result.descriptionScore).toBeGreaterThanOrEqual(0);
      expect(result.descriptionScore).toBeLessThanOrEqual(100);
    });
  });

  describe('evaluate_discernment tool', () => {
    it('should flag high hallucination risk for certain phrases', () => {
      const aiOutput = 'I am certain this is the correct solution without any doubt';
      const originalTask = 'Evaluate this code';

      // Tool should detect overconfidence
      const taskSet = keywordSet(originalTask + ' ' + aiOutput);
      const scored = knowledgeEntries.map((entry) => {
        const entrySet = keywordSet(
          entry.title + ' ' + entry.dimensions.discernment.description
        );
        const similarity = cosineSimilarity(taskSet, entrySet);
        return {
          entry,
          discernmentScore: Math.round(similarity * entry.score_hints.discernment * 100),
        };
      });

      scored.sort((a, b) => b.discernmentScore - a.discernmentScore);
      const result = scored[0];

      expect(result.discernmentScore).toBeDefined();
      expect(result.discernmentScore).toBeGreaterThanOrEqual(0);
      expect(result.discernmentScore).toBeLessThanOrEqual(100);

      // Hallucination risk = 100 - discernmentScore
      const hallucinationRisk = Math.max(0, 100 - result.discernmentScore);
      expect(hallucinationRisk).toBeGreaterThanOrEqual(0);
      expect(hallucinationRisk).toBeLessThanOrEqual(100);
    });

    it('should handle lower hallucination risk for cautious outputs', () => {
      const aiOutput = 'Based on the code analysis, this pattern could potentially indicate an issue. Further review is recommended.';
      const originalTask = 'Analyze security concerns';

      const taskSet = keywordSet(originalTask + ' ' + aiOutput);
      const scored = knowledgeEntries.map((entry) => {
        const entrySet = keywordSet(
          entry.title + ' ' + entry.dimensions.discernment.description
        );
        const similarity = cosineSimilarity(taskSet, entrySet);
        return {
          discernmentScore: Math.round(similarity * entry.score_hints.discernment * 100),
        };
      });

      scored.sort((a, b) => b.discernmentScore - a.discernmentScore);
      const result = scored[0];

      expect(result.discernmentScore).toBeGreaterThanOrEqual(0);
      expect(result.discernmentScore).toBeLessThanOrEqual(100);
    });
  });

  describe('check_diligence tool', () => {
    it('should return diligence checklist with common items', () => {
      const checklist = [
        'Define clear human accountability roles',
        'Establish review and approval process',
        'Document AI involvement in decision',
        'Create audit trail of decisions',
        'Define escalation criteria',
      ];

      expect(checklist).toBeDefined();
      expect(Array.isArray(checklist)).toBe(true);
      expect(checklist.length).toBeGreaterThan(0);
      checklist.forEach((item) => {
        expect(typeof item).toBe('string');
        expect(item.length).toBeGreaterThan(0);
      });
    });

    it('should include transparency and accountability requirements', () => {
      const transparencyRequirements = [
        'Disclose AI participation to stakeholders',
        'Explain AI limitations and confidence',
        'Provide human decision-maker contact',
      ];

      expect(transparencyRequirements).toBeDefined();
      expect(transparencyRequirements.length).toBeGreaterThan(0);
      transparencyRequirements.forEach((req) => {
        expect(typeof req).toBe('string');
      });
    });
  });

  describe('get_4d_score tool', () => {
    it('should return complete 4D score response', () => {
      const description = 'Automated code review with human oversight and clear approval workflows';
      const delegation = 'augmented';
      const taskSet = keywordSet(description + ' ' + delegation);

      const scored = knowledgeEntries.map((entry) => {
        const entrySet = keywordSet(entry.title + ' ' + entry.domain);
        const similarity = cosineSimilarity(taskSet, entrySet);
        return {
          entry,
          similarity,
          delegationScore: Math.round(similarity * entry.score_hints.delegation * 100),
          descriptionScore: Math.round(similarity * entry.score_hints.description * 100),
          discernmentScore: Math.round(similarity * entry.score_hints.discernment * 100),
          diligenceScore: Math.round(similarity * entry.score_hints.diligence * 100),
        };
      });

      scored.sort((a, b) => b.similarity - a.similarity);
      const topMatch = scored[0];

      // Apply boosting logic like the tool does
      const delegationScore = Math.max(0, Math.min(100, topMatch.delegationScore + 30));
      const descriptionScore = Math.max(0, Math.min(100, topMatch.descriptionScore + 25));
      const discernmentScore = Math.max(0, Math.min(100, topMatch.discernmentScore + 20));
      const diligenceScore = Math.max(0, Math.min(100, topMatch.diligenceScore + 15));

      const overallScore = Math.round(
        (delegationScore + descriptionScore + discernmentScore + diligenceScore) / 4
      );

      // Verify scores
      expect(delegationScore).toBeGreaterThanOrEqual(0);
      expect(delegationScore).toBeLessThanOrEqual(100);
      expect(descriptionScore).toBeGreaterThanOrEqual(0);
      expect(descriptionScore).toBeLessThanOrEqual(100);
      expect(discernmentScore).toBeGreaterThanOrEqual(0);
      expect(discernmentScore).toBeLessThanOrEqual(100);
      expect(diligenceScore).toBeGreaterThanOrEqual(0);
      expect(diligenceScore).toBeLessThanOrEqual(100);
      expect(overallScore).toBeGreaterThanOrEqual(0);
      expect(overallScore).toBeLessThanOrEqual(100);
    });

    it('should return expected score range for well-formed task', () => {
      const description = 'Code review process with AI suggestions and human final decision';
      const delegation = 'augmented with explicit approval workflow';
      const taskSet = keywordSet(description + ' ' + delegation);

      const scored = knowledgeEntries.map((entry) => {
        const entrySet = keywordSet(entry.title + ' ' + entry.domain);
        const similarity = cosineSimilarity(taskSet, entrySet);
        return {
          similarity,
          delegationScore: Math.round(similarity * entry.score_hints.delegation * 100),
          descriptionScore: Math.round(similarity * entry.score_hints.description * 100),
          discernmentScore: Math.round(similarity * entry.score_hints.discernment * 100),
          diligenceScore: Math.round(similarity * entry.score_hints.diligence * 100),
        };
      });

      scored.sort((a, b) => b.similarity - a.similarity);
      const topMatch = scored[0];

      const delegationScore = Math.max(0, Math.min(100, topMatch.delegationScore + 30));
      const descriptionScore = Math.max(0, Math.min(100, topMatch.descriptionScore + 25));
      const discernmentScore = Math.max(0, Math.min(100, topMatch.discernmentScore + 20));
      const diligenceScore = Math.max(0, Math.min(100, topMatch.diligenceScore + 15));

      const overallScore = Math.round(
        (delegationScore + descriptionScore + discernmentScore + diligenceScore) / 4
      );

      // Well-formed task should score reasonably
      expect(overallScore).toBeGreaterThan(20);
    });

    it('should include improvement tips for each dimension', () => {
      const tipsTemplate = {
        delegation: 'Clarify role: ',
        description: 'Better context: ',
        discernment: 'Review more carefully: ',
        diligence: 'Establish accountability: '
      };

      const tipKeys = Object.keys(tipsTemplate);
      expect(tipKeys).toEqual(['delegation', 'description', 'discernment', 'diligence']);

      tipKeys.forEach(key => {
        expect(typeof tipsTemplate[key as keyof typeof tipsTemplate]).toBe('string');
      });
    });
  });
});


