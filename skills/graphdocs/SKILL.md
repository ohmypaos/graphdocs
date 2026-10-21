---
name: graphdocs
description: Entry point of the GraphDocs workflow. Use for any work in a project that has a .graphdocs/ folder (feature requests, changes, bug fixes, "where are we", user feedback on a report) or when the user wants to start a project with GraphDocs. Reads the graph state and routes to gd-init, gd-plan, gd-build or gd-report.
---

# GraphDocs router

The project's official docs are ONE graph in `.graphdocs/index.html`. The graph leads the code.

## CLI

`gd` below means the CLI printed at session start (`GraphDocs CLI: node ".../gd.js"`).
If it is missing, use `node <this skill's base dir>/../../scripts/gd.js`.
Always run it literally as `node "<path>" <args>`: no `gd` function or alias (clashes with a common git alias), no `$VAR` holding the command (zsh does not split it).
`gd help` lists every command.

## Graph JSON (for `gd apply <file>`, write the file outside the repo)

All keys are optional except ids. An unknown key is rejected.

```json
{
  "nodes": [{ "id": "auth.login", "type": "actor|action|result", "label": "", "note": "", "feature": "Parent/Child",
              "status": "draft|doing|review|done", "level": 1, "plan": "p-x",
              "form": "form.login", "data": ["users"], "message": "ERR_X", "code": ["src/a.ts#fn"], "rules": [""], "links": ["id"] }],
  "edges": [{ "from": "id", "to": "id", "when": "condition", "kind": "ok|fail|nav" }],
  "forms": [{ "id": "form.login", "label": "", "status": "", "level": 1, "plan": "",
              "fields": [{ "name": "email", "label": "", "type": "email", "required": true,
                           "rules": [{ "rule": "valid email", "msg": "ERR_EMAIL" }], "maps": "users.email",
                           "placeholder": "", "default": "", "hint": "" }] }],
  "entities": [{ "id": "users", "label": "", "status": "", "level": 1, "plan": "",
                 "columns": [{ "name": "id", "type": "uuid", "required": true, "key": "pk|fk|unique",
                               "ref": "table.col", "default": "", "note": "", "index": true }] }],
  "messages": { "ERR_EMAIL": "Invalid email" }
}
```

Upsert: nodes/forms/entities by `id`, edges by `from`+`to`, fields/columns by `name`. New nodes get their `#no` automatically.

## Route

1. No `.graphdocs/` → repo already has app code: **gd-import** · empty/new project: **gd-init**.
2. Else run `gd state`, then route on its `next →`:

| State / user intent | Go to |
|---|---|
| "Document / import existing feature X" | **gd-import** |
| `report: waiting…` and the user says ok / gives feedback | **gd-report** |
| `build: resume …` or `build: drafts of …` | **gd-build** |
| New request, change of direction, bug | **gd-plan** |
| "Where are we?" | Answer from `gd state` + `.graphdocs/graph.md`, in 3 lines max |

Invoke the target skill and follow it. Each step skill ends by naming the next one.

## Rules for every step

- **Graph leads code.** No code change without a plan on the graph.
- **Never edit `.graphdocs/` by hand** (a hook blocks it). Only `gd`.
- Read `.graphdocs/graph.md` to understand the project, never the HTML.
- **Brief.** No prose pages. Labels a few words, reports 3–5 lines.
- **Detail level** (`config.json` → `level`, or the plan's own): 1 main flow only · 2 + common errors · 3 + every edge case. Never go beyond it.
- **Questions:** one at a time with AskUserQuestion, multiple choice, first option = recommendation, labeled "(Recommended)", with a one-line reason.
- Docs text (labels, notes, messages) in `config.json` → `lang`.
- **Commits:** never add `Co-Authored-By` or any attribution / "generated with" line.
