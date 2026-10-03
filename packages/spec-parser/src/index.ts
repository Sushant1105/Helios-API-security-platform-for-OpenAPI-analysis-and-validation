/**
 * @helios/spec-parser
 * Public API for OpenAPI 3.0 and 3.1 specification reading, format detection,
 * local reference dereferencing, and Canonical AST normalization.
 */

import { readFile } from 'node:fs/promises';
import { buildCanonicalAst, type HeliosSpec } from '@helios/canonical-ast';
import { OpenApiParser } from './parser.js';
import type {
  ParsedOpenAPISpec,
  ParseOptions,
  ParseResult,
  ParserError,
} from './types.js';

export * from './types.js';
export { OpenApiParser } from './parser.js';
export { LocalRefResolver } from './resolver.js';

/**
 * Parses raw OpenAPI specification text (JSON or YAML) asynchronously.
 */
export async function parseSpec(
  rawContent: string,
  options?: ParseOptions
): Promise<ParseResult> {
  return OpenApiParser.parse(rawContent, options);
}

/**
 * Parses raw OpenAPI specification text (JSON or YAML) synchronously.
 */
export function parseSpecSync(
  rawContent: string,
  options?: ParseOptions
): ParseResult {
  return OpenApiParser.parse(rawContent, options);
}

/**
 * Reads and parses an OpenAPI specification directly from a local file path.
 */
export async function parseSpecFile(
  filePath: string,
  options?: ParseOptions
): Promise<ParseResult> {
  try {
    const content = await readFile(filePath, 'utf-8');
    return OpenApiParser.parse(content, { ...options, sourceFilePath: filePath });
  } catch (err) {
    const parserError: ParserError = {
      code: 'FILE_READ_ERROR',
      message: `Failed to read specification file at "${filePath}": ${
        err instanceof Error ? err.message : String(err)
      }`,
      details: err,
    };
    return {
      success: false,
      error: parserError,
      warnings: [],
    };
  }
}

/**
 * Detects whether content is formatted as JSON or YAML.
 */
export function detectFormat(content: string): 'json' | 'yaml' {
  return OpenApiParser.detectFormat(content);
}

/**
 * Adapts a ParsedOpenAPISpec into the universal HeliosSpec Canonical AST.
 */
export function toCanonicalAst(parsed: ParsedOpenAPISpec): HeliosSpec {
  const result = buildCanonicalAst(parsed);
  if (!result.success) {
    throw new Error(`Failed to convert spec to Canonical AST: ${result.error.message}`);
  }
  return result.data;
}
