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
  ArraySchema,
  CombinedSchema,
  FALSE_SCHEMA,
  JsonValue,
  ObjectSchema,
  ResolvedJsonSchema,
  TerminalSchema,
  TRUE_SCHEMA,
} from "./schema";
import { deepEquals, joinJsonPointer, TypedJsonPointer } from "./utilities";

export type ValuePath = TypedJsonPointer;
export type SchemaPath = TypedJsonPointer;

export type Constraint =
  | "integer" // La valeur bien que de type [number] n'est pas compatible avec un entier
  | "format" // Le texte ne respecte pas le format défini
  | "enum" // La valeur ne fait pas partie des valeurs autorisées de l'énumération
  | "const" // La valeur ne correspond pas à la valeur constante définie
  | "minLength" // La longueur du texte est inférieure à la valeur minimale
  | "maxLength" // La longueur du texte est supérieure à la valeur maximale
  | "pattern" // Le texte ne correspond pas au motif (expression régulière)
  | "minimum" // Le nombre est inférieure à la valeur minimale
  | "exclusiveMinimum" // Le nombre est inférieure ou égale à la valeur minimale
  | "maximum" // Le nombre est supérieure à la valeur maximale
  | "exclusiveMaximum" // Le nombre est supérieure ou égale à la valeur maximale
  | "multipleOf" // Le nombre n'est pas un multiple de la valeur définie
  | "minProperties" // Le nombre de propriétés de l'objet est inférieur à la valeur minimale
  | "maxProperties" // Le nombre de propriétés de l'objet est supérieure à la valeur maximale
  | "minItems" // Le nombre d'éléments du tableau est inférieur à la valeur minimale
  | "maxItems"; // Le nombre d'éléments du tableau est supérieure à la valeur maximale

export type Combined =
  | "oneOf" // exactement une variante de schéma est validée
  | "anyOf" // au moins une variante de schéma
  | "allOf"; // toutes les variantes de schéma

export type JsonSchemaValidationError = {
  category:
    | "false" // Le schéma est <false>, donc aucune valeur n'est valide
    | "type" // La valeur possède le mauvais type
    | "missing_property" // Une propriété requise d'un objet est manquante
    | "unexpected_property" // Une propriété inattendue a été trouvée dans un objet
    | "constraint" // La valeur ne respecte pas une contrainte (min, max, enum, ...)
    | "not_supported" // Le schéma n'est pas supporté
    | "combined"; // Pour les schémas de type oneOf, anyOf, allOf, le nombre de schémas validés n'est pas le bon
  constraint?: Constraint;
  combined?: Combined;
  parameter?: JsonValue;
  valuePath: string;
  schemaPath: string;
};

export interface ValidateSchemaHandler {
  isValid(): boolean;

  createLocal(): ValidateSchemaHandler;

  merge(local: ValidateSchemaHandler): void;

  // Le type de la valeur ne correspond pas au type attendu par le schéma.
  onUnexpectedType(schemaPath: SchemaPath, value: JsonValue, valuePath: ValuePath): void;

  // La valeur ne respecte pas une contrainte du schéma.
  onConstraintError(
    constraint: Constraint,
    parameter: JsonValue | undefined,
    schemaPath: SchemaPath,
    valuePath: ValuePath
  ): void;

  // Le schéma est faux.
  onFalse(schemaPath: SchemaPath, valuePath: ValuePath): void;

  // Dans un objet, une propriété requise est manquante.
  onMissingProperty(schemaPath: SchemaPath, valuePath: ValuePath): void;

  // Dans un objet, une propriété inattendue a été trouvée.
  onUnexpectedProperty(schemaPath: SchemaPath, valuePath: ValuePath): void;

  // Le nombre de schémas validés dans un schéma combiné (oneOf, anyOf, allOf) n'est pas correct.
  onCombinedError(combined: Combined, validated: number[], schemaPath: SchemaPath, valuePath: ValuePath): void;

  // Le schéma n'est pas supporté.
  onNotSupported(schemaPath: SchemaPath, valuePath: ValuePath): void;

  onTerminal(schema: TerminalSchema, schemaPath: SchemaPath, value: JsonValue, valuePath: ValuePath): void;

  onStartObject(schema: ObjectSchema, schemaPath: SchemaPath, value: JsonValue, valuePath: ValuePath): void;
  onEndObject(): void;

  onStartArray(schema: ArraySchema, schemaPath: SchemaPath, value: JsonValue, valuePath: ValuePath): void;
  onEndArray(): void;

  onStartCombined(schema: CombinedSchema, schemaPath: SchemaPath, value: JsonValue, valuePath: ValuePath): void;
  onEndCombined(): void;
}

