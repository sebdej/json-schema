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
import { relativeJsonPointer } from "./utilities";
import { doValidateSchema } from "./validate";
const INVALID_STATE = "Invalid state";
const NOT_IMPLEMENTED = "Not implemented";
class ValidateChoicesHandler {
    constructor(parent) {
        this.parent = parent;
        this.hasError = false;
        this.stack = [];
        this.result = null;
    }
    consolidateObject(item, parent, relative) {
        const key = relative[1];
        if (relative.length !== 2 || typeof key !== "string") {
            throw new Error(INVALID_STATE);
        }
        if (relative[0] === "properties") {
            this.consolidateObjectProperty(item, parent, key);
        }
        else {
            throw new Error(NOT_IMPLEMENTED);
        }
    }
    consolidateArray(item, parent, relative) {
        if (relative.length === 2) {
            if (relative[0] === "items") {
                const key = relative[1];
                if (typeof key !== "number") {
                    throw new Error(INVALID_STATE);
                }
                this.consolidateArrayItem(item, parent, key);
            }
            else {
                throw new Error(INVALID_STATE);
            }
        }
        else {
            throw new Error(NOT_IMPLEMENTED);
        }
    }
    consolidateCombined(item, parent, relative) {
        const index = relative[1];
        if (relative.length !== 2 || typeof index !== "number") {
            throw new Error(INVALID_STATE);
        }
        switch (relative[0]) {
            case "oneOf":
                return this.consolidateOneOf(item, parent, index);
            case "allOf":
                return this.consolidateAllOf(item, parent, index);
            case "anyOf":
                return this.consolidateAnyOf(item, parent, index);
            default:
                throw new Error(INVALID_STATE);
        }
    }
    consolidate(item) {
        if (this.stack.length > 0) {
            const parent = this.stack[this.stack.length - 1];
            const relative = relativeJsonPointer(parent.schemaPath, item.schemaPath);
            if (relative === null) {
                throw new Error(INVALID_STATE);
            }
            switch (parent.type) {
                case "object":
                    this.consolidateObject(item, parent, relative);
                    break;
                case "array":
                    this.consolidateArray(item, parent, relative);
                    break;
                case "combined":
                    this.consolidateCombined(item, parent, relative);
                    break;
                default:
                    throw new Error(INVALID_STATE);
            }
        }
        else {
            if (this.result !== null) {
                throw new Error(INVALID_STATE);
            }
            // TODO: vérifier schemaPath, valuePath
            this.result = item;
        }
    }
    pushStackItem(item) {
        if (!this.hasError) {
            this.stack.push(item);
            if (item.type === "terminal") {
                this.popStackItem("terminal");
            }
        }
    }
    popStackItem(type) {
        if (!this.hasError) {
            if (this.stack.length > 0) {
                const item = this.stack.pop();
                if (item.type !== type) {
                    throw new Error(INVALID_STATE);
                }
                this.consolidate(item);
            }
            else {
                throw new Error(INVALID_STATE);
            }
        }
    }
    isValid() {
        return !this.hasError;
    }
    merge(handler) {
        if (!(handler instanceof ValidateChoicesHandler)) {
            throw new Error("Invalid handler");
        }
        const local = handler;
        if (local.parent !== this) {
            throw new Error("Handler is not a child");
        }
        if (!this.hasError) {
            if (local.hasError) {
                this.hasError = true;
            }
            else {
                if (local.result === null) {
                    throw new Error("Local handler is not closed");
                }
                this.consolidate(local.result);
            }
        }
    }
    onFalse(_schemaPath, _valuePath) {
        this.hasError = true;
    }
    onUnexpectedType(_value, _valuePath, _schemaPath) {
        this.hasError = true;
    }
    onConstraintError(_constraint, _parameter, _valuePath, _schemaPath) {
        this.hasError = true;
    }
    onMissingProperty(_valuePath, _schemaPath) {
        this.hasError = true;
    }
    onUnexpectedProperty(_valuePath, _schemaPath) {
        this.hasError = true;
    }
    onNotSupported(_valuePath, _schemaPath) {
        this.hasError = true;
    }
    onCombinedError(_combined, _validated, _valuePath, _schemaPath) {
        this.hasError = true;
    }
    onTerminal(schema, schemaPath, _value, _valuePath) {
        this.pushStackItem(this.createTerminal(schema, schemaPath));
    }
    onStartObject(schema, schemaPath, _value, _valuePath) {
        this.pushStackItem(this.createObject(schema, schemaPath));
    }
    onEndObject() {
        this.popStackItem("object");
    }
    onStartArray(schema, schemaPath, _value, _valuePath) {
        this.pushStackItem(this.creatArray(schema, schemaPath));
    }
    onEndArray() {
        this.popStackItem("array");
    }
    onStartCombined(schema, schemaPath, _value, _valuePath) {
        this.pushStackItem(this.createCombined(schema, schemaPath));
    }
    onEndCombined() {
        this.popStackItem("combined");
    }
    createLocal() {
        throw new Error(NOT_IMPLEMENTED);
    }
    consolidateObjectProperty(_item, _parent, _name) {
        throw new Error(NOT_IMPLEMENTED);
    }
    consolidateArrayItem(_item, _parent, _index) {
        throw new Error(NOT_IMPLEMENTED);
    }
    consolidateOneOf(_item, _parent, _index) {
        throw new Error(NOT_IMPLEMENTED);
    }
    consolidateAllOf(_item, _parent, _index) {
        throw new Error(NOT_IMPLEMENTED);
    }
    consolidateAnyOf(_item, _parent, _index) {
        throw new Error(NOT_IMPLEMENTED);
    }
    createTerminal(_schema, _schemaPath) {
        throw new Error(NOT_IMPLEMENTED);
    }
    createObject(_schema, _schemaPath) {
        throw new Error(NOT_IMPLEMENTED);
    }
    creatArray(_schema, _schemaPath) {
        throw new Error(NOT_IMPLEMENTED);
    }
    createCombined(_schema, _schemaPath) {
        throw new Error(NOT_IMPLEMENTED);
    }
}
class ExplainChoicesHandler extends ValidateChoicesHandler {
    createLocal() {
        return new ExplainChoicesHandler(this);
    }
    consolidateObjectProperty(item, parent, name) {
        if (!item.invariant) {
            parent.invariant = false;
            if (typeof parent.node.properties === "undefined") {
                parent.node.properties = { [name]: item.node };
            }
            else {
                parent.node.properties[name] = item.node;
            }
        }
    }
    consolidateArrayItem(item, parent, index) {
        if (!item.invariant) {
            parent.invariant = false;
            if (typeof parent.node.items === "undefined") {
                parent.node.items = { [index]: item.node };
            }
            else {
                parent.node.items[index] = item.node;
            }
        }
    }
    consolidateOneOf(item, parent, index) {
        parent.invariant = false; // TODO: peut mieux faire.
        if (typeof parent.node.oneOf === "undefined") {
            if (item.invariant) {
                parent.node.oneOf = index;
            }
            else {
                parent.node.oneOf = { [index]: item.node };
            }
        }
        else {
            throw new Error(INVALID_STATE);
        }
    }
    consolidateAllOf(item, parent, index) {
        parent.invariant = false; // TODO: peut mieux faire.
        if (item.invariant) {
            if (typeof parent.node.allOf === "undefined") {
                parent.node.allOf = { [index]: item.node };
            }
            else {
                parent.node.allOf[index] = item.node;
            }
        }
    }
    consolidateAnyOf(item, parent, index) {
        parent.invariant = false; // TODO: peut mieux faire.
        if (typeof parent.node.anyOf === "undefined") {
            parent.node.anyOf = { [index]: item.invariant ? true : item.node };
        }
        else {
            parent.node.anyOf[index] = item.invariant ? true : item.node;
        }
    }
    createTerminal(schema, schemaPath) {
        return { type: "terminal", node: true, schemaPath, invariant: true };
    }
    createObject(schema, schemaPath) {
        return { type: "object", node: {}, schemaPath, invariant: true };
    }
    creatArray(schema, schemaPath) {
        return { type: "array", node: {}, schemaPath, invariant: true };
    }
    createCombined(schema, schemaPath) {
        return { type: "combined", node: {}, schemaPath, invariant: true };
    }
}
// Etant donnés un schéma JSON et une valeur, on renvoie une structure qui indique les choix effectués pour choisir les schémas oneOf / anyOf / allOf /...
// Si le schéma ne valide pas la valeur, renvoie 'null'.
// Sinon renvoie une structure similaire à un schéma JSON (avec des propriétés comme 'properties', 'items', 'oneOf', 'anyOf', 'allOf',...) mais plus compact,
// avec comme différence par exemple, qu'un schéma où aucun embranchment n'a été fait est remplacé par la valeur 'true'.
export function explainValidationChoices(schema, value) {
    const handler = new ExplainChoicesHandler(null);
    doValidateSchema(schema, [], value, [], handler);
    if (handler.isValid()) {
        if (handler.stack.length > 0) {
            throw new Error(INVALID_STATE);
        }
        if (handler.result === null) {
            throw new Error(INVALID_STATE);
        }
        else {
            if (handler.result.invariant) {
                return true;
            }
            return handler.result.node;
        }
    }
    else {
        return null;
    }
}
