#!/usr/bin/env node
// GraphDocs CLI: the only way to change the graph.
// Every write validates, rewrites the JSON block in .graphdocs/index.html and regenerates graph.md.
'use strict';
const fs = require('fs');
const path = require('path');

const DIR = '.graphdocs';
const TEMPLATE = path.join(__dirname, '..', 'viewer', 'index.html');
const BLOCK = /(<script id="graph" type="application\/json">)([\s\S]*?)(<\/script>)/;
const TYPES = ['actor', 'action', 'result'];
const STATUSES = ['draft', 'doing', 'review', 'done'];
const KINDS = ['ok', 'fail', 'nav'];
const KEYS = ['pk', 'fk', 'unique'];
const LISTS = ['data', 'code', 'links', 'rules'];
const ID = /^[a-z0-9][a-z0-9_-]*(\.[a-z0-9_-]+)*$/;
// allowed keys: an unknown key is an error, so a wrong guess (e.g. "cols") fails loudly
const SCHEMA = {
  node: ['id', 'no', 'type', 'label', 'note', 'feature', 'status', 'level', 'plan', 'form', 'data', 'message', 'code', 'rules', 'links'],
  edge: ['from', 'to', 'when', 'kind'],
  form: ['id', 'label', 'status', 'level', 'plan', 'fields'],
  field: ['name', 'label', 'type', 'required', 'rules', 'maps', 'placeholder', 'default', 'hint'],
  rule: ['rule', 'msg'],
  entity: ['id', 'label', 'status', 'level', 'plan', 'columns'],
  column: ['name', 'type', 'required', 'key', 'ref', 'default', 'note', 'index'],
};

const USAGE = `gd <command>

  init --title T [--lang vi|en] [--level 1-3] [--test CMD]   create .graphdocs/
  state                                  one-line summary + next step
  check                                  validate, exit 1 on any issue
  md                                     regenerate graph.md
  upgrade                                refresh the viewer, keep data

  node add <id> key=value...             type= label= feature= status= level= note=
                                         plan= form= data=a,b message= code=a,b rules=.. links=a,b
  node set <id|#no> key=value...         empty value removes the key
  node rm <id|#no>                       also removes its edges
  link <from> <to> [when=..] [kind=ok|fail|nav]
  unlink <from> <to>
  status <draft|doing|review|done> <id|#no|plan:<id>>...

  form set <id> key=value...             label= status= level= plan=
  form field <form> <name> key=value...  label= type= required= maps= placeholder= default= hint=
                                         rules='[{"rule":"min 8","msg":"ERR_X"}]'
  form rm <id> [field]
  entity set <id> key=value...           label= status= level= plan=
  entity col <entity> <name> key=value...  type= required= key=pk|fk|unique ref= default= note= index=
  entity rm <id> [col]
  msg <CODE> <text>                      set a message (empty text removes it)

  apply <file.json|->                    upsert a partial graph:
                                         { nodes, edges, forms, entities, messages }
  merge <plan>                           draft items of the plan become official
  discard <plan> [--all]                 drop the plan's draft items (--all: every item, for imports)`;

// ---------- io ----------
function findRoot(start = process.cwd()) {
  for (let d = path.resolve(start); ; d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, DIR, 'index.html'))) return path.join(d, DIR);
    if (d === path.dirname(d)) fail(`no ${DIR}/ found — run: gd init --title "..."`);
  }
}

function load(root) {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const m = html.match(BLOCK);
  if (!m) fail('graph block not found in index.html');
  const g = JSON.parse(m[2]);
  for (const k of ['nodes', 'edges', 'forms', 'entities']) g[k] ||= [];
  g.messages ||= {};
  g.meta ||= {};
  return { html, g };
}

const config = root => JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8'));

