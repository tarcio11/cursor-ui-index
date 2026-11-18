#!/usr/bin/env node
/**
 * ai-index: gera o índice de componentes e rotas do front para agentes de IA.
 *
 * Uso (a partir de qualquer pasta):
 *   node tools/ai-index/generate.mjs             gera tools/ai-index/generated/component-index.json e .md
 *   node tools/ai-index/generate.mjs --check     não grava nada; sai com código 1 se o índice estiver desatualizado
 *   node tools/ai-index/generate.mjs --discover  não grava nada; imprime um relatório para preencher config.json
 *
 * Os arquivos em tools/ai-index/generated/ são GERADOS. Nunca edite à mão.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Project, Node, SyntaxKind, ts } from 'ts-morph';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(HERE, '..', '..');
const OUT_JSON = path.join(HERE, 'generated', 'component-index.json');
const OUT_MD = path.join(HERE, 'generated', 'component-index.md');
const MODE = process.argv.includes('--check') ? 'check' : process.argv.includes('--discover') ? 'discover' : 'write';
const CONFIG = JSON.parse(fs.readFileSync(path.join(HERE, 'config.json'), 'utf8'));
const DS_PACKAGES = CONFIG.designSystem?.packages ?? [];
const DS_FOLDERS = (CONFIG.designSystem?.folders ?? []).map((f) => f.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '') + '/');
const EXCLUDE_NAME = new RegExp(CONFIG.excludeComponentPattern || '^.+Icon$');
const MAX_PROPS = 40;

const started = Date.now();
const log = (...a) => console.error('[ai-index]', ...a);
const toPosix = (p) => p.replace(/\\/g, '/');
const rel = (abs) => toPosix(path.relative(APP_ROOT, abs));
const isPascal = (s) => typeof s === 'string' && /^[A-Z][A-Za-z0-9]*$/.test(s);
const byStr = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const sortedUnique = (it) => [...new Set(it)].sort(byStr);
const clip = (s, n) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};
const pascal = (s) => s.split(/[^A-Za-z0-9]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join('');

const pkgJson = JSON.parse(fs.readFileSync(path.join(APP_ROOT, 'package.json'), 'utf8'));
const DEPS = { ...pkgJson.peerDependencies, ...pkgJson.devDependencies, ...pkgJson.dependencies };

// ---------------------------------------------------------------- projeto TS
if (CONFIG.tsconfig && !fs.existsSync(path.join(APP_ROOT, CONFIG.tsconfig))) {
  log(`ERRO: tsconfig "${CONFIG.tsconfig}" (de tools/ai-index/config.json) não existe em ${APP_ROOT}.`);
  process.exit(1);
}
if (!Array.isArray(CONFIG.include) || CONFIG.include.length === 0) {
  log('ERRO: "include" de tools/ai-index/config.json precisa ser uma lista de globs (ex.: ["src/**/*.{ts,tsx,js,jsx}"]).');
  process.exit(1);
}
const project = CONFIG.tsconfig
  ? new Project({
      tsConfigFilePath: path.join(APP_ROOT, CONFIG.tsconfig),
      skipAddingFilesFromTsConfig: true,
      compilerOptions: { allowJs: true, noEmit: true },
    })
  : new Project({
      compilerOptions: {
        allowJs: true,
        noEmit: true,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
        skipLibCheck: true,
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        baseUrl: APP_ROOT,
      },
    });

const abs = (p) => toPosix(path.join(APP_ROOT, p));
project.addSourceFilesAtPaths([
  ...(CONFIG.include ?? []).map(abs),
  ...(CONFIG.exclude ?? []).map((p) => '!' + abs(p)),
  '!' + abs('**/node_modules/**'),
  '!' + abs('**/*.d.ts'),
  '!' + abs('tools/ai-index/**'),
]);
const projectFiles = project
  .getSourceFiles()
  .filter((sf) => !toPosix(sf.getFilePath()).includes('/node_modules/'))
  .sort((a, b) => byStr(a.getFilePath(), b.getFilePath()));
if (projectFiles.length === 0) {
  log('ERRO: nenhum arquivo encontrado com "include" de tools/ai-index/config.json. Corrija o config.');
  process.exit(1);
}
const fileSet = new Set(projectFiles.map((sf) => rel(sf.getFilePath())));
const checker = project.getTypeChecker();

// Um arquivo virtual por pacote do design system (só em memória, nunca é salvo).
const dsVirtuals = DS_PACKAGES.map((pkg, i) => [
  pkg,
  project.createSourceFile(path.join(APP_ROOT, `__ai_index_virtual_${i}__.ts`), `export * from ${JSON.stringify(pkg)};\n`, {
    overwrite: true,
  }),
]);

// ---------------------------------------------------------------- utilitários de tipo
const JSX_RETURN = /JSX\.Element|ReactElement|ReactNode|ReactPortal/;

function valueTypeOf(decl) {
  if (Node.isClassDeclaration(decl)) {
    const s = decl.getSymbol();
    return s ? s.getTypeAtLocation(decl) : decl.getType();
  }
  return decl.getType();
}

