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

export type JsonSchemaSimpleType = "null" | "boolean" | "object" | "array" | "number" | "integer" | "string";

export type JsonValue = null | undefined | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface SchemaBase<T = JsonValue> {
  __symbol: symbol;
  __root: RootSchema;
  __required?: true;

  readOnly?: boolean;
  enum?: T[];
  const?: T;
  default?: T;
  format?: string;
  title?: string;
}

export interface StringSchema extends SchemaBase<string> {
  type: "string";

  maxLength?: number;
  minLength?: number;
  pattern?: string;
  contentMediaType?: string;
  contentEncoding?: string;
}

export interface IntegerSchema extends SchemaBase<number> {
  type: "integer";

  multipleOf?: number;
  maximum?: number;
  exclusiveMaximum?: number;
  minimum?: number;
  exclusiveMinimum?: number;
}

export interface NumberSchema extends SchemaBase<number> {
  type: "number";

  multipleOf?: number;
  maximum?: number;
  exclusiveMaximum?: number;
  minimum?: number;
  exclusiveMinimum?: number;
}

export interface BooleanSchema extends SchemaBase<boolean> {
  type: "boolean";
}

export interface ObjectSchema extends SchemaBase<{ [key: string]: JsonValue }> {
  type: "object";

  maxProperties?: number;
  minProperties?: number;
  required?: string[];
  properties?: { [key: string]: ResolvedJsonSchema };
  patternProperties?: { [key: string]: ResolvedJsonSchema };
  additionalProperties?: ResolvedJsonSchema;
  unevaluatedProperties?: boolean;
  dependencies?: { [key: string]: ResolvedJsonSchema | string[] };
  propertyNames?: ResolvedJsonSchema;
}

export interface ConditionalSchema extends SchemaBase<boolean> {
  type: "conditional";

  if: ResolvedJsonSchema;
  then?: ResolvedJsonSchema;
  else?: ResolvedJsonSchema;
}

export interface ArraySchema extends SchemaBase<JsonValue[]> {
  type: "array";

  items?: ResolvedJsonSchema;
  prefixItems?: ResolvedJsonSchema[];
  maxItems?: number;
  minItems?: number;
  uniqueItems?: boolean;
  contains?: ResolvedJsonSchema;
  minContains?: number;
  maxContains?: number;
}

export interface NullSchema extends SchemaBase<null> {
  type: "null";
}

export interface CombinedSchema extends SchemaBase {
  type: "combined";

  allOf?: ResolvedJsonSchema[];
  anyOf?: ResolvedJsonSchema[];
  oneOf?: ResolvedJsonSchema[];
  not?: ResolvedJsonSchema;
}

export interface AnySchema extends SchemaBase {
  type: "any";
}

export type TerminalSchema = StringSchema | IntegerSchema | NumberSchema | BooleanSchema | NullSchema;

export type ResolvedJsonSchema =
  | TerminalSchema
  | ObjectSchema
  | ArraySchema
  | CombinedSchema
  | AnySchema
  | ConditionalSchema;

export type RootSchema = ResolvedJsonSchema & {
  __symbol: symbol;

  $schema?: string;
  $id?: string;

  $defs?: { [key: string]: ResolvedJsonSchema };
};

// Un schéma JSON brut, avant résolution des références.
export interface RawObjectJsonSchema<T = JsonValue> {
  $schema?: string;

  $ref?: string;
  $id?: string;
  title?: string;
  readOnly?: boolean;
  description?: string;

  type?: JsonSchemaSimpleType | JsonSchemaSimpleType[];
  enum?: T[];
  const?: T;
  default?: T;

  multipleOf?: number;
  maximum?: number;
  exclusiveMaximum?: number;
  minimum?: number;
  exclusiveMinimum?: number;

  maxLength?: number;
  minLength?: number;
  pattern?: string;
  contentMediaType?: string;
  contentEncoding?: string;

  items?: RawJsonSchema | boolean;
  prefixItems?: RawJsonSchema[];
  maxItems?: number;
  minItems?: number;
  uniqueItems?: boolean;
  contains?: RawJsonSchema;
  minContains?: number;
  maxContains?: number;

  maxProperties?: number;
  minProperties?: number;
  required?: string[];
  properties?: { [key: string]: RawJsonSchema };
  patternProperties?: { [key: string]: RawJsonSchema };
  additionalProperties?: RawJsonSchema;
  unevaluatedProperties?: boolean;
  dependencies?: { [key: string]: RawJsonSchema | string[] };
  propertyNames?: RawJsonSchema;

  format?: string;

  if?: RawJsonSchema;
  then?: RawJsonSchema;
  else?: RawJsonSchema;

  allOf?: RawJsonSchema[];
  anyOf?: RawJsonSchema[];
  oneOf?: RawJsonSchema[];
  not?: RawJsonSchema;

  $defs?: { [key: string]: RawJsonSchema };
}

export type RawJsonSchema = RawObjectJsonSchema | boolean;

export const TRUE_SCHEMA: AnySchema = {
  __symbol: Symbol(),
  __root: null!,
  type: "any",
};

TRUE_SCHEMA.__root = TRUE_SCHEMA;
Object.freeze(TRUE_SCHEMA);

export const FALSE_SCHEMA: CombinedSchema = {
  __symbol: Symbol(),
  __root: null!,
  type: "combined",
  not: TRUE_SCHEMA,
};

FALSE_SCHEMA.__root = FALSE_SCHEMA;
Object.freeze(FALSE_SCHEMA);