function save(root, html, g) {
  const cfg = config(root);
  g.meta = { ...g.meta, title: cfg.title, lang: cfg.lang, level: cfg.level };
  const { errors, warnings } = validate(g);
  if (errors.length) fail('not saved:\n' + errors.map(e => '  ✗ ' + e).join('\n'));
  // "</" is escaped so text can never close the script tag
  const json = '\n' + JSON.stringify(g, null, 2).replace(/<\//g, '<\\/') + '\n';
  fs.writeFileSync(path.join(root, 'index.html'), html.replace(BLOCK, (_, a, __, c) => a + json + c));
  fs.writeFileSync(path.join(root, 'graph.md'), markdown(g));
  // details only via `gd check`, so repeated writes stay quiet
  if (warnings.length) console.log(`  ! ${warnings.length} warning(s), run: gd check`);
}

function fail(msg) { console.error('gd: ' + msg); process.exit(1); }

// ---------- values ----------
function parseValue(key, raw) {
  if (raw === '') return undefined;
  if (/^[[{]/.test(raw)) { try { return JSON.parse(raw); } catch { fail(`bad JSON for ${key}`); } }
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (['level', 'no'].includes(key)) return Number(raw);
  if (key === 'rules') return [raw];
  if (LISTS.includes(key)) return raw.split(',').map(s => s.trim()).filter(Boolean);
  return raw;
}

function assign(obj, pairs) {
  for (const p of pairs) {
    const i = p.indexOf('=');
    if (i < 1) fail(`expected key=value, got "${p}"`);
    const key = p.slice(0, i), val = parseValue(key, p.slice(i + 1));
    if (val === undefined) delete obj[key]; else obj[key] = val;
  }
  return obj;
}

// "#12" / "12" → node id
function nodeId(g, ref) {
  if (/^#?\d+$/.test(ref)) {
    const n = g.nodes.find(x => x.no === Number(ref.replace('#', '')));
    if (!n) fail(`no node #${ref.replace('#', '')}`);
    return n.id;
  }
  if (!g.nodes.some(n => n.id === ref)) fail(`no node ${ref}`);
  return ref;
}

const nextNo = g => {
  const no = Math.max(g.meta.nextNo || 1, ...g.nodes.map(n => (n.no || 0) + 1));
  g.meta.nextNo = no + 1;
  return no;
};

// ---------- validation ----------
function validate(g) {
  const errors = [], warnings = [];
  const keys = (kind, o, at) => {
    const bad = Object.keys(o || {}).filter(k => !SCHEMA[kind].includes(k));
    if (bad.length) errors.push(`${at}: unknown key ${bad.join(', ')} (allowed: ${SCHEMA[kind].join(', ')})`);
  };
  for (const n of g.nodes) keys('node', n, `node ${n.id}`);
  for (const e of g.edges) keys('edge', e, `edge ${e.from} → ${e.to}`);
  for (const f of g.forms) {
    keys('form', f, `form ${f.id}`);
    if (f.fields && !Array.isArray(f.fields)) errors.push(`form ${f.id}: fields must be an array`);
    for (const fd of Array.isArray(f.fields) ? f.fields : []) {
      keys('field', fd, `form ${f.id}.${fd.name}`);
      for (const r of fd.rules || []) keys('rule', r, `form ${f.id}.${fd.name} rule`);
    }
  }
  for (const en of g.entities) {
    keys('entity', en, `entity ${en.id}`);
    if (en.columns && !Array.isArray(en.columns)) errors.push(`entity ${en.id}: columns must be an array`);
    for (const c of Array.isArray(en.columns) ? en.columns : []) keys('column', c, `entity ${en.id}.${c.name}`);
  }
  if (errors.length) return { errors, warnings };
  const ids = new Map(), nos = new Map();
  const forms = new Map(g.forms.map(f => [f.id, f]));
  const ents = new Map(g.entities.map(e => [e.id, e]));
  const colExists = ref => { const [e, c] = String(ref).split('.'); return ents.get(e)?.columns?.some(x => x.name === c); };

  for (const n of g.nodes) {
    const at = `node ${n.id}`;
    if (!n.id || !ID.test(n.id)) errors.push(`${at}: bad id (use slugs like auth.login-google)`);
    if (ids.has(n.id)) errors.push(`${at}: duplicate id`);
    ids.set(n.id, n);
    if (n.no != null) { if (nos.has(n.no)) errors.push(`${at}: duplicate #${n.no}`); nos.set(n.no, n); }
    if (!TYPES.includes(n.type)) errors.push(`${at}: type must be ${TYPES.join('|')}`);
    if (!n.label) errors.push(`${at}: label required`);
    if (n.status && !STATUSES.includes(n.status)) errors.push(`${at}: status must be ${STATUSES.join('|')}`);
    if (n.level != null && ![1, 2, 3].includes(n.level)) errors.push(`${at}: level must be 1-3`);
    if (n.type !== 'actor' && !n.feature) errors.push(`${at}: feature required`);
    if (n.type === 'actor' && n.feature) warnings.push(`${at}: actors are shared, drop feature`);
    if (n.form && n.type !== 'action') warnings.push(`${at}: form is for actions`);
    if (n.form && !forms.has(n.form)) warnings.push(`${at}: unknown form ${n.form}`);
    for (const d of n.data || []) if (!ents.has(d)) warnings.push(`${at}: unknown entity ${d}`);
    if (n.message && !(n.message in g.messages)) warnings.push(`${at}: unknown message ${n.message}`);
  }
  for (const n of g.nodes) for (const l of n.links || []) if (!ids.has(l)) warnings.push(`node ${n.id}: unknown link ${l}`);

  const pairs = new Set();
  for (const e of g.edges) {
    const at = `edge ${e.from} → ${e.to}`;
    if (!ids.has(e.from) || !ids.has(e.to)) errors.push(`${at}: unknown node`);
    if (e.kind && !KINDS.includes(e.kind)) errors.push(`${at}: kind must be ${KINDS.join('|')}`);
    if (pairs.has(e.from + '>' + e.to)) errors.push(`${at}: duplicate edge`);
    pairs.add(e.from + '>' + e.to);
  }

  for (const f of g.forms) {
    const at = `form ${f.id}`;
    if (!f.id || !ID.test(f.id)) errors.push(`${at}: bad id`);
    const names = new Set();
    for (const fd of f.fields || []) {
      if (!fd.name || names.has(fd.name)) errors.push(`${at}: missing or duplicate field name`);
      names.add(fd.name);
      if (!fd.type) warnings.push(`${at}.${fd.name}: type missing`);
      if (fd.maps && !colExists(fd.maps)) warnings.push(`${at}.${fd.name}: unknown column ${fd.maps}`);
      for (const r of fd.rules || []) if (r.msg && !(r.msg in g.messages)) warnings.push(`${at}.${fd.name}: unknown message ${r.msg}`);
    }
    if (!(f.fields || []).length) warnings.push(`${at}: no fields (forms are for input/validation only)`);
  }

  for (const en of g.entities) {
    const at = `entity ${en.id}`;
    if (!en.id || !ID.test(en.id)) errors.push(`${at}: bad id`);
    const names = new Set();
    for (const c of en.columns || []) {
      if (!c.name || names.has(c.name)) errors.push(`${at}: missing or duplicate column name`);
      names.add(c.name);
      if (c.key && !KEYS.includes(c.key)) errors.push(`${at}.${c.name}: key must be ${KEYS.join('|')}`);
      if (c.key === 'fk' && !colExists(c.ref)) warnings.push(`${at}.${c.name}: fk ref ${c.ref} not found`);
    }
  }
  return { errors, warnings };
}

// ---------- graph.md ----------
function markdown(g) {
  const m = g.meta, out = [];
  const count = s => g.nodes.filter(n => n.type !== 'actor' && (n.status || 'draft') === s).length;
  const plans = [...new Set([...g.nodes, ...g.forms, ...g.entities].map(x => x.plan).filter(Boolean))];
  const kv = (o, keys) => keys.filter(k => o[k] != null && o[k] !== '').map(k => `${k}=${Array.isArray(o[k]) ? o[k].join(',') : o[k]}`);

  out.push(`# ${m.title || 'GraphDocs'}`, '', '> Generated from index.html by gd. Do not edit.', '');
  out.push(`level ${m.level} · lang ${m.lang} · ${STATUSES.map(s => `${s} ${count(s)}`).join(' · ')}${plans.length ? ' · open plans: ' + plans.join(', ') : ''}`, '');

  out.push('## Actors', '');
  for (const n of g.nodes.filter(n => n.type === 'actor')) out.push(`- #${n.no} ${n.id} "${n.label}"${n.note ? ' · ' + n.note : ''}`);

  const feats = [...new Set(g.nodes.filter(n => n.feature).map(n => n.feature))];
  for (const f of feats) {
    const ns = g.nodes.filter(n => n.feature === f);
    const ids = new Set(ns.map(n => n.id));
    out.push('', `## ${f.split('/').join(' › ')} · level ${Math.max(...ns.map(n => n.level || m.level))}`, '');
    for (const n of ns) {
      out.push(`- #${n.no} ${n.id} · ${n.type} · ${n.status || 'draft'} · "${n.label}"` +
        [...kv(n, ['note', 'plan', 'form', 'data', 'message', 'code', 'links']), ...(n.rules || []).map(r => `rule: ${r}`)].map(x => ' · ' + x).join(''));
    }
    const es = g.edges.filter(e => ids.has(e.to));
    if (es.length) out.push('', 'flow:');
    for (const e of es) out.push(`- ${e.from} →${e.when || e.kind ? `[${[e.when, e.kind].filter(Boolean).join(' | ')}]` : ''} ${e.to}`);
  }

  if (g.forms.length) {
    out.push('', '## Forms');
    for (const f of g.forms) {
      out.push('', `### ${f.id} "${f.label || ''}" · ${f.status || 'draft'}${f.plan ? ' · plan=' + f.plan : ''}`);
      for (const fd of f.fields || []) {
        out.push(`- ${fd.name}${fd.required ? '*' : ''} ${fd.type || '?'} "${fd.label || ''}"` +
          [...kv(fd, ['maps', 'placeholder', 'default', 'hint']), ...(fd.rules || []).map(r => `rule: ${r.rule} → ${r.msg}`)].map(x => ' · ' + x).join(''));
      }
    }
  }

  if (g.entities.length) {
    out.push('', '## Entities');
    for (const en of g.entities) {
      out.push('', `### ${en.id} "${en.label || ''}" · ${en.status || 'draft'}${en.plan ? ' · plan=' + en.plan : ''}`);
      for (const c of en.columns || []) {
        out.push(`- ${c.name}${c.required ? '*' : ''} ${c.type || '?'}` + kv(c, ['key', 'ref', 'default', 'index', 'note']).map(x => ' · ' + x).join(''));
      }
    }
  }

  const msgs = Object.entries(g.messages);
  if (msgs.length) { out.push('', '## Messages', ''); for (const [k, v] of msgs) out.push(`- ${k}: ${v}`); }
  return out.join('\n') + '\n';
}

// ---------- state: one line for humans, hooks and the router ----------
function state(g) {
  const items = g.nodes.filter(n => n.type !== 'actor');
  const by = s => items.filter(n => (n.status || 'draft') === s);
  const plans = [...new Set(items.map(n => n.plan).filter(Boolean))];
  const actors = g.nodes.length - items.length;
  const parts = [`${items.length} nodes${actors ? ` (+${actors} actor${actors > 1 ? 's' : ''})` : ''}`, ...STATUSES.map(s => `${by(s).length} ${s}`)];
  if (plans.length) parts.push(`plans: ${plans.join(', ')}`);
  const next = by('review').length ? 'report: waiting for the user to confirm (ok)'
    : by('doing').length ? 'build: resume ' + by('doing').map(n => '#' + n.no).join(' ')
    : by('draft').some(n => n.plan) ? 'build: drafts of ' + plans.join(', ')
    : 'plan: ready for a new request';
  return `GraphDocs · ${parts.join(' · ')} · next → ${next}`;
}

// ---------- upsert helpers ----------
function upsert(list, item, key = 'id') {
  const cur = list.find(x => x[key] === item[key]);
  if (cur) Object.assign(cur, item); else list.push(item);
  return cur || item;
}

// forms/entities merge their fields/columns by name instead of replacing the list
function upsertForm(g, { fields = [], ...f }) {
  const cur = upsert(g.forms, f);
  cur.fields ||= [];
  for (const fd of fields) upsert(cur.fields, fd, 'name');
}

function upsertEntity(g, { columns = [], ...en }) {
  const cur = upsert(g.entities, en);
  cur.columns ||= [];
  for (const c of columns) upsert(cur.columns, c, 'name');
}

const clean = o => { for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k]; return o; };

// ---------- commands ----------
function init(pairs) {
  const o = assign({}, pairs);
  const root = path.join(process.cwd(), DIR);
  if (fs.existsSync(path.join(root, 'index.html'))) fail(`${DIR}/ already exists`);
  if (!o.title) fail('init needs --title');
  const cfg = { title: o.title, lang: o.lang || 'en', level: Number(o.level || 1), ...(o.test ? { test: o.test } : {}) };
  if (!['en', 'vi'].includes(cfg.lang)) fail('lang must be en|vi');
  if (![1, 2, 3].includes(cfg.level)) fail('level must be 1-3');
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify(cfg, null, 2) + '\n');
  fs.writeFileSync(path.join(root, 'index.html'), fs.readFileSync(TEMPLATE, 'utf8'));
  save(root, fs.readFileSync(path.join(root, 'index.html'), 'utf8'), { meta: { nextNo: 1 }, nodes: [], edges: [], forms: [], entities: [], messages: {} });
  console.log(`created ${DIR}/ (index.html, graph.md, config.json)`);
}

// "--title Shop" style flags → title=Shop
function flags(argv) {
  const out = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const k = argv[i].slice(2);
      if (k.includes('=')) out.push(k); else out.push(`${k}=${argv[++i] ?? ''}`);
    } else out.push(argv[i]);
  }
  return out;
}

