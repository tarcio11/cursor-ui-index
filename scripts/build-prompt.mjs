#!/usr/bin/env node
/**
 * Monta prompt-cursor-ai-index.md a partir de prompt-template.md e dos arquivos de src/.
 * Marcadores do template:
 *   {{FILE:nome}}   bloco com o conteúdo do arquivo (cercado por 4 crases)
 *   {{SHA:nome}}    SHA-256 do conteúdo (com quebras de linha LF), usado pelo agent para conferir a cópia
 *   {{LINES:nome}}  número de linhas do arquivo
 * Uso: node scripts/build-prompt.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = {
  'generate.mjs': ['src/tools/ai-index/generate.mjs', 'js'],
  'mcp-server.mjs': ['src/tools/ai-index/mcp-server.mjs', 'js'],
  'mcp-smoke-test.mjs': ['src/tools/ai-index/mcp-smoke-test.mjs', 'js'],
  'pre-commit.sh': ['src/tools/ai-index/pre-commit.sh', 'sh'],
  'reuse-first-ui.mdc': ['src/cursor/rules/reuse-first-ui.mdc', 'markdown'],
};

function content(name) {
  const entry = FILES[name];
  if (!entry) throw new Error(`Arquivo desconhecido no template: ${name}`);
  let text = fs.readFileSync(path.join(ROOT, entry[0]), 'utf8').replace(/\r\n/g, '\n');
  if (!text.endsWith('\n')) text += '\n';
  if (text.includes('````')) throw new Error(`${entry[0]} não pode conter quatro crases seguidas`);
  return text;
}

let out = fs.readFileSync(path.join(ROOT, 'prompt-template.md'), 'utf8').replace(/\r\n/g, '\n');
out = out.replace(/\{\{FILE:([^}]+)\}\}/g, (_, name) => '````' + FILES[name][1] + '\n' + content(name) + '````');
out = out.replace(/\{\{SHA:([^}]+)\}\}/g, (_, name) => crypto.createHash('sha256').update(content(name)).digest('hex'));
out = out.replace(/\{\{LINES:([^}]+)\}\}/g, (_, name) => String(content(name).split('\n').length - 1));
if (out.includes('{{')) throw new Error('Sobrou marcador {{...}} no prompt gerado');

fs.writeFileSync(path.join(ROOT, 'prompt-cursor-ai-index.md'), out);
console.log(`prompt-cursor-ai-index.md gerado (${out.length} caracteres, ${out.split('\n').length - 1} linhas)`);