function signaturesOf(type) {
  return [...type.getCallSignatures(), ...type.getConstructSignatures()];
}

function returnsJsx(type, at) {
  for (const sig of signaturesOf(type)) {
    const ret = sig.getReturnType();
    if (JSX_RETURN.test(ret.getText(at))) return true;
    if (ret.getProperty('render') && ret.getProperty('props')) return true; // componente de classe
  }
  return false;
}

function containsJsx(node) {
  return !!node.getFirstDescendant((d) => Node.isJsxElement(d) || Node.isJsxSelfClosingElement(d) || Node.isJsxFragment(d));
}

function isStyledInit(init) {
  if (!init) return false;
  let head = '';
  if (Node.isTaggedTemplateExpression(init)) head = init.getTag().getText();
  else if (Node.isCallExpression(init)) head = init.getExpression().getText();
  return /^(styled|css|keyframes|tw)\b/.test(head);
}

function docOf(symbol) {
  if (!symbol) return '';
  try {
    return clip(ts.displayPartsToString(symbol.compilerSymbol.getDocumentationComment(checker.compilerObject)), 300);
  } catch {
    return '';
  }
}

function isOwnDeclarationPath(filePath) {
  const p = toPosix(filePath);
  if (!p.includes('/node_modules/')) return true;
  return DS_PACKAGES.some((pkg) => p.includes(`/node_modules/${pkg}/`));
}

function extractProps(type, at) {
  const sig = type.getCallSignatures()[0] ?? type.getConstructSignatures()[0];
  const param = sig?.getParameters()[0];
  if (!param) return { props: [], omittedInheritedProps: 0, extraPropsNotListed: 0 };
  const propsType = param.getTypeAtLocation(at);
  const props = [];
  let omittedInheritedProps = 0;
  for (const p of propsType.getApparentProperties()) {
    const name = p.getName();
    if (name === 'key' || name === 'ref') continue;
    const decls = p.getDeclarations();
    if (decls.length > 0 && !decls.some((d) => isOwnDeclarationPath(d.getSourceFile().getFilePath()))) {
      omittedInheritedProps++;
      continue;
    }
    let typeText = 'unknown';
    try {
      typeText = p.getTypeAtLocation(at).getText(at, ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope);
    } catch {}
    const required = (p.getFlags() & ts.SymbolFlags.Optional) === 0;
    if (!required) typeText = typeText.replace(/^\((.*)\) \| undefined$/, '$1').replace(/ \| undefined$/, '');
    props.push({
      name,
      type: clip(typeText, 160),
      required,
      description: docOf(p),
    });
  }
  return {
    props: props.slice(0, MAX_PROPS),
    omittedInheritedProps,
    extraPropsNotListed: Math.max(0, props.length - MAX_PROPS),
  };
}

// ---------------------------------------------------------------- registro de componentes
const components = new Map(); // id -> componente
const declToId = new Map(); // ts.Node -> id

function register(comp, nodes) {
  if (!components.has(comp.id)) components.set(comp.id, comp);
  for (const n of nodes) if (n) declToId.set(n.compilerNode, comp.id);
}

const GENERIC_DECLARED = new Set(['Page', 'Layout', 'Template', 'Default', 'Component', 'Index', 'Loading', 'Error', 'NotFound']);
const GENERIC_FILES = new Set(['index', 'page', 'layout', 'template', 'default', 'loading', 'error', 'not-found', 'route']);

function derivedName(filePath) {
  const base = path.basename(filePath).replace(/\.[^.]+$/, '');
  const dir = path.basename(path.dirname(filePath));
  if (GENERIC_FILES.has(base)) return pascal(dir) + (base === 'index' ? '' : pascal(base));
  return pascal(base);
}

function inDsFolder(file) {
  return DS_FOLDERS.some((f) => file.startsWith(f));
}

// Componentes definidos no código do projeto
for (const sf of projectFiles) {
  const file = rel(sf.getFilePath());
  for (const [exportName, decls] of sf.getExportedDeclarations()) {
    for (const decl of decls) {
      if (decl.getSourceFile() !== sf) continue; // re-export: indexado no arquivo onde é definido
      const isFn = Node.isFunctionDeclaration(decl);
      const isVar = Node.isVariableDeclaration(decl);
      const isClass = Node.isClassDeclaration(decl);
      const isExpr = !isFn && !isVar && !isClass && Node.isExpression(decl);
      if (!isFn && !isVar && !isClass && !isExpr) continue;
      const init = isVar ? decl.getInitializer() : undefined;
      if (isVar && isStyledInit(init)) continue;

      let name = exportName;
      if (exportName === 'default') {
        if ((isFn || isClass || isVar) && decl.getName?.()) name = decl.getName();
        else if (isExpr && Node.isCallExpression(decl) && Node.isIdentifier(decl.getArguments()[0])) name = decl.getArguments()[0].getText();
        else name = derivedName(sf.getFilePath());
      }
      if (GENERIC_DECLARED.has(name)) name = derivedName(sf.getFilePath());
      if (!isPascal(name) || EXCLUDE_NAME.test(name)) continue;

      let type;
      try {
        type = valueTypeOf(decl);
      } catch {
        continue;
      }
      const fnLike = isFn || isClass || (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init) || Node.isCallExpression(init)));
      if (!returnsJsx(type, decl) && !(fnLike && containsJsx(decl))) continue;

      const symbol = isExpr ? undefined : decl.getSymbol();
      const extra = isExpr ? [decl.getParentIfKind(SyntaxKind.ExportAssignment)] : [];
      register(
        {
          id: `${file}#${name}`,
          name,
          kind: 'component',
          source: inDsFolder(file) ? 'design-system' : 'local',
          file,
          package: null,
          description: docOf(symbol),
          ...extractProps(type, decl),
          declNode: decl,
        },
        [decl, ...extra],
      );
    }
  }
}

