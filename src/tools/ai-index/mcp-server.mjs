#!/usr/bin/env node
/**
 * ai-index MCP server: expõe o índice de componentes e rotas (tools/ai-index/generated/component-index.json) ao agent.
 * Sem dependências: implementa o protocolo MCP (JSON-RPC 2.0, uma mensagem JSON por linha) via stdio.
 * Iniciado pelo Cursor via .cursor/mcp.json. Nunca escreva em stdout aqui: stdout é o canal do protocolo.
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(HERE, '..', '..');
const INDEX_FILE = path.join(HERE, 'generated', 'component-index.json');

let cache = { mtimeMs: -1, data: null };
function loadIndex() {
  if (!fs.existsSync(INDEX_FILE)) {
    throw new Error(`Índice não encontrado em ${INDEX_FILE}. Rode a tool refresh_index.`);
  }
  const { mtimeMs } = fs.statSync(INDEX_FILE);
  if (mtimeMs !== cache.mtimeMs) cache = { mtimeMs, data: JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8')) };
  return cache.data;
}

// ---------------------------------------------------------------- busca
const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
const words = (s) =>
  norm(String(s ?? '').replace(/([a-z0-9])([A-Z])/g, '$1 $2'))
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

// Sinônimos PT -> EN mais comuns em telas (nomes de componentes costumam estar em inglês)
const SYNONYMS = {
  botao: ['button', 'btn', 'action'],
  tabela: ['table', 'grid', 'datatable', 'list'],
  lista: ['list', 'table', 'items'],
  cartao: ['card', 'tile'],
  card: ['card', 'tile', 'panel'],
  modal: ['modal', 'dialog'],
  dialogo: ['dialog', 'modal'],
  gaveta: ['drawer', 'sheet', 'sidepanel'],
  abas: ['tabs', 'tab'],
  aba: ['tab', 'tabs'],
  filtro: ['filter', 'filters', 'search'],
  filtros: ['filter', 'filters'],
  busca: ['search', 'filter'],
  pesquisa: ['search', 'filter'],
  formulario: ['form'],
  campo: ['field', 'input', 'formfield'],
  entrada: ['input', 'field'],
  texto: ['text', 'typography', 'textarea'],
  titulo: ['title', 'heading', 'header'],
  selecao: ['select', 'dropdown', 'combobox', 'picker'],
  seletor: ['select', 'picker', 'dropdown'],
  dropdown: ['dropdown', 'select', 'menu'],
  data: ['date', 'datepicker', 'calendar', 'data'],
  calendario: ['calendar', 'datepicker', 'date'],
  periodo: ['range', 'daterange', 'period'],
  status: ['status', 'badge', 'tag', 'chip'],
  etiqueta: ['tag', 'badge', 'chip', 'label'],
  selo: ['badge', 'tag', 'seal'],
  alerta: ['alert', 'toast', 'notification', 'banner'],
  aviso: ['alert', 'warning', 'toast', 'notification'],
  notificacao: ['notification', 'toast', 'alert'],
  carregando: ['loading', 'spinner', 'skeleton', 'loader'],
  vazio: ['empty', 'emptystate', 'placeholder'],
  erro: ['error', 'alert'],
  cabecalho: ['header', 'heading', 'topbar'],
  rodape: ['footer'],
  menu: ['menu', 'nav', 'navigation', 'sidebar', 'dropdown'],
  lateral: ['sidebar', 'sidenav', 'drawer'],
  navegacao: ['nav', 'navigation', 'breadcrumb', 'menu'],
  paginacao: ['pagination', 'pager'],
  icone: ['icon'],
  imagem: ['image', 'img', 'avatar', 'picture'],
  usuario: ['user', 'avatar', 'profile'],
  grafico: ['chart', 'graph'],
  dica: ['tooltip', 'hint', 'popover'],
  passo: ['step', 'stepper', 'wizard'],
  etapa: ['step', 'stepper', 'wizard'],
  arquivo: ['file', 'upload', 'dropzone'],
  upload: ['upload', 'file', 'dropzone'],
  interruptor: ['switch', 'toggle'],
  checkbox: ['checkbox', 'check'],
  opcao: ['option', 'radio', 'select'],
  valor: ['value', 'amount', 'price', 'currency'],
  preco: ['price', 'amount', 'currency'],
  moeda: ['currency', 'money', 'price'],
  resumo: ['summary', 'overview', 'card'],
  detalhe: ['detail', 'details', 'view'],
  detalhes: ['details', 'detail', 'view'],
  layout: ['layout', 'shell', 'template', 'page'],
  pagina: ['page', 'screen', 'view'],
  tela: ['page', 'screen', 'view'],
  confirmacao: ['confirm', 'confirmation', 'dialog'],
  progresso: ['progress', 'progressbar', 'stepper'],
  acordeao: ['accordion', 'collapse'],
  quantidade: ['quantity', 'counter', 'stepper'],
  contador: ['counter', 'count'],
  pedido: ['order'],
  pedidos: ['order', 'orders'],
  cliente: ['customer', 'client'],
  produto: ['product', 'item', 'sku'],
  venda: ['sale', 'sales', 'order'],
  vendas: ['sales', 'sale'],
  estoque: ['stock', 'inventory'],
  parceiro: ['partner', 'seller', 'vendor'],
  relatorio: ['report', 'dashboard'],
  planilha: ['spreadsheet', 'sheet', 'upload', 'import'],
  loja: ['store', 'shop'],
  categoria: ['category'],
  marca: ['brand'],
  pagamento: ['payment', 'checkout'],
  endereco: ['address'],
  configuracao: ['settings', 'config', 'preferences'],
  configuracoes: ['settings', 'config', 'preferences'],
  perfil: ['profile', 'account'],
  painel: ['dashboard', 'panel'],
  historico: ['history', 'timeline', 'log'],
  mensagem: ['message', 'chat'],
  comentario: ['comment'],
  importacao: ['import', 'upload'],
  exportar: ['export', 'download'],
  editar: ['edit', 'form'],
  excluir: ['delete', 'remove', 'confirm'],
  login: ['login', 'signin', 'auth'],
};

function singularOf(t) {
  if (t.endsWith('oes')) return t.slice(0, -3) + 'ao';
  if (t.endsWith('s') && t.length > 3) return t.slice(0, -1);
  return t;
}

function expandTokens(query) {
  const base = [...new Set(words(query).filter((t) => t.length >= 2))];
  return base.map((t) => {
    const sing = singularOf(t);
    return [...new Set([t, sing, ...(SYNONYMS[t] ?? []), ...(SYNONYMS[sing] ?? [])])];
  });
}

function scoreOne(c, term) {
  const nameN = norm(c.name);
  if (nameN === term) return 10;
  if (words(c.name).includes(term)) return 7;
  if (nameN.includes(term)) return 5;
  if (norm(c.description).includes(term)) return 3;
  if (c.props.some((p) => norm(p.name).includes(term))) return 2;
  if (norm(c.file ?? c.package).includes(term) || c.usedInRoutes.some((r) => norm(r).includes(term))) return 1;
  return 0;
}

function score(c, groups) {
  let total = 0;
  let hits = 0;
  for (const group of groups) {
    const best = Math.max(...group.map((t) => scoreOne(c, t)));
    if (best > 0) hits++;
    total += best;
  }
  if (!hits) return 0;
  return total + hits * 3 + (c.source === 'design-system' ? 2 : 0) + Math.min(c.usageCount, 10) * 0.1;
}

// ---------------------------------------------------------------- formatação
const summary = (c) => ({
  id: c.id,
  name: c.name,
  kind: c.kind,
  source: c.source,
  file: c.file,
  package: c.package,
  description: c.description || undefined,
  props: c.props.slice(0, 15).map((p) => `${p.name}${p.required ? '' : '?'}: ${p.type}`),
  usageCount: c.usageCount,
  usedInRoutes: c.usedInRoutes.slice(0, 8),
});

const ok = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });
const fail = (message) => ({ isError: true, content: [{ type: 'text', text: message }] });

function findComponent(idx, nameOrId) {
  const exact = idx.components.find((c) => c.id === nameOrId);
  if (exact) return { match: exact };
  const byName = idx.components.filter((c) => norm(c.name) === norm(nameOrId));
  if (byName.length === 1) return { match: byName[0] };
  if (byName.length > 1) return { ambiguous: byName.map(summary) };
  return { notFound: true };
}

function notFoundMessage(idx, nameOrId) {
  const groups = expandTokens(nameOrId);
  const similar = idx.components
    .map((c) => [score(c, groups), c])
    .filter(([s]) => s > 0)
    .sort((a, b) => b[0] - a[0])
    .slice(0, 5)
    .map(([, c]) => `${c.name} (${c.id})`);
  return `Componente "${nameOrId}" não encontrado no índice.${similar.length ? ` Parecidos: ${similar.join('; ')}.` : ''} Se ele acabou de ser criado, rode refresh_index.`;
}

const normRoute = (p) =>
  String(p ?? '')
    .trim()
    .replace(/\[\.{3}([^\]]+)\]/g, '*')
    .replace(/\[([^\]]+)\]/g, ':$1')
    .replace(/:[A-Za-z0-9_]+/g, ':param')
    .replace(/\/+$/, '') || '/';

function withIndex(handler) {
  return async (args) => {
    try {
      return handler(loadIndex(), args ?? {});
    } catch (err) {
      return fail(String(err?.message ?? err));
    }
  };
}

// ---------------------------------------------------------------- tools
const str = (description) => ({ type: 'string', description });
const TOOLS = [
  {
    name: 'search_components',
    description:
      'Busca no índice de componentes do front (design system, componentes locais, telas e layouts). Use ANTES de criar qualquer componente ou tela. Faça buscas com termos em inglês e em português e com sinônimos (ex.: "table tabela grid").',
    inputSchema: {
      type: 'object',
      properties: {
        query: str('Termos separados por espaço. Ex.: "card pedido order resumo"'),
        kind: { type: 'string', enum: ['any', 'component', 'page', 'layout'], description: 'Filtra por tipo. "page" busca telas parecidas. Padrão: any' },
        source: { type: 'string', enum: ['any', 'design-system', 'local'], description: 'Filtra pela origem. Padrão: any' },
        limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Máximo de resultados. Padrão: 15' },
      },
      required: ['query'],
    },
    handler: withIndex((idx, { query, kind = 'any', source = 'any', limit = 15 }) => {
      const groups = expandTokens(query);
      const results = idx.components
        .filter((c) => (kind === 'any' || c.kind === kind) && (source === 'any' || c.source === source))
        .map((c) => [score(c, groups), c])
        .filter(([s]) => s > 0)
        .sort((a, b) => b[0] - a[0] || (a[1].name < b[1].name ? -1 : 1))
        .slice(0, Math.max(1, Math.min(50, Number(limit) || 15)))
        .map(([, c]) => summary(c));
      return ok({
        query,
        results,
        next:
          results.length > 0
            ? 'Para cada candidato relevante: get_component (props completas) e find_usages (onde já é usado).'
            : 'Nenhum candidato. Tente outros termos (inglês, português, sinônimos) antes de concluir que não existe.',
      });
    }),
  },
  {
    name: 'get_component',
    description: 'Retorna props (tipos e descrições), descrição, arquivo, onde é usado, rotas e quais componentes ele usa por dentro.',
    inputSchema: { type: 'object', properties: { name: str('Nome (ex.: "Button") ou id (ex.: "src/components/Button.tsx#Button")') }, required: ['name'] },
    handler: withIndex((idx, { name }) => {
      const r = findComponent(idx, name);
      if (r.ambiguous) return ok({ message: 'Mais de um componente com esse nome. Repita com o id.', candidates: r.ambiguous });
      if (r.notFound) return fail(notFoundMessage(idx, name));
      const byId = new Map(idx.components.map((c) => [c.id, c]));
      return ok({ ...r.match, uses: r.match.uses.map((id) => ({ id, name: byId.get(id)?.name ?? id, source: byId.get(id)?.source })) });
    }),
  },
  {
    name: 'find_usages',
    description: 'Lista os arquivos e as rotas onde o componente é usado. Use antes de ESTENDER um componente, para garantir que nenhum uso atual quebre.',
    inputSchema: { type: 'object', properties: { name: str('Nome ou id do componente') }, required: ['name'] },
    handler: withIndex((idx, { name }) => {
      const r = findComponent(idx, name);
      if (r.ambiguous) return ok({ message: 'Mais de um componente com esse nome. Repita com o id.', candidates: r.ambiguous });
      if (r.notFound) return fail(notFoundMessage(idx, name));
      const c = r.match;
      return ok({ id: c.id, name: c.name, usageCount: c.usageCount, usedInFiles: c.usedInFiles, usedInRoutes: c.usedInRoutes });
    }),
  },
  {
    name: 'list_routes',
    description: 'Lista as rotas do front com tipo (page/layout), arquivo, componente da tela e layouts. Use para saber se a rota já existe e qual layout/rota pai usar.',
    inputSchema: { type: 'object', properties: { filter: str('Opcional. Trecho para filtrar por caminho ou arquivo. Ex.: "pedidos"') } },
    handler: withIndex((idx, { filter }) => {
      const f = norm(filter ?? '');
      const byId = new Map(idx.components.map((c) => [c.id, c]));
      const routes = idx.routes
        .filter((r) => !f || norm(r.path).includes(f) || norm(r.file).includes(f))
        .map((r) => ({
          path: r.path,
          kind: r.kind,
          file: r.file,
          page: r.pageComponents.map((id) => byId.get(id)?.name ?? id),
          layouts: r.layouts,
          componentsCount: r.components.length,
        }));
      return ok({ total: routes.length, routes });
    }),
  },
  {
    name: 'get_route',
    description: 'Mostra a rota com seu arquivo, componente da tela, layouts e todos os componentes usados nela. Use para copiar a estrutura de uma tela parecida.',
    inputSchema: { type: 'object', properties: { path: str('Caminho da rota. Ex.: "/pedidos/:id" (aceita também o formato [id])') }, required: ['path'] },
    handler: withIndex((idx, { path: routePath }) => {
      const wanted = normRoute(routePath);
      const byId = new Map(idx.components.map((c) => [c.id, c]));
      const matches = idx.routes.filter((r) => normRoute(r.path) === wanted);
      if (matches.length === 0) {
        const first = norm(routePath).replace(/^\//, '').split('/')[0];
        const similar = first ? [...new Set(idx.routes.filter((r) => norm(r.path).includes(first)).map((r) => r.path))] : [];
        return fail(`Rota "${routePath}" não existe no índice.${similar.length ? ` Rotas parecidas: ${similar.slice(0, 10).join(', ')}.` : ''}`);
      }
      return ok(
        matches.map((r) => ({
          ...r,
          pageComponents: r.pageComponents.map((id) => ({ id, name: byId.get(id)?.name ?? id })),
          components: r.components.map((id) => ({ id, name: byId.get(id)?.name ?? id, source: byId.get(id)?.source })),
        })),
      );
    }),
  },
  {
    name: 'refresh_index',
    description: 'Roda o gerador (tools/ai-index/generate.mjs) e recarrega o índice. Use depois de criar/alterar componentes ou rotas, ou se o índice parecer desatualizado.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      // Yarn Plug'n'Play (.pnp.cjs) precisa de "yarn node" para achar o ts-morph
      let usesPnp = false;
      for (let dir = APP_ROOT; ; dir = path.dirname(dir)) {
        if (fs.existsSync(path.join(dir, '.pnp.cjs'))) usesPnp = true;
        if (usesPnp || path.dirname(dir) === dir) break;
      }
      const script = path.join(HERE, 'generate.mjs');
      const opts = { cwd: APP_ROOT, encoding: 'utf8', timeout: 600000 };
      const run = usesPnp
        ? spawnSync('yarn', ['node', script], { ...opts, shell: process.platform === 'win32' })
        : spawnSync(process.execPath, [script], opts);
      const output = `${run.stdout ?? ''}${run.stderr ?? ''}`.trim();
      if (run.status !== 0) return fail(`Falha ao gerar o índice (exit ${run.status}).\n${output}`);
      cache = { mtimeMs: -1, data: null };
      return ok({ message: 'Índice regerado.', output });
    },
  },
];

// ---------------------------------------------------------------- protocolo MCP (stdio)
const SERVER_INFO = { name: 'ui-index', version: '1.0.0' };
const send = (msg) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...msg }) + '\n');

async function handle(msg) {
  const { id, method, params } = msg;
  const isRequest = id !== undefined && id !== null;
  if (!method) return; // resposta a algo que não pedimos: ignora
  try {
    if (method === 'initialize') {
      return send({
        id,
        result: {
          protocolVersion: params?.protocolVersion ?? '2025-06-18',
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: 'Índice de componentes e rotas do front. Consulte antes de criar telas, rotas ou componentes.',
        },
      });
    }
    if (method === 'ping') return isRequest && send({ id, result: {} });
    if (method === 'tools/list') {
      return send({ id, result: { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) } });
    }
    if (method === 'tools/call') {
      const tool = TOOLS.find((t) => t.name === params?.name);
      if (!tool) return send({ id, error: { code: -32602, message: `Tool desconhecida: ${params?.name}` } });
      return send({ id, result: await tool.handler(params?.arguments ?? {}) });
    }
    if (!isRequest) return; // notificações (ex.: notifications/initialized) não têm resposta
    return send({ id, error: { code: -32601, message: `Método não suportado: ${method}` } });
  } catch (err) {
    if (isRequest) send({ id, error: { code: -32603, message: String(err?.message ?? err) } });
  }
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return send({ id: null, error: { code: -32700, message: 'JSON inválido' } });
  }
  for (const m of Array.isArray(msg) ? msg : [msg]) handle(m);
});
rl.on('close', () => process.exit(0));
console.error('[ui-index] MCP server pronto. Índice:', INDEX_FILE);
