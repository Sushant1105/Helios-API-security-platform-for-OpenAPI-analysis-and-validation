/**
 * @helios/ai-engine
 * Local AI Copilot and Authoritative AST Ground-Truth Validator for HELIOS.
 * Provides local Ollama integration, targeted context extraction,
 * structured JSON output parsing, and anti-hallucination AST verification.
 */

export * from './types.js';
export * from './prompts.js';
export * from './parser.js';
export * from './context-builder.js';
export * from './verifier.js';
export * from './providers/ollama.js';
export * from './providers/mock.js';
export * from './copilot.js';
