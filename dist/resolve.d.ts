import { ResolvedJsonSchema, RawJsonSchema, RawObjectJsonSchema } from "./schema";
export interface JsonSchemaFetcher {
    get(uri: string): Promise<RawObjectJsonSchema>;
}
export declare class JsonSchemaResolver {
    private jsonSchemaFetcher;
    private readonly cache;
    constructor(jsonSchemaFetcher: JsonSchemaFetcher);
    private resolveSubSchema;
    private resolveObjectSubSchemaNoRef;
    private resolveRawJsonSchema;
    private fetch;
    private getWithRoot;
    get(uri: string): Promise<ResolvedJsonSchema>;
    resolve(schema: RawJsonSchema): Promise<ResolvedJsonSchema>;
}