export function doValidateSchema(
  schema: ResolvedJsonSchema,
  schemaPath: SchemaPath,
  value: JsonValue,
  valuePath: ValuePath,
  handler: ValidateSchemaHandler
): void {
  if (schema.__symbol === TRUE_SCHEMA.__symbol) {
    return;
  }

  if (schema.__symbol === FALSE_SCHEMA.__symbol) {
    handler.onFalse(schemaPath, valuePath);

    return;
  }

  if (
    Array.isArray(schema.enum) &&
    typeof schema.enum.find((enumValue) => deepEquals(enumValue, value)) == "undefined"
  ) {
    handler.onConstraintError("enum", undefined, schemaPath, valuePath);
  } else if (typeof schema.const != "undefined" && !deepEquals(schema.const, value)) {
    handler.onConstraintError("const", schema.const, schemaPath, valuePath);
  } else {
    switch (schema.type) {
      case "string":
        if (typeof value != "string") {
          handler.onUnexpectedType(schemaPath, value, valuePath);
        } else {
          let isValid = true;

          if (typeof schema.minLength == "number" && value.length < schema.minLength) {
            isValid = false;
            handler.onConstraintError("minLength", schema.minLength, schemaPath, valuePath);
          }

          if (typeof schema.maxLength == "number" && value.length > schema.maxLength) {
            isValid = false;
            handler.onConstraintError("maxLength", schema.maxLength, schemaPath, valuePath);
          }

          if (typeof schema.pattern == "string") {
            const regExp = new RegExp(schema.pattern);

            if (!regExp.test(value)) {
              isValid = false;
              handler.onConstraintError("pattern", schema.pattern, schemaPath, valuePath);
            }
          }

          switch (schema.format) {
            case "date": {
              const regExp = /\d{4}-\d{2}-\d{2}/;

              if (!regExp.test(value)) {
                isValid = false;
                handler.onConstraintError("format", schema.format, schemaPath, valuePath);
              }

              break;
            }

            case "date-time": {
              const regExp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

              if (!regExp.test(value)) {
                isValid = false;
                handler.onConstraintError("format", schema.format, schemaPath, valuePath);
              }

              break;
            }

            case "time": {
              const regExp = /^\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

              if (!regExp.test(value)) {
                isValid = false;
                handler.onConstraintError("format", schema.format, schemaPath, valuePath);
              }

              break;
            }

            case "duration": {
              const regExp = /^P(\d+Y)?(\d+M)?(\d+D)?(T(\d+H)?(\d+M)?(\d+(\.\d+)?S)?)?$/;

              if (!regExp.test(value)) {
                isValid = false;
                handler.onConstraintError("format", schema.format, schemaPath, valuePath);
              }

              break;
            }

            case "email": {
              const regExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

              if (!regExp.test(value)) {
                isValid = false;
                handler.onConstraintError("format", schema.format, schemaPath, valuePath);
              }

              break;
            }
          }

          if (isValid) {
            handler.onTerminal(schema, schemaPath, value, valuePath);
          }
        }
        break;

      case "number":
      case "integer":
        if (typeof value != "number") {
          handler.onUnexpectedType(schemaPath, value, valuePath);
        } else if (schema.type == "integer" && !Number.isSafeInteger(value)) {
          handler.onConstraintError("integer", undefined, schemaPath, valuePath);
        } else {
          let isValid = true;

          if (typeof schema.minimum == "number" && value < schema.minimum) {
            isValid = false;
            handler.onConstraintError("minimum", schema.minimum, schemaPath, valuePath);
          }

          if (typeof schema.exclusiveMinimum == "number" && value <= schema.exclusiveMinimum) {
            isValid = false;
            handler.onConstraintError("exclusiveMinimum", schema.exclusiveMinimum, schemaPath, valuePath);
          }

          if (typeof schema.maximum == "number" && value > schema.maximum) {
            isValid = false;
            handler.onConstraintError("maximum", schema.maximum, schemaPath, valuePath);
          }

          if (typeof schema.exclusiveMaximum == "number" && value >= schema.exclusiveMaximum) {
            isValid = false;
            handler.onConstraintError("exclusiveMaximum", schema.exclusiveMaximum, schemaPath, valuePath);
          }

          if (typeof schema.multipleOf == "number" && value % schema.multipleOf != 0) {
            isValid = false;
            handler.onConstraintError("multipleOf", schema.multipleOf, schemaPath, valuePath);
          }

          if (isValid) {
            handler.onTerminal(schema, schemaPath, value, valuePath);
          }
        }
        break;

      case "boolean":
        if (typeof value != "boolean") {
          handler.onUnexpectedType(schemaPath, value, valuePath);
        } else {
          handler.onTerminal(schema, schemaPath, value, valuePath);
        }
        break;

      case "null":
        if (value !== null) {
          handler.onUnexpectedType(schemaPath, value, valuePath);
        } else {
          handler.onTerminal(schema, schemaPath, value, valuePath);
        }
        break;

      case "object":
        if (typeof value != "object" || value === null || Array.isArray(value)) {
          handler.onUnexpectedType(schemaPath, value, valuePath);
        } else {
          const keys = Object.keys(value);

          if (typeof schema.minProperties == "number" || typeof schema.maxProperties == "number") {
            const count = keys.filter((key) => typeof value[key] != "undefined").length;

            if (typeof schema.minProperties == "number" && count < schema.minProperties) {
              handler.onConstraintError("minProperties", schema.minProperties, schemaPath, valuePath);
            }

            if (typeof schema.maxProperties == "number" && count > schema.maxProperties) {
              handler.onConstraintError("maxProperties", schema.maxProperties, schemaPath, valuePath);
            }
          }

          handler.onStartObject(schema, schemaPath, value, valuePath);

          if (typeof schema.properties == "object") {
            for (const [propertyName, propertySchema] of Object.entries(schema.properties)) {
              const propertyValue = value[propertyName];

              // On indique que cette propriété a été traitée.
              keys.splice(keys.indexOf(propertyName), 1);

              if (typeof propertyValue === "undefined") {
                if (propertySchema.__required) {
                  handler.onMissingProperty(valuePath, schemaPath);
                }
              } else {
                doValidateSchema(
                  propertySchema,
                  [...schemaPath, "properties", propertyName],
                  propertyValue,
                  [...valuePath, propertyName],
                  handler
                );
              }
            }
          }

          if (typeof schema.additionalProperties == "object") {
            if (schema.additionalProperties.__symbol !== FALSE_SCHEMA.__symbol) {
              for (const propertyName of keys) {
                const propertyValue = value[propertyName];

                // On indique que cette propriété a été traitée.
                // TODO: il ne faudrait le faire que si la validation réussit pour pouvoir gérer [patternProperties] par exemple.
                keys.splice(keys.indexOf(propertyName), 1);

                doValidateSchema(
                  schema.additionalProperties,
                  [...schemaPath, "additionalProperties"],
                  propertyValue,
                  [...valuePath, propertyName],
                  handler
                );
              }
            }
          }

          if (keys.length > 0) {
            // Il reste des propriétés non traitées.

            for (const propertyName of keys) {
              handler.onUnexpectedProperty(schemaPath, [...valuePath, propertyName]);
            }
          }

          handler.onEndObject();

          // TODO: schema.dependencies, schema.patternProperties, schema.propertyNames
        }
        break;

      case "array":
        if (!Array.isArray(value)) {
          handler.onUnexpectedType(schemaPath, value, valuePath);
        } else {
          if (typeof schema.minItems == "number" && value.length < schema.minItems) {
            handler.onConstraintError("minItems", schema.minItems, schemaPath, valuePath);
          }

          if (typeof schema.maxItems == "number" && value.length > schema.maxItems) {
            handler.onConstraintError("maxItems", schema.maxItems, schemaPath, valuePath);
          }

          handler.onStartArray(schema, schemaPath, value, valuePath);

          if (typeof schema.items == "object") {
            const items = schema.items;

            for (let i = 0; i < value.length; ++i) {
              doValidateSchema(items, [...schemaPath, "items", i], value[i], [...valuePath, i], handler);
            }
          }

          handler.onEndArray();

          // TODO: schema.prefixItems, ...
        }
        break;

      case "combined": {
        type Variant = readonly [index: number, local: ValidateSchemaHandler];

        let isValid = true;

        function validateCombinedSchema(
          schema: CombinedSchema,
          key: Combined,
          predicate: (total: number, valid: number) => boolean
        ): Variant[] {
          const schemas = schema[key];

          if (Array.isArray(schemas)) {
            const variants = schemas.map((subSchema, index) => {
              const local = handler.createLocal();

              doValidateSchema(subSchema, [...schemaPath, key, index], value, valuePath, local);

              return [index, local] as const;
            });

            const valid = variants.filter(([_, local]) => local.isValid()).map(([index]) => index);

            if (!predicate(schemas.length, valid.length)) {
              isValid = false;
              handler.onCombinedError(key, valid, schemaPath, valuePath);
            }

            return variants;
          }

          return [];
        }

        const oneOf = validateCombinedSchema(schema, "oneOf", (_total, valid) => valid === 1);
        const allOf = validateCombinedSchema(schema, "allOf", (total, valid) => valid === total);
        const anyOf = validateCombinedSchema(schema, "anyOf", (_total, valid) => valid > 0);

        const allVariants = [...oneOf, ...allOf, ...anyOf];

        if (isValid) {
          handler.onStartCombined(schema, schemaPath, value, valuePath);

          for (const [_index, local] of allVariants) {
            if (local.isValid()) {
              handler.merge(local);
            }
          }

          handler.onEndCombined();
        }

        break;
      }

      case "conditional": {
        const local = handler.createLocal();
        doValidateSchema(schema.if, [...schemaPath, "if"], value, valuePath, local);

        if (local.isValid()) {
          if (typeof schema.then == "object") {
            doValidateSchema(schema.then!, [...schemaPath, "then"], value, valuePath, handler);
          }
        } else {
          if (typeof schema.else == "object") {
            doValidateSchema(schema.else!, [...schemaPath, "else"], value, valuePath, handler);
          }
        }

        break;
      }

      default:
        handler.onNotSupported(valuePath, schemaPath);
        break;
    }
  }
}