// Componentes exportados pelos pacotes do design system
const dsWarnings = [];
for (const [pkg, vf] of dsVirtuals) {
  const target = vf.getExportDeclarations()[0]?.getModuleSpecifierSourceFile();
  if (!target) {
    dsWarnings.push(`pacote do design system "${pkg}" não foi resolvido (está instalado? publica tipos .d.ts?)`);
    continue;
  }
  const untyped = [];
  for (const [name, decls] of vf.getExportedDeclarations()) {
    if (!isPascal(name) || EXCLUDE_NAME.test(name)) continue;
    const valueDecls = decls.filter((d) => Node.isFunctionDeclaration(d) || Node.isVariableDeclaration(d) || Node.isClassDeclaration(d));
    const decl = valueDecls[0];
    if (!decl) continue;
    let type;
    try {
      type = valueTypeOf(decl);
    } catch {
      continue;
    }
    if (type.isAny()) untyped.push(name);
    if (!returnsJsx(type, decl)) continue;
    const fp = toPosix(decl.getSourceFile().getFilePath());
    register(
      {
        id: `${pkg}#${name}`,
        name,
        kind: 'component',
        source: 'design-system',
        file: fp.includes('/node_modules/') ? null : rel(fp),
        package: pkg,
        description: docOf(decl.getSymbol()),
        ...extractProps(type, decl),
      },
      valueDecls,
    );
  }
  if (untyped.length) {
    dsWarnings.push(
      `pacote "${pkg}": ${untyped.length} export(s) com tipo "any" foram ignorados (os tipos do pacote não foram resolvidos; ele acha "react"?): ${untyped.slice(0, 10).join(', ')}`,
    );
  }
}

// ---------------------------------------------------------------- uso em JSX
function finalSymbol(node) {
  let sym = node.getSymbol();
  if (sym && sym.isAlias()) sym = sym.getAliasedSymbol() ?? sym;
  return sym;
}

function idFromNode(node) {
  const sym = finalSymbol(node);
  for (const d of sym?.getDeclarations() ?? []) {
    const id = declToId.get(d.compilerNode);
    if (id) return id;
  }
  return null;
}

function resolveTag(tag) {
  if (Node.isIdentifier(tag)) return isPascal(tag.getText()) ? idFromNode(tag) : null;
  if (Node.isPropertyAccessExpression(tag)) {
    const direct = idFromNode(tag.getNameNode());
    if (direct) return direct;
    let left = tag.getExpression();
    while (Node.isPropertyAccessExpression(left)) left = left.getExpression();
    return Node.isIdentifier(left) ? idFromNode(left) : null;
  }
  return null;
}

function jsxTagsOf(sf) {
  return [...sf.getDescendantsOfKind(SyntaxKind.JsxOpeningElement), ...sf.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement)];
}

const fileUses = new Map(); // arquivo -> Set(id)
const usedIn = new Map(); // id -> Set(arquivo)
for (const sf of projectFiles) {
  const file = rel(sf.getFilePath());
  const ids = new Set();
  for (const el of jsxTagsOf(sf)) {
    const id = resolveTag(el.getTagNameNode());
    if (id) ids.add(id);
  }
  fileUses.set(file, ids);
  for (const id of ids) {
    if (!usedIn.has(id)) usedIn.set(id, new Set());
    usedIn.get(id).add(file);
  }
}

// ---------------------------------------------------------------- rotas
const routes = [];
const EXT_RE = /\.(tsx|ts|jsx|js)$/;
const findFile = (base) => ['tsx', 'ts', 'jsx', 'js'].map((e) => `${base}.${e}`).find((f) => fileSet.has(f)) ?? null;

// Ids dos componentes exportados por um arquivo (segue re-exports, ex.: export { X as default } from '...')
function exportIds(fileRel, names) {
  const sf = project.getSourceFile(path.join(APP_ROOT, fileRel));
  if (!sf) return [];
  const exported = sf.getExportedDeclarations();
  const out = [];
  for (const n of names) {
    for (const d of exported.get(n) ?? []) {
      const id = declToId.get(d.compilerNode) ?? declToId.get(d.getParentIfKind?.(SyntaxKind.ExportAssignment)?.compilerNode);
      if (id) out.push(id);
    }
  }
  return out;
}