function main(argv) {
  const [cmd, sub, ...rest] = argv;
  if (!cmd || cmd === 'help' || cmd === '-h' || cmd === '--help') return console.log(USAGE);
  if (cmd === 'init') return init(flags(argv.slice(1)));

  const root = findRoot();
  const { html, g } = load(root);
  const write = msg => { save(root, html, g); if (msg) console.log(msg); };

  switch (cmd) {
    case 'state': return console.log(state(g));
    case 'md': return write('graph.md regenerated');
    case 'upgrade': {
      const fresh = fs.readFileSync(TEMPLATE, 'utf8');
      return (save(root, fresh, g), console.log('viewer upgraded'));
    }
    case 'check': {
      const { errors, warnings } = validate(g);
      for (const e of errors) console.log('  ✗ ' + e);
      for (const w of warnings) console.log('  ! ' + w);
      if (errors.length || warnings.length) process.exit(1);
      return console.log('ok');
    }

    case 'node': {
      const [ref, ...pairs] = rest;
      if (!ref) fail('node needs an id');
      if (sub === 'add') {
        if (g.nodes.some(n => n.id === ref)) fail(`node ${ref} exists (use node set)`);
        const n = assign({ id: ref }, pairs);
        n.status ||= 'draft';
        n.no = nextNo(g);
        g.nodes.push(n);
        return write(`added #${n.no} ${ref}`);
      }
      const id = nodeId(g, ref);
      if (sub === 'set') { assign(g.nodes.find(n => n.id === id), pairs); return write(`updated ${id}`); }
      if (sub === 'rm') {
        g.nodes = g.nodes.filter(n => n.id !== id);
        g.edges = g.edges.filter(e => e.from !== id && e.to !== id);
        return write(`removed ${id}`);
      }
      return fail(`unknown: node ${sub}`);
    }

    case 'link': {
      const from = nodeId(g, sub), to = nodeId(g, rest[0]);
      const e = assign({ from, to }, rest.slice(1));
      upsertEdge(g, e);
      return write(`linked ${from} → ${to}`);
    }
    case 'unlink': {
      const from = nodeId(g, sub), to = nodeId(g, rest[0]);
      g.edges = g.edges.filter(e => !(e.from === from && e.to === to));
      return write(`unlinked ${from} → ${to}`);
    }
    case 'status': {
      if (!STATUSES.includes(sub)) fail(`status must be ${STATUSES.join('|')}`);
      if (!rest.length) fail('status needs node ids or plan:<id>');
      // plan:<id> selects every node, form and entity of that plan
      const items = rest.flatMap(r => r.startsWith('plan:')
        ? [...g.nodes, ...g.forms, ...g.entities].filter(x => x.plan === r.slice(5))
        : [g.nodes.find(n => n.id === nodeId(g, r))]);
      if (!items.length) fail('nothing selected');
      for (const x of items) x.status = sub;
      return write(`${items.length} item(s) → ${sub}`);
    }

    case 'form': {
      const [id, a, ...more] = rest;
      if (!id) fail('form needs an id');
      if (sub === 'set') { upsertForm(g, assign({ id }, [a, ...more].filter(Boolean))); return write(`form ${id} saved`); }
      if (sub === 'field') { if (!a) fail('form field needs a name'); upsertForm(g, { id, fields: [assign({ name: a }, more)] }); return write(`field ${id}.${a} saved`); }
      if (sub === 'rm') {
        if (a) { const f = g.forms.find(x => x.id === id); if (f) f.fields = (f.fields || []).filter(x => x.name !== a); }
        else { g.forms = g.forms.filter(x => x.id !== id); g.nodes.forEach(n => { if (n.form === id) delete n.form; }); }
        return write(`removed ${id}${a ? '.' + a : ''}`);
      }
      return fail(`unknown: form ${sub}`);
    }

    case 'entity': {
      const [id, a, ...more] = rest;
      if (!id) fail('entity needs an id');
      if (sub === 'set') { upsertEntity(g, assign({ id }, [a, ...more].filter(Boolean))); return write(`entity ${id} saved`); }
      if (sub === 'col') { if (!a) fail('entity col needs a name'); upsertEntity(g, { id, columns: [assign({ name: a }, more)] }); return write(`column ${id}.${a} saved`); }
      if (sub === 'rm') {
        if (a) { const en = g.entities.find(x => x.id === id); if (en) en.columns = (en.columns || []).filter(x => x.name !== a); }
        else { g.entities = g.entities.filter(x => x.id !== id); g.nodes.forEach(n => { if (n.data) n.data = n.data.filter(d => d !== id); }); }
        return write(`removed ${id}${a ? '.' + a : ''}`);
      }
      return fail(`unknown: entity ${sub}`);
    }

    case 'msg': {
      if (!sub) fail('msg needs a code');
      const text = rest.join(' ');
      if (text) g.messages[sub] = text; else delete g.messages[sub];
      return write(`message ${sub} ${text ? 'saved' : 'removed'}`);
    }

    case 'apply': {
      const src = sub === '-' || !sub ? fs.readFileSync(0, 'utf8') : fs.readFileSync(sub, 'utf8');
      const p = JSON.parse(src);
      let added = 0;
      for (const n of p.nodes || []) {
        const cur = g.nodes.find(x => x.id === n.id);
        if (cur) Object.assign(cur, n); else { g.nodes.push({ status: 'draft', ...n, no: nextNo(g) }); added++; }
      }
      for (const e of p.edges || []) upsertEdge(g, { ...e, from: nodeId(g, e.from), to: nodeId(g, e.to) });
      for (const f of p.forms || []) upsertForm(g, f);
      for (const en of p.entities || []) upsertEntity(g, en);
      Object.assign(g.messages, p.messages || {});
      for (const k of Object.keys(p.messages || {})) if (p.messages[k] == null || p.messages[k] === '') delete g.messages[k];
      return write(`applied: ${added} new node(s), ${(p.edges || []).length} edge(s), ${(p.forms || []).length} form(s), ${(p.entities || []).length} entit(ies), ${Object.keys(p.messages || {}).length} message(s)`);
    }

    case 'merge': {
      if (!sub) fail('merge needs a plan id');
      let n = 0;
      for (const x of [...g.nodes, ...g.forms, ...g.entities]) if (x.plan === sub) { delete x.plan; n++; }
      if (!n) fail(`no items in plan ${sub}`);
      return write(`plan ${sub} merged: ${n} item(s) official`);
    }
    case 'discard': {
      if (!sub) fail('discard needs a plan id');
      // only brand-new drafts are removed; existing items the plan touched just lose the tag (revert those with git).
      // --all removes every item of the plan (import plans: everything in them is new)
      const all = rest.includes('--all');
      const drop = x => x.plan === sub && (all || (x.status || 'draft') === 'draft');
      const gone = new Set(g.nodes.filter(drop).map(n => n.id));
      g.nodes = g.nodes.filter(n => !gone.has(n.id));
      g.edges = g.edges.filter(e => !gone.has(e.from) && !gone.has(e.to));
      g.forms = g.forms.filter(f => !drop(f));
      g.entities = g.entities.filter(e => !drop(e));
      for (const x of [...g.nodes, ...g.forms, ...g.entities]) if (x.plan === sub) delete x.plan;
      return write(`plan ${sub} discarded: ${gone.size} draft node(s) removed`);
    }
  }
  fail(`unknown command "${cmd}" — run: gd help`);
}

function upsertEdge(g, e) {
  clean(e);
  if (e.kind === 'ok') delete e.kind;
  const cur = g.edges.find(x => x.from === e.from && x.to === e.to);
  if (cur) { Object.assign(cur, e); for (const k of ['when', 'kind']) if (!(k in e)) delete cur[k]; }
  else g.edges.push(e);
}

if (require.main === module) main(process.argv.slice(2));
module.exports = { validate, markdown, state };
