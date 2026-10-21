---
name: gd-report
description: GraphDocs step 3. Report a built plan in 3-5 lines and close it - on the user's "ok" mark it done, merge it into the official graph and commit code plus .graphdocs together; on feedback, fix small things directly or re-plan. Use after gd-build, or when gd state says "report".
---

# gd-report

Rules from the **graphdocs** skill apply.

## 1. Report (then stop and wait)

Exactly this shape, in `config.json` → `lang`:

```
✅ <plan title>: <n> nodes, <n> files
🧪 Tests: <passed>/<total>
👆 Try by hand: <the one thing tests can't prove, or "nothing">
🗺 .graphdocs/index.html#<no of the plan's first node>
→ "ok" to make it official
```

## 2. The user answers

| Answer | Do |
|---|---|
| ok | `gd status done plan:<id>` → `gd merge <id>` → commit (below) |
| Small fix (text, a bug, a style) | Fix directly, rerun tests, report again |
| Changes flow or requirements | **gd-plan** with 1–2 questions, update the same draft, then gd-build |
| Drop it | `gd discard <id>`, revert its code with git, confirm in 1 line |

## 3. Commit (on ok)

- One commit: code + `.graphdocs/`.
- Message from the plan: `feat(<feature>): <what>` (or fix/refactor).
- **No `Co-Authored-By`, no attribution, no "generated with" line.**

Confirm in 1 line. **Next:** wait for the next request → **gd-plan**.
