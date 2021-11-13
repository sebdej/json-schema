import {
  JsonSchemaResolver,
  JsonSchemaFetcher,
  RawObjectJsonSchema,
  ResolvedJsonSchema,
  ObjectSchema,
  CombinedSchema,
  StringSchema,
  NumberSchema,
  IntegerSchema,
  TRUE_SCHEMA,
  FALSE_SCHEMA,
  ArraySchema,
  ExplainValidationChoices,
} from "../src";

function select(value: any, path: string | string[]): any {
  if (typeof path == "string") {
    return select(value, path.split("/"));
  }

  for (const index of path) {
    if (typeof value === "object" && value !== null) {
      if (Array.isArray(value)) {
        const arrayIndex = parseInt(index, 10);

        if (isNaN(arrayIndex)) {
          return undefined;
        }

        value = value[arrayIndex];
      } else {
        value = value[index];
      }
    } else {
      return undefined;
    }
  }

  return value;
}

const allSchemas: { [uri: string]: RawObjectJsonSchema } = {
  "self-referenced": {
    $id: "self-referenced",
    type: "object",
    properties: {
      related: {
        $ref: "#",
      },
    },
  },
  "cyclic-a": {
    $id: "cyclic-a",
    type: "object",
    properties: {
      related: {
        $ref: "cyclic-b",
      },
    },
  },
  "cyclic-b": {
    $id: "cyclic-b",
    type: "object",
    properties: {
      related: {
        $ref: "cyclic-a",
      },
    },
  },
  "simple-string": {
    $id: "simple-string",
    type: "string",
    minLength: 2,
    maxLength: 3,
    pattern: "[a-z]*",
    format: "date",
  },
  "simple-number": {
    $id: "simple-number",
    type: "number",
    multipleOf: 3,
    minimum: 1,
    exclusiveMinimum: 0,
    maximum: 99,
    exclusiveMaximum: 100,
  },
  "simple-integer": {
    $id: "simple-integer",
    type: "integer",
    multipleOf: 3,
    minimum: 1,
    exclusiveMinimum: 0,
    maximum: 99,
    exclusiveMaximum: 100,
  },
  "simple-boolean": {
    $id: "simple-boolean",
    type: "boolean",
  },
  "simple-null": {
    $id: "simple-null",
    type: "null",
  },
  "simple-object": {
    $id: "simple-object",
    type: "object",
    properties: {
      a: { type: "string" },
      b: { type: "number" },
      c: {
        type: "object",
        additionalProperties: false,
      },
      d: {
        type: "object",
        additionalProperties: true,
      },
    },
    patternProperties: {
      "[0-9]+": {
        type: "integer",
      },
    },
    additionalProperties: {
      type: "boolean",
    },
    minProperties: 1,
    maxProperties: 100,
    propertyNames: {
      pattern: "^.+$",
    },
  },
  "simple-array": {
    $id: "simple-array",
    type: "array",
    items: { type: "string" },
    prefixItems: [{ type: "number" }, { type: "string" }, { type: "boolean" }],
    contains: {
      type: "string",
    },
    minContains: 1,
    maxContains: 3,
    minItems: 1,
    maxItems: 10,
    uniqueItems: true,
  },
  "simple-anyOf": {
    $id: "simple-anyOf",
    anyOf: [{ $ref: "simple-string" }, { $ref: "simple-number" }],
  },
  "simple-oneOf": {
    $id: "simple-oneOf",
    oneOf: [{ $ref: "simple-string" }, { $ref: "simple-number" }],
  },
  "simple-allOf": {
    $id: "simple-allOf",
    allOf: [{ $ref: "simple-string" }, { $ref: "simple-number" }],
  },
  "simple-definitions": {
    $id: "simple-definitions",
    $defs: {
      string: {
        type: "string",
      },
      number: {
        type: "number",
      },
    },
  },
  "external-definition": {
    $id: "external-definition",
    properties: {
      a: { $ref: "simple-definitions#/$defs/string" },
      b: { $ref: "simple-definitions#/$defs/number" },
    },
  },
  true: {
    $id: "true",
  },
  "type-is-array": {
    $id: "type-is-array",
    type: ["string", "number"],
  },
  "combined-2": {
    $id: "combined-2",
    oneOf: [
      { type: "array", items: { $ref: "simple-oneOf" } },
      {
        type: "object",
        properties: { a: { $ref: "simple-oneOf" }, b: { $ref: "simple-oneOf" } },
        additionalProperties: false,
      },
    ],
  },
  "combined-recursive": {
    $id: "combined-recursive",
    oneOf: [{ type: "array", items: { $ref: "combined-recursive" } }, { $ref: "simple-oneOf" }],
  },
};

