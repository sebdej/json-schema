import { ArraySchema, CombinedSchema, ObjectSchema, ResolvedJsonSchema } from "./schema";
type EnumType = "mixed" | undefined | boolean;
type SchemaClassification = {
    category: "other" | "atomic" | "array" | "object" | "union";
    isEnum?: EnumType;
    of?: SchemaClassification | "mixed";
};
export declare function ClassifyArraySchema(schema: ArraySchema): SchemaClassification;
export declare function ClassifyObjectSchema(schema: ObjectSchema): SchemaClassification;
export declare function ClassifyCombinedSchema(schema: CombinedSchema): SchemaClassification;
export declare function ClassifySchema(schema: ResolvedJsonSchema): SchemaClassification;
export {};
