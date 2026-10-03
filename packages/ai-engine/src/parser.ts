/**
 * @helios/ai-engine
 * Untrusted LLM Output Parser.
 * Safely extracts and validates structured AiAnswer objects from model responses.
 */

import type { AiAnswer, AiConfidence } from './types.js';

function extractJsonBlock(raw: string): string {
  const trimmed = raw.trim();

  // Handle markdown code fences
  const match = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(trimmed);
  if (match && match[1]) {
    return match[1].trim();
  }

  // Handle raw object boundaries
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.substring(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

function ensureStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.map((v) => String(v).trim()).filter((v) => v.length > 0);
}

function normalizeConfidence(val: unknown): AiConfidence {
  const upper = String(val || '').toUpperCase();
  if (upper === 'HIGH' || upper === 'MEDIUM' || upper === 'LOW') {
    return upper;
  }
  return 'MEDIUM';
}

export function parseAiResponse(rawResponse: string): AiAnswer {
  const jsonCandidate = extractJsonBlock(rawResponse);

  try {
    const parsed = JSON.parse(jsonCandidate) as Record<string, unknown>;

    if (parsed && typeof parsed === 'object') {
      const answer =
        typeof parsed['answer'] === 'string'
          ? parsed['answer'].trim()
          : typeof parsed['response'] === 'string'
          ? parsed['response'].trim()
          : rawResponse.trim();

      return {
        answer: answer || 'No textual explanation provided.',
        referencedEndpoints: ensureStringArray(parsed['referencedEndpoints']),
        referencedSchemas: ensureStringArray(parsed['referencedSchemas']),
        referencedFindings: ensureStringArray(parsed['referencedFindings']),
        referencedControls: ensureStringArray(parsed['referencedControls']),
        referencedChanges: ensureStringArray(parsed['referencedChanges']),
        limitations: ensureStringArray(parsed['limitations']),
        confidence: normalizeConfidence(parsed['confidence']),
      };
    }
  } catch {
    // Malformed JSON fallback
  }

  // Fallback: construct default answer from raw text
  return {
    answer: rawResponse.trim() || 'No response generated.',
    referencedEndpoints: [],
    referencedSchemas: [],
    referencedFindings: [],
    referencedControls: [],
    referencedChanges: [],
    limitations: ['LLM output was not well-formed JSON; parsed as raw text.'],
    confidence: 'LOW',
  };
}
