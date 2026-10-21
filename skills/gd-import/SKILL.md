---
name: gd-import
description: GraphDocs for an existing codebase - scan the code, let the user pick features, then draw their current flows, forms, tables and messages exactly as the code behaves, for the user to confirm. Use when starting GraphDocs in a repo that already has app code, or when the user asks to document (import) more existing features into the graph.
---

# gd-import

Rules from the **graphdocs** skill apply (CLI, JSON shape, brevity, question style, no attribution).
Document **what the code does today**. Never invent or "fix" behavior here; changes go through gd-plan later.

## 1. Init (only if `.graphdocs/` is missing)

- Infer the title from the repo (package.json, README…). Detect the test command.
- Ask in one AskUserQuestion call: docs language (`vi`/`en`), default level (1 Recommended), test command (confirm the detected one).
- `gd init --title "…" --lang … --level … --test "…"`. No skeleton.

## 2. Scan

Use a code index if the repo has one (e.g. `.codegraph/`), else glob/grep. Look for:

| Find | Becomes |
|---|---|
| Routes, handlers, pages, commands, jobs | actions (+ actors: who triggers them) |
| Return paths, thrown errors, redirects | results + edges with `when` (`kind: fail` for errors) |
| Validation schemas, form components | forms (fields, required, rules) |
| Models, migrations, ORM schemas | entities (columns, keys, fk) |
| User-facing strings, i18n keys | messages (reuse existing keys as codes) |

Group into features `Parent/Child`. Skip features already in `.graphdocs/graph.md`.

## 3. Pick

AskUserQuestion, `multiSelect: true`, one question per parent feature (max 4 options each, max 4 questions per call; more → several calls).
Option = feature name, description = one line + main file. Recommend nothing; the user decides scope.

## 4. Draw

One `gd apply <file>` per pick, plan id `p-import-<slug>`:

- Every node, form and entity: `"plan": "p-import-<slug>"`, `"status": "review"`.
- **Actors are shared**: one node per real actor across all features (`actor.guest`, `actor.user`), no `feature`. Reuse an existing actor id; never create a second node for the same actor.
- Every action node gets `code` (file#symbol). Results get `code` when a distinct place produces them.
- Branches: only those the level asks for (1 main flow · 2 + common errors · 3 + every edge case), and only if the code really has them.
- Forms only where there is input/validation. Entities only those the picked features touch.
- Unsure about intent (dead code, unclear rule)? Draw what the code does and add `note: "? <doubt>"`.

`gd check` until `ok`.

## 5. Report (then stop and wait)

```
📥 Imported <features>: <n> nodes, <n> forms, <n> tables, <n> messages
❓ Unsure: <#no: doubt, …> or "nothing"
🗺 .graphdocs/index.html
→ "ok" to make it official
```

The user's answer is handled by **gd-report** (ok → done + merge + commit `.graphdocs/` only, as `docs(graphdocs): import <features>`).