if (DEPS.next) {
  for (const dir of ['app', 'src/app']) {
    for (const f of [...fileSet].sort(byStr)) {
      if (!f.startsWith(dir + '/')) continue;
      const m = f.slice(dir.length + 1).match(/^(?:(.*)\/)?(page|layout)\.(tsx|ts|jsx|js)$/);
      if (!m) continue;
      const segs = m[1] ? m[1].split('/') : [];
      const urlSegs = segs.filter((s) => !/^\(.*\)$/.test(s) && !s.startsWith('@'));
      const layouts = [];
      const upTo = m[2] === 'layout' ? segs.length - 1 : segs.length;
      for (let i = 0; i <= upTo; i++) {
        const l = findFile([dir, ...segs.slice(0, i), 'layout'].join('/'));
        if (l && l !== f) layouts.push(l);
      }
      routes.push({ path: '/' + urlSegs.join('/'), kind: m[2], source: 'next-app', file: f, definedIn: f, layouts, rootFiles: [f], rootIds: [], pageIds: exportIds(f, ['default']) });
    }
  }
  for (const dir of ['pages', 'src/pages']) {
    for (const f of [...fileSet].sort(byStr)) {
      if (!f.startsWith(dir + '/') || !EXT_RE.test(f)) continue;
      const sub = f.slice(dir.length + 1).replace(EXT_RE, '');
      if (/^api(\/|$)/.test(sub) || /(^|\/)_(app|document|error|middleware)$/.test(sub)) continue;
      const p = ('/' + sub.replace(/(^|\/)index$/, '')).replace(/\/$/, '') || '/';
      routes.push({ path: p, kind: 'page', source: 'next-pages', file: f, definedIn: f, layouts: [], rootFiles: [f], rootIds: [], pageIds: exportIds(f, ['default']) });
    }
  }
}

function resolveModuleFile(spec, fromFile) {
  const r = ts.resolveModuleName(spec, fromFile, project.getCompilerOptions(), ts.sys);
  const f = r.resolvedModule?.resolvedFileName;
  if (!f || toPosix(f).includes('/node_modules/')) return null;
  const relF = rel(f);
  return fileSet.has(relF) ? relF : null;
}

function dynamicImportFile(node) {
  if (!node) return null;
  const calls = [node, ...node.getDescendantsOfKind(SyntaxKind.CallExpression)].filter(
    (c) => Node.isCallExpression(c) && c.getExpression().getKind() === SyntaxKind.ImportKeyword,
  );
  for (const c of calls) {
    const arg = c.getArguments()[0];
    if (arg && (Node.isStringLiteral(arg) || Node.isNoSubstitutionTemplateLiteral(arg))) {
      const f = resolveModuleFile(arg.getLiteralText(), c.getSourceFile().getFilePath());
      if (f) return f;
    }
  }
  return null;
}

// Resolve uma referência a componente (identificador) para {id, file}
function resolveRef(node) {
  const id = resolveTag(node);
  if (id) return { id, file: components.get(id).package ? null : components.get(id).file };
  const sym = Node.isIdentifier(node) || Node.isPropertyAccessExpression(node) ? finalSymbol(node) : null;
  for (const d of sym?.getDeclarations() ?? []) {
    if (Node.isVariableDeclaration(d)) {
      const f = dynamicImportFile(d.getInitializer());
      if (f) return { id: exportIds(f, ['default', 'Component'])[0] ?? null, file: f };
    }
  }
  return null;
}

function literalOf(expr) {
  if (!expr) return null;
  if (Node.isStringLiteral(expr) || Node.isNoSubstitutionTemplateLiteral(expr)) return expr.getLiteralText();
  try {
    const t = expr.getType();
    if (t.isStringLiteral()) return String(t.getLiteralValue());
  } catch {}
  return `{${clip(expr.getText(), 60)}}`;
}

// Raízes a partir do JSX de um "element": a página é o componente mais profundo fora de props (ex.: fallback)
function rootsFromElement(expr, out) {
  if (!expr) return;
  const tags = [];
  const visit = (n) => {
    if (Node.isJsxOpeningElement(n) || Node.isJsxSelfClosingElement(n)) tags.push(n);
  };
  visit(expr);
  expr.forEachDescendant(visit);
  let best = null;
  for (const tag of tags) {
    const ref = resolveRef(tag.getTagNameNode());
    if (!ref) continue;
    if (ref.id) out.rootIds.add(ref.id);
    if (ref.file) out.rootFiles.add(ref.file);
    let depth = 0;
    let inProp = false;
    for (let p = tag.getParent(); p && p !== expr.getParent(); p = p.getParent()) {
      if (Node.isJsxAttribute(p)) inProp = true;
      if (Node.isJsxElement(p) && p.getOpeningElement() !== tag) depth++;
    }
    const score = inProp ? -1 : depth;
    if (ref.file && (!best || score >= best.score)) best = { score, file: ref.file, id: ref.id };
  }
  if (best && !out.file) {
    out.file = best.file;
    if (best.id) out.pageIds.add(best.id);
  }
}

