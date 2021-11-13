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

import { ArraySchema, CombinedSchema, JsonValue, ObjectSchema, ResolvedJsonSchema, TerminalSchema } from "./schema";
import { relativeJsonPointer } from "./utilities";
import { Combined, Constraint, doValidateSchema, SchemaPath, ValidateSchemaHandler, ValuePath } from "./validate";

type NodeType = "terminal" | "object" | "array" | "combined";

type BuildBaseStackItem<PROPS, NODE, TYPE> = {
  type: TYPE;
  schemaPath: SchemaPath;
  node: NODE;
} & PROPS;

type BaseStackItemTerminal<PROPS, CHOICE> = BuildBaseStackItem<PROPS, CHOICE, "terminal">;
type BaseStackItemObject<PROPS, CHOICE> = BuildBaseStackItem<PROPS, CHOICE, "object">;
type BaseStackItemArray<PROPS, CHOICE> = BuildBaseStackItem<PROPS, CHOICE, "array">;
type BaseStackItemCombined<PROPS, CHOICE> = BuildBaseStackItem<PROPS, CHOICE, "combined">;

type BaseStackItem<PROPS, TERMINAL, OBJECT, ARRAY, COMBINED> =
  | BaseStackItemTerminal<PROPS, TERMINAL>
  | BaseStackItemObject<PROPS, OBJECT>
  | BaseStackItemArray<PROPS, ARRAY>
  | BaseStackItemCombined<PROPS, COMBINED>;

const INVALID_STATE = "Invalid state";
const NOT_IMPLEMENTED = "Not implemented";

class ValidateChoicesHandler<PROPS, TERMINAL, OBJECT, ARRAY, COMBINED> implements ValidateSchemaHandler {
  hasError: boolean = false;
  stack: BaseStackItem<PROPS, TERMINAL, OBJECT, ARRAY, COMBINED>[] = [];
  result: BaseStackItem<PROPS, TERMINAL, OBJECT, ARRAY, COMBINED> | null = null;

  constructor(private parent: ValidateSchemaHandler | null) {}

  private consolidateObject(
    item: BaseStackItem<PROPS, TERMINAL, OBJECT, ARRAY, COMBINED>,
    parent: BaseStackItemObject<PROPS, OBJECT>,
    relative: (string | number)[]
  ): void {
    const key = relative[1];

    if (relative.length !== 2 || typeof key !== "string") {
      throw new Error(INVALID_STATE);
    }

    if (relative[0] === "properties") {
      this.consolidateObjectProperty(item, parent, key);
    } else {
      throw new Error(NOT_IMPLEMENTED);
    }
  }

  private consolidateArray(
    item: BaseStackItem<PROPS, TERMINAL, OBJECT, ARRAY, COMBINED>,
    parent: BaseStackItemArray<PROPS, ARRAY>,
    relative: (string | number)[]
  ): void {
    if (relative.length === 2) {
      if (relative[0] === "items") {
        const key = relative[1];

        if (typeof key !== "number") {
          throw new Error(INVALID_STATE);
        }

        this.consolidateArrayItem(item, parent, key);
      } else {
        throw new Error(INVALID_STATE);
      }
    } else {
      throw new Error(NOT_IMPLEMENTED);
    }
  }

