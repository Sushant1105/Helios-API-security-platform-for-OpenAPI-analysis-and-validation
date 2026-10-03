/**
 * @helios/sdk-generator
 * Python Client SDK Generator.
 * Generates an end-to-end, typed, dependency-free client SDK package using standard library.
 */

import type {
  CanonicalApiAst,
  CanonicalEndpoint,
  CanonicalProperty,
  CanonicalSchema,
} from '@helios/canonical-ast';
import {
  generateMethodName,
  sanitizePyIdentifier,
  toPascalCase,
  toSnakeCase,
  UniqueNameRegistry,
} from '../naming.js';
import type { GeneratedFile, GeneratedSdk, GeneratorOptions, GenerationWarning } from '../types.js';

function resolvePySchemaTypeName(
  schema: CanonicalSchema | undefined,
  fallbackName: string,
  declaredModels: Map<string, string>,
  enumRegistry: Map<string, string>
): string {
  if (!schema) return 'Any';

  if (schema.rawRef) {
    const parts = schema.rawRef.split('/');
    const rawTarget = parts[parts.length - 1] || 'Model';
    return toPascalCase(rawTarget);
  }

  if (schema.id) {
    return toPascalCase(schema.id);
  }

  // Handle enums
  if (schema.enum && schema.enum.length > 0) {
    const enumName = toPascalCase(fallbackName);
    if (!enumRegistry.has(enumName)) {
      generatePyEnum(enumName, schema.enum, enumRegistry);
    }
    return schema.nullable ? `Optional[${enumName}]` : enumName;
  }

  // Handle primitives
  const rawType = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  switch (rawType) {
    case 'string':
      return schema.nullable ? 'Optional[str]' : 'str';
    case 'integer':
      return schema.nullable ? 'Optional[int]' : 'int';
    case 'number':
      return schema.nullable ? 'Optional[float]' : 'float';
    case 'boolean':
      return schema.nullable ? 'Optional[bool]' : 'bool';
    case 'array': {
      const itemType = schema.items
        ? resolvePySchemaTypeName(schema.items, `${fallbackName}Item`, declaredModels, enumRegistry)
        : 'Any';
      return schema.nullable ? `Optional[List[${itemType}]]` : `List[${itemType}]`;
    }
    case 'object': {
      if (schema.properties && Object.keys(schema.properties).length > 0) {
        const modelName = toPascalCase(fallbackName);
        if (!declaredModels.has(modelName)) {
          generatePyModelClass(modelName, schema, declaredModels, enumRegistry);
        }
        return schema.nullable ? `Optional[${modelName}]` : modelName;
      }
      return schema.nullable ? 'Optional[Dict[str, Any]]' : 'Dict[str, Any]';
    }
    default:
      if (schema.oneOf && schema.oneOf.length > 0) {
        const unionTypes = schema.oneOf
          .map((sub, i) => resolvePySchemaTypeName(sub, `${fallbackName}Variant${i}`, declaredModels, enumRegistry))
          .join(', ');
        return schema.nullable ? `Optional[Union[${unionTypes}]]` : `Union[${unionTypes}]`;
      }
      return 'Any';
  }
}

function generatePyEnum(
  enumName: string,
  variants: unknown[],
  enumRegistry: Map<string, string>
): void {
  const lines: string[] = [];
  lines.push(`class ${enumName}(str, Enum):`);
  for (const v of variants) {
    const strVal = String(v);
    const key = sanitizePyIdentifier(toSnakeCase(strVal)).toUpperCase();
    lines.push(`    ${key} = ${JSON.stringify(strVal)}`);
  }
  enumRegistry.set(enumName, lines.join('\n'));
}

function generatePyModelClass(
  modelName: string,
  schema: CanonicalSchema,
  declaredModels: Map<string, string>,
  enumRegistry: Map<string, string>
): void {
  const lines: string[] = [];
  lines.push('@dataclass');
  lines.push(`class ${modelName}:`);
  if (schema.description) {
    lines.push(`    """${schema.description.trim()}"""`);
  }

  const props = schema.properties || {};
  const propKeys = Object.keys(props).sort();
  const requiredProps = new Set(schema.requiredProperties || []);

  // In Python dataclasses, required fields must precede optional fields (fields with default values)
  const requiredEntries: { key: string; prop: CanonicalProperty; pyName: string; pyType: string }[] = [];
  const optionalEntries: { key: string; prop: CanonicalProperty; pyName: string; pyType: string }[] = [];

  for (const key of propKeys) {
    const prop = props[key];
    if (!prop) continue;
    const isRequired = requiredProps.has(key) || prop.required;
    const pyName = sanitizePyIdentifier(key);
    const pyType = resolvePySchemaTypeName(
      prop.schema,
      `${modelName}${toPascalCase(key)}`,
      declaredModels,
      enumRegistry
    );

    if (isRequired) {
      requiredEntries.push({ key, prop, pyName, pyType });
    } else {
      optionalEntries.push({ key, prop, pyName, pyType });
    }
  }

  if (requiredEntries.length === 0 && optionalEntries.length === 0) {
    lines.push('    pass');
  } else {
    for (const item of requiredEntries) {
      lines.push(`    ${item.pyName}: ${item.pyType}`);
    }
    for (const item of optionalEntries) {
      const typeStr = item.pyType.startsWith('Optional[') ? item.pyType : `Optional[${item.pyType}]`;
      lines.push(`    ${item.pyName}: ${typeStr} = None`);
    }
  }

  declaredModels.set(modelName, lines.join('\n'));
}