const tagText = (el) => el.getTagNameNode().getText();
function jsxAttrExpr(el, name) {
  const a = el.getAttribute(name);
  if (!a || !Node.isJsxAttribute(a)) return undefined;
  const init = a.getInitializer();
  if (!init) return null; // atributo booleano (ex.: index)
  return Node.isJsxExpression(init) ? init.getExpression() : init;
}
function propValue(obj, name) {
  const p = obj.getProperty(name);
  if (!p) return undefined;
  if (Node.isPropertyAssignment(p)) return p.getInitializer();
  if (Node.isShorthandPropertyAssignment(p)) return p.getNameNode();
  return undefined;
}

const routeInfoCache = new Map();
function routeInfo(node) {
  if (routeInfoCache.has(node.compilerNode)) return routeInfoCache.get(node.compilerNode);
  const info = { segment: null, index: false, file: null, rootFiles: new Set(), rootIds: new Set(), pageIds: new Set(), hasChildren: false };
  if (Node.isObjectLiteralExpression(node)) {
    const pathExpr = propValue(node, 'path');
    info.segment = pathExpr ? literalOf(pathExpr) : null;
    const idx = propValue(node, 'index');
    info.index = !!idx && idx.getText() === 'true';
    rootsFromElement(propValue(node, 'element'), info);
    const comp = propValue(node, 'Component');
    if (comp) {
      const ref = resolveRef(comp);
      if (ref?.id) {
        info.rootIds.add(ref.id);
        if (!info.file) info.pageIds.add(ref.id);
      }
      if (ref?.file) {
        info.rootFiles.add(ref.file);
        info.file = info.file ?? ref.file;
      }
    }
    const lazyFile = dynamicImportFile(propValue(node, 'lazy'));
    if (lazyFile) {
      info.rootFiles.add(lazyFile);
      if (!info.file) for (const id of exportIds(lazyFile, ['default', 'Component'])) info.pageIds.add(id);
      info.file = info.file ?? lazyFile;
    }
    const children = propValue(node, 'children');
    info.hasChildren = !!children && Node.isArrayLiteralExpression(children) && children.getElements().length > 0;
  } else {
    const el = Node.isJsxElement(node) ? node.getOpeningElement() : node;
    const pathExpr = jsxAttrExpr(el, 'path');
    info.segment = pathExpr === undefined ? null : literalOf(pathExpr);
    info.index = jsxAttrExpr(el, 'index') !== undefined;
    rootsFromElement(jsxAttrExpr(el, 'element') ?? undefined, info);
    for (const attr of ['Component', 'component']) {
      const c = jsxAttrExpr(el, attr);
      if (c) {
        const ref = resolveRef(c);
        if (ref?.id) {
          info.rootIds.add(ref.id);
          if (!info.file) info.pageIds.add(ref.id);
        }
        if (ref?.file) {
          info.rootFiles.add(ref.file);
          info.file = info.file ?? ref.file;
        }
      }
    }
    info.hasChildren =
      Node.isJsxElement(node) && node.getJsxChildren().some((c) => (Node.isJsxElement(c) || Node.isJsxSelfClosingElement(c)) && tagText(Node.isJsxElement(c) ? c.getOpeningElement() : c) === 'Route');
  }
  routeInfoCache.set(node.compilerNode, info);
  return info;
}

function parentRouteNodes(node) {
  const parents = [];
  if (Node.isObjectLiteralExpression(node)) {
    let cur = node;
    for (;;) {
      const arr = cur.getParent();
      const pa = arr?.getParent();
      const obj = pa?.getParent();
      if (!Node.isArrayLiteralExpression(arr) || !Node.isPropertyAssignment(pa) || pa.getName() !== 'children' || !Node.isObjectLiteralExpression(obj)) break;
      parents.unshift(obj);
      cur = obj;
    }
  } else {
    for (let p = node.getParent(); p; p = p.getParent()) {
      if (Node.isJsxElement(p) && tagText(p.getOpeningElement()) === 'Route') parents.unshift(p);
    }
  }
  return parents;
}

function joinPaths(segs) {
  let out = '';
  for (const s of segs) {
    if (!s) continue;
    out = s.startsWith('/') ? s : out.replace(/\/+$/, '') + '/' + s;
  }
  out = out.replace(/\/{2,}/g, '/');
  if (!out.startsWith('/')) out = '/' + out;
  return out.length > 1 ? out.replace(/\/+$/, '') : out;
}