class ValidateSchemaHandlerWithCapture implements ValidateSchemaHandler {
  errors: JsonSchemaValidationError[] = [];

  constructor(private parent: ValidateSchemaHandlerWithCapture | null) {}

  isValid(): boolean {
    return this.errors.length === 0;
  }

  createLocal(): ValidateSchemaHandler {
    return new ValidateSchemaHandlerWithCapture(this);
  }

  merge(handler: ValidateSchemaHandler): void {
    if (!(handler instanceof ValidateSchemaHandlerWithCapture)) {
      throw new Error("Invalid handler");
    }

    const local = handler as ValidateSchemaHandlerWithCapture;

    if (local.parent !== this) {
      throw new Error("Handler is not a child");
    }

    this.errors.push(...local.errors);
  }

  onFalse(schemaPath: SchemaPath, valuePath: ValuePath): void {
    this.errors.push({
      category: "false",
      schemaPath: joinJsonPointer(schemaPath),
      valuePath: joinJsonPointer(valuePath),
    });
  }

  onMissingProperty(schemaPath: SchemaPath, valuePath: ValuePath): void {
    this.errors.push({
      category: "missing_property",
      schemaPath: joinJsonPointer(schemaPath),
      valuePath: joinJsonPointer(valuePath),
    });
  }