class JsonSchemaFetcherMock implements JsonSchemaFetcher {
  async get(uri: string): Promise<RawObjectJsonSchema> {
    const schema = allSchemas[uri];

    if (typeof schema != "undefined") {
      return schema;
    }

    throw new Error("Not found: " + uri);
  }
}

describe("JsonSchemaResolver", function () {
  let jsonSchemaResolver: JsonSchemaResolver;

  beforeEach(() => {
    jsonSchemaResolver = new JsonSchemaResolver(new JsonSchemaFetcherMock());
  });

  test("self-referenced schema should work", async function () {
    const value = await jsonSchemaResolver.get("self-referenced");

    expect(value).toBeDefined();
    expect(value.__symbol).toBeDefined();
    expect(value.type).toBe("object");
    expect(select(value, "properties/related/$id")).toBe("self-referenced");
    expect(select(value, "properties/related/__symbol")).toBe(value.__symbol);
    expect(select(value, "properties/related/properties/related/$id")).toBe("self-referenced");
    expect(select(value, "properties/related/properties/related/__symbol")).toBe(value.__symbol);
  });

  test("cyclic schema should work", async function () {
    const value = await jsonSchemaResolver.get("cyclic-a");

    expect(value).toBeDefined();
    expect(value.__symbol).toBeDefined();
    expect(value.type).toBe("object");
    expect(select(value, "properties/related/$id")).toBe("cyclic-b");
    expect(select(value, "properties/related/__symbol")).not.toBe(value.__symbol);
    expect(select(value, "properties/related/properties/related/$id")).toBe("cyclic-a");
    expect(select(value, "properties/related/properties/related/__symbol")).toBe(value.__symbol);
    expect(select(value, "properties/related/properties/related/properties/related/$id")).toBe("cyclic-b");
  });

  test("simple string schema should work", async function () {
    const value = await jsonSchemaResolver.get("simple-string");
    const schema = value as StringSchema;

    expect(schema).toBeDefined();
    expect(schema.__symbol).toBeDefined();
    expect(schema.type).toBe("string");
    expect(schema.minLength).toBe(2);
    expect(schema.maxLength).toBe(3);
    expect(schema.pattern).toBe("[a-z]*");
    expect(schema.format).toBe("date");
  });

  test("simple number schema should work", async function () {
    const value = await jsonSchemaResolver.get("simple-number");
    const schema = value as NumberSchema;

    expect(schema).toBeDefined();
    expect(schema.__symbol).toBeDefined();
    expect(schema.type).toBe("number");
    expect(schema.multipleOf).toBe(3);
    expect(schema.minimum).toBe(1);
    expect(schema.exclusiveMinimum).toBe(0);
    expect(schema.maximum).toBe(99);
    expect(schema.exclusiveMaximum).toBe(100);
  });

  test("simple integer schema should work", async function () {
    const value = await jsonSchemaResolver.get("simple-integer");
    const schema = value as IntegerSchema;

    expect(schema).toBeDefined();
    expect(schema.__symbol).toBeDefined();
    expect(schema.type).toBe("integer");
    expect(schema.multipleOf).toBe(3);
    expect(schema.minimum).toBe(1);
    expect(schema.exclusiveMinimum).toBe(0);
    expect(schema.maximum).toBe(99);
    expect(schema.exclusiveMaximum).toBe(100);
  });

  test("simple boolean schema should work", async function () {
    const value = await jsonSchemaResolver.get("simple-boolean");

    expect(value).toBeDefined();
    expect(value.__symbol).toBeDefined();
    expect(value.type).toBe("boolean");
  });

  test("simple null schema should work", async function () {
    const value = await jsonSchemaResolver.get("simple-null");

    expect(value).toBeDefined();
    expect(value.__symbol).toBeDefined();
    expect(value.type).toBe("null");
  });

  test("simple object schema should work", async function () {
    const value = await jsonSchemaResolver.get("simple-object");
    const schema = value as ObjectSchema;

    expect(schema).toBeDefined();
    expect(schema.__symbol).toBeDefined();
    expect(schema.type).toBe("object");
    expect(schema.properties).toBeDefined();
    expect(select(schema, "properties/a")).toBeDefined();
    expect(select(schema, "properties/a/type")).toBe("string");
    expect(select(schema, "properties/b")).toBeDefined();
    expect(select(schema, "properties/b/type")).toBe("number");
    expect(select(schema, "properties/c")).toBeDefined();
    expect(select(schema, "properties/c/type")).toBe("object");
    expect(select(schema, "properties/c/additionalProperties/__symbol")).toBe(FALSE_SCHEMA.__symbol);
    expect(select(schema, "properties/d")).toBeDefined();
    expect(select(schema, "properties/d/type")).toBe("object");
    expect(select(schema, "properties/d/additionalProperties/__symbol")).toBe(TRUE_SCHEMA.__symbol);
    expect(schema.patternProperties).toBeDefined();
    expect(select(schema, "patternProperties/[0-9]+/type")).toBe("integer");
    expect(schema.additionalProperties).toBeDefined();
    expect(select(schema, "additionalProperties/type")).toBe("boolean");
    expect(schema.minProperties).toBe(1);
    expect(schema.maxProperties).toBe(100);
    expect(select(schema, "propertyNames/pattern")).toBe("^.+$");
  });

  test("simple array schema should work", async function () {
    const value = await jsonSchemaResolver.get("simple-array");
    const schema = value as ArraySchema;

    expect(schema).toBeDefined();
    expect(schema.__symbol).toBeDefined();
    expect(schema.type).toBe("array");
    expect(schema.items).toBeDefined();
    expect(schema.items!.type).toBe("string");
    expect(schema.minItems).toBe(1);
    expect(schema.maxItems).toBe(10);
    expect(schema.uniqueItems).toBe(true);
    expect(schema.prefixItems).toBeDefined();
    expect(select(schema, "prefixItems/0/type")).toBe("number");
    expect(select(schema, "prefixItems/1/type")).toBe("string");
    expect(select(schema, "prefixItems/2/type")).toBe("boolean");
    expect(schema.contains).toBeDefined();
    expect(schema.contains!.type).toBe("string");
    expect(schema.minContains).toBe(1);
    expect(schema.maxContains).toBe(3);
  });

  test("simple anyOf schema should work", async function () {
    const value = await jsonSchemaResolver.get("simple-anyOf");

    expect(value).toBeDefined();
    expect(value.__symbol).toBeDefined();
    expect(value.type).toBe("combined");
    expect((value as CombinedSchema).anyOf).toBeDefined();
  });

  test("simple oneOf schema should work", async function () {
    const value = await jsonSchemaResolver.get("simple-oneOf");

    expect(value).toBeDefined();
    expect(value.__symbol).toBeDefined();
    expect(value.type).toBe("combined");
    expect((value as CombinedSchema).oneOf).toBeDefined();
  });

  test("simple allOf schema should work", async function () {
    const value = await jsonSchemaResolver.get("simple-allOf");

    expect(value).toBeDefined();
    expect(value.__symbol).toBeDefined();
    expect(value.type).toBe("combined");
    expect((value as CombinedSchema).allOf).toBeDefined();
  });

  test("schema definitions should work", async function () {
    const value = await jsonSchemaResolver.get("simple-definitions");

    expect(value).toBeDefined();
    expect(value.__symbol).toBeDefined();
    expect(select(value, "$defs")).toBeDefined();
  });

  test("schema definitions references 1 should work", async function () {
    const value = await jsonSchemaResolver.get("simple-definitions#/$defs/string");

    expect(value).toBeDefined();
    expect(value.__symbol).toBeDefined();
    expect(value.type).toBe("string");
  });

  test("schema definitions references 2 should work", async function () {
    const value = await jsonSchemaResolver.get("simple-definitions#/$defs/number");

    expect(value).toBeDefined();
    expect(value.__symbol).toBeDefined();
    expect(value.type).toBe("number");
  });

  test("external references to schema definitions should work", async function () {
    const value = await jsonSchemaResolver.get("external-definition");

    expect(value).toBeDefined();
    expect(value.__symbol).toBeDefined();
    expect(select(value, "properties/a/type")).toBe("string");
    expect(select(value, "properties/b/type")).toBe("number");
  });

  test("true schema should work", async function () {
    const value = await jsonSchemaResolver.get("true");

    expect(value).toBeDefined();
    expect(value.type).toBe("any");
  });

  test("array of simple types should work", async function () {
    const value = await jsonSchemaResolver.get("type-is-array");

    expect(value).toBeDefined();
    expect(value.type).toBe("combined");
  });
});

