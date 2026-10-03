/**
 * @helios/diff-engine
 * Recursive schema comparator with cycle protection, local reference awareness,
 * and direction-sensitive compatibility classification.
 */

import type { CanonicalSchema } from '@helios/canonical-ast';
import type { ApiChange, CompatibilityImpact, SchemaCompareContext } from '../types.js';

let schemaIdCounter = 0;
const schemaObjIds = new WeakMap<CanonicalSchema, number>();

function getSchemaId(schema: CanonicalSchema): string {
  if (schema.id) return schema.id;
  if (schema.rawRef) return schema.rawRef;
  if (schema.title) return schema.title;
  let id = schemaObjIds.get(schema);
  if (id === undefined) {
    id = ++schemaIdCounter;
    schemaObjIds.set(schema, id);
  }
  return `obj#${id}`;
}

function getEffectiveType(schema: CanonicalSchema): string {
  if (Array.isArray(schema.type)) {
    return schema.type.slice().sort().join('|');
  }
  return schema.type || (schema.properties ? 'object' : schema.items ? 'array' : 'unknown');
}

export function compareSchemas(
  oldSchema: CanonicalSchema | undefined,
  newSchema: CanonicalSchema | undefined,
  context: SchemaCompareContext
): ApiChange[] {
  if (!oldSchema && !newSchema) {
    return [];
  }

  const changes: ApiChange[] = [];

  // Schema Added
  if (!oldSchema && newSchema) {
    changes.push({
      id: `schema:${context.location}:SCHEMA_ADDED`,
      kind: 'SCHEMA_ADDED',
      category: 'schema',
      compatibility: 'non_breaking',
      message: `Schema added at ${context.location}`,
      path: context.path,
      method: context.method,
      location: context.location,
      rationale: 'Adding a schema definition provides new structural models.',
      newValue: newSchema,
    });
    return changes;
  }

  // Schema Removed
  if (oldSchema && !newSchema) {
    const impact: CompatibilityImpact =
      context.direction === 'response'
        ? context.config.responsePropertyRemovalImpact
        : 'breaking';
    changes.push({
      id: `schema:${context.location}:SCHEMA_REMOVED`,
      kind: 'SCHEMA_REMOVED',
      category: 'schema',
      compatibility: impact,
      message: `Schema removed at ${context.location}`,
      path: context.path,
      method: context.method,
      location: context.location,
      rationale: 'Removing a schema definition invalidates references expecting this data contract.',
      oldValue: oldSchema,
    });
    return changes;
  }

  // Both exist: check cycle protection
  const oldKey = getSchemaId(oldSchema!);
  const newKey = getSchemaId(newSchema!);
  const pairKey = `${context.direction}:${oldKey}->${newKey}`;

  if (context.visitedPairs.has(pairKey)) {
    return [];
  }
  context.visitedPairs.add(pairKey);

  const oldS = oldSchema!;
  const newS = newSchema!;

  // 1. Type comparison
  const oldType = getEffectiveType(oldS);
  const newType = getEffectiveType(newS);

  if (oldType !== 'unknown' && newType !== 'unknown' && oldType !== newType) {
    const impact: CompatibilityImpact = 'breaking';
    changes.push({
      id: `schema:${context.location}:SCHEMA_TYPE_CHANGED`,
      kind: 'SCHEMA_TYPE_CHANGED',
      category: 'schema',
      compatibility: impact,
      message: `Type changed from "${oldType}" to "${newType}" at ${context.location}`,
      path: context.path,
      method: context.method,
      location: context.location,
      rationale: 'Incompatible data type change breaks serialization and deserialization contracts.',
      oldValue: oldType,
      newValue: newType,
    });
  }

  // 2. Nullable comparison
  if (oldS.nullable !== newS.nullable) {
    let impact: CompatibilityImpact;
    let rationale: string;

    if (context.direction === 'request') {
      if (oldS.nullable && !newS.nullable) {
        impact = 'breaking';
        rationale = 'Input parameter/property no longer accepts null values, breaking clients sending null.';
      } else {
        impact = 'non_breaking';
        rationale = 'Input parameter/property now accepts null values.';
      }
    } else {
      if (!oldS.nullable && newS.nullable) {
        impact = 'potentially_breaking';
        rationale = 'Response can now return null values, potentially causing null-pointer exceptions in strict clients.';
      } else {
        impact = 'non_breaking';
        rationale = 'Response guarantees non-null values.';
      }
    }

    changes.push({
      id: `schema:${context.location}:SCHEMA_NULLABLE_CHANGED`,
      kind: 'SCHEMA_NULLABLE_CHANGED',
      category: 'schema',
      compatibility: impact,
      message: `Nullable changed from ${oldS.nullable} to ${newS.nullable} at ${context.location}`,
      path: context.path,
      method: context.method,
      location: context.location,
      rationale,
      oldValue: oldS.nullable,
      newValue: newS.nullable,
    });
  }

  // 3. Enum comparison
  if (oldS.enum || newS.enum) {
    const oldEnums = new Set((oldS.enum || []).map(String));
    const newEnums = new Set((newS.enum || []).map(String));

    // Enum values added
    const addedEnums = [...newEnums].filter((e) => !oldEnums.has(e));
    if (addedEnums.length > 0) {
      const impact: CompatibilityImpact =
        context.direction === 'response'
          ? context.config.responseEnumAdditionImpact
          : 'non_breaking';
      const rationale =
        context.direction === 'response'
          ? 'Adding new enum variants in responses may break client deserializers that do not recognize the new value.'
          : 'Adding accepted enum variants in requests broadens client options without breaking existing callers.';

      changes.push({
        id: `schema:${context.location}:enum_added:${addedEnums.sort().join(',')}:SCHEMA_ENUM_CHANGED`,
        kind: 'SCHEMA_ENUM_CHANGED',
        category: 'schema',
        compatibility: impact,
        message: `Enum values added at ${context.location}: [${addedEnums.sort().join(', ')}]`,
        path: context.path,
        method: context.method,
        location: context.location,
        rationale,
        oldValue: oldS.enum,
        newValue: newS.enum,
      });
    }

    // Enum values removed
    const removedEnums = [...oldEnums].filter((e) => !newEnums.has(e));
    if (removedEnums.length > 0) {
      const impact: CompatibilityImpact =
        context.direction === 'request' ? 'breaking' : 'non_breaking';
      const rationale =
        context.direction === 'request'
          ? 'Removing accepted enum variants causes requests with previously valid values to be rejected.'
          : 'Removing enum variants from responses reduces variant options but clients still recognize returned values.';

      changes.push({
        id: `schema:${context.location}:enum_removed:${removedEnums.sort().join(',')}:SCHEMA_ENUM_CHANGED`,
        kind: 'SCHEMA_ENUM_CHANGED',
        category: 'schema',
        compatibility: impact,
        message: `Enum values removed at ${context.location}: [${removedEnums.sort().join(', ')}]`,
        path: context.path,
        method: context.method,
        location: context.location,
        rationale,
        oldValue: oldS.enum,
        newValue: newS.enum,
      });
    }
  }

  // 4. Constraint comparison (if enabled)
  if (context.config.strictConstraintChecking) {
    // maxLength
    if (oldS.maxLength !== newS.maxLength) {
      if (oldS.maxLength !== undefined && newS.maxLength !== undefined) {
        if (newS.maxLength < oldS.maxLength) {
          const impact: CompatibilityImpact =
            context.direction === 'request' ? 'breaking' : 'non_breaking';
          changes.push({
            id: `schema:${context.location}:maxLength:SCHEMA_CONSTRAINT_CHANGED`,
            kind: 'SCHEMA_CONSTRAINT_CHANGED',
            category: 'schema',
            compatibility: impact,
            message: `maxLength decreased from ${oldS.maxLength} to ${newS.maxLength} at ${context.location}`,
            path: context.path,
            method: context.method,
            location: context.location,
            rationale: 'Narrowing maximum length constraint causes longer inputs to be rejected.',
            oldValue: oldS.maxLength,
            newValue: newS.maxLength,
          });
        } else if (newS.maxLength > oldS.maxLength) {
          changes.push({
            id: `schema:${context.location}:maxLength:SCHEMA_CONSTRAINT_CHANGED`,
            kind: 'SCHEMA_CONSTRAINT_CHANGED',
            category: 'schema',
            compatibility: 'non_breaking',
            message: `maxLength increased from ${oldS.maxLength} to ${newS.maxLength} at ${context.location}`,
            path: context.path,
            method: context.method,
            location: context.location,
            rationale: 'Widening maximum length constraint accommodates larger inputs without breaking existing inputs.',
            oldValue: oldS.maxLength,
            newValue: newS.maxLength,
          });
        }
      } else if (oldS.maxLength === undefined && newS.maxLength !== undefined) {
        const impact: CompatibilityImpact =
          context.direction === 'request' ? 'breaking' : 'non_breaking';
        changes.push({
          id: `schema:${context.location}:maxLength_added:SCHEMA_CONSTRAINT_CHANGED`,
          kind: 'SCHEMA_CONSTRAINT_CHANGED',
          category: 'schema',
          compatibility: impact,
          message: `maxLength constraint of ${newS.maxLength} added at ${context.location}`,
          path: context.path,
          method: context.method,
          location: context.location,
          rationale: 'Adding a maximum length constraint restricts previously unbounded inputs.',
          newValue: newS.maxLength,
        });
      }
    }

    // maxItems
    if (oldS.maxItems !== newS.maxItems) {
      if (oldS.maxItems !== undefined && newS.maxItems !== undefined) {
        if (newS.maxItems < oldS.maxItems) {
          const impact: CompatibilityImpact =
            context.direction === 'request' ? 'breaking' : 'non_breaking';
          changes.push({
            id: `schema:${context.location}:maxItems:SCHEMA_CONSTRAINT_CHANGED`,
            kind: 'SCHEMA_CONSTRAINT_CHANGED',
            category: 'schema',
            compatibility: impact,
            message: `maxItems decreased from ${oldS.maxItems} to ${newS.maxItems} at ${context.location}`,
            path: context.path,
            method: context.method,
            location: context.location,
            rationale: 'Narrowing maxItems constraint rejects larger arrays.',
            oldValue: oldS.maxItems,
            newValue: newS.maxItems,
          });
        }
      } else if (oldS.maxItems === undefined && newS.maxItems !== undefined) {
        const impact: CompatibilityImpact =
          context.direction === 'request' ? 'breaking' : 'non_breaking';
        changes.push({
          id: `schema:${context.location}:maxItems_added:SCHEMA_CONSTRAINT_CHANGED`,
          kind: 'SCHEMA_CONSTRAINT_CHANGED',
          category: 'schema',
          compatibility: impact,
          message: `maxItems constraint of ${newS.maxItems} added at ${context.location}`,
          path: context.path,
          method: context.method,
          location: context.location,
          rationale: 'Adding maxItems restricts previously unbounded arrays.',
          newValue: newS.maxItems,
        });
      }
    }

    // minimum
    if (oldS.minimum !== newS.minimum) {
      if (oldS.minimum !== undefined && newS.minimum !== undefined && newS.minimum > oldS.minimum) {
        const impact: CompatibilityImpact =
          context.direction === 'request' ? 'breaking' : 'non_breaking';
        changes.push({
          id: `schema:${context.location}:minimum_increased:SCHEMA_CONSTRAINT_CHANGED`,
          kind: 'SCHEMA_CONSTRAINT_CHANGED',
          category: 'schema',
          compatibility: impact,
          message: `minimum increased from ${oldS.minimum} to ${newS.minimum} at ${context.location}`,
          path: context.path,
          method: context.method,
          location: context.location,
          rationale: 'Increasing minimum numerical bound restricts input range.',
          oldValue: oldS.minimum,
          newValue: newS.minimum,
        });
      }
    }

    // maximum
    if (oldS.maximum !== newS.maximum) {
      if (oldS.maximum !== undefined && newS.maximum !== undefined && newS.maximum < oldS.maximum) {
        const impact: CompatibilityImpact =
          context.direction === 'request' ? 'breaking' : 'non_breaking';
        changes.push({
          id: `schema:${context.location}:maximum_decreased:SCHEMA_CONSTRAINT_CHANGED`,
          kind: 'SCHEMA_CONSTRAINT_CHANGED',
          category: 'schema',
          compatibility: impact,
          message: `maximum decreased from ${oldS.maximum} to ${newS.maximum} at ${context.location}`,
          path: context.path,
          method: context.method,
          location: context.location,
          rationale: 'Decreasing maximum numerical bound restricts input range.',
          oldValue: oldS.maximum,
          newValue: newS.maximum,
        });
      }
    }
  }

  // 5. Properties comparison (for objects)
  const oldProps = oldS.properties || {};
  const newProps = newS.properties || {};

  const oldPropKeys = Object.keys(oldProps).sort();
  const newPropKeys = Object.keys(newProps).sort();

  const oldRequired = new Set(oldS.requiredProperties || []);
  const newRequired = new Set(newS.requiredProperties || []);

  // Added properties
  for (const propName of newPropKeys) {
    if (!(propName in oldProps)) {
      const prop = newProps[propName];
      if (!prop) continue;

      const isRequired = newRequired.has(propName) || prop.required;

      let impact: CompatibilityImpact;
      let rationale: string;

      if (context.direction === 'request') {
        if (isRequired) {
          impact = 'breaking';
          rationale = 'Adding a required property to a request body requires all existing clients to update their payload.';
        } else {
          impact = 'non_breaking';
          rationale = 'Adding an optional property to a request body is backward-compatible.';
        }
      } else {
        if (isRequired) {
          impact = 'potentially_breaking';
          rationale = 'Adding a required response field may impact clients with strict payload validation.';
        } else {
          impact = 'non_breaking';
          rationale = 'Adding an optional property to a response is backward-compatible for clients ignoring unknown properties.';
        }
      }

      changes.push({
        id: `schema:${context.location}.${propName}:SCHEMA_PROPERTY_ADDED`,
        kind: 'SCHEMA_PROPERTY_ADDED',
        category: 'schema',
        compatibility: impact,
        message: `Property "${propName}" added at ${context.location} (required: ${isRequired})`,
        path: context.path,
        method: context.method,
        location: `${context.location}.${propName}`,
        rationale,
        newValue: prop,
      });
    }
  }

  // Removed properties
  for (const propName of oldPropKeys) {
    if (!(propName in newProps)) {
      const prop = oldProps[propName];
      if (!prop) continue;

      let impact: CompatibilityImpact;
      let rationale: string;

      if (context.direction === 'response') {
        impact = context.config.responsePropertyRemovalImpact;
        rationale = 'Removing a property from a response breaks client consumers expecting that field.';
      } else {
        impact = 'breaking';
        rationale = 'Removing a property from a request schema means the server no longer accepts or processes this property.';
      }

      changes.push({
        id: `schema:${context.location}.${propName}:SCHEMA_PROPERTY_REMOVED`,
        kind: 'SCHEMA_PROPERTY_REMOVED',
        category: 'schema',
        compatibility: impact,
        message: `Property "${propName}" removed at ${context.location}`,
        path: context.path,
        method: context.method,
        location: `${context.location}.${propName}`,
        rationale,
        oldValue: prop,
      });
    }
  }

  // Common properties: check required toggle and recurse
  for (const propName of oldPropKeys) {
    if (propName in newProps) {
      const oldProp = oldProps[propName];
      const newProp = newProps[propName];
      if (!oldProp || !newProp) continue;

      const oldIsReq = oldRequired.has(propName) || oldProp.required;
      const newIsReq = newRequired.has(propName) || newProp.required;

      if (oldIsReq !== newIsReq) {
        let impact: CompatibilityImpact;
        let rationale: string;

        if (context.direction === 'request') {
          if (!oldIsReq && newIsReq) {
            impact = 'breaking';
            rationale = 'Making an optional request property required breaks existing clients that omit it.';
          } else {
            impact = 'non_breaking';
            rationale = 'Relaxing a required request property to optional is backward-compatible.';
          }
        } else {
          if (!oldIsReq && newIsReq) {
            impact = 'potentially_breaking';
            rationale = 'Guaranteeing a response property now as required may impact strict client decoders.';
          } else {
            impact = 'potentially_breaking';
            rationale = 'Making a response property optional means clients cannot unconditionally rely on its presence.';
          }
        }

        changes.push({
          id: `schema:${context.location}.${propName}:SCHEMA_PROPERTY_REQUIRED_CHANGED`,
          kind: 'SCHEMA_PROPERTY_REQUIRED_CHANGED',
          category: 'schema',
          compatibility: impact,
          message: `Property "${propName}" required status changed from ${oldIsReq} to ${newIsReq} at ${context.location}`,
          path: context.path,
          method: context.method,
          location: `${context.location}.${propName}`,
          rationale,
          oldValue: oldIsReq,
          newValue: newIsReq,
        });
      }

      // Recurse on property schema
      const subContext: SchemaCompareContext = {
        ...context,
        location: `${context.location}.${propName}`,
      };
      changes.push(...compareSchemas(oldProp.schema, newProp.schema, subContext));
    }
  }

  // 6. Items comparison (for arrays)
  if (oldS.items || newS.items) {
    const subContext: SchemaCompareContext = {
      ...context,
      location: `${context.location}[]`,
    };
    changes.push(...compareSchemas(oldS.items, newS.items, subContext));
  }

  return changes;
}
