/**
 * @helios/ai-engine
 * Local Ollama LLM Provider Implementation.
 * Communicates with local Ollama daemon (/api/generate) without external network dependencies.
 */

import type { LlmProvider, LlmRequest, LlmResponse, OllamaProviderConfig } from '../types.js';

export const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434';
export const DEFAULT_OLLAMA_MODEL = 'llama3';
export const DEFAULT_OLLAMA_TIMEOUT_MS = 30000;
export const DEFAULT_OLLAMA_TEMPERATURE = 0.1;

export class OllamaProvider implements LlmProvider {
  public readonly name = 'ollama';
  private readonly baseUrl: string;
  private readonly modelName: string;
  private readonly timeoutMs: number;
  private readonly temperature: number;
  private readonly fetcher: typeof fetch;

  constructor(config: OllamaProviderConfig = {}) {
    this.baseUrl = (config.baseUrl || DEFAULT_OLLAMA_BASE_URL).replace(/\/+$/, '');
    this.modelName = config.modelName || DEFAULT_OLLAMA_MODEL;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_OLLAMA_TIMEOUT_MS;
    this.temperature = config.temperature ?? DEFAULT_OLLAMA_TEMPERATURE;
    this.fetcher = config.fetch || globalThis.fetch;
  }

  public async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      const res = await this.fetcher(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timer);
      return res.ok;
    } catch {
      return false;
    }
  }

  public async generate(request: LlmRequest): Promise<LlmResponse> {
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), this.timeoutMs);

    // Merge external signal if provided
    if (request.signal) {
      request.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    try {
      const payload: Record<string, unknown> = {
        model: this.modelName,
        prompt: request.prompt,
        stream: false,
        options: {
          temperature: request.temperature ?? this.temperature,
        },
      };

      if (request.systemPrompt) {
        payload['system'] = request.systemPrompt;
      }

      if (request.format === 'json') {
        payload['format'] = 'json';
      }

      const startTime = Date.now();
      const res = await this.fetcher(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutTimer);

      if (!res.ok) {
        const errorText = await res.text().catch(() => 'Unknown error');
        throw new Error(`Ollama generation failed with status ${res.status}: ${errorText}`);
      }

      const json = (await res.json()) as {
        response?: string;
        model?: string;
        total_duration?: number;
        prompt_eval_count?: number;
        eval_count?: number;
      };

      return {
        text: json.response || '',
        model: json.model || this.modelName,
        totalDurationMs: json.total_duration ? Math.round(json.total_duration / 1000000) : Date.now() - startTime,
        promptEvalCount: json.prompt_eval_count,
        evalCount: json.eval_count,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutTimer);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Ollama generation timed out after ${this.timeoutMs}ms.`);
      }
      throw err;
    }
  }
}
