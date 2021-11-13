import { JsonValue, ResolvedJsonSchema } from "./schema";

export type TypedJsonPointer = (string | number)[];
export type NonTypedJsonPointer = string[];

export function EncodeJsonPathComponent(value: string | number): string {
  if (typeof value == "number") {
    return value.toString();
  }

  return value.replaceAll(/\/|~/g, (match) => (match == "~" ? "~0" : "~1"));
}

export function SplitJsonPointer(value: string): NonTypedJsonPointer {
  return value.split("/").map((value) => value.replaceAll("~1", "/").replaceAll("~0", "~"));
}

export function JoinJsonPointer(value: TypedJsonPointer): string {
  if (value.length == 0) {
    return "";
  }

  return "/" + value.map(EncodeJsonPathComponent).join("/");
}

export function SplitUriFragment(value: string): [string, string] {
  const index = value.indexOf("#");

  if (index < 0) {
    return [value, ""];
  }

  return [value.substring(0, index), value.substring(index + 1)];
}

// Retourne le pointeur relatif de [pointer] par rapport à [base].
// Si [pointer] n'est pas un préfixe de [base] alors retourne <null>.
export function RelativeJsonPointer(
  base: (string | number)[],
  pointer: (string | number)[]
): (string | number)[] | null {
  for (let i = 0; i < base.length; ++i) {
    if (base[i] !== pointer[i]) {
      return null; // [base] n'est pas un préfixe de [pointer].
    }
  }

  return pointer.slice(base.length);
}

// Navigue dans le schéma JSON [schema] en suivant le pointeur JSON [path].
// Retourne le schéma JSON trouvé ou <null> si le pointeur est invalide.
export function ResolveJsonPointer(schema: ResolvedJsonSchema, path: TypedJsonPointer): ResolvedJsonSchema | null {
  for (let i = 0; i < path.length; ++i) {
    const testSchema = (schema as unknown as { [key: string | number]: ResolvedJsonSchema })[path[i]];

    if (typeof testSchema != "object" || testSchema == null) {
      return null;
    }

    schema = testSchema;
  }

  return schema;
}

// Compare deux valeurs JSON de manière récursive.
export function DeepEquals(a: JsonValue, b: JsonValue): boolean {
  if (typeof a !== typeof b) {
    return false;
  }

  if (a === b) {
    return true;
  }

  if (typeof a === "object" && a !== null && typeof b === "object" && b !== null) {
    if (Array.isArray(a)) {
      if (Array.isArray(b)) {
        if (a.length !== b.length) {
          return false;
        }

        for (let i = 0; i < a.length; ++i) {
          if (!DeepEquals(a[i], b[i])) {
            return false;
          }
        }

        return true;
      } else {
        return false;
      }
    } else {
      if (Array.isArray(b)) {
        return false;
      } else {
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);

        if (keysA.length != keysB.length) {
          return false;
        }

        keysA.sort();
        keysB.sort();

        for (let i = 0; i < keysA.length; ++i) {
          if (keysA[i] != keysB[i]) {
            return false;
          }
        }

        for (let i = 0; i < keysA.length; ++i) {
          const key = keysA[i];

          if (!DeepEquals(a[key], b[key])) {
            return false;
          }
        }

        return true;
      }
    }
  }

  return false;
}
