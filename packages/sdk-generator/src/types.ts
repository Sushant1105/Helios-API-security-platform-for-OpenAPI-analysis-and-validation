/**
 * @helios/sdk-generator
 * Strongly-typed domain models for the Polyglot Client SDK Generator.
 */

import type { CanonicalApiAst } from '@helios/canonical-ast';

export type GeneratorTarget = 'typescript' | 'python';

// Backward compatibility alias
export type SdkTargetLanguage = GeneratorTarget;

export interface GeneratorOptions {
  target: GeneratorTarget;
  packageName: string;
  packageVersion?: string;
  packageDescription?: string;
  baseUrl?: string;
  author?: string;
  license?: string;
  includeDocumentation?: boolean;
  clientClassName?: string;
}

// Backward compatibility alias
export type SdkGeneratorOptions = GeneratorOptions;

export interface GeneratedFile {
  path: string; // Relative path inside the package, e.g. "src/client.ts" or "pyproject.toml"
  content: string;
  isExecutable?: boolean;
}

export interface GenerationWarning {
  code: string;
  message: string;
  location?: string;
}

export class GenerationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'GenerationError';
  }
}

export interface GeneratedSdk {
  target: GeneratorTarget;
  packageName: string;
  packageVersion: string;
  files: GeneratedFile[];
  warnings: GenerationWarning[];
  stats: {
    totalFiles: number;
    totalEndpointsCovered: number;
    totalModelsGenerated: number;
  };
}

// Backward compatibility alias
export type SdkGenerationResult = GeneratedSdk;

export interface LanguageGenerator {
  readonly target: GeneratorTarget;
  generate(ast: CanonicalApiAst, options: Required<GeneratorOptions>): GeneratedSdk;
}
