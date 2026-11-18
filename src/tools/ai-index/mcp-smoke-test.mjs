#!/usr/bin/env node
/**
 * Smoke test do MCP server ui-index (sem dependências): sobe o servidor via stdio,
 * faz o handshake MCP, lista as tools e chama cada uma.
 * Uso: node tools/ai-index/mcp-smoke-test.mjs "termo de busca"
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const query = process.argv[2] ?? 'button';
const EXPECTED = ['search_components', 'get_component', 'find_usages', 'list_routes', 'get_route', 'refresh_index'];

const child = spawn(process.execPath, [path.join(HERE, 'mcp-server.mjs')], { stdio: ['pipe', 'pipe', 'ignore'] });
const pending = new Map();
let nextId = 1;
readline.createInterface({ input: child.stdout }).on('line', (line) => {
  const msg = JSON.parse(line);
  const p = pending.get(msg.id);
  if (!p) return;
  pending.delete(msg.id);
  if (msg.error) p.reject(new Error(msg.error.message));
  else p.resolve(msg.result);
});
const request = (method, params) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    setTimeout(() => pending.has(id) && reject(new Error(`timeout em ${method}`)), 600000).unref();
  });
const call = async (name, args = {}) => {
  const r = await request('tools/call', { name, arguments: args });
  const text = r.content?.[0]?.text ?? '';
  if (r.isError) throw new Error(`${name} falhou: ${text}`);
  return JSON.parse(text);
};

let failed = false;
const check = (label, cond) => {
  console.log(`${cond ? 'OK    ' : 'FALHOU'} ${label}`);
  if (!cond) failed = true;
};

try {
  const init = await request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'smoke-test', version: '1.0.0' } });
  check(`initialize -> ${init.serverInfo?.name}`, init.serverInfo?.name === 'ui-index');
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  const tools = (await request('tools/list', {})).tools.map((t) => t.name);
  check(`tools/list -> ${tools.join(', ')}`, EXPECTED.every((t) => tools.includes(t)));

  const search = await call('search_components', { query });
  check(`search_components("${query}") -> ${search.results.length} resultado(s): ${search.results.slice(0, 5).map((r) => r.name).join(', ')}`, Array.isArray(search.results));

  // Usa o primeiro resultado da busca; se a busca não achou nada, usa o primeiro componente do índice
  const index = JSON.parse(fs.readFileSync(path.join(HERE, 'generated', 'component-index.json'), 'utf8'));
  const targetId = search.results[0]?.id ?? index.components[0]?.id;
  check(`índice tem componentes (${index.components.length})`, !!targetId);
  if (targetId) {
    const comp = await call('get_component', { name: targetId });
    check(`get_component("${targetId}") -> ${comp.props.length} prop(s)`, comp.id === targetId);
    const usages = await call('find_usages', { name: targetId });
    check(`find_usages("${targetId}") -> ${usages.usageCount} arquivo(s)`, Array.isArray(usages.usedInFiles));
  }

  const routes = await call('list_routes');
  check(`list_routes -> ${routes.total} rota(s)`, typeof routes.total === 'number');
  if (routes.total > 0) {
    const r = await call('get_route', { path: routes.routes[0].path });
    check(`get_route("${routes.routes[0].path}") -> ${r.length} entrada(s)`, r.length > 0);
  }

  const refresh = await call('refresh_index');
  check('refresh_index', refresh.message === 'Índice regerado.');
} catch (err) {
  check(String(err?.message ?? err), false);
} finally {
  child.kill();
}
process.exit(failed ? 1 : 0);
