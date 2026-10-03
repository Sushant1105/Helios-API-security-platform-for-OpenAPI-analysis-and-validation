/**
 * @helios/sdk-generator
 * Deterministic identifier normalization, casing conversions,
 * reserved keyword sanitization, and collision prevention.
 */

const TS_RESERVED_KEYWORDS = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
  'delete', 'do', 'else', 'enum', 'export', 'extends', 'false', 'finally', 'for',
  'from', 'function', 'if', 'import', 'in', 'instanceof', 'new', 'null', 'return', 'super',
  'switch', 'this', 'throw', 'true', 'try', 'typeof', 'var', 'void', 'while', 'with',
  'yield', 'let', 'static', 'implements', 'interface', 'package', 'private',
  'protected', 'public', 'type', 'as', 'of',
]);

const PYTHON_RESERVED_KEYWORDS = new Set([
  'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break',
  'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally',
  'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal',
  'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
]);

export function splitWords(str: string): string[] {
  return str
    .replace(/[^a-zA-Z0-9_-]/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[\s_-]+/)
    .filter((w) => w.length > 0);
}

export function toPascalCase(str: string): string {
  const words = splitWords(str);
  if (words.length === 0) return 'AnonymousModel';
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

export function toCamelCase(str: string): string {
  const words = splitWords(str);
  if (words.length === 0) return 'anonymousParam';
  return words
    .map((w, index) =>
      index === 0
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    )
    .join('');
}

export function toSnakeCase(str: string): string {
  const words = splitWords(str);
  if (words.length === 0) return 'anonymous_item';
  return words.map((w) => w.toLowerCase()).join('_');
}

export function sanitizeTsIdentifier(name: string): string {
  let sanitized = name.replace(/[^a-zA-Z0-9_$]/g, '_');
  if (/^[0-9]/.test(sanitized)) {
    sanitized = `_${sanitized}`;
  }
  if (TS_RESERVED_KEYWORDS.has(sanitized)) {
    return `${sanitized}Param`;
  }
  return sanitized;
}

export function sanitizePyIdentifier(name: string): string {
  let sanitized = toSnakeCase(name);
  if (/^[0-9]/.test(sanitized)) {
    sanitized = `_${sanitized}`;
  }
  if (PYTHON_RESERVED_KEYWORDS.has(sanitized)) {
    return `${sanitized}_`;
  }
  return sanitized;
}

export function generateMethodName(
  method: string,
  path: string,
  operationId: string | undefined,
  target: 'typescript' | 'python'
): string {
  let rawName: string;
  if (operationId && operationId.trim().length > 0) {
    rawName = operationId.trim();
  } else {
    // Generate from method and path
    // e.g. "get /users/{id}" -> "get_users_by_id" or "getUsersById"
    const cleanedPath = path
      .replace(/{([^}]+)}/g, 'by_$1')
      .replace(/[^a-zA-Z0-9_]/g, '_');
    rawName = `${method}_${cleanedPath}`;
  }

  if (target === 'typescript') {
    return sanitizeTsIdentifier(toCamelCase(rawName));
  }
  return sanitizePyIdentifier(toSnakeCase(rawName));
}

export class UniqueNameRegistry {
  private readonly used = new Map<string, number>();

  public getUniqueName(desired: string): string {
    const count = this.used.get(desired) || 0;
    this.used.set(desired, count + 1);
    if (count === 0) {
      return desired;
    }
    return `${desired}_${count + 1}`;
  }

  public reset(): void {
    this.used.clear();
  }
}
