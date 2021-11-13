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
import { FALSE_SCHEMA } from "./schema";
export function classifyArraySchema(schema, hook) {
    if (Array.isArray(schema.prefixItems)) {
        return { category: "array", of: "mixed" };
    }
    if (typeof schema.items == "object" && schema.items != null) {
        const classification = doClassifySchema(schema.items, hook);
        return { category: "array", of: classification };
    }
    return { category: "other" };
}
export function classifyObjectSchema(schema, hook) {
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
            if (doClassifySchema(schema.properties[key], hook).category != "atomic") {
                return { category: "object", of: "mixed" };
            }
        }
        return { category: "object", of: { category: "atomic" } };
    }
    return { category: "other" };
}
export function classifyCombinedSchema(schema, hook) {
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
            const classification = doClassifySchema(subSchema, hook);
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
function doClassifySchema(schema, hook) {
    if (schema.type == "boolean" || schema.type == "integer" || schema.type == "number" || schema.type == "string") {
        if (Array.isArray(schema.enum) || schema.const) {
            return hook(schema, { category: "atomic", isEnum: true });
        }
        else {
            return hook(schema, { category: "atomic", isEnum: false });
        }
    }
    if (schema.type == "object") {
        return hook(schema, classifyObjectSchema(schema, hook));
    }
    if (schema.type == "array") {
        return hook(schema, classifyArraySchema(schema, hook));
    }
    if (schema.type == "combined") {
        return hook(schema, classifyCombinedSchema(schema, hook));
    }
    return hook(schema, { category: "other" });
}
export function classifySchema(schema, hook) {
    if (typeof hook !== "function") {
        hook = (schema, classification) => classification;
    }
    return doClassifySchema(schema, hook);
}