const ROUTER_DEPS = ['react-router', 'react-router-dom', 'react-router-native', '@remix-run/react'];
if (ROUTER_DEPS.some((d) => DEPS[d])) {
  for (const sf of projectFiles) {
    const definedIn = rel(sf.getFilePath());
    const candidates = [];
    for (const el of jsxTagsOf(sf)) {
      if (tagText(el) !== 'Route') continue;
      candidates.push(Node.isJsxOpeningElement(el) ? el.getParent() : el);
    }
    for (const obj of sf.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)) {
      const hasTarget = obj.getProperty('element') || obj.getProperty('Component') || obj.getProperty('lazy');
      const hasPath = obj.getProperty('path') || obj.getProperty('index');
      if (hasTarget && hasPath) candidates.push(obj);
    }
    for (const node of candidates) {
      const info = routeInfo(node);
      if (!info.file && info.rootFiles.size === 0 && info.rootIds.size === 0) continue;
      const parents = parentRouteNodes(node).map(routeInfo);
      const segs = [...parents.map((p) => p.segment), info.index ? null : info.segment];
      routes.push({
        path: joinPaths(segs),
        kind: info.hasChildren ? 'layout' : 'page',
        source: 'react-router',
        file: info.file,
        definedIn,
        layouts: parents.map((p) => p.file).filter(Boolean),
        rootFiles: [...info.rootFiles],
        rootIds: [...info.rootIds],
        pageIds: [...info.pageIds],
      });
    }
  }
}

// ---------------------------------------------------------------- telas/layouts e fechamento
for (const r of routes) {
  for (const id of r.pageIds) {
    const c = components.get(id);
    if (!c || c.source === 'design-system') continue;
    if (r.kind === 'page') c.kind = 'page';
    else if (c.kind !== 'page') c.kind = 'layout';
  }
}

function closure(rootFiles, rootIds) {
  const ids = new Set(rootIds);
  const seen = new Set();
  const queue = [...rootFiles];
  for (const id of rootIds) {
    const c = components.get(id);
    if (c && c.source !== 'design-system' && c.file) queue.push(c.file);
  }
  while (queue.length) {
    const f = queue.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    for (const id of fileUses.get(f) ?? []) {
      ids.add(id);
      const c = components.get(id);
      // Não entra nos arquivos do design system: os internos dele não são "usados pela tela"
      if (c && c.source !== 'design-system' && c.file && fileSet.has(c.file)) queue.push(c.file);
    }
  }
  return ids;
}

// Componentes usados dentro da declaração; se a declaração não tem JSX (ex.: memo(Foo), Object.assign), usa o arquivo todo
function usesOf(c) {
  if (c.package || !c.file || !c.declNode) return [];
  const ids = new Set();
  const visit = (n) => {
    if (Node.isJsxOpeningElement(n) || Node.isJsxSelfClosingElement(n)) {
      const id = resolveTag(n.getTagNameNode());
      if (id) ids.add(id);
    }
  };
  c.declNode.forEachDescendant(visit);
  const result = containsJsx(c.declNode) ? ids : new Set(fileUses.get(c.file) ?? []);
  result.delete(c.id);
  return sortedUnique(result);
}

const routesOut = [];
const routesOf = new Map(); // id -> Set(path)
const routeKeys = new Set();
for (const r of routes) {
  const key = `${r.path}|${r.kind}|${r.file}|${r.definedIn}`;
  if (routeKeys.has(key)) continue;
  routeKeys.add(key);
  const ids = closure(r.rootFiles, [...r.rootIds, ...r.pageIds]);
  for (const id of [...ids, ...r.pageIds]) {
    if (!routesOf.has(id)) routesOf.set(id, new Set());
    routesOf.get(id).add(r.path);
  }
  routesOut.push({
    path: r.path,
    kind: r.kind,
    source: r.source,
    file: r.file,
    definedIn: r.definedIn,
    pageComponents: sortedUnique(r.pageIds),
    layouts: sortedUnique(r.layouts),
    components: sortedUnique([...ids].filter((id) => components.get(id)?.kind === 'component')),
  });
}
routesOut.sort((a, b) => byStr(a.path, b.path) || byStr(a.kind, b.kind) || byStr(a.file ?? '', b.file ?? '') || byStr(a.definedIn, b.definedIn));

// ---------------------------------------------------------------- saída
const SOURCE_ORDER = { 'design-system': 0, local: 1 };
const KIND_ORDER = { component: 0, layout: 1, page: 2 };
const componentsOut = [...components.values()]
  .map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
    source: c.source,
    file: c.file,
    package: c.package,
    description: c.description,
    props: c.props,
    omittedInheritedProps: c.omittedInheritedProps,
    extraPropsNotListed: c.extraPropsNotListed,
    usageCount: usedIn.get(c.id)?.size ?? 0,
    usedInFiles: sortedUnique(usedIn.get(c.id) ?? []),
    usedInRoutes: sortedUnique(routesOf.get(c.id) ?? []),
    uses: usesOf(c),
  }))
  .sort((a, b) => SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source] || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || byStr(a.name, b.name) || byStr(a.id, b.id));

const count = (pred) => componentsOut.filter(pred).length;
const index = {
  generatedBy: 'tools/ai-index/generate.mjs',
  note: 'Arquivo gerado. Não edite à mão. Atualize com: node tools/ai-index/generate.mjs',
  schemaVersion: 1,
  stats: {
    filesScanned: projectFiles.length,
    designSystemComponents: count((c) => c.source === 'design-system'),
    localComponents: count((c) => c.source === 'local' && c.kind === 'component'),
    pages: count((c) => c.kind === 'page'),
    layouts: count((c) => c.kind === 'layout'),
    routes: routesOut.length,
  },
  components: componentsOut,
  routes: routesOut,
};

