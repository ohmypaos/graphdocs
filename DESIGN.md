# GraphDocs — Design

> Claude Code plugin. A project's docs are **one interactive graph** (HTML), not long text.
> Spec for building the plugin. Update it whenever a decision changes.

## 1. Why

| Pain | Answer |
|---|---|
| Reviewing long AI-written docs is a nightmare | Diagram you can approve in ~30s |
| Small / solo projects need speed | Short → try → fail → fix |
| AI over-engineers, covers every edge case | User picks the detail level; agent stops there |
| Docs drift from code | Every change goes through the graph first |

## 2. Principles

1. **Graph is the source of truth.** It is the project's official, long-lived documentation.
2. **Graph leads code.** No code change without a plan on the graph.
3. **Minimal but sufficient.** No prose. Labels are a few words, details are 1–3 lines.
4. **User sets the detail level.** The agent never goes beyond it.
5. **Two touchpoints only:** the plan brainstorm and confirming the report. Everything else runs on its own.
6. **Questions:** one at a time, multiple choice, one option recommended with a short reason.
7. **HTML is view-only.** All feedback goes through chat.

## 3. Data model

### Nodes

Each node is exactly **one** of:

| Type | Icon | Example |
|---|---|---|
| `actor` | 👤 | User, Admin, Payment gateway |
| `action` | ⚙ | Enter email/password |
| `result` | ◎ | Dashboard shown |

Nodes are fine-grained (an action, never a whole feature).

| Field | Meaning |
|---|---|
| `id` | Feature slug, unique: `auth.login-google` |
| `type` | `actor` · `action` · `result` |
| `label` | Short name |
| `feature` | Path: `Sales/Order/Payment`, which drives color and collapsing |
| `status` | See below |
| `code` | File/symbol links: `src/api/auth.ts#login` |
| `rules` | Only constraints that can't be drawn as an edge (1–2 lines) |
| `links` | Cross-links to nodes in other features |
| `plan` | Draft plan id, while not yet merged |

### Edges

`from → to`, with an optional `when` condition. **Business rules live on the edges.**

```
👤 User ─▶ ⚙ Enter email/pass ─[correct]──────▶ ◎ Dashboard
                              ├─[wrong, < 5]──▶ ◎ Show error
                              └─[wrong, ≥ 5]──▶ ◎ Lock 15 min
```

### Hierarchy = semantic zoom

- No group nodes. Parent/child is read from edge direction.
- Zoom out: nodes sharing a feature collapse into one node labeled with that feature.
- Same feature means same color.

```
Zoom in : 👤 Customer ─▶ 🟦Pick item ─▶ 🟦Cart ─▶ 🟩Pay ─[wallet]─▶ 🟩Paid
Zoom 1  : 👤 Customer ─▶ 🟦[Pick items] ─▶ 🟩[Payment]
Zoom 2  : 👤 Customer ─▶ 🟪[Order]
```

### Status

```
draft ─▶ doing ─▶ review ─▶ done
```

| Status | Display | Router's next step |
|---|---|---|
| `draft` | dashed border | build |
| `doing` | solid border + ◐ | resume build |
| `review` | solid border + ⏳ | remind the user of the report |
| `done` | bold border + ✓ | none |

### Detail levels

| Level | Covers | Login example |
|---|---|---|
| ① Simple | Main flow only | login → dashboard |
| ② Medium | + common errors | + wrong password |
| ③ Full | + every edge case | + lockout, locked account, offline, session expiry |

- The project default is set at init. A plan can override it ("this plan at ③").
- Each branch shows a level badge, so a sparse area reads as "not detailed", not "no errors".

## 4. Workflow

```
 INIT    brainstorm (idea, actors, features, level, lang, test cmd) ─▶ skeleton graph
   │
   ▼
 PLAN    brainstorm (choices + recommendation) ─▶ draft branch     ◀── user answers
   │
   ▼
 BUILD   code ─▶ self-test ─▶ fix (max 3 tries)                    (autonomous)
   │       └─ still failing ─▶ report error + cause + 2–3 options
   ▼
 REPORT  3–5 lines + graph link                                    ◀── user "ok"?
   ├─ ok             ─▶ merge draft into graph ─▶ regen md ─▶ commit
   ├─ small fix      ─▶ fix directly ─▶ REPORT
   └─ changes reqs   ─▶ PLAN (1–2 questions) ─▶ update draft
```

