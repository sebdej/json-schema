# 🧩 JSON Schema Library

This is an open-source **TypeScript** library designed to simplify working with **JSON Schema** in modern web applications.

> 🎯 Its main goal is to make JSON Schema usage easy, ergonomic, and powerful — from data validation to automatic UI generation.

---

## ✨ Features

### 🧠 Smart Schema Management
- **Automatic `$ref` resolution** – referenced schemas are seamlessly replaced by their full definitions.
- **Schema classification** – categorize and analyze schemas to help automatically generate intuitive and user-friendly interfaces.

### ✅ Advanced Data Validation
- **Full JSON Schema validation** for any JSON object.
- **Detailed error reporting** – each error includes:
  - The **exact path** to the invalid field as a Json Pointer for the data (e.g. `/user/2/name`) and another for the schema (e.g.`/properties/user/item/property/name`).
  - The **JSON Schema constraint** that failed (e.g. `minLength`, `enum`, `required`)
- **Choice explanations** – when using `oneOf`, `if / then / else`, etc., the validator can explain **which branch was selected** and why.

### 🌍 Internationalization (i18n)
- No hardcoded error strings in error messages!
- Developers can **add custom translations** easily.

---

Apache License, Version 2.0.

