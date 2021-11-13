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
export function encodeJsonPointerComponent(value) {
    if (typeof value == "number") {
        return value.toString();
    }
    return value.replaceAll(/\/|~/g, (match) => (match == "~" ? "~0" : "~1"));
}
export function splitJsonPointer(value) {
    const parts = value.split("/");
    if (parts.length == 0) {
        return [];
    }
    if (parts[0] != "") {
        throw new Error(`Invalid JSON Pointer: ${value}`);
    }
    return parts.slice(1).map((value) => value.replaceAll("~1", "/").replaceAll("~0", "~"));
}
export function joinJsonPointer(value) {
    if (value.length == 0) {
        return "";
    }
    return "/" + value.map(encodeJsonPointerComponent).join("/");
}
export function splitUriFragment(value) {
    const index = value.indexOf("#");
    if (index < 0) {
        return [value, ""];
    }
    return [value.substring(0, index), value.substring(index + 1)];
}
// Retourne le pointeur relatif de [pointer] par rapport à [base].
// Si [pointer] n'est pas un préfixe de [base] alors retourne <null>.
export function relativeJsonPointer(base, pointer) {
    for (let i = 0; i < base.length; ++i) {
        if (base[i] !== pointer[i]) {
            return null; // [base] n'est pas un préfixe de [pointer].
        }
    }
    return pointer.slice(base.length);
}
// Navigue dans le schéma JSON [schema] en suivant le pointeur JSON [path].
// Retourne le schéma JSON trouvé ou <null> si le pointeur est invalide.
export function resolveJsonPointer(schema, path) {
    for (let i = 0; i < path.length; ++i) {
        const testSchema = schema[path[i]];
        if (typeof testSchema != "object" || testSchema == null) {
            return null;
        }
        schema = testSchema;
    }
    return schema;
}
// Compare deux valeurs JSON de manière récursive.
export function deepEquals(a, b) {
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
                    if (!deepEquals(a[i], b[i])) {
                        return false;
                    }
                }
                return true;
            }
            else {
                return false;
            }
        }
        else {
            if (Array.isArray(b)) {
                return false;
            }
            else {
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
                    if (!deepEquals(a[key], b[key])) {
                        return false;
                    }
                }
                return true;
            }
        }
    }
    return false;
}