  private consolidateCombined(
    item: BaseStackItem<PROPS, TERMINAL, OBJECT, ARRAY, COMBINED>,
    parent: BaseStackItemCombined<PROPS, COMBINED>,
    relative: (string | number)[]
  ): void {
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

  private consolidate(item: BaseStackItem<PROPS, TERMINAL, OBJECT, ARRAY, COMBINED>): void {
    if (this.stack.length > 0) {
      const parent = this.stack[this.stack.length - 1];

      const relative = relativeJsonPointer(parent.schemaPath, item.schemaPath);

      if (relative === null) {
        throw new Error(INVALID_STATE);
      }

      switch (parent.type) {
        case "object":
          this.consolidateObject(item, parent as BaseStackItemObject<PROPS, OBJECT>, relative);
          break;

        case "array":
          this.consolidateArray(item, parent as BaseStackItemArray<PROPS, ARRAY>, relative);
          break;

        case "combined":
          this.consolidateCombined(item, parent as BaseStackItemCombined<PROPS, COMBINED>, relative);
          break;

        default:
          throw new Error(INVALID_STATE);
      }
    } else {
      if (this.result !== null) {
        throw new Error(INVALID_STATE);
      }

      // TODO: vérifier schemaPath, valuePath

      this.result = item;
    }
  }

  private pushStackItem(item: BaseStackItem<PROPS, TERMINAL, OBJECT, ARRAY, COMBINED>): void {
    if (!this.hasError) {
      this.stack.push(item);

      if (item.type === "terminal") {
        this.popStackItem("terminal");
      }
    }
  }

  private popStackItem(type: NodeType): void {
    if (!this.hasError) {
      if (this.stack.length > 0) {
        const item = this.stack.pop()!;

        if (item.type !== type) {
          throw new Error(INVALID_STATE);
        }

        this.consolidate(item);
      } else {
        throw new Error(INVALID_STATE);
      }
    }
  }

  isValid(): boolean {
    return !this.hasError;
  }

  merge(handler: ValidateSchemaHandler): void {
    if (!(handler instanceof ValidateChoicesHandler)) {
      throw new Error("Invalid handler");
    }

    const local = handler as ValidateChoicesHandler<PROPS, TERMINAL, OBJECT, ARRAY, COMBINED>;

    if (local.parent !== this) {
      throw new Error("Handler is not a child");
    }

    if (!this.hasError) {
      if (local.hasError) {
        this.hasError = true;
      } else {
        if (local.result === null) {
          throw new Error("Local handler is not closed");
        }

        this.consolidate(local.result);
      }
    }
  }

  onFalse(_schemaPath: SchemaPath, _valuePath: ValuePath): void {
    this.hasError = true;
  }

  onUnexpectedType(_value: JsonValue, _valuePath: ValuePath, _schemaPath: SchemaPath): void {
    this.hasError = true;
  }

  onConstraintError(
    _constraint: Constraint,
    _parameter: JsonValue | undefined,
    _valuePath: ValuePath,
    _schemaPath: SchemaPath
  ): void {
    this.hasError = true;
  }

  onMissingProperty(_valuePath: ValuePath, _schemaPath: SchemaPath): void {
    this.hasError = true;
  }

  onUnexpectedProperty(_valuePath: ValuePath, _schemaPath: SchemaPath): void {
    this.hasError = true;
  }

  onNotSupported(_valuePath: ValuePath, _schemaPath: SchemaPath): void {
    this.hasError = true;
  }

  onCombinedError(_combined: Combined, _validated: number[], _valuePath: ValuePath, _schemaPath: SchemaPath): void {
    this.hasError = true;
  }

  onTerminal(schema: TerminalSchema, schemaPath: SchemaPath, _value: JsonValue, _valuePath: ValuePath): void {
    this.pushStackItem(this.createTerminal(schema, schemaPath));
  }

  onStartObject(schema: ObjectSchema, schemaPath: SchemaPath, _value: JsonValue, _valuePath: ValuePath): void {
    this.pushStackItem(this.createObject(schema, schemaPath));
  }

  onEndObject(): void {
    this.popStackItem("object");
  }

  onStartArray(schema: ArraySchema, schemaPath: SchemaPath, _value: JsonValue, _valuePath: ValuePath): void {
    this.pushStackItem(this.creatArray(schema, schemaPath));
  }

  onEndArray(): void {
    this.popStackItem("array");
  }

  onStartCombined(schema: CombinedSchema, schemaPath: SchemaPath, _value: JsonValue, _valuePath: ValuePath): void {
    this.pushStackItem(this.createCombined(schema, schemaPath));
  }

  onEndCombined(): void {
    this.popStackItem("combined");
  }

  createLocal(): ValidateSchemaHandler {
    throw new Error(NOT_IMPLEMENTED);
  }

  consolidateObjectProperty(
    _item: BaseStackItem<PROPS, TERMINAL, OBJECT, ARRAY, COMBINED>,
    _parent: BaseStackItemObject<PROPS, OBJECT>,
    _name: string
  ): void {
    throw new Error(NOT_IMPLEMENTED);
  }

  consolidateArrayItem(
    _item: BaseStackItem<PROPS, TERMINAL, OBJECT, ARRAY, COMBINED>,
    _parent: BaseStackItemArray<PROPS, ARRAY>,
    _index: number
  ): void {
    throw new Error(NOT_IMPLEMENTED);
  }

  consolidateOneOf(
    _item: BaseStackItem<PROPS, TERMINAL, OBJECT, ARRAY, COMBINED>,
    _parent: BaseStackItemCombined<PROPS, COMBINED>,
    _index: number
  ): void {
    throw new Error(NOT_IMPLEMENTED);
  }

  consolidateAllOf(
    _item: BaseStackItem<PROPS, TERMINAL, OBJECT, ARRAY, COMBINED>,
    _parent: BaseStackItemCombined<PROPS, COMBINED>,
    _index: number
  ): void {
    throw new Error(NOT_IMPLEMENTED);
  }

  consolidateAnyOf(
    _item: BaseStackItem<PROPS, TERMINAL, OBJECT, ARRAY, COMBINED>,
    _parent: BaseStackItemCombined<PROPS, COMBINED>,
    _index: number
  ): void {
    throw new Error(NOT_IMPLEMENTED);
  }

  createTerminal(_schema: TerminalSchema, _schemaPath: SchemaPath): BaseStackItemTerminal<PROPS, TERMINAL> {
    throw new Error(NOT_IMPLEMENTED);
  }

  createObject(_schema: ObjectSchema, _schemaPath: SchemaPath): BaseStackItemObject<PROPS, OBJECT> {
    throw new Error(NOT_IMPLEMENTED);
  }

  creatArray(_schema: ArraySchema, _schemaPath: SchemaPath): BaseStackItemArray<PROPS, ARRAY> {
    throw new Error(NOT_IMPLEMENTED);
  }

  createCombined(_schema: CombinedSchema, _schemaPath: SchemaPath): BaseStackItemCombined<PROPS, COMBINED> {
    throw new Error(NOT_IMPLEMENTED);
  }
}

type ExplainChoicesProps = { invariant: boolean };

type ExplainChoicesTerminal = true;

type ExplainChoicesObject = {
  properties?: { [key: string]: ExplainChoicesPath };
};

type ExplainChoicesArray = {
  items?: { [key: number]: ExplainChoicesPath };
};

interface ExplainChoicesCombined {
  oneOf?: number | { [key: number]: ExplainChoicesPath };
  allOf?: { [key: number]: ExplainChoicesPath };
  anyOf?: { [key: number]: true | ExplainChoicesPath };
}

export type ExplainChoicesPath =
  | ExplainChoicesTerminal
  | ExplainChoicesObject
  | ExplainChoicesArray
  | ExplainChoicesCombined;

type ExplainChoicesStackItem = BaseStackItem<
  ExplainChoicesProps,
  ExplainChoicesTerminal,
  ExplainChoicesObject,
  ExplainChoicesArray,
  ExplainChoicesCombined
>;

class ExplainChoicesHandler extends ValidateChoicesHandler<
  ExplainChoicesProps,
  ExplainChoicesTerminal,
  ExplainChoicesObject,
  ExplainChoicesArray,
  ExplainChoicesCombined
> {
  createLocal(): ValidateSchemaHandler {
    return new ExplainChoicesHandler(this);
  }

  consolidateObjectProperty(
    item: ExplainChoicesStackItem,
    parent: BaseStackItemObject<ExplainChoicesProps, ExplainChoicesObject>,
    name: string
  ): void {
    if (!item.invariant) {
      parent.invariant = false;

      if (typeof parent.node.properties === "undefined") {
        parent.node.properties = { [name]: item.node };
      } else {
        parent.node.properties[name] = item.node;
      }
    }
  }

  consolidateArrayItem(
    item: ExplainChoicesStackItem,
    parent: BaseStackItemArray<ExplainChoicesProps, ExplainChoicesArray>,
    index: number
  ): void {
    if (!item.invariant) {
      parent.invariant = false;

      if (typeof parent.node.items === "undefined") {
        parent.node.items = { [index]: item.node };
      } else {
        parent.node.items[index] = item.node;
      }
    }
  }

  consolidateOneOf(
    item: ExplainChoicesStackItem,
    parent: BaseStackItemCombined<ExplainChoicesProps, ExplainChoicesCombined>,
    index: number
  ): void {
    parent.invariant = false; // TODO: peut mieux faire.

    if (typeof parent.node.oneOf === "undefined") {
      if (item.invariant) {
        parent.node.oneOf = index;
      } else {
        parent.node.oneOf = { [index]: item.node };
      }
    } else {
      throw new Error(INVALID_STATE);
    }
  }

  consolidateAllOf(
    item: ExplainChoicesStackItem,
    parent: BaseStackItemCombined<ExplainChoicesProps, ExplainChoicesCombined>,
    index: number
  ): void {
    parent.invariant = false; // TODO: peut mieux faire.

    if (item.invariant) {
      if (typeof parent.node.allOf === "undefined") {
        parent.node.allOf = { [index]: item.node };
      } else {
        parent.node.allOf[index] = item.node;
      }
    }
  }

  consolidateAnyOf(
    item: ExplainChoicesStackItem,
    parent: BaseStackItemCombined<ExplainChoicesProps, ExplainChoicesCombined>,
    index: number
  ): void {
    parent.invariant = false; // TODO: peut mieux faire.

    if (typeof parent.node.anyOf === "undefined") {
      parent.node.anyOf = { [index]: item.invariant ? true : item.node };
    } else {
      parent.node.anyOf[index] = item.invariant ? true : item.node;
    }
  }

  createTerminal(
    schema: TerminalSchema,
    schemaPath: SchemaPath
  ): BaseStackItemTerminal<ExplainChoicesProps, ExplainChoicesTerminal> {
    return { type: "terminal", node: true, schemaPath, invariant: true };
  }

  createObject(
    schema: ObjectSchema,
    schemaPath: SchemaPath
  ): BaseStackItemObject<ExplainChoicesProps, ExplainChoicesObject> {
    return { type: "object", node: {}, schemaPath, invariant: true };
  }

  creatArray(
    schema: ArraySchema,
    schemaPath: SchemaPath
  ): BaseStackItemArray<ExplainChoicesProps, ExplainChoicesArray> {
    return { type: "array", node: {}, schemaPath, invariant: true };
  }

  createCombined(
    schema: CombinedSchema,
    schemaPath: SchemaPath
  ): BaseStackItemCombined<ExplainChoicesProps, ExplainChoicesCombined> {
    return { type: "combined", node: {}, schemaPath, invariant: true };
  }
}

// Etant donnés un schéma JSON et une valeur, on renvoie une structure qui indique les choix effectués pour choisir les schémas oneOf / anyOf / allOf /...
// Si le schéma ne valide pas la valeur, renvoie 'null'.
// Sinon renvoie une structure similaire à un schéma JSON (avec des propriétés comme 'properties', 'items', 'oneOf', 'anyOf', 'allOf',...) mais plus compact,
// avec comme différence par exemple, qu'un schéma où aucun embranchment n'a été fait est remplacé par la valeur 'true'.
export function explainValidationChoices(schema: ResolvedJsonSchema, value: JsonValue): ExplainChoicesPath | null {
  const handler = new ExplainChoicesHandler(null);

  doValidateSchema(schema, [], value, [], handler);

  if (handler.isValid()) {
    if (handler.stack.length > 0) {
      throw new Error(INVALID_STATE);
    }

    if (handler.result === null) {
      throw new Error(INVALID_STATE);
    } else {
      if (handler.result.invariant) {
        return true;
      }

      return handler.result.node;
    }
  } else {
    return null;
  }
}