function renderMarkdown() {
  const nameOf = (id) => components.get(id)?.name ?? id;
  const where = (c) => (c.package ? `pacote \`${c.package}\`${c.file ? ` (\`${c.file}\`)` : ''}` : `\`${c.file}\``);
  const propsLine = (c) => {
    if (c.props.length === 0) return '_sem props próprias_';
    const parts = c.props.map((p) => `\`${p.name}${p.required ? '' : '?'}: ${clip(p.type, 80)}\``);
    const extra = c.extraPropsNotListed ? ` (+${c.extraPropsNotListed} não listadas)` : '';
    return clip(parts.join(', '), 900) + extra;
  };
  const section = (title, list) => {
    const out = [`## ${title} (${list.length})`, ''];
    for (const c of list) {
      out.push(`### ${c.name} — ${where(c)}`);
      out.push(`- id: \`${c.id}\``);
      if (c.description) out.push(`- descrição: ${c.description}`);
      out.push(`- props: ${propsLine(c)}`);
      out.push(`- usado em ${c.usageCount} arquivo(s)${c.usedInRoutes.length ? `; rotas: ${clip(c.usedInRoutes.join(', '), 300)}` : ''}`);
      if (c.uses.length) out.push(`- usa: ${clip(c.uses.map(nameOf).join(', '), 300)}`);
      out.push('');
    }
    return out.join('\n');
  };
  const s = index.stats;
  const lines = [
    '# Índice de componentes e rotas',
    '',
    '> Arquivo GERADO por `tools/ai-index/generate.mjs`. Não edite à mão. Para atualizar: `node tools/ai-index/generate.mjs`.',
    '> Agentes: prefiram as tools do MCP `ui-index`. Este arquivo é o fallback; busque por nome/termo em vez de ler tudo.',
    '',
    `Resumo: ${s.designSystemComponents} do design system · ${s.localComponents} locais · ${s.pages} telas · ${s.layouts} layouts · ${s.routes} rotas · ${s.filesScanned} arquivos analisados`,
    '',
    `## Rotas (${routesOut.length})`,
    '',
    '| Rota | Tipo | Arquivo | Layouts | Componentes |',
    '|---|---|---|---|---|',
    ...routesOut.map(
      (r) =>
        `| \`${r.path.replace(/\|/g, '\\|')}\` | ${r.kind} | ${r.file ? `\`${r.file}\`` : '—'} | ${r.layouts.map((l) => `\`${l}\``).join(', ') || '—'} | ${clip(r.components.map(nameOf).join(', '), 400) || '—'} |`,
    ),
    '',
    section('Design system', componentsOut.filter((c) => c.source === 'design-system')),
    section('Componentes locais', componentsOut.filter((c) => c.source === 'local' && c.kind === 'component')),
    section('Layouts', componentsOut.filter((c) => c.source === 'local' && c.kind === 'layout')),
    section('Telas (páginas)', componentsOut.filter((c) => c.source === 'local' && c.kind === 'page')),
  ];
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

function discoverReport() {
  const pkgRoot = (spec) => (spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]);
  const pkgs = new Map(); // pkg -> { files:Set, examples:Set }
  for (const sf of projectFiles) {
    const local = new Map(); // nome local -> [pkg, nomeImportado|null]
    for (const imp of sf.getImportDeclarations()) {
      const spec = imp.getModuleSpecifierValue();
      if (spec.startsWith('.')) continue;
      const target = imp.getModuleSpecifierSourceFile();
      if (target && fileSet.has(rel(target.getFilePath()))) continue; // alias para código do projeto
      const root = pkgRoot(spec);
      const d = imp.getDefaultImport();
      if (d) local.set(d.getText(), [root, d.getText()]);
      const ns = imp.getNamespaceImport();
      if (ns) local.set(ns.getText(), [root, null]);
      for (const n of imp.getNamedImports()) local.set((n.getAliasNode() ?? n.getNameNode()).getText(), [root, n.getName()]);
    }
    for (const el of jsxTagsOf(sf)) {
      const tag = el.getTagNameNode();
      let left = tag;
      while (Node.isPropertyAccessExpression(left)) left = left.getExpression();
      const hit = local.get(left.getText());
      if (!hit) continue;
      const [root, imported] = hit;
      if (!pkgs.has(root)) pkgs.set(root, { files: new Set(), examples: new Set() });
      const entry = pkgs.get(root);
      entry.files.add(rel(sf.getFilePath()));
      entry.examples.add(imported ?? (Node.isPropertyAccessExpression(tag) ? tag.getName() : left.getText()));
    }
  }
  const dirs = new Map();
  for (const c of components.values()) {
    if (c.package || !c.file) continue;
    const d = path.posix.dirname(c.file);
    dirs.set(d, (dirs.get(d) ?? 0) + 1);
  }
  // Pastas internas com cara de design system: corta o caminho no segmento que casou (ex.: src/components/ui/button -> src/components/ui)
  const DS_SEGMENT = /^(design-?system|designsystem|ds|ui|ui-?kit|primitives|atoms)$/i;
  const dsRootOf = (dir) => {
    const parts = dir.split('/');
    const i = parts.findIndex((p) => DS_SEGMENT.test(p));
    return i >= 0 ? parts.slice(0, i + 1).join('/') : null;
  };
  const dsFolders = sortedUnique([...dirs.keys()].map(dsRootOf).filter(Boolean));
  const insideDs = (file) => dsFolders.some((f) => file.startsWith(f + '/'));
  const NOT_DS =
    /^(react|react-dom|next|react-router.*|@remix-run\/.*|@tanstack\/.*|react-hook-form|formik|react-final-form|react-helmet.*|react-error-boundary|@apollo\/.*|react-redux|zustand|jotai|recoil|framer-motion|motion|react-i18next|i18next|react-intl|@lingui\/.*|@emotion\/.*|styled-components|@stitches\/.*|recharts|chart\.js|react-chartjs-2|@nivo\/.*|victory|echarts-for-react|@visx\/.*|highcharts-react-official|react-apexcharts|lucide-react|react-icons|@heroicons\/.*|@tabler\/icons-react|@phosphor-icons\/.*|@fortawesome\/.*|@mui\/icons-material|@radix-ui\/react-icons|@ant-design\/icons|@chakra-ui\/icons|react-feather|@iconify\/.*|sonner|react-hot-toast|react-toastify|@testing-library\/.*|@storybook\/.*|@vercel\/.*|@next\/.*)$/;
  const ICONS = /(^|[-/@])icons?([-/]|$)/i;
  const UI_NAME = /(design|(^|[-/@])(ds|ui|ui-?kit|components)([-/]|$))/i;
  const pkgRows = [...pkgs.entries()]
    .map(([p, e]) => ({ p, total: e.files.size, outside: [...e.files].filter((f) => !insideDs(f)).length, examples: [...e.examples].sort(byStr).slice(0, 8) }))
    .sort((a, b) => b.total - a.total || byStr(a.p, b.p));
  const suggestedPackages = pkgRows
    .filter((r) => !NOT_DS.test(r.p) && !ICONS.test(r.p) && r.outside >= 1 && (r.outside >= 3 || UI_NAME.test(r.p)))
    .map((r) => r.p)
    .sort(byStr);
  const lines = [
    '== ai-index --discover ==',
    `APP_ROOT: ${APP_ROOT}`,
    `tsconfig: ${CONFIG.tsconfig ?? '(nenhum)'}`,
    `Arquivos analisados: ${projectFiles.length}`,
    `Roteamento: next=${DEPS.next ? 'sim' : 'não'} | react-router=${ROUTER_DEPS.some((d) => DEPS[d]) ? 'sim' : 'não'} | rotas encontradas=${routesOut.length}`,
    '',
    'PACOTES EXTERNOS cujos componentes são usados em JSX (pacote | arquivos que usam | arquivos fora das pastas de DS interno | exemplos):',
    ...pkgRows.slice(0, 40).map((r) => `  ${r.p} | ${r.total} | ${r.outside} | ${r.examples.join(', ')}`),
    '',
    'PASTAS INTERNAS com cara de design system:',
    ...(dsFolders.length ? dsFolders.map((d) => `  ${d}`) : ['  (nenhuma)']),
    '',
    'TODAS AS PASTAS com componentes exportados (pasta | componentes):',
    ...[...dirs.entries()].sort((a, b) => byStr(a[0], b[0])).map(([d, n]) => `  ${d} | ${n}`),
    '',
    'SUGESTÃO para "designSystem" em tools/ai-index/config.json:',
    `  "packages": ${JSON.stringify(suggestedPackages)}`,
    `  "folders": ${JSON.stringify(dsFolders)}`,
  ];
  return lines.join('\n');
}

const json = JSON.stringify(index, null, 2) + '\n';
const md = renderMarkdown();
for (const w of dsWarnings) log('AVISO:', w);

if (MODE === 'discover') {
  console.log(discoverReport());
} else if (MODE === 'check') {
  const same = (f, content) => fs.existsSync(f) && fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n') === content;
  if (!same(OUT_JSON, json) || !same(OUT_MD, md)) {
    log('ERRO: o índice de componentes está desatualizado.');
    log('Rode "node tools/ai-index/generate.mjs" (ou o script ai:index) e commite os arquivos de tools/ai-index/generated/.');
    process.exit(1);
  }
  log(`OK: índice atualizado (${((Date.now() - started) / 1000).toFixed(1)}s).`);
} else {
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, json);
  fs.writeFileSync(OUT_MD, md);
  const s = index.stats;
  log(
    `OK: ${s.designSystemComponents} do DS, ${s.localComponents} locais, ${s.pages} telas, ${s.layouts} layouts, ${s.routes} rotas, ${s.filesScanned} arquivos (${((Date.now() - started) / 1000).toFixed(1)}s).`,
  );
  log(`Gravado em ${rel(OUT_JSON)} e ${rel(OUT_MD)}`);
}
