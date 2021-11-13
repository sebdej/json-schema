import { ArraySchema, CombinedSchema, JsonValue, ObjectSchema, ResolvedJsonSchema, TerminalSchema } from "./schema";
import { TypedJsonPointer } from "./utilities";
export type ValuePath = TypedJsonPointer;
export type SchemaPath = TypedJsonPointer;
export type Constraint = "integer" | "format" | "enum" | "const" | "minLength" | "maxLength" | "pattern" | "minimum" | "exclusiveMinimum" | "maximum" | "exclusiveMaximum" | "multipleOf" | "minProperties" | "maxProperties" | "minItems" | "maxItems";
export type Combined = "oneOf" | "anyOf" | "allOf";
export type JsonSchemaValidationError = {
    category: "false" | "type" | "missing_property" | "unexpected_property" | "constraint" | "not_supported" | "combined";
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
    onUnexpectedType(schemaPath: SchemaPath, value: JsonValue, valuePath: ValuePath): void;
    onConstraintError(constraint: Constraint, parameter: JsonValue | undefined, schemaPath: SchemaPath, valuePath: ValuePath): void;
    onFalse(schemaPath: SchemaPath, valuePath: ValuePath): void;
    onMissingProperty(schemaPath: SchemaPath, valuePath: ValuePath): void;
    onUnexpectedProperty(schemaPath: SchemaPath, valuePath: ValuePath): void;
    onCombinedError(combined: Combined, validated: number[], schemaPath: SchemaPath, valuePath: ValuePath): void;
    onNotSupported(schemaPath: SchemaPath, valuePath: ValuePath): void;
    onTerminal(schema: TerminalSchema, schemaPath: SchemaPath, value: JsonValue, valuePath: ValuePath): void;
    onStartObject(schema: ObjectSchema, schemaPath: SchemaPath, value: JsonValue, valuePath: ValuePath): void;
    onEndObject(): void;
    onStartArray(schema: ArraySchema, schemaPath: SchemaPath, value: JsonValue, valuePath: ValuePath): void;
    onEndArray(): void;
    onStartCombined(schema: CombinedSchema, schemaPath: SchemaPath, value: JsonValue, valuePath: ValuePath): void;
    onEndCombined(): void;
}
export declare function doValidateSchema(schema: ResolvedJsonSchema, schemaPath: SchemaPath, value: JsonValue, valuePath: ValuePath, handler: ValidateSchemaHandler): void;
export declare function validateSchema(schema: ResolvedJsonSchema, value: JsonValue): JsonSchemaValidationError[];