- **Init:** brainstorm, then a skeleton graph at the overview zoom. Asks for the docs language (`en` / `vi`), the default level, and the test command (detected, then confirmed).
- **Plan:** the draft attaches to its parent node in the main graph. Answering the brainstorm counts as approving the requirements.
- **Build:** writes tests per conditional branch, at the plan's level. Updates status and code links as it goes.
- **Report format:**
  ```
  ✅ Login Google: 4 nodes, 3 files
  🧪 Tests: 6/6 pass
  👆 Try by hand: "Sign in with Google" button on mobile
  🗺 .graphdocs/index.html#auth.login-google
  → 'ok' to make it official
  ```
- **Commit after "ok":** one commit with code + `.graphdocs/`, message derived from the plan. **No `Co-Authored-By` or any attribution trailer.**

## 5. Viewer

| Aspect | Decision |
|---|---|
| Layout | Left → right (actor → action → result) |
| Zoom | Scroll zooms the whole graph; click a collapsed node to expand only it |
| Color | Fill = feature |
| Status | Border style + small corner icon |
| Details | Click → side panel (rules, code, cross-links, level). Hover shows the full name only |
| Draft / impact | Overlay on the main graph: draft dashed, affected nodes orange border, rest dimmed |
| Deep link | `#<node-id>` opens the overlay focused on that node (used by reports) |
| Tools | Node search only (no filters, no minimap) |

## 6. Output: `.graphdocs/` in the user's project

```
.graphdocs/
├─ index.html    viewer + graph JSON in <script id="graph" type="application/json">  ← source of truth
├─ graph.md      generated for agents, never edited by hand
├─ config.json   { "lang": "vi", "level": 1, "test": "npm test" }
└─ lib/          cytoscape, elk (vendored, works offline over file://)
```

- Data is embedded because `file://` blocks `fetch()` of sibling JSON.
- `graph.md` is an edge list per feature, with status and code link:
  ```
  ## Auth (level ①)
  - 👤user → ⚙auth.login                      ✓ src/api/auth.ts
  - ⚙auth.login →[correct]→ ◎auth.dashboard   ✓
  - ⚙auth.login →[wrong]→ ◎auth.error         ◐
  ```
- All output text is in the language set by `config.lang`, and stays short.

## 7. Plugin structure

```
graphdocs/
├─ .claude-plugin/plugin.json
├─ skills/
│  ├─ graphdocs/    router: reads graph state → invokes the right step
│  ├─ gd-init/
│  ├─ gd-plan/
│  ├─ gd-build/
│  └─ gd-report/    each step ends with "next: …"
├─ scripts/gd.js    CLI, the only way to modify the graph
├─ hooks/
└─ viewer/          index.html template + lib
```

### CLI (`node scripts/gd.js …`)

```
gd node add  --type action --label "Login Google" --feature "Auth" --plan p1
gd link      auth.login auth.login-google --when "valid token"
gd status    auth.login-google done
gd merge     p1
```

Every command validates the schema, writes the JSON block into `index.html`, and regenerates `graph.md`.

### Hooks

| Hook | Effect |
|---|---|
| `SessionStart` | If `.graphdocs/` exists, inject one line of state: "1 plan awaiting ok, 2 nodes doing" |
| `PreToolUse` (Edit/Write) | Block direct edits under `.graphdocs/`; use the CLI |

## 8. Conventions

- Skills, scripts and plugin code are in **English**.
- Generated docs are in **English or Vietnamese**, chosen at init.
- Everything (skills, labels, reports) is **very short and clear**. No full pages of prose.
- Commits carry **no co-author or attribution lines**.

## 9. Scope

| Now | Later |
|---|---|
| New projects | Bootstrap a graph from an existing codebase |

Out of scope: editing inside the HTML, filters, minimap.
