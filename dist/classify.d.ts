import { ArraySchema, CombinedSchema, ObjectSchema, ResolvedJsonSchema } from "./schema";
type EnumType = "mixed" | undefined | boolean;
type SchemaClassification = {
    category: "other" | "atomic" | "array" | "object" | "union";
    isEnum?: EnumType;
    of?: SchemaClassification | "mixed";
};
export declare function classifyArraySchema(schema: ArraySchema, hook: ClassifierHook): SchemaClassification;
export declare function classifyObjectSchema(schema: ObjectSchema, hook: ClassifierHook): SchemaClassification;
export declare function classifyCombinedSchema(schema: CombinedSchema, hook: ClassifierHook): SchemaClassification;
export type ClassifierHook = (schema: ResolvedJsonSchema, classification: SchemaClassification) => SchemaClassification;
export declare function classifySchema(schema: ResolvedJsonSchema, hook?: ClassifierHook): SchemaClassification;
export {};
