import { ArraySchema, CombinedSchema, ObjectSchema, ResolvedJsonSchema } from "./schema";
type EnumType = "mixed" | undefined | boolean;
type SchemaClassification = {
    category: "other" | "atomic" | "array" | "object" | "union";
    isEnum?: EnumType;
    of?: SchemaClassification | "mixed";
};
export declare function classifyArraySchema(schema: ArraySchema): SchemaClassification;
export declare function classifyObjectSchema(schema: ObjectSchema): SchemaClassification;
export declare function classifyCombinedSchema(schema: CombinedSchema): SchemaClassification;
export declare function classifySchema(schema: ResolvedJsonSchema): SchemaClassification;
export {};
