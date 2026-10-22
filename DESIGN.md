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
6. **Questions:** one at a time, multiple choice (multiSelect for lists), one option recommended with a short reason. Options are inferred, never blank: the user types as little as possible.
7. **HTML is view-only.** All feedback goes through chat.
8. **Replies in `config.lang`, ending with a next action.** Every reply ends with an AskUserQuestion of next actions (recommended first). All user input is a choice.

## 3. Data model

### Nodes

Each node is exactly **one** of:

| Type | Shown as | Example |
|---|---|---|
| `actor` | pill with avatar | User, Admin, Payment gateway |
| `action` | card, thick left border | Enter email/password |
| `result` | card | Dashboard shown |

Nodes are fine-grained (an action, never a whole feature). **Actors are shared** across features: one node per real actor, no `feature`.

| Field | Meaning |
|---|---|
| `id` | Feature slug, unique: `auth.login-google` |
| `no` | Stable number shown as `#12`, for talking about a node. The CLI assigns it incrementally and never reuses one. Deep links accept it |
| `type` | `actor` · `action` · `result` |
| `label` | Short name |
| `note` | Optional extra info, shown in the detail panel only |
| `feature` | Path: `Sales/Order/Payment`. Each feature is one section. Not set on actors |
| `status` | See below |
| `code` | File/symbol links: `src/api/auth.ts#login` |
| `rules` | Only constraints that can't be drawn as an edge (1–2 lines) |
| `links` | Extra cross-links to other nodes (panel) |
| `level` | Detail level the node was planned at (default: `meta.level`) |
| `plan` | Plan id (`p-<slug>`, imports `p-import-<slug>`) until merged |
| `form` | Action only: the form it submits (`form.login`) |
| `data` | Action only: entities it reads/writes (`["users", "sessions"]`) |
| `message` | Result only: message code shown to the user (`ERR_LOGIN_FAILED`) |

### Edges

`from → to`, with an optional `when` condition and `kind`. **Business rules live on the edges.**

| `kind` | Line |
|---|---|
| `ok` (default) | solid, accent |
| `fail` | dashed, muted |
| `nav` | solid, gray: moves on to the next step |
| (from an actor) | thin, gray |

```
(User) ─▶ [Enter email/pass] ─(correct)──────▶ [Dashboard]
                             ┄(wrong, < 5)┄┄┄▶ [Show error]
                             ┄(wrong, ≥ 5)┄┄┄▶ [Lock 15 min]
```

### Sections (no zoom)

- No group nodes, no zoom. **One section per feature**, which can be collapsed.
- The parent path is written **once** as a group heading. Each sub-feature is a soft rounded block under it, titled with its own name only, so there is no repeated prefix. (A left menu was tried and dropped: little value.)
- A shared actor is drawn in every section where it acts.
- An edge to another feature is not drawn. The card shows a reference instead (`→ #12`, `← #4`, tooltip = name) that jumps to it.

```
ACCOUNT
╭ ▾ Login  2 · 3/6 done ─────────────────────────────╮
│ 👤 Customer ─▶ Enter email/pass ─(correct)─▶ Home  │
╰────────────────────────────────────────────────────╯
SALES
╭ ▸ Order  1 · 3/3 done  (collapsed) ────────────────╮
╭ ▾ Payment  3 · 3/5 done ───────────────────────────╮
```

### Forms, data, messages

The flow alone isn't enough to build from. Three more parts, linked to the flow, give the full spec:

| Part | Holds | Linked from |
|---|---|---|
| `forms` | Per form: fields, plus the actions that use it (taken from nodes with that `form`) | action `form` |
| `entities` | DB tables: columns, keys, relations (ERD) | action `data`, field `maps` |
| `messages` | Central table: code → text, in `meta.lang` | result `message`, field rule `msg` |

**Only forms**, meaning screens with input or validation. Pure UI is not documented here; it lives in the design, elsewhere. A form with no fields is not shown.

**Field** (in a form):

