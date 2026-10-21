# GraphDocs

A Claude Code plugin that keeps a project's documentation as **one visual graph** instead of long text. You read it in a browser in seconds, and Claude uses it to plan, build and report every change.

Built for small and solo projects: short → try → fail → fix, with no pages of AI prose to review.

## How it works

```
 INIT / IMPORT   create the graph (new project, or from existing code)
      ▼
 PLAN            a few multiple-choice questions ─▶ draft branch on the graph     ◀── you answer
      ▼
 BUILD           code ─▶ tests per branch ─▶ fix (max 3 tries)                    (autonomous)
      ▼
 REPORT          5 lines + graph link ─▶ "ok" ─▶ merge + one commit              ◀── you confirm
```

- **The graph leads the code.** Every change is drafted on the graph first.
- **Nodes** are actors, actions or results. Conditions sit on the edges.
- **Detail level** 1–3 (main flow → + common errors → + every edge case), set per project or per plan, so Claude doesn't over-engineer.
- **Status by color**: draft · doing · review · done.
- Four tabs: **Flow**, **Forms** (fields, required, rules → message codes), **Data** (ERD), **Messages**.

## Install

Requires Node.js 18+.

```bash
git clone <this repo> graphdocs
claude --plugin-dir /path/to/graphdocs
```

## Use

In your project, just talk to Claude:

| You say | What happens |
|---|---|
| "Set up GraphDocs for this project" | New repo: brainstorm → skeleton graph. Existing code: scan → you pick features → current flows drawn for review |
| "Add login with Google" | Questions → draft → code + tests → 5-line report |
| "ok" | Plan becomes official, code + graph committed together |
| "Where are we?" | Short status from the graph |

Open `.graphdocs/index.html` in a browser to see the graph. Deep links: `index.html#12` (node number) or `#auth.login`.

## What it creates in your project

```
.graphdocs/
├─ index.html    the graph (viewer + data), source of truth
├─ graph.md      generated text version for agents
└─ config.json   language (en/vi), default level, test command
```

`.graphdocs/` is only changed through the bundled CLI (a hook blocks hand edits):

```bash
node scripts/gd.js help
```

## Plugin contents

| Path | Role |
|---|---|
| `skills/graphdocs` | Router: reads the graph state, picks the next step |
| `skills/gd-init`, `gd-import` | Start from a new or an existing codebase |
| `skills/gd-plan`, `gd-build`, `gd-report` | The change loop |
| `scripts/gd.js` | CLI, the only writer of the graph |
| `hooks/` | Session status line, guard on `.graphdocs/` |
| `viewer/index.html` | Dependency-free viewer template |

Design details: [DESIGN.md](DESIGN.md).

## License

[MIT](LICENSE)
