import { FALSE_SCHEMA, TRUE_SCHEMA, } from "./schema";
import { DeepEquals, JoinJsonPointer } from "./utilities";
export function DoValidateSchema(schema, schemaPath, value, valuePath, handler) {
    if (schema.__symbol === TRUE_SCHEMA.__symbol) {
        return;
    }
    if (schema.__symbol === FALSE_SCHEMA.__symbol) {
        handler.onFalse(schemaPath, valuePath);
        return;
    }
    if (Array.isArray(schema.enum) &&
        typeof schema.enum.find((enumValue) => DeepEquals(enumValue, value)) == "undefined") {
        handler.onConstraintError("enum", undefined, schemaPath, valuePath);
    }
    else if (typeof schema.const != "undefined" && !DeepEquals(schema.const, value)) {
        handler.onConstraintError("const", schema.const, schemaPath, valuePath);
    }
    else {
        switch (schema.type) {
            case "string":
                if (typeof value != "string") {
                    handler.onUnexpectedType(schemaPath, value, valuePath);
                }
                else {
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
                    if (isValid) {
                        handler.onTerminal(schema, schemaPath, value, valuePath);
                    }
                }
                break;
            case "number":
            case "integer":
                if (typeof value != "number") {
                    handler.onUnexpectedType(schemaPath, value, valuePath);
                }
                else if (schema.type == "integer" && !Number.isSafeInteger(value)) {
                    handler.onConstraintError("integer", undefined, schemaPath, valuePath);
                }
                else {
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
                }
                else {
                    handler.onTerminal(schema, schemaPath, value, valuePath);
                }
                break;
            case "null":
                if (value !== null) {
                    handler.onUnexpectedType(schemaPath, value, valuePath);
                }
                else {
                    handler.onTerminal(schema, schemaPath, value, valuePath);
                }
                break;
            case "object":
                if (typeof value != "object" || value === null || Array.isArray(value)) {
                    handler.onUnexpectedType(schemaPath, value, valuePath);
                }
                else {
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
                            if (typeof propertyValue === "undefined" && propertySchema.__required) {
                                handler.onMissingProperty(valuePath, schemaPath);
                            }
                            else {
                                DoValidateSchema(propertySchema, [...schemaPath, "properties", propertyName], propertyValue, [...valuePath, propertyName], handler);
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
                                DoValidateSchema(schema.additionalProperties, [...schemaPath, "additionalProperties"], propertyValue, [...valuePath, propertyName], handler);
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
                }
                else {
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
                            DoValidateSchema(items, [...schemaPath, "items", i], value[i], [...valuePath, i], handler);
                        }
                    }
                    handler.onEndArray();
                    // TODO: schema.prefixItems, ...
                }
                break;
            case "combined": {
                let isValid = true;
                function ValidateCombinedSchema(schema, key, predicate) {
                    const schemas = schema[key];
                    if (Array.isArray(schemas)) {
                        const variants = schemas.map((subSchema, index) => {
                            const local = handler.createLocal();
                            DoValidateSchema(subSchema, [...schemaPath, key, index], value, valuePath, local);
                            return [index, local];
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
                const oneOf = ValidateCombinedSchema(schema, "oneOf", (_total, valid) => valid === 1);
                const allOf = ValidateCombinedSchema(schema, "allOf", (total, valid) => valid === total);
                const anyOf = ValidateCombinedSchema(schema, "anyOf", (_total, valid) => valid > 0);
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
                DoValidateSchema(schema.if, [...schemaPath, "if"], value, valuePath, local);
                if (local.isValid()) {
                    if (typeof schema.then == "object") {
                        DoValidateSchema(schema.then, [...schemaPath, "then"], value, valuePath, handler);
                    }
                }
                else {
                    if (typeof schema.else == "object") {
                        DoValidateSchema(schema.else, [...schemaPath, "else"], value, valuePath, handler);
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
class ValidateSchemaHandlerWithCapture {
    constructor(parent) {
        this.parent = parent;
        this.errors = [];
    }
    isValid() {
        return this.errors.length === 0;
    }
    createLocal() {
        return new ValidateSchemaHandlerWithCapture(this);
    }
    merge(handler) {
        if (!(handler instanceof ValidateSchemaHandlerWithCapture)) {
            throw new Error("Invalid handler");
        }
        const local = handler;
        if (local.parent !== this) {
            throw new Error("Handler is not a child");
        }
        this.errors.push(...local.errors);
    }
    onFalse(schemaPath, valuePath) {
        this.errors.push({
            category: "false",
            schemaPath: JoinJsonPointer(schemaPath),
            valuePath: JoinJsonPointer(valuePath),
        });
    }
    onMissingProperty(schemaPath, valuePath) {
        this.errors.push({
            category: "missing_property",
            schemaPath: JoinJsonPointer(schemaPath),
            valuePath: JoinJsonPointer(valuePath),
        });
    }
    onUnexpectedProperty(schemaPath, valuePath) {
        this.errors.push({
            category: "unexpected_property",
            schemaPath: JoinJsonPointer(schemaPath),
            valuePath: JoinJsonPointer(valuePath),
        });
    }
    onUnexpectedType(schemaPath, _value, valuePath) {
        this.errors.push({
            category: "type",
            schemaPath: JoinJsonPointer(schemaPath),
            valuePath: JoinJsonPointer(valuePath),
        });
    }
    onNotSupported(schemaPath, valuePath) {
        this.errors.push({
            category: "not_supported",
            schemaPath: JoinJsonPointer(schemaPath),
            valuePath: JoinJsonPointer(valuePath),
        });
    }
    onConstraintError(constraint, parameter, schemaPath, valuePath) {
        this.errors.push({
            category: "constraint",
            constraint: constraint,
            parameter: parameter,
            schemaPath: JoinJsonPointer(schemaPath),
            valuePath: JoinJsonPointer(valuePath),
        });
    }
    onCombinedError(combined, validated, schemaPath, valuePath) {
        this.errors.push({
            category: "combined",
            combined: combined,
            parameter: validated,
            schemaPath: JoinJsonPointer(schemaPath),
            valuePath: JoinJsonPointer(valuePath),
        });
    }
    onTerminal(_schema, _schemaPath, _value, _valuePath) { }
    onStartObject(_schema, _schemaPath, _value, _valuePath) { }
    onEndObject() { }
    onStartArray(_schema, _schemaPath, _value, _valuePath) { }
    onEndArray() { }
    onStartCombined(_schema, _schemaPath, _value, _valuePath) { }
    onEndCombined() { }
}
export function ValidateSchema(schema, value) {
    const handler = new ValidateSchemaHandlerWithCapture(null);
    DoValidateSchema(schema, [], value, [], handler);
    return handler.errors;
}