| Attr | Example |
|---|---|
| `name`, `label`, `type` | `email`, "Email", `email` (text · email · password · number · date · select · checkbox · file…) |
| `required` | `true` |
| `rules` | `[{ "rule": "min 8", "msg": "ERR_PASS_SHORT" }]` |
| `maps` | `users.email` |
| `placeholder`, `default`, `hint` | "you@mail.com" |

**Column** (in an entity): `name`, `type`, `required`, `key` (`pk` · `fk` · `unique`), `ref` (for `fk`: `users.id`). Extra detail depends on the level: level 2 adds `default` and `note`, level 3 adds `index`.

```json
"forms":    [{ "id": "form.login", "label": "Login", "fields": [
  { "name": "email", "label": "Email", "type": "email", "required": true,
    "rules": [{ "rule": "email", "msg": "ERR_EMAIL_FORMAT" }], "maps": "users.email" } ] }],
"entities": [{ "id": "users", "label": "Users", "columns": [
  { "name": "id", "type": "uuid", "key": "pk" },
  { "name": "email", "type": "text", "required": true, "key": "unique" } ] }],
"messages": { "ERR_LOGIN_FAILED": "Wrong email or password" }
```

- Forms and entities have `status` and `plan` like nodes. A plan drafts its form/DB changes too.
- Cards show only the message **code**. The text is in the panel, the Messages tab and the code's tooltip.

### Status

```
draft ─▶ doing ─▶ review ─▶ done
```

| Status | Display | Router's next step |
|---|---|---|
| `draft` | light gray, dashed border | build |
| `doing` | light blue | resume build |
| `review` | light amber | remind the user of the report |
| `done` | light green | none |

Status is shown **by background color only** (no icons). It is the only thing that colors a node, form or entity.

### Detail levels

| Level | Covers | Login example |
|---|---|---|
| 1 Simple | Main flow only | login → dashboard |
| 2 Medium | + common errors | + wrong password |
| 3 Full | + every edge case | + lockout, locked account, offline, session expiry |

- The project default is set at init. A plan can override it ("this plan at level 3").
- Each section shows a colored level badge, so a sparse area reads as "not detailed", not "no errors".

## 4. Workflow

```
 INIT    new project: brainstorm (idea, actors, features, level, lang, test) ─▶ skeleton (drafts)
 IMPORT  existing code: scan ─▶ user picks features ─▶ current flows as `review` ─▶ REPORT
   │
   ▼
 PLAN    brainstorm (choices + recommendation) ─▶ draft branch     ◀── user answers
   │
   ▼
 BUILD   code ─▶ self-test ─▶ fix (max 3 tries)                    (autonomous)
   │       └─ still failing ─▶ report error + cause + 2–3 options
   ▼
 REPORT  3–5 lines + graph link                                    ◀── user "ok"?
   ├─ ok             ─▶ status done ─▶ merge ─▶ one commit
   ├─ small fix      ─▶ fix directly ─▶ REPORT
   ├─ changes reqs   ─▶ PLAN (1–2 questions) ─▶ update the same draft
   └─ drop           ─▶ gd discard (+ git revert of its code)
```

- **Init:** brainstorm, then a skeleton graph: main flows only, at the default level. Asks the docs language (`en` / `vi`) first and speaks it from then on; then the default level. The test command is never asked: detected from the code, or picked by build.
- **Plan:** id `p-<slug>`, drawn with one `gd apply` (new and changed items get `plan` + `draft`). Answering the questions counts as approving the requirements; build starts right away.
- **Build:** `status doing plan:<id>`, code, `code=` links on nodes, one test per conditional branch at the plan's level, then `status review plan:<id>`.
- **Report format:**
  ```
  ✅ Login Google: 4 nodes, 3 files
  🧪 Tests: 6/6 pass
  👆 Try by hand: "Sign in with Google" button on mobile
  🗺 .graphdocs/index.html#7
  Then a choice: ok, make it official · small fix · change the flow · drop it
  ```
