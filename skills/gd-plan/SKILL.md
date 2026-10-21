---
name: gd-plan
description: GraphDocs step 1. Turn a user request (new feature, change, bug fix) into a draft branch on the graph - clarify with multiple-choice questions, then draft nodes, edges, forms, entities and messages as one plan. Use whenever a request would change code in a GraphDocs project.
---

# gd-plan

Rules from the **graphdocs** skill apply.

## 1. Understand

- Read `.graphdocs/graph.md`. Find the feature and the nodes the request touches.
- Level = `config.json` level, unless the user names one for this plan ("level 3").

## 2. Clarify (the only time the user is asked before the report)

- Ask only questions whose answer changes the graph. Usually 1–4. Skip what is obvious.
- One at a time, AskUserQuestion, first option "(Recommended)" + one-line reason.
- Do not ask about edge cases beyond the level.

## 3. Draft

Plan id: `p-<short-slug>` (e.g. `p-login-google`). Write one JSON file outside the repo, then `gd apply <file>` (full shape in the **graphdocs** skill):

```json
{ "nodes": [ { "id": "auth.google", "type": "action", "label": "Login with Google",
               "feature": "Account/Login", "plan": "p-login-google", "form": "form.login", "data": ["users"] },
             { "id": "auth.google-error", "type": "result", "label": "Google error",
               "feature": "Account/Login", "plan": "p-login-google", "message": "ERR_GOOGLE" } ],
  "edges": [ { "from": "auth.google", "to": "auth.google-error", "when": "cancelled", "kind": "fail" } ],
  "forms": [], "entities": [], "messages": { "ERR_GOOGLE": "Could not sign in with Google" } }
```

- **Nodes**: one of actor / action / result, fine-grained (an action, not a feature). Conditions go on edges (`when`), `kind`: ok (default) · fail · nav.
- Actors are shared across features (no `feature`): reuse existing ones, never duplicate.
- New nodes: `plan` set, status draft (default). Existing nodes the plan changes: set `plan` and `status: "draft"` too.
- Card text stays minimal: `label` short; extra info in `note`; user-facing text only as a `message` code.
- **Forms** only for screens with input or validation: fields with type, required, rules → message code, `maps` → `entity.column`. Pure UI is not documented.
- **Entities**: columns with type, required, key (pk/fk/unique), `ref` for fk. Level 2 adds default + note, level 3 adds index.
- Set `plan` on new or changed forms/entities as well.
- Level decides how many branches: 1 main flow · 2 + common errors · 3 + every edge case.

Then `gd check` and fix until `ok`.

## 4. End

No stop, no approval request: answering the questions approved the plan.
**Now invoke the `gd-build` skill** with this plan id.
