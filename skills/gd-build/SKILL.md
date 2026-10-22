---
name: gd-build
description: GraphDocs step 2. Implement a drafted plan autonomously - code it, link code to nodes, write tests per branch, run them, fix up to 3 times, then mark the plan for review. Use right after gd-plan, or when gd state says "build".
---

# gd-build

Rules from the **graphdocs** skill apply. Runs **without stopping** until tests pass or 3 fix attempts fail.

## 1. Start

- Plan id from gd-plan, or from `gd state` (`build: drafts of …` / `resume …`).
- `gd status doing plan:<id>`
- Read the plan's nodes, forms, entities and messages in `.graphdocs/graph.md`.

## 2. Implement

- Code exactly what the graph says: actions, every branch (`when`), forms with their validation, entity changes, message texts by code.
- Nothing beyond the plan's level. No extra edge cases.
- Link code as you go: `gd node set <id> code=src/api/auth.ts#login`.
- If the plan turns out wrong or impossible: **stop**, update the draft with `gd`, AskUserQuestion with 2–3 options (recommendation first). Never silently build something else.

## 3. Test

- **Unit tests (always):** one per conditional branch of the plan (each edge with `when`), plus form validation rules. API / logic tests call the handler or endpoint directly.
- **Integration test (only if the plan has a form or UI):** drive the real app with `agent-browser` through the plan's main flow (open → fill the form → submit → check the result/message). Start the dev server yourself. Level 3 also covers the `fail` edges.
- **`agent-browser` missing** (`command -v agent-browser`): detect the OS (`uname -s`) and offer the install by AskUserQuestion, then run it plus `agent-browser install` (downloads Chrome):

| OS | Options (first = Recommended) |
|---|---|
| macOS | `brew install agent-browser` · `npm install -g agent-browser` · skip |
| Linux | `npm install -g agent-browser` then `agent-browser install --with-deps` · `cargo install agent-browser` · skip |
| Windows | `npm install -g agent-browser` · `cargo install agent-browser` · skip |

  Skip → no integration test; say so in the report's "Try by hand" line.
- Run `config.json` → `test`. Unset (e.g. new project) → never ask: use the standard runner of the code's language, installing/configuring it if missing.
- Fail → fix → rerun. **Max 3 attempts.**
- Still failing → stop and report in 3 lines: what fails, suspected cause, then AskUserQuestion with 2–3 ways forward (recommendation first).

## 4. End

`gd status review plan:<id>`, then **invoke the `gd-report` skill now**. Do not write your own summary: the report format lives there.