- **Commit after "ok":** one commit with code + `.graphdocs/`, message derived from the plan (`feat(...)`; imports: `docs(graphdocs): import …`, `.graphdocs/` only). **No `Co-Authored-By` or any attribution trailer.**
- Each step skill ends by **invoking** the next one (plan → build → report); the router picks the step from `gd state`.

## 5. Viewer

| Aspect | Decision |
|---|---|
| Tech | Plain HTML + inline SVG. **No libraries**. Thin, flat scrollbars |
| Tabs | **Flow** · **Form** (one spec card per form) · **Data** (ERD: table cards + FK lines) · **Messages** (code → text) |
| Cross-links | Panel of an action → its form + entities; result card → message text; field → column. All clickable across tabs |
| Layout | Per section, left → right. Column = longest path from the start. Rows are centered on their neighbours |
| Node | **Minimal card: title + `#no` + references only** (message code, `→ #12` to another feature). Note, message text, form, data, rules, code all go to the detail panel. Message text shows as a tooltip on the code. **Full text, never truncated**: cards wrap and grow, and layout uses their real height. Actor = pill with avatar |
| Level | Colored number badge: green 1 · amber 2 · red 3 (section header + panel) |
| Edge | Smooth curve. Condition = pill chip near the target. Line style by `kind` |
| Sections | Parent feature = group heading (once). Sub-feature = card in 2 parts: header (chevron, name, level badge, done count) and flow, split by a dashed line. Collapsed shows the header only |
| Hover | Highlights the flow through the node, dims the rest |
| Details | Click → side panel (rules, code, links, level, from / leads to) |
| Draft | Shown by status color only (gray, dashed). No plan filter/overlay for now |
| Deep link | `#<node-id>` or `#<no>` opens the right tab/section, scrolls to the item, opens the panel (used by reports) |
| Tools | None for now: no search, no filters (add later if needed) |
| Reference | Style follows the "Đăng nhập & Đăng ký" design the user shared |

## 6. Output: `.graphdocs/` in the user's project

```
.graphdocs/
├─ index.html    viewer + graph JSON in <script id="graph" type="application/json">  ← source of truth
├─ graph.md      generated for agents, never edited by hand
└─ config.json   { "lang": "vi", "level": 1, "test": "npm test" }
```

- A single self-contained file that works offline. Data is embedded because `file://` blocks `fetch()` of sibling JSON.
- Graph JSON = `{ meta: { title, lang, level, nextNo }, nodes, edges, forms, entities, messages }`. The CLI copies title/lang/level from config, since the viewer can't read `config.json`.
- Template: `viewer/index.html` (with sample data). `gd init` copies it and replaces the data; `gd upgrade` refreshes the viewer code and keeps the data.
- `graph.md`: summary line, actors, then per feature its nodes and `flow:` edges, then Forms, Entities, Messages:
  ```
  level 2 · lang vi · draft 0 · doing 0 · review 2 · done 9 · open plans: p-x
  ## Account › Login · level 2
  - #6 auth.login · action · done · "Login" · form=form.login · data=users · code=src/routes/auth.js#login
  - #8 auth.login.wrong · result · done · "Wrong password" · message=auth.wrong
  flow:
  - auth.login →[wrong password | fail] auth.login.wrong
  ```
- All output text is in the language set by `config.lang`, and stays short.

## 7. Plugin structure

```
graphdocs/
├─ .claude-plugin/
│  ├─ plugin.json        manifest (MIT)
│  └─ marketplace.json   marketplace "ohmypaos" listing this plugin
├─ skills/
│  ├─ graphdocs/         router + shared rules + graph JSON shape
│  ├─ gd-init/           new project
│  ├─ gd-import/         existing codebase
│  ├─ gd-plan/
│  ├─ gd-build/
│  └─ gd-report/         each step invokes the next
├─ scripts/gd.js         CLI, the only way to modify the graph
├─ scripts/hooks.js      SessionStart + PreToolUse handlers
├─ hooks/hooks.json
├─ viewer/index.html     viewer template (no dependencies)
├─ README.md · LICENSE
└─ DESIGN.md · CLAUDE.md repo-only (not loaded by the plugin)
```

