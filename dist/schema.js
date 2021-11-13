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
export const TRUE_SCHEMA = {
    __symbol: Symbol(),
    __root: null,
    type: "any",
};
TRUE_SCHEMA.__root = TRUE_SCHEMA;
Object.freeze(TRUE_SCHEMA);
export const FALSE_SCHEMA = {
    __symbol: Symbol(),
    __root: null,
    type: "combined",
    not: TRUE_SCHEMA,
};
FALSE_SCHEMA.__root = FALSE_SCHEMA;
Object.freeze(FALSE_SCHEMA);
