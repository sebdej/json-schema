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
