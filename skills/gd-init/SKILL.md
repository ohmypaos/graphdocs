---
name: gd-init
description: GraphDocs step 0. Start GraphDocs in a new project - brainstorm the idea with the user, create .graphdocs/ and draw the skeleton graph. Use when the user wants to set up GraphDocs or the graphdocs router finds no .graphdocs/ folder.
---

# gd-init

Rules from the **graphdocs** skill apply (CLI path, brevity, question style, no attribution).

## 1. Brainstorm (one question at a time, AskUserQuestion, recommendation first)

Ask only what you can't infer from the repo or the user's message:

1. Project name + one-line idea.
2. Main actors (who uses it).
3. Main features (3–7), grouped by parent if natural: `Account/Login`.
4. Default detail level: 1 simple (Recommended for solo/small) · 2 medium · 3 full.
5. Docs language: `vi` · `en` (recommend the language the user writes in).
6. Test command: detect first (`package.json` scripts.test, pytest, go test, cargo test…), ask to confirm.

## 2. Create

```
gd init --title "<name>" --lang <vi|en> --level <1-3> --test "<cmd>"
```

## 3. Skeleton graph

One `gd apply <file>` (write the JSON to a temp file outside the repo; shape in the **graphdocs** skill):

- Actors + **main flows only** per feature (actor → action → result), at the default level.
- Every node `status: draft`, **no `plan`** (skeleton = backlog).
- Ids are feature slugs: `auth.login`, `order.pay-card`. Short labels.
- No forms / entities / messages yet: plans add them when a feature is built.

Then `gd check` until clean.

## 4. End

Tell the user in 2 lines: skeleton ready + `.graphdocs/index.html` to open.
**Next:** wait for the first request → **gd-plan**.
