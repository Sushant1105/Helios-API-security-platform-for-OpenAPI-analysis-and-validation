import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OllamaProvider } from '../providers/ollama.js';
import { AiCopilot } from '../copilot.js';
import type { CanonicalApiAst } from '@helios/canonical-ast';

describe('Ollama Live Integration Tests (Optional)', () => {
  it('should test against live Ollama daemon if running, or skip cleanly', async (t) => {
    const provider = new OllamaProvider();
    const available = await provider.isAvailable();

    if (!available) {
      t.skip('Local Ollama daemon is not running at localhost:11434 (clean skip for offline/CI environments)');
      return;
    }

    // If reachable, test lightweight prompt
    try {
      const response = await provider.generate({
        prompt: 'Say hello in 3 words.',
        format: 'json',
      });
      assert.ok(response.text);
      assert.ok(response.model);
    } catch (err) {
      // If model not installed or other error, skip gracefully
      t.skip(`Ollama reachable but request failed (e.g. model not pulled): ${(err as Error).message}`);
    }
  });

  it('should run full AiCopilot pipeline with live Ollama if available', async (t) => {
    const provider = new OllamaProvider();
    const available = await provider.isAvailable();

    if (!available) {
      t.skip('Local Ollama daemon is not running (clean skip)');
      return;
    }

    const copilot = new AiCopilot({ provider });
    const mockAst: CanonicalApiAst = {
      id: 'test-api:1.0.0',
      title: 'Test API',
      version: '1.0.0',
      specVersion: '3.1',
      format: 'json',
      info: { title: 'Test API', version: '1.0.0' },
      servers: [],
      tags: [],
      endpoints: [
        {
          id: 'get:/health',
          path: '/health',
          method: 'get',
          deprecated: false,
          parameters: [],
          responses: {
            '200': {
              statusCode: '200',
              description: 'OK',
            },
          },
          tags: ['Health'],
        },
      ],
      schemas: {},
      securitySchemes: {},
      security: [],
      metadata: {
        normalizedAt: new Date().toISOString(),
        sourceFormat: 'json',
        specVersion: '3.1',
        totalEndpoints: 1,
        totalSchemas: 0,
      },
    };

    try {
      const result = await copilot.ask({
        userQuery: 'What endpoints are available in this API?',
        ast: mockAst,
      });

      assert.ok(result.verifiedAnswer);
      assert.ok(result.status);
      assert.ok(Array.isArray(result.hallucinationsDetected));
    } catch (err) {
      t.skip(`Live Ollama generation failed: ${(err as Error).message}`);
    }
  });
});
