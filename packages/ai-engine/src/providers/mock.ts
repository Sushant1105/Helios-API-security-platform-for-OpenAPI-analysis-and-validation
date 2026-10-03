/**
 * @helios/ai-engine
 * Mock LLM Provider for deterministic, offline testing.
 * Does not require network access or a running Ollama daemon.
 */

import type { LlmProvider, LlmRequest, LlmResponse } from '../types.js';

export interface MockResponseRule {
  pattern?: RegExp | string;
  response: string | Record<string, unknown>;
  delayMs?: number;
  shouldFail?: boolean;
  failError?: Error;
}

export class MockLlmProvider implements LlmProvider {
  public readonly name = 'mock';
  private defaultResponse: string | Record<string, unknown>;
  private readonly rules: MockResponseRule[] = [];
  public callCount = 0;
  public lastRequest?: LlmRequest;

  constructor(defaultResponse?: string | Record<string, unknown>) {
    this.defaultResponse = defaultResponse || {
      answer: 'This is a mock AI answer grounded in provided context.',
      referencedEndpoints: [],
      referencedSchemas: [],
      referencedFindings: [],
      referencedControls: [],
      referencedChanges: [],
      limitations: ['Mock offline provider.'],
      confidence: 'HIGH',
    };
  }

  public setDefaultResponse(resp: string | Record<string, unknown>): void {
    this.defaultResponse = resp;
  }

  public addRule(rule: MockResponseRule): void {
    this.rules.push(rule);
  }

  public async isAvailable(): Promise<boolean> {
    return true;
  }

  public async generate(request: LlmRequest): Promise<LlmResponse> {
    this.callCount += 1;
    this.lastRequest = request;

    // Check matching rules
    for (const rule of this.rules) {
      if (rule.pattern) {
        const matches =
          typeof rule.pattern === 'string'
            ? request.prompt.includes(rule.pattern)
            : rule.pattern.test(request.prompt);
        if (matches) {
          if (rule.delayMs) {
            await new Promise((r) => setTimeout(r, rule.delayMs));
          }
          if (rule.shouldFail) {
            throw rule.failError || new Error('Mock LLM provider simulated failure.');
          }
          const text =
            typeof rule.response === 'string'
              ? rule.response
              : JSON.stringify(rule.response);
          return {
            text,
            model: 'mock-llm',
            totalDurationMs: rule.delayMs || 5,
          };
        }
      }
    }

    const text =
      typeof this.defaultResponse === 'string'
        ? this.defaultResponse
        : JSON.stringify(this.defaultResponse);

    return {
      text,
      model: 'mock-llm',
      totalDurationMs: 5,
    };
  }
}