  onUnexpectedProperty(schemaPath: SchemaPath, valuePath: ValuePath): void {
    this.errors.push({
      category: "unexpected_property",
      schemaPath: joinJsonPointer(schemaPath),
      valuePath: joinJsonPointer(valuePath),
    });
  }

  onUnexpectedType(schemaPath: SchemaPath, _value: JsonValue, valuePath: ValuePath): void {
    this.errors.push({
      category: "type",
      schemaPath: joinJsonPointer(schemaPath),
      valuePath: joinJsonPointer(valuePath),
    });
  }

  onNotSupported(schemaPath: SchemaPath, valuePath: ValuePath): void {
    this.errors.push({
      category: "not_supported",
      schemaPath: joinJsonPointer(schemaPath),
      valuePath: joinJsonPointer(valuePath),
    });
  }

  onConstraintError(
    constraint: Constraint,
    parameter: JsonValue | undefined,
    schemaPath: SchemaPath,
    valuePath: ValuePath
  ): void {
    this.errors.push({
      category: "constraint",
      constraint: constraint,
      parameter: parameter,
      schemaPath: joinJsonPointer(schemaPath),
      valuePath: joinJsonPointer(valuePath),
    });
  }

  onCombinedError(combined: Combined, validated: number[], schemaPath: SchemaPath, valuePath: ValuePath): void {
    this.errors.push({
      category: "combined",
      combined: combined,
      parameter: validated,
      schemaPath: joinJsonPointer(schemaPath),
      valuePath: joinJsonPointer(valuePath),
    });
  }

  onTerminal(_schema: ResolvedJsonSchema, _schemaPath: SchemaPath, _value: JsonValue, _valuePath: ValuePath): void {}

  onStartObject(_schema: ResolvedJsonSchema, _schemaPath: SchemaPath, _value: JsonValue, _valuePath: ValuePath): void {}

  onEndObject(): void {}

  onStartArray(_schema: ResolvedJsonSchema, _schemaPath: SchemaPath, _value: JsonValue, _valuePath: ValuePath): void {}

  onEndArray(): void {}

  onStartCombined(
    _schema: ResolvedJsonSchema,
    _schemaPath: SchemaPath,
    _value: JsonValue,
    _valuePath: ValuePath
  ): void {}

  onEndCombined(): void {}
}

export function validateSchema(schema: ResolvedJsonSchema, value: JsonValue): JsonSchemaValidationError[] {
  const handler = new ValidateSchemaHandlerWithCapture(null);

  doValidateSchema(schema, [], value, [], handler);

  return handler.errors;
}
