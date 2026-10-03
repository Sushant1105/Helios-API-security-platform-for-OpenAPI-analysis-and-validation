/**
 * @helios/spec-parser
 * Local JSON Pointer reference resolver (#/components/schemas/...) with
 * cycle detection, RFC 6901 token decoding, and external reference guardrails.
 */

import type { ParserError, ParserWarning } from './types.js';

export interface ResolveResult<T = unknown> {
  success: boolean;
  value?: T;
  error?: ParserError;
  warning?: ParserWarning;
}

export class LocalRefResolver {
  private readonly rootDoc: Record<string, unknown>;
  private readonly resolvedCache = new Map<string, unknown>();
  private readonly activePointers = new Set<string>();

  constructor(rootDoc: Record<string, unknown>) {
    this.rootDoc = rootDoc;
  }

  /**
   * Safely decodes RFC 6901 JSON pointer tokens (~1 to /, ~0 to ~)
   */
  public static decodePointerToken(token: string): string {
    return token.replace(/~1/g, '/').replace(/~0/g, '~');
  }

  /**
   * Evaluates if a given object is a reference object containing `$ref`.
   */
  public static isRefNode(node: unknown): node is { $ref: string; [key: string]: unknown } {
    return (
      typeof node === 'object' &&
      node !== null &&
      '$ref' in node &&
      typeof (node as { $ref: unknown }).$ref === 'string'
    );
  }

  /**
   * Resolves a local $ref string against the root document.
   */
  public resolvePointer<T = unknown>(pointer: string): ResolveResult<T> {
    // 1. Guard against external or arbitrary network references
    if (!pointer.startsWith('#/')) {
      return {
        success: false,
        error: {
          code: 'REFERENCE_RESOLUTION_ERROR',
          message: `Unsupported external reference: "${pointer}". Only local document references starting with "#/" are permitted.`,
          path: [pointer],
        },
      };
    }

    // 2. Cycle detection guard
    if (this.activePointers.has(pointer)) {
      return {
        success: true,
        value: {
          rawRef: pointer,
          isCircular: true,
          description: `Circular reference to ${pointer}`,
        } as unknown as T,
      };
    }

    // 3. Cache lookup
    if (this.resolvedCache.has(pointer)) {
      return {
        success: true,
        value: this.resolvedCache.get(pointer) as T,
      };
    }

    this.activePointers.add(pointer);

    try {
      // 4. Split and decode pointer segments
      const rawPath = pointer.slice(2); // strip leading "#/"
      const segments = rawPath.split('/').map(LocalRefResolver.decodePointerToken);

      let current: unknown = this.rootDoc;

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i]!;
        if (typeof current !== 'object' || current === null) {
          return {
            success: false,
            error: {
              code: 'REFERENCE_RESOLUTION_ERROR',
              message: `Cannot resolve reference "${pointer}": segment "${seg}" cannot be accessed on a primitive or null value.`,
              path: segments.slice(0, i + 1),
            },
          };
        }

        const obj = current as Record<string, unknown>;
        if (!(seg in obj)) {
          return {
            success: false,
            error: {
              code: 'REFERENCE_RESOLUTION_ERROR',
              message: `Cannot resolve reference "${pointer}": segment "${seg}" does not exist in target object.`,
              path: segments.slice(0, i + 1),
            },
          };
        }

        current = obj[seg];
      }

      // If the target is itself another $ref, recursively resolve it
      if (LocalRefResolver.isRefNode(current)) {
        const chainedResult = this.resolvePointer(current.$ref);
        if (!chainedResult.success) {
          return chainedResult as ResolveResult<T>;
        }
        current = chainedResult.value;
      }

      this.resolvedCache.set(pointer, current);

      return {
        success: true,
        value: current as T,
      };
    } finally {
      this.activePointers.delete(pointer);
    }
  }

  /**
   * Recursively deep-resolves all local references in a data structure,
   * returning a cloned object with resolved references while protecting against cycles.
   */
  public deepResolve<T = unknown>(node: unknown, depth = 0, maxDepth = 64): ResolveResult<T> {
    if (depth > maxDepth) {
      return {
        success: false,
        error: {
          code: 'REFERENCE_RESOLUTION_ERROR',
          message: `Maximum reference resolution depth (${maxDepth}) exceeded. Check for deep or circular object structures.`,
        },
      };
    }

    if (node === null || typeof node !== 'object') {
      return { success: true, value: node as T };
    }

    if (LocalRefResolver.isRefNode(node)) {
      const resolved = this.resolvePointer(node.$ref);
      if (!resolved.success) {
        return resolved as ResolveResult<T>;
      }

      const resolvedObj = resolved.value;

      // In OpenAPI 3.1, sibling fields alongside $ref can override or extend
      if (typeof resolvedObj === 'object' && resolvedObj !== null && !Array.isArray(resolvedObj)) {
        const { $ref, ...siblings } = node;
        const merged = { ...(resolvedObj as Record<string, unknown>), ...siblings, rawRef: $ref };
        return this.deepResolve<T>(merged, depth + 1, maxDepth);
      }

      return this.deepResolve<T>(resolvedObj, depth + 1, maxDepth);
    }

    if (Array.isArray(node)) {
      const resolvedArray: unknown[] = [];
      for (const item of node) {
        const itemRes = this.deepResolve(item, depth + 1, maxDepth);
        if (!itemRes.success) {
          return itemRes as ResolveResult<T>;
        }
        resolvedArray.push(itemRes.value);
      }
      return { success: true, value: resolvedArray as T };
    }

    const resolvedRecord: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(node as Record<string, unknown>)) {
      const fieldRes = this.deepResolve(val, depth + 1, maxDepth);
      if (!fieldRes.success) {
        return fieldRes as ResolveResult<T>;
      }
      resolvedRecord[key] = fieldRes.value;
    }

    return { success: true, value: resolvedRecord as T };
  }
}
