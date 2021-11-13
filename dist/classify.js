import { FALSE_SCHEMA } from "./schema";
export function ClassifyArraySchema(schema) {
    if (Array.isArray(schema.prefixItems)) {
        return { category: "array", of: "mixed" };
    }
    if (typeof schema.items == "object" && schema.items != null) {
        const classification = ClassifySchema(schema.items);
        return { category: "array", of: classification };
    }
    return { category: "other" };
}
export function ClassifyObjectSchema(schema) {
    if (typeof schema.additionalProperties == "object" && schema.additionalProperties != null) {
        if (schema.additionalProperties.__symbol !== FALSE_SCHEMA.__symbol) {
            return { category: "other" };
        }
    }
    if (typeof schema.patternProperties == "object" && schema.patternProperties != null) {
        return { category: "other" };
    }
    if (typeof schema.properties == "object" && schema.properties != null) {
        for (const key of Object.keys(schema.properties)) {
            if (ClassifySchema(schema.properties[key]).category != "atomic") {
                return { category: "object", of: "mixed" };
            }
        }
        return { category: "object", of: { category: "atomic" } };
    }
    return { category: "other" };
}
export function ClassifyCombinedSchema(schema) {
    if (Array.isArray(schema.allOf)) {
        return { category: "other" };
    }
    if (Array.isArray(schema.anyOf)) {
        return { category: "other" };
    }
    if (Array.isArray(schema.oneOf)) {
        const categories = {};
        const isEnum = {};
        for (const subSchema of schema.oneOf) {
            const classification = ClassifySchema(subSchema);
            if (typeof categories[classification.category] == "number") {
                ++categories[classification.category];
            }
            else {
                categories[classification.category] = 1;
            }
            switch (classification.isEnum) {
                case "mixed":
                    isEnum.mixed = classification.isEnum;
                    break;
                case true:
                    isEnum.true = classification.isEnum;
                    break;
                case false:
                    isEnum.false = classification.isEnum;
                    break;
                default:
                    isEnum.undefined = classification.isEnum;
                    break;
            }
        }
        if (Object.keys(categories).length > 1) {
            return { category: "union", of: "mixed" };
        }
        if (Object.keys(categories).length === 1) {
            let ofIsEnum;
            switch (Object.keys(isEnum).length) {
                case 0:
                    ofIsEnum = undefined;
                    break;
                case 1:
                    ofIsEnum = isEnum[Object.keys(isEnum)[0]];
                    break;
                default:
                    ofIsEnum = "mixed";
                    break;
            }
            if (Object.keys(categories)[0] == "atomic") {
                return {
                    category: "atomic",
                    isEnum: ofIsEnum,
                };
            }
            return {
                category: "union",
                of: {
                    category: Object.keys(categories)[0],
                    isEnum: ofIsEnum,
                },
            };
        }
    }
    return { category: "other" };
}
export function ClassifySchema(schema) {
    if (schema.type == "boolean" || schema.type == "integer" || schema.type == "number" || schema.type == "string") {
        if (Array.isArray(schema.enum) || schema.const) {
            return { category: "atomic", isEnum: true };
        }
        else if (schema.type == "string" && typeof schema.pattern == "string" && schema.pattern.startsWith("[^@]+@")) {
            return { category: "atomic", isEnum: true };
        }
        else {
            return { category: "atomic", isEnum: false };
        }
    }
    if (schema.type == "object") {
        return ClassifyObjectSchema(schema);
    }
    if (schema.type == "array") {
        return ClassifyArraySchema(schema);
    }
    if (schema.type == "combined") {
        return ClassifyCombinedSchema(schema);
    }
    return { category: "other" };
}