export function generatePythonSdk(
  ast: CanonicalApiAst,
  options: Required<GeneratorOptions>
): GeneratedSdk {
  const warnings: GenerationWarning[] = [];
  const files: GeneratedFile[] = [];

  const pkgName = sanitizePyIdentifier(toSnakeCase(options.packageName));
  const clientClassName = options.clientClassName || 'ApiClient';
  const defaultBaseUrl =
    options.baseUrl ||
    (ast.servers && ast.servers.length > 0 && ast.servers[0]?.url ? ast.servers[0].url : 'https://api.example.com');

  const declaredModels = new Map<string, string>();
  const enumRegistry = new Map<string, string>();

  // 1. Process component schemas
  const componentSchemaNames = Object.keys(ast.schemas || {}).sort();
  for (const name of componentSchemaNames) {
    const schema = ast.schemas[name];
    if (schema) {
      const modelName = toPascalCase(name);
      generatePyModelClass(modelName, schema, declaredModels, enumRegistry);
    }
  }

  // 2. Endpoints
  interface PyEndpointMeta {
    endpoint: CanonicalEndpoint;
    methodName: string;
    params: { name: string; pyName: string; type: string; required: boolean; in: string }[];
    bodyType?: string;
    returnType: string;
    hasBody: boolean;
  }

  const endpointMetas: PyEndpointMeta[] = [];
  const methodNameRegistry = new UniqueNameRegistry();

  const sortedEndpoints = ast.endpoints.slice().sort((a, b) => {
    const pathCmp = a.path.localeCompare(b.path);
    if (pathCmp !== 0) return pathCmp;
    return a.method.localeCompare(b.method);
  });

  for (const ep of sortedEndpoints) {
    const baseMethodName = generateMethodName(ep.method, ep.path, ep.operationId, 'python');
    const methodName = methodNameRegistry.getUniqueName(baseMethodName);
    const opPrefix = toPascalCase(methodName);

    // Parameters
    const params: { name: string; pyName: string; type: string; required: boolean; in: string }[] = [];
    for (const p of ep.parameters || []) {
      const pyName = sanitizePyIdentifier(p.name);
      const typeStr = resolvePySchemaTypeName(
        p.schema,
        `${opPrefix}${toPascalCase(p.name)}`,
        declaredModels,
        enumRegistry
      );
      params.push({
        name: p.name,
        pyName,
        type: typeStr,
        required: p.required,
        in: p.in,
      });
    }

    // Sort params: required first, optional second
    params.sort((a, b) => {
      if (a.required === b.required) return a.name.localeCompare(b.name);
      return a.required ? -1 : 1;
    });

    // Body
    let bodyType: string | undefined;
    const hasBody = !!ep.requestBody && !!ep.requestBody.content;
    if (hasBody) {
      const jsonContent = ep.requestBody!.content['application/json'];
      if (jsonContent?.schema) {
        bodyType = resolvePySchemaTypeName(
          jsonContent.schema,
          `${opPrefix}RequestBody`,
          declaredModels,
          enumRegistry
        );
      } else {
        bodyType = 'Any';
      }
    }

    // Return type
    let returnType = 'None';
    const successResp =
      ep.responses['200'] || ep.responses['201'] || ep.responses['202'] || ep.responses['default'];
    if (successResp?.content?.['application/json']?.schema) {
      returnType = resolvePySchemaTypeName(
        successResp.content['application/json'].schema,
        `${opPrefix}Response`,
        declaredModels,
        enumRegistry
      );
    }

    endpointMetas.push({
      endpoint: ep,
      methodName,
      params,
      bodyType,
      returnType,
      hasBody,
    });
  }

  // --- FILE: pkg/models.py ---
  const modelsLines: string[] = [
    '"""Auto-generated by HELIOS Polyglot SDK Generator.',
    'Specification Models and Enums.',
    '"""',
    'from __future__ import annotations',
    'from dataclasses import dataclass',
    'from enum import Enum',
    'from typing import Optional, List, Dict, Any, Union',
    '',
  ];

  for (const enumCode of Array.from(enumRegistry.values()).sort()) {
    modelsLines.push(enumCode);
    modelsLines.push('');
  }

  for (const modelCode of Array.from(declaredModels.values()).sort()) {
    modelsLines.push(modelCode);
    modelsLines.push('');
  }

  files.push({
    path: `${pkgName}/models.py`,
    content: modelsLines.join('\n').trim() + '\n',
  });

  // --- FILE: pkg/errors.py ---
  const errorsContent = `"""Auto-generated by HELIOS Polyglot SDK Generator.
Typed SDK Exception Hierarchy.
"""
from typing import Optional, Any


class ApiException(Exception):
    def __init__(self, message: str, status_code: Optional[int] = None, response_body: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.response_body = response_body


class ApiHttpError(ApiException):
    pass


class ApiValidationError(ApiException):
    pass
`;
  files.push({
    path: `${pkgName}/errors.py`,
    content: errorsContent,
  });

  // --- FILE: pkg/client.py ---
  const clientLines: string[] = [
    '"""Auto-generated by HELIOS Polyglot SDK Generator.',
    'Primary API Client Implementation.',
    '"""',
    'from __future__ import annotations',
    'import json',
    'import base64',
    'import urllib.request',
    'import urllib.parse',
    'import urllib.error',
    'from dataclasses import dataclass',
    'from typing import Optional, Dict, Any, Union, List, Tuple',
    `from .errors import ApiException, ApiHttpError, ApiValidationError`,
    `from .models import *`,
    '',
    '@dataclass',
    'class ClientAuthConfig:',
    '    api_key: Optional[str] = None',
    '    api_key_header: str = "X-API-Key"',
    '    bearer_token: Optional[str] = None',
    '    basic_auth: Optional[Tuple[str, str]] = None',
    '',
    '@dataclass',
    'class ClientOptions:',
    `    base_url: str = "${defaultBaseUrl}"`,
    '    headers: Optional[Dict[str, str]] = None',
    '    auth: Optional[ClientAuthConfig] = None',
    '',
    `class ${clientClassName}:`,
    '    def __init__(self, options: Optional[ClientOptions] = None):',
    '        opts = options or ClientOptions()',
    '        self.base_url = opts.base_url.rstrip("/")',
    '        self.headers = dict(opts.headers or {})',
    '        self.auth = opts.auth',
    '',
    '    def _build_headers(self, custom: Optional[Dict[str, str]] = None) -> Dict[str, str]:',
    '        headers = dict(self.headers)',
    '        if custom:',
    '            headers.update(custom)',
    '        if self.auth:',
    '            if self.auth.bearer_token:',
    '                headers["Authorization"] = f"Bearer {self.auth.bearer_token}"',
    '            elif self.auth.basic_auth:',
    '                user, pw = self.auth.basic_auth',
    '                enc = base64.b64encode(f"{user}:{pw}".encode()).decode()',
    '                headers["Authorization"] = f"Basic {enc}"',
    '            elif self.auth.api_key:',
    '                headers[self.auth.api_key_header] = self.auth.api_key',
    '        return headers',
  ];

  for (const meta of endpointMetas) {
    const { endpoint, methodName, params, bodyType, returnType, hasBody } = meta;
    clientLines.push('');

    // Method arguments: self, required params, body, optional params
    const sigArgs: string[] = ['self'];
    for (const p of params.filter((x) => x.required)) {
      sigArgs.push(`${p.pyName}: ${p.type}`);
    }
    if (hasBody && bodyType) {
      sigArgs.push(`body: ${bodyType}`);
    }
    for (const p of params.filter((x) => !x.required)) {
      const typeStr = p.type.startsWith('Optional[') ? p.type : `Optional[${p.type}]`;
      sigArgs.push(`${p.pyName}: ${typeStr} = None`);
    }

    clientLines.push(`    def ${methodName}(${sigArgs.join(', ')}) -> ${returnType}:`);
    if (endpoint.summary || endpoint.description) {
      clientLines.push(`        """${(endpoint.summary || endpoint.description || '').trim()}"""`);
    }

    // Path params
    clientLines.push(`        url_path = "${endpoint.path}"`);
    const pathParams = params.filter((p) => p.in === 'path');
    for (const p of pathParams) {
      clientLines.push(`        url_path = url_path.replace("{${p.name}}", urllib.parse.quote(str(${p.pyName})))`);
    }

    // Query params
    const queryParams = params.filter((p) => p.in === 'query');
    if (queryParams.length > 0) {
      clientLines.push('        query_dict = {}');
      for (const qp of queryParams) {
        clientLines.push(`        if ${qp.pyName} is not None:`);
        clientLines.push(`            query_dict["${qp.name}"] = str(${qp.pyName})`);
      }
      clientLines.push('        query_str = urllib.parse.urlencode(query_dict)');
      clientLines.push('        full_url = f"{self.base_url}{url_path}{"?" + query_str if query_str else ""}"');
    } else {
      clientLines.push('        full_url = f"{self.base_url}{url_path}"');
    }

    // Headers
    const headerParams = params.filter((p) => p.in === 'header');
    clientLines.push('        custom_headers = {}');
    if (hasBody) {
      clientLines.push('        custom_headers["Content-Type"] = "application/json"');
    }
    for (const hp of headerParams) {
      clientLines.push(`        if ${hp.pyName} is not None:`);
      clientLines.push(`            custom_headers["${hp.name}"] = str(${hp.pyName})`);
    }
    clientLines.push('        headers = self._build_headers(custom_headers)');

    // Data payload
    if (hasBody) {
      clientLines.push('        payload = json.dumps(body.__dict__ if hasattr(body, "__dict__") else body).encode("utf-8")');
    } else {
      clientLines.push('        payload = None');
    }

    // Request
    clientLines.push(`        req = urllib.request.Request(full_url, data=payload, headers=headers, method="${endpoint.method.toUpperCase()}")`);
    clientLines.push('        try:');
    clientLines.push('            with urllib.request.urlopen(req) as resp:');
    if (returnType === 'None') {
      clientLines.push('                return None');
    } else {
      clientLines.push('                resp_data = resp.read().decode("utf-8")');
      clientLines.push('                return json.loads(resp_data) if resp_data else None');
    }
    clientLines.push('        except urllib.error.HTTPError as err:');
    clientLines.push('            err_body = err.read().decode("utf-8")');
    clientLines.push('            raise ApiHttpError(err.code, err_body)');

  }

  files.push({
    path: `${pkgName}/client.py`,
    content: clientLines.join('\n').trim() + '\n',
  });

  // --- FILE: pkg/__init__.py ---
  const initContent = `"""Auto-generated by HELIOS Polyglot SDK Generator."""
from .client import ${clientClassName}, ClientOptions, ClientAuthConfig
from .errors import ApiException, ApiHttpError, ApiValidationError

__all__ = ["${clientClassName}", "ClientOptions", "ClientAuthConfig", "ApiException", "ApiHttpError", "ApiValidationError"]
`;
  files.push({
    path: `${pkgName}/__init__.py`,
    content: initContent,
  });

  // --- FILE: pyproject.toml ---
  const pyprojectContent = `[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"

[project]
name = "${options.packageName}"
version = "${options.packageVersion || '1.0.0'}"
description = "${options.packageDescription || `${ast.title || 'API'} Client SDK for Python`}"
readme = "README.md"
requires-python = ">=3.10"
license = {text = "${options.license || 'Apache-2.0'}"}

[project.optional-dependencies]
dev = ["pytest>=7.0.0"]
`;
  files.push({
    path: 'pyproject.toml',
    content: pyprojectContent,
  });

  // --- FILE: README.md ---
  const readmeContent = `# ${options.packageName}

Auto-generated Python client SDK for **${ast.title || 'API'}** (v${ast.version || '1.0.0'}).

## Installation

\`\`\`bash
pip install ${options.packageName}
\`\`\`

## Quickstart

\`\`\`python
from ${pkgName} import ${clientClassName}, ClientOptions, ClientAuthConfig

options = ClientOptions(
    base_url="${defaultBaseUrl}",
    auth=ClientAuthConfig(bearer_token="your-token-here"),
)
client = ${clientClassName}(options)
\`\`\`
`;
  files.push({
    path: 'README.md',
    content: readmeContent,
  });

  // Ensure deterministic file order
  files.sort((a, b) => a.path.localeCompare(b.path));

  return {
    target: 'python',
    packageName: options.packageName,
    packageVersion: options.packageVersion || '1.0.0',
    files,
    warnings,
    stats: {
      totalFiles: files.length,
      totalEndpointsCovered: sortedEndpoints.length,
      totalModelsGenerated: declaredModels.size + enumRegistry.size,
    },
  };
}
