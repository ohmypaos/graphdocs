#!/usr/bin/env node
// GraphDocs hooks.
//   session-start: tell Claude where the CLI is and where the project stands.
//   pre-edit:      block hand edits under .graphdocs/ (exit 2 = blocked, stderr goes to Claude).
'use strict';
const fs = require('fs');
const path = require('path');

const CLI = path.join(__dirname, 'gd.js');
const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

function sessionStart() {
  const lines = [`GraphDocs CLI: node "${CLI}" <args>  (run it literally: no gd function/alias, no $VAR holding the command)`];
  const html = path.join(projectDir, '.graphdocs', 'index.html');
  if (fs.existsSync(html)) {
    const { state } = require('./gd.js');
    const block = fs.readFileSync(html, 'utf8').match(/<script id="graph" type="application\/json">([\s\S]*?)<\/script>/);
    const g = JSON.parse(block[1]);
    for (const k of ['nodes', 'edges', 'forms', 'entities']) g[k] ||= [];
    lines.push(state(g));
    lines.push('This project uses GraphDocs: route every change through the graphdocs skill.');
  }
  console.log(lines.join('\n'));
}

function preEdit() {
  let input = '';
  process.stdin.on('data', c => { input += c; });
  process.stdin.on('end', () => {
    const t = JSON.parse(input || '{}').tool_input || {};
    const file = t.file_path || t.notebook_path || '';
    if (path.resolve(projectDir, file).split(path.sep).includes('.graphdocs')) {
      console.error(`GraphDocs: .graphdocs/ is generated. Change the graph with the CLI: node "${CLI}" help`);
      process.exit(2);
    }
  });
}

({ 'session-start': sessionStart, 'pre-edit': preEdit })[process.argv[2]]?.();