### CLI (`node scripts/gd.js …`, full list: `gd help`)

```
gd init --title T --lang vi --level 1 --test "npm test"
gd state                      # one line: counts, open plans, next step (for hooks + router)
gd node add auth.google type=action label="Login Google" feature=Auth/Login plan=p1 form=form.login
gd link auth.google auth.home when="valid token"        # kind=fail|nav
gd status review auth.google '#6'                       # ids, #numbers or plan:<id>
gd form field form.login email type=email required=true maps=users.email 'rules=[{"rule":"email","msg":"ERR_EMAIL"}]'
gd entity col users email type=text required=true key=unique
gd msg ERR_EMAIL "Invalid email"
gd apply plan.json            # bulk upsert { nodes, edges, forms, entities, messages }, used to draft a plan
gd merge p1 | gd discard p1 [--all]
gd check | gd md | gd upgrade
```

- Every write validates. **Errors block the write**: bad id/type/status/kind, dangling edge, duplicates, and **any unknown key** (the message lists the allowed keys, so a wrong guess like `cols` fails loudly). **Warnings** (unknown form/entity/message, empty form, actor with a `feature`) are allowed while building, counted in one line, listed by `gd check`.
- Then it writes the JSON block into `index.html` and regenerates `graph.md`.
- `no` is assigned from `meta.nextNo` and never reused.
- `kind: ok` is the default and never stored.
- `discard` removes only brand-new drafts of the plan; existing items it touched just lose the tag (revert those with git). `--all` removes every item of the plan (imports).
- Call it literally as `node "<path>/gd.js" …`: no `gd` shell function/alias (clashes with a common git alias), no `$VAR` holding the command (zsh doesn't split it).

### Hooks

| Hook | Effect |
|---|---|
| `SessionStart` | Always: the CLI path + how to call it. With `.graphdocs/`: the `gd state` line + "route every change through the graphdocs skill" |
| `PreToolUse` (Edit · Write · MultiEdit · NotebookEdit) | Exit 2 on any path under `.graphdocs/`, pointing to the CLI |

## 8. Install

- Repo: `github.com/ohmypaos/graphdocs` (branch `main`).
- `/plugin install graphdocs --marketplace ohmypaos/graphdocs` (or `claude plugin install …` from a terminal).
- Local dev: `claude --plugin-dir <repo>`. Requires Node.js 18+.

### Release

Users only get a new copy when `version` changes (pushing commits alone does nothing).

1. Bump `version` (semver) in `.claude-plugin/plugin.json` only, never in `marketplace.json`.
2. Commit `release: vX.Y.Z`, push `main`.
3. Tag `graphdocs--vX.Y.Z` (the tag form plugin dependencies resolve against), push the tag.
4. GitHub release on that tag with 3–5 short lines of changes.

Users update via auto-update (if they turned it on) or `/plugin marketplace update ohmypaos`.

## 9. Conventions

- Skills, scripts and plugin code are in **English**.
- Generated docs are in **English or Vietnamese**, chosen at init.
- Everything (skills, labels, reports) is **very short and clear**. No full pages of prose.
- Commits carry **no co-author or attribution lines**.

## 10. Scope

| Start | Skill |
|---|---|
| New project | **gd-init**: brainstorm → skeleton graph (drafts) |
| Existing codebase | **gd-import**: scan → user picks features (multi-select per parent) → draw current flows, forms, tables, messages exactly as the code behaves, every action linked to code → status `review`, plan `p-import-<slug>` → short report with "unsure" points → user "ok" → done + merge + commit `.graphdocs/` only (`docs(graphdocs): import …`). Drop = `gd discard <id> --all` |

Import documents what the code does today; changes still go through gd-plan. Unpicked features can be imported later.

Out of scope for now: editing inside the HTML, search, filters, plan overlay, minimap.
