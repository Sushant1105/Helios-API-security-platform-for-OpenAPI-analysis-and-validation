/**
 * @helios/sdk-generator
 * Core SDK Generator Dispatcher.
 * Coordinates language targets, options validation, and deterministic outputs.
 */

import type { CanonicalApiAst } from '@helios/canonical-ast';
import { generatePythonSdk } from './generators/python.js';
import { generateTypeScriptSdk } from './generators/typescript.js';
import {
  GeneratedSdk,
  GenerationError,
  GeneratorOptions,
  GeneratorTarget,
  LanguageGenerator,
} from './types.js';

export class SdkGenerator {
  private readonly generators = new Map<GeneratorTarget, LanguageGenerator>();

  constructor() {
    // Register default built-in language generators
    this.registerGenerator({
      target: 'typescript',
      generate: (ast, options) => generateTypeScriptSdk(ast, options),
    });
    this.registerGenerator({
      target: 'python',
      generate: (ast, options) => generatePythonSdk(ast, options),
    });
  }

  public registerGenerator(generator: LanguageGenerator): void {
    this.generators.set(generator.target, generator);
  }

  public generate(ast: CanonicalApiAst, options: GeneratorOptions): GeneratedSdk {
    if (!options.target) {
      throw new GenerationError('Missing target language for SDK generation.', 'INVALID_TARGET');
    }

    if (!options.packageName || options.packageName.trim().length === 0) {
      throw new GenerationError('Missing packageName for SDK generation.', 'INVALID_PACKAGE_NAME');
    }

    const generator = this.generators.get(options.target);
    if (!generator) {
      throw new GenerationError(
        `Unsupported SDK target language: "${options.target}". Currently supported: ${Array.from(this.generators.keys()).join(', ')}`,
        'UNSUPPORTED_TARGET'
      );
    }

    const resolvedOptions: Required<GeneratorOptions> = {
      target: options.target,
      packageName: options.packageName.trim(),
      packageVersion: options.packageVersion || '1.0.0',
      packageDescription: options.packageDescription || `${ast.title || 'API'} Client SDK`,
      baseUrl:
        options.baseUrl ||
        (ast.servers && ast.servers.length > 0 && ast.servers[0]?.url
          ? ast.servers[0].url
          : 'https://api.example.com'),
      author: options.author || 'HELIOS Auto-generator',
      license: options.license || 'Apache-2.0',
      includeDocumentation: options.includeDocumentation ?? true,
      clientClassName: options.clientClassName || 'ApiClient',
    };

    const sdk = generator.generate(ast, resolvedOptions);

    // Enforce 100% deterministic file sorting
    sdk.files.sort((a, b) => a.path.localeCompare(b.path));

    return sdk;
  }
}

export function generateSdk(ast: CanonicalApiAst, options: GeneratorOptions): GeneratedSdk {
  const engine = new SdkGenerator();
  return engine.generate(ast, options);
}
