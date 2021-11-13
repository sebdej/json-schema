import { JsonValue, ResolvedJsonSchema } from "./schema";
type ExplainChoicesTerminal = true;
type ExplainChoicesObject = {
    properties?: {
        [key: string]: ExplainChoicesPath;
    };
};
type ExplainChoicesArray = {
    items?: {
        [key: number]: ExplainChoicesPath;
    };
};
interface ExplainChoicesCombined {
    oneOf?: number | {
        [key: number]: ExplainChoicesPath;
    };
    allOf?: {
        [key: number]: ExplainChoicesPath;
    };
    anyOf?: {
        [key: number]: true | ExplainChoicesPath;
    };
}
export type ExplainChoicesPath = ExplainChoicesTerminal | ExplainChoicesObject | ExplainChoicesArray | ExplainChoicesCombined;
export declare function explainValidationChoices(schema: ResolvedJsonSchema, value: JsonValue): ExplainChoicesPath | null;
export {};
