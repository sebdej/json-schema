/*
 * Copyright 2021 Sébastian Dejonghe
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  ResolvedJsonSchema,
  RootSchema,
  RawJsonSchema,
  FALSE_SCHEMA,
  TRUE_SCHEMA,
  RawObjectJsonSchema,
  CombinedSchema,
  NumberSchema,
  StringSchema,
  ArraySchema,
  ObjectSchema,
  ConditionalSchema,
} from "./schema";
import { splitUriFragment, splitJsonPointer, resolveJsonPointer } from "./utilities";

export interface JsonSchemaFetcher {
  get(uri: string): Promise<RawObjectJsonSchema>;
}

export class JsonSchemaResolver {
  private readonly cache = new Map<string, RootSchema>();

  constructor(private jsonSchemaFetcher: JsonSchemaFetcher) {}

  private async resolveSubSchema(schema: RawJsonSchema, root: RootSchema): Promise<ResolvedJsonSchema> {
    if (typeof schema == "boolean" || typeof schema == "undefined") {
      if (schema == false) {
        return FALSE_SCHEMA;
      }

      return TRUE_SCHEMA;
    }

    if (schema.$ref) {
      return await this.getWithRoot(schema.$ref, root);
    }

    if (Array.isArray(schema.type)) {
      // We don't want to support complex schema types.

      return this.resolveSubSchema({ oneOf: schema.type.map((type) => ({ ...schema, type })) }, root);
    }

    const resolved: ResolvedJsonSchema = {
      __symbol: Symbol(),
      __root: root,
      type: null!,
    };

    await this.resolveObjectSubSchemaNoRef(schema, resolved);

    return resolved;
  }

  private async resolveObjectSubSchemaNoRef(schema: RawObjectJsonSchema, resolved: ResolvedJsonSchema): Promise<void> {
    // Ici les schémas situés dans /$defs/ du schéma [resolved] sont présents mais vides.

    if (Array.isArray(schema.type)) {
      const combined = resolved as CombinedSchema;
      combined.type = "combined";
      const { type, ...otherProps } = schema;
      combined.oneOf = await Promise.all(type.map((type) => this.resolveSubSchema({ ...otherProps, type }, combined)));

      return;
    }

    if (typeof schema.type == "string") {
      resolved.type = schema.type;
    } else {
      resolved.type = "any";
    }

    resolved.enum = schema.enum;
    resolved.const = schema.const;
    resolved.format = schema.format;
    resolved.readOnly = schema.readOnly;
    resolved.default = schema.default;
    resolved.title = schema.title;

    if (
      typeof schema.type == "undefined" ||
      schema.type == "number" ||
      schema.type == "integer" ||
      (Array.isArray(schema.type) && (schema.type.includes("number") || schema.type.includes("integer")))
    ) {
      (resolved as NumberSchema).multipleOf = schema.multipleOf;
      (resolved as NumberSchema).maximum = schema.maximum;
      (resolved as NumberSchema).exclusiveMaximum = schema.exclusiveMaximum;
      (resolved as NumberSchema).minimum = schema.minimum;
      (resolved as NumberSchema).exclusiveMinimum = schema.exclusiveMinimum;
    }

    if (
      typeof schema.type == "undefined" ||
      schema.type == "string" ||
      (Array.isArray(schema.type) && schema.type.includes("string"))
    ) {
      (resolved as StringSchema).maxLength = schema.maxLength;
      (resolved as StringSchema).minLength = schema.minLength;
      (resolved as StringSchema).pattern = schema.pattern;
      (resolved as StringSchema).contentMediaType = schema.contentMediaType;
      (resolved as StringSchema).contentEncoding = schema.contentEncoding;
    }

    if (
      typeof schema.type == "undefined" ||
      schema.type == "array" ||
      (Array.isArray(schema.type) && schema.type.includes("array"))
    ) {
      (resolved as ArraySchema).maxItems = schema.maxItems;
      (resolved as ArraySchema).minItems = schema.minItems;
      (resolved as ArraySchema).uniqueItems = schema.uniqueItems;
      (resolved as ArraySchema).minContains = schema.minContains;
      (resolved as ArraySchema).maxContains = schema.maxContains;
    }

    if (typeof schema.items == "object" && schema.items != null) {
      (resolved as ArraySchema).items = await this.resolveSubSchema(schema.items, resolved.__root);
    }

    if (Array.isArray(schema.prefixItems)) {
      (resolved as ArraySchema).prefixItems = await Promise.all(
        schema.prefixItems.map((schema) => this.resolveSubSchema(schema, resolved.__root))
      );
    }

    if (typeof schema.contains == "object" && schema.contains != null) {
      (resolved as ArraySchema).contains = await this.resolveSubSchema(schema.contains, resolved.__root);
    }

    if (typeof schema.propertyNames == "object" && schema.propertyNames != null) {
      (resolved as ObjectSchema).propertyNames = await this.resolveSubSchema(schema.propertyNames, resolved.__root);
    }

    if (
      typeof schema.type == "undefined" ||
      schema.type == "object" ||
      (Array.isArray(schema.type) && schema.type.includes("object"))
    ) {
      const objectSchema = resolved as ObjectSchema;
      objectSchema.maxProperties = schema.maxProperties;
      objectSchema.minProperties = schema.minProperties;
      objectSchema.required = schema.required;
    }

    if (typeof schema.properties == "object" && schema.properties != null) {
      const objectSchema = resolved as ObjectSchema;
      objectSchema.properties = {};

      for (const key of Object.keys(schema.properties)) {
        objectSchema.properties[key] = await this.resolveSubSchema(schema.properties[key], resolved.__root);
      }

      if (Array.isArray(objectSchema.required)) {
        for (const key of objectSchema.required) {
          const propertySchema = objectSchema.properties[key];

          if (typeof propertySchema == "object" && propertySchema != null) {
            propertySchema.__required = true;
          }
        }
      }
    }

    if (typeof schema.patternProperties == "object" && schema.patternProperties != null) {
      const objectSchema = resolved as ObjectSchema;
      objectSchema.patternProperties = {};

      for (const key of Object.keys(schema.patternProperties)) {
        objectSchema.patternProperties[key] = await this.resolveSubSchema(
          schema.patternProperties[key],
          resolved.__root
        );
      }
    }

    if (
      (typeof schema.additionalProperties == "object" && schema.additionalProperties != null) ||
      typeof schema.additionalProperties == "boolean"
    ) {
      (resolved as ObjectSchema).additionalProperties = await this.resolveSubSchema(
        schema.additionalProperties,
        resolved.__root
      );
    }

    if (typeof schema.unevaluatedProperties == "boolean") {
      (resolved as ObjectSchema).unevaluatedProperties = schema.unevaluatedProperties;
    }

    if (typeof schema.dependencies == "object" && schema.dependencies != null) {
      const objectSchema = resolved as ObjectSchema;
      objectSchema.dependencies = {};

      for (const key of Object.keys(schema.dependencies)) {
        const dependency = schema.dependencies[key];

        if (Array.isArray(dependency)) {
          objectSchema.dependencies[key] = dependency;
        } else {
          objectSchema.dependencies[key] = await this.resolveSubSchema(dependency, resolved.__root);
        }
      }
    }

    if (typeof schema.if == "object" && schema.if != null) {
      const conditionalSchema = resolved as ConditionalSchema;
      conditionalSchema.type = "conditional";
      conditionalSchema.if = await this.resolveSubSchema(schema.if, resolved.__root);

      if (typeof schema.then == "object" && schema.then != null) {
        conditionalSchema.then = await this.resolveSubSchema(schema.then, resolved.__root);
      }

      if (typeof schema.else == "object" && schema.else != null) {
        conditionalSchema.else = await this.resolveSubSchema(schema.else, resolved.__root);
      }
    }

    if (Array.isArray(schema.allOf)) {
      const combinedSchema = resolved as CombinedSchema;
      combinedSchema.type = "combined";
      combinedSchema.allOf = await Promise.all(
        schema.allOf.map((schema) => this.resolveSubSchema(schema, resolved.__root))
      );
    }

    if (Array.isArray(schema.anyOf)) {
      const combinedSchema = resolved as CombinedSchema;
      combinedSchema.type = "combined";
      combinedSchema.anyOf = await Promise.all(
        schema.anyOf.map((schema) => this.resolveSubSchema(schema, resolved.__root))
      );
    }

    if (Array.isArray(schema.oneOf)) {
      const combinedSchema = resolved as CombinedSchema;
      combinedSchema.type = "combined";
      combinedSchema.oneOf = await Promise.all(
        schema.oneOf.map((schema) => this.resolveSubSchema(schema, resolved.__root))
      );
    }

    if (typeof schema.not == "object" && schema.not != null) {
      const combinedSchema = resolved as CombinedSchema;
      combinedSchema.type = "combined";
      combinedSchema.not = await this.resolveSubSchema(schema.not, resolved.__root);
    }
  }

  // On a un schéma JSON brut, on veut résoudre toutes ses dépendances.
  // We have a raw JSON schema, we want to resolve all its dependencies.
  private async resolveRawJsonSchema(schema: RawJsonSchema, uri?: string): Promise<RootSchema> {
    if (typeof schema == "boolean" || typeof schema == "undefined") {
      if (schema === false) {
        return FALSE_SCHEMA;
      }

      return TRUE_SCHEMA;
    }

    if (schema.$ref) {
      return await this.get(schema.$ref);
    }

    if (typeof uri == "undefined") {
      uri = schema.$id;
    } else if (schema.$id !== uri && typeof schema.$id == "string") {
      throw new Error("Schema $id and URI does not match");
    }

    const resolved: RootSchema = {
      __symbol: Symbol(),
      $id: uri,
      type: null!,
      $schema: schema.$schema,
      __root: null!,
    };

    const definitions = schema.$defs;

    const resolvedDefinitions: { [key: string]: ResolvedJsonSchema } = (resolved.$defs = {});

    if (typeof definitions == "object" && definitions != null) {
      // On pré-alloue les schémas situés dans /$defs/.

      for (const key of Object.keys(definitions)) {
        const definition = definitions[key];

        if (typeof definition == "object" && definition != null && definition.$ref) {
          throw new Error("Unimplemented case");
        }

        resolvedDefinitions[key] = {
          __symbol: Symbol(),
          type: null!,
          __root: resolved,
        };
      }
    }

    resolved.__root = resolved;

    if (typeof uri != "undefined") {
      this.cache.set(uri, resolved);
    }

    await this.resolveObjectSubSchemaNoRef(schema, resolved);

    if (typeof definitions == "object" && definitions != null) {
      for (const key of Object.keys(definitions)) {
        const definition = definitions[key];
        const resolvedDefinition = resolvedDefinitions[key];

        if (typeof definition == "boolean" || typeof definition == "undefined" /* ? */) {
          if (definitions[key] == false) {
            resolvedDefinition.__symbol = FALSE_SCHEMA.__symbol;
            (resolvedDefinition as CombinedSchema).not = TRUE_SCHEMA;
          } else {
            resolvedDefinition.__symbol = TRUE_SCHEMA.__symbol;
          }
        } else {
          await this.resolveObjectSubSchemaNoRef(definition, resolvedDefinition);
        }
      }
    }

    Object.freeze(resolved);

    return resolved;
  }

  private async fetch(uri: string): Promise<RootSchema> {
    return this.resolveRawJsonSchema(await this.jsonSchemaFetcher.get(uri), uri);
  }

  private async getWithRoot(uri: string, root?: RootSchema): Promise<ResolvedJsonSchema> {
    const [document, hash] = splitUriFragment(uri);

    let useRoot: RootSchema;

    if (document.length == 0) {
      // Root schema.

      if (typeof root == "undefined") {
        throw new Error("Unexpected case, no root schema");
      } else {
        useRoot = root;
      }
    } else {
      useRoot = this.cache.get(document) || (await this.fetch(document));
    }

    const fragment = splitJsonPointer(hash);

    if (fragment.length == 0) {
      return useRoot;
    } else {
      const subSchema = resolveJsonPointer(useRoot, fragment);

      if (subSchema == null) {
        throw new Error("Invalid fragment " + hash);
      }

      return subSchema;
    }
  }

  public async get(uri: string): Promise<ResolvedJsonSchema> {
    return this.getWithRoot(uri);
  }

  public async resolve(schema: RawJsonSchema): Promise<ResolvedJsonSchema> {
    return this.resolveRawJsonSchema(schema);
  }
}