describe("ExplainValidationChoices", function () {
  let jsonSchemaResolver: JsonSchemaResolver;

  beforeEach(() => {
    jsonSchemaResolver = new JsonSchemaResolver(new JsonSchemaFetcherMock());
  });

  test("simple-string with string should work", async function () {
    const schema = (await jsonSchemaResolver.get("simple-string")) as ResolvedJsonSchema;
    expect(schema).toBeDefined();

    const result = ExplainValidationChoices(schema, "abc");
    expect(result).toBeDefined();
    expect(result).toBe(true);
  });

  test("simple-string with number should not work", async function () {
    const schema = (await jsonSchemaResolver.get("simple-string")) as ResolvedJsonSchema;
    expect(schema).toBeDefined();

    const result = ExplainValidationChoices(schema, 123);
    expect(result).toBeDefined();
    expect(result).toBe(null);
  });

  test("simple-number with number should work", async function () {
    const schema = (await jsonSchemaResolver.get("simple-number")) as ResolvedJsonSchema;
    expect(schema).toBeDefined();

    const result = ExplainValidationChoices(schema, 12);
    expect(result).toBeDefined();
    expect(result).toBe(true);
  });

  test("simple-boolean with boolean should work", async function () {
    const schema = (await jsonSchemaResolver.get("simple-boolean")) as ResolvedJsonSchema;
    expect(schema).toBeDefined();

    const result = ExplainValidationChoices(schema, true);
    expect(result).toBeDefined();
    expect(result).toBe(true);
  });

  test("simple-object should work", async function () {
    const schema = (await jsonSchemaResolver.get("simple-object")) as ResolvedJsonSchema;
    expect(schema).toBeDefined();

    const result = ExplainValidationChoices(schema, { a: "test", b: 123, c: {}, d: { x: 1 } });
    expect(result).toBeDefined();
    expect(result).toBe(true);
  });

  test("simple-array should work", async function () {
    const schema = (await jsonSchemaResolver.get("simple-array")) as ResolvedJsonSchema;
    expect(schema).toBeDefined();

    const result = ExplainValidationChoices(schema, ["aa", "bb", "ccc"]);
    expect(result).toBeDefined();
    expect(result).toBe(true);
  });

  test("simple-oneOf with string should work", async function () {
    const schema = (await jsonSchemaResolver.get("simple-oneOf")) as ResolvedJsonSchema;
    expect(schema).toBeDefined();

    const result = ExplainValidationChoices(schema, "abc");
    expect(result).toBeDefined();
    expect(result).toStrictEqual({ oneOf: 0 });
  });

  test("simple-oneOf with number should work", async function () {
    const schema = (await jsonSchemaResolver.get("simple-oneOf")) as ResolvedJsonSchema;
    expect(schema).toBeDefined();

    const result = ExplainValidationChoices(schema, 33);
    expect(result).toBeDefined();
    expect(result).toStrictEqual({ oneOf: 1 });
  });

  test("simple-oneOf with bool should not work", async function () {
    const schema = (await jsonSchemaResolver.get("simple-oneOf")) as ResolvedJsonSchema;
    expect(schema).toBeDefined();

    const result = ExplainValidationChoices(schema, true);
    expect(result).toBeDefined();
    expect(result).toBe(null);
  });

  test("combined-2 with array of strings and numbers should work", async function () {
    const schema = (await jsonSchemaResolver.get("combined-2")) as ResolvedJsonSchema;
    expect(schema).toBeDefined();

    const result = ExplainValidationChoices(schema, ["aaa", 3, "cc"]);
    expect(result).toBeDefined();
    expect(result).toStrictEqual({
      oneOf: { 0: { items: { 0: { oneOf: 0 }, 1: { oneOf: 1 }, 2: { oneOf: 0 } } } },
    });
  });

  test("combined-2 with object of strings and numbers should work", async function () {
    const schema = (await jsonSchemaResolver.get("combined-2")) as ResolvedJsonSchema;
    expect(schema).toBeDefined();

    const result = ExplainValidationChoices(schema, { a: "aaa", b: 3 });
    expect(result).toBeDefined();
    expect(result).toStrictEqual({
      oneOf: { 1: { properties: { a: { oneOf: 0 }, b: { oneOf: 1 } } } },
    });
  });

  test("combined-recursive should work", async function () {
    const schema = (await jsonSchemaResolver.get("combined-recursive")) as ResolvedJsonSchema;
    expect(schema).toBeDefined();

    const result = ExplainValidationChoices(schema, ["aaa", ["bbb", 3], [[[33]]]]);
    expect(result).toBeDefined();
    expect(result).toStrictEqual({
      oneOf: {
        0: {
          items: {
            0: { oneOf: { 1: { oneOf: 0 } } },
            1: {
              oneOf: {
                0: {
                  items: { 0: { oneOf: { 1: { oneOf: 0 } } }, 1: { oneOf: { 1: { oneOf: 1 } } } },
                },
              },
            },
            2: {
              oneOf: {
                0: {
                  items: {
                    0: {
                      oneOf: {
                        0: {
                          items: { 0: { oneOf: { 0: { items: { 0: { oneOf: { 1: { oneOf: 1 } } } } } } } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  });

  test("combined-2 with additional properties should not work", async function () {
    const schema = (await jsonSchemaResolver.get("combined-2")) as ResolvedJsonSchema;
    expect(schema).toBeDefined();

    const result = ExplainValidationChoices(schema, { a: "aaa", b: 3, c: "bb" });
    expect(result).toBeDefined();
    expect(result).toBe(null);
  });

  test("combined-2 with array of numbers should work", async function () {
    const schema = (await jsonSchemaResolver.get("combined-2")) as ResolvedJsonSchema;
    expect(schema).toBeDefined();

    const result = ExplainValidationChoices(schema, [1, 2, 3]);
    expect(result).toBeDefined();
  });

  test("combined-2 with array of booleans should not work", async function () {
    const schema = (await jsonSchemaResolver.get("combined-2")) as ResolvedJsonSchema;
    expect(schema).toBeDefined();

    const result = ExplainValidationChoices(schema, [true, false, true]);
    expect(result).toBeDefined();
  });

  test("combined-2 with object of strings should work", async function () {
    const schema = (await jsonSchemaResolver.get("combined-2")) as ResolvedJsonSchema;
    expect(schema).toBeDefined();

    const result = ExplainValidationChoices(schema, { a: "x", b: "y" });
    expect(result).toBeDefined();
  });

  test("combined-2 with object of numbers should work", async function () {
    const schema = (await jsonSchemaResolver.get("combined-2")) as ResolvedJsonSchema;
    expect(schema).toBeDefined();

    const result = ExplainValidationChoices(schema, { a: 1, b: 2 });
    expect(result).toBeDefined();
  });

  test("combined-2 with object of mixed string/number should work", async function () {
    const schema = (await jsonSchemaResolver.get("combined-2")) as ResolvedJsonSchema;
    expect(schema).toBeDefined();

    const result = ExplainValidationChoices(schema, { a: 1, b: "2" });
    expect(result).toBeDefined();
  });

  test("combined-2 with object of mixed string/boolean should not work", async function () {
    const schema = (await jsonSchemaResolver.get("combined-2")) as ResolvedJsonSchema;
    expect(schema).toBeDefined();

    const result = ExplainValidationChoices(schema, { a: true, b: "2" });
    expect(result).toBeDefined();
    expect(result).toBe(null);
  });
});
