# Tarefa: configurar o fluxo "reaproveitar antes de criar" para o agent de UI

Você vai configurar neste repositório três coisas que trabalham juntas:

1. **Gerador de índice** (`tools/ai-index/generate.mjs`): lê o código do front com ts-morph e gera um índice com todos os componentes (design system e locais), as props de cada um, onde cada um é usado, telas, layouts e rotas. Ele se atualiza sozinho em todo commit (hook de pre-commit) e é conferido no CI.
2. **Servidor MCP `ui-index`** (`tools/ai-index/mcp-server.mjs`): deixa o agent consultar esse índice (buscar componentes, ver props, ver onde são usados, ver rotas). Não tem dependências.
3. **Regra do Cursor** (`.cursor/rules/reuse-first-ui.mdc`): obriga o agent a seguir a ordem reusar → compor → estender → só em último caso criar, e a entregar um plano de reaproveitamento antes de escrever código.

## Regras de execução (valem para a tarefa inteira)

1. Execute as fases na ordem: 0, 1, 2, 3, 4. Não pule nem reordene passos.
2. Quando um passo disser **conteúdo exato**, crie o arquivo com o conteúdo do bloco indicado, copiado caractere por caractere. Não reformate, não "melhore", não traduza, não resuma, não converta para TypeScript, não remova comentários, não troque aspas. Os blocos são delimitados por quatro crases (````); as crases não fazem parte do arquivo.
3. As únicas decisões que são suas são os valores das variáveis da Fase 0. Onde aparecer `<<P>>`, `<<G>>` ou `<<RUN>>`, substitua pelo valor da variável (P e G podem ser vazios). Nenhum `<<...>>` pode sobrar nos arquivos finais.
4. Não altere nenhum arquivo que não esteja listado neste documento. Nunca edite `generate.mjs`, `mcp-server.mjs`, `mcp-smoke-test.mjs` nem `pre-commit.sh` depois de criados: se um deles falhar, PARE e me mostre o erro completo.
5. Não rode `npm audit fix`, não atualize nem reinstale dependências existentes. A única dependência nova é `ts-morph` (e `husky`, só no caso previsto no passo 1.10).
6. Não faça commit, push nem abra PR. Deixe tudo no working tree para eu revisar.
7. Se um comando falhar: mostre o erro completo, corrija só o que for causado por esta tarefa e rode de novo. Se a correção exigir mexer em algo fora deste documento, PARE e me pergunte.
8. Quando este documento disser **PARE**, pare e espere minha resposta.
9. Conferência de cópia: depois de criar cada arquivo de **conteúdo exato** (exceto a regra `.mdc`), rode dentro de APP_ROOT o comando abaixo trocando `<arquivo>` pelo caminho do arquivo, e compare a saída com o hash esperado informado no passo. Se for diferente, apague o arquivo e crie de novo a partir do bloco. Se continuar diferente na segunda tentativa, PARE e me avise.
   `node -e "const c=require('fs').readFileSync(process.argv[1],'utf8').replace(/\r\n/g,'\n');console.log(require('crypto').createHash('sha256').update(c).digest('hex'))" <arquivo>`
10. Terminal: os comandos estão em sintaxe de shell POSIX (bash/zsh). Se o seu terminal for PowerShell, use a sintaxe equivalente; para rodar arquivos `.sh` no Windows, use o Git Bash (`"C:\Program Files\Git\bin\bash.exe" -c "<comando>"`).

## Fase 0: descoberta (somente leitura)

Não altere nada nesta fase. Descubra os valores abaixo e mostre-os numa tabela `Variável | Valor | Como descobri`. Depois siga para a Fase 1 sem esperar, a não ser que algum item mande PARAR.

**0.1 REPO_ROOT**: saída de `git rev-parse --show-toplevel`.

**0.2 CURSOR_ROOT**: pasta raiz do workspace aberto no Cursor (a raiz em que você está trabalhando).

**0.3 APP_ROOT**: pasta do `package.json` do app front-end React em que o agent cria telas.
- Repositório simples (sem monorepo) com `react` em `dependencies` do `package.json` da raiz: APP_ROOT = REPO_ROOT.
- Monorepo (existe `workspaces` no `package.json` da raiz, `pnpm-workspace.yaml`, `turbo.json`, `nx.json` ou `lerna.json`): APP_ROOT é a pasta do app web que tem `react` em `dependencies` (normalmente junto com `next` ou `vite`).
- Se houver mais de um app React candidato, PARE e me pergunte qual.
- Se APP_ROOT não estiver dentro de CURSOR_ROOT, PARE e me avise.

**0.4 P**: caminho de APP_ROOT relativo a CURSOR_ROOT, com `/` no final (ex.: `apps/web/`). Se forem a mesma pasta, P é vazio.

**0.5 G**: caminho de APP_ROOT relativo a REPO_ROOT, com `/` no final (ex.: `apps/web/`). Se forem a mesma pasta, G é vazio.

**0.6 PM** (gerenciador de pacotes): procure o lockfile primeiro em APP_ROOT e depois em REPO_ROOT. `pnpm-lock.yaml` → `pnpm`; `yarn.lock` → `yarn`; `bun.lockb` ou `bun.lock` → `bun`; `package-lock.json` ou nenhum → `npm`.

**0.7 PM_RUN**: `npm run` (npm), `pnpm run` (pnpm), `yarn` (yarn), `bun run` (bun).

**0.8 RUN**: `yarn node` se existir `.pnp.cjs` em APP_ROOT ou em REPO_ROOT (Yarn Plug'n'Play); senão `node`.

**0.9 NODE**: saída de `node -v`. Precisa ser 20 ou maior (o ts-morph 28 exige). Se for menor, PARE e me avise.

**0.10 STACK**: confira se `react` está em `dependencies` ou `peerDependencies` do `package.json` de APP_ROOT. Se não estiver (Angular, Vue, Svelte etc.), PARE e me avise: este setup é só para React. Anote também se existe `next` e se existe `react-router` ou `react-router-dom` nas dependências.

**0.11 TSCONFIG** (caminho relativo a APP_ROOT; use a primeira regra que se aplicar):
1. se `tsconfig.json` tiver `"files": []` e `"references"` (padrão do Vite): o arquivo referenciado cujo `include` contém `src` (normalmente `tsconfig.app.json`);
2. se existir `tsconfig.json`: `tsconfig.json`;
3. se existir `jsconfig.json`: `jsconfig.json`;
4. senão: `null`.

**0.12 INCLUDE** (lista de globs relativos a APP_ROOT):
- se existe a pasta `src/` em APP_ROOT: `["src/**/*.{ts,tsx,js,jsx}"]`;
- senão: um item `"<pasta>/**/*.{ts,tsx,js,jsx}"` para cada pasta da raiz de APP_ROOT que contém arquivos `.tsx` ou `.jsx` em qualquer nível (ex.: `app`, `pages`, `components`, `features`, `lib`, `hooks`). Nunca inclua `node_modules`, `dist`, `build`, `.next`, `out`, `coverage`, `public`, `storybook-static`, `e2e`, `cypress`, `tools`.

**0.13 HOOKS** (ferramenta de git hooks; use o primeiro critério que bater):
1. `husky`: `git config --get core.hooksPath` retorna um caminho terminado em `.husky/_` ou `.husky`, ou existe uma pasta `.husky/` em REPO_ROOT ou em APP_ROOT. Anote também HUSKY_DIR = essa pasta `.husky` (caminho relativo a REPO_ROOT).
2. `husky-v4`: algum `package.json` (REPO_ROOT ou APP_ROOT) tem `"husky": { "hooks": { ... } }`.
3. `lefthook`: existe `lefthook.yml`, `lefthook.yaml`, `.lefthook.yml` ou `.lefthook.yaml` em REPO_ROOT.
4. `simple-git-hooks`: algum `package.json` (REPO_ROOT ou APP_ROOT) tem a chave `"simple-git-hooks"`.
5. `pre-commit-python`: existe `.pre-commit-config.yaml` em REPO_ROOT.
6. `nenhum`.

**0.14 CI** (use o primeiro que bater): `github` (existem arquivos em `.github/workflows/`), `gitlab` (`.gitlab-ci.yml`), `azure` (`azure-pipelines.yml`/`.yaml`, ou pastas `.azure-pipelines/` ou `.azuredevops/`), `bitbucket` (`bitbucket-pipelines.yml`), `outro` (Jenkinsfile, CircleCI etc.), `nenhum`.
- Se for `github`, `gitlab`, `azure` ou `bitbucket`: anote **CI_JOB** = arquivo + nome do job que roda em pull request/merge request e instala as dependências do front (ex.: o job de lint, test ou build do front). Se não existir job assim: CI_JOB = `nenhum`.

**0.15 PRETTIER**: `sim` se existir `.prettierrc*`, `prettier.config.*` ou a chave `prettier` em algum `package.json` (APP_ROOT ou REPO_ROOT); senão `não`.

**0.16 ESLINT**: `flat` se existir `eslint.config.*` (APP_ROOT ou REPO_ROOT); `legado` se existir `.eslintrc*` ou a chave `eslintConfig` em algum `package.json`; senão `não`. Anote o arquivo encontrado.

**0.17 TYPECHECK**: nome do script do `package.json` de APP_ROOT que roda só a checagem de tipos (`typecheck`, `type-check`, `check-types`, `tsc` ou `lint:types`); se não houver, `nenhum`.

## Fase 1: passo 1, gerador do índice e atualização automática

**1.1 Instalar ts-morph** como devDependency de APP_ROOT, versão exata. Se `ts-morph` já estiver em `dependencies` ou `devDependencies` de APP_ROOT, não instale nada e siga.
- npm: dentro de APP_ROOT, `npm install --save-dev --save-exact ts-morph@28.0.0`. Se for monorepo com workspaces do npm, rode em REPO_ROOT: `npm install --save-dev --save-exact ts-morph@28.0.0 -w <G sem a barra final>`.
- pnpm: dentro de APP_ROOT, `pnpm add -D --save-exact ts-morph@28.0.0`.
- yarn: dentro de APP_ROOT, `yarn add -D --exact ts-morph@28.0.0`.
- bun: dentro de APP_ROOT, `bun add -d --exact ts-morph@28.0.0`.

**1.2 Criar `tools/ai-index/config.json`** dentro de APP_ROOT com este conteúdo, trocando `"<TSCONFIG>"` pelo valor de TSCONFIG entre aspas (ou por `null` sem aspas) e `<INCLUDE>` pela lista INCLUDE. Deixe `packages` e `folders` vazios por enquanto; eles são preenchidos no passo 1.6.

````json
{
  "tsconfig": "<TSCONFIG>",
  "include": <INCLUDE>,
  "exclude": ["**/*.test.*", "**/*.spec.*", "**/*.stories.*", "**/*.cy.*", "**/__tests__/**", "**/__mocks__/**"],
  "excludeComponentPattern": "^.+Icon$",
  "designSystem": {
    "packages": [],
    "folders": []
  }
}
````

**1.3 Criar `tools/ai-index/generate.mjs`** dentro de APP_ROOT, **conteúdo exato**. Hash esperado (regra 9): `40bce9b827bca5a504b9a7567d3f5b31670f92bfac1085a442971a6e280dbcbd`

````js
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
````

**1.4 Adicionar scripts** ao `package.json` de APP_ROOT (dentro de `"scripts"`, sem alterar os scripts que já existem). Se algum desses nomes já existir, PARE e me pergunte.

````json
"ai:index": "node tools/ai-index/generate.mjs",
"ai:index:check": "node tools/ai-index/generate.mjs --check",
"ai:index:discover": "node tools/ai-index/generate.mjs --discover",
"ai:mcp:test": "node tools/ai-index/mcp-smoke-test.mjs"
````

**1.5 Rodar a descoberta**: dentro de APP_ROOT, `<<RUN>> tools/ai-index/generate.mjs --discover`. Mostre a saída completa no chat.

**1.6 Preencher o design system** em `tools/ai-index/config.json`: copie para `designSystem.packages` e `designSystem.folders` exatamente as listas da seção `SUGESTÃO` no fim da saída do passo 1.5. Só há uma exceção: tire da lista um pacote sugerido que você tenha certeza de que não é biblioteca de componentes visuais (ex.: é de dados, roteamento, formulário ou ícones). Não acrescente nada que não esteja na sugestão. Registre no relatório final o que entrou, o que saiu e por quê.

**1.7 Gerar e validar o índice** (dentro de APP_ROOT):
1. `<<RUN>> tools/ai-index/generate.mjs`. A última linha deve começar com `[ai-index] Gravado em`. Se aparecer erro, PARE e me mostre a saída completa.
2. `<<RUN>> tools/ai-index/generate.mjs --check`. Deve responder `[ai-index] OK: índice atualizado`.
3. Abra `tools/ai-index/generated/component-index.md` e copie para o relatório final: a linha `Resumo: ...` e as primeiras 15 linhas da tabela de rotas.
4. Se a saída tiver linhas `[ai-index] AVISO:`, copie-as para o relatório final.
5. Se `designSystem` não estiver vazio e o resumo mostrar `0 do design system`, ou se STACK tem `next`/`react-router` e o índice tem `0 rotas`, não tente consertar: registre no relatório final para eu analisar.

**1.8 Ajustes de ferramentas do projeto:**
1. `.gitattributes` em REPO_ROOT (crie se não existir): acrescente a linha `<<G>>tools/ai-index/generated/** linguist-generated=true`.
2. Se PRETTIER = `sim`: se existir `.prettierignore` em APP_ROOT, acrescente nele a linha `tools/ai-index/generated/`; senão, acrescente a linha `<<G>>tools/ai-index/generated/` ao `.prettierignore` de REPO_ROOT (crie se não existir).
3. Se ESLINT = `flat`: no arquivo encontrado na 0.16, acrescente o glob `tools/ai-index/**` (se o arquivo estiver em APP_ROOT) ou `<<G>>tools/ai-index/**` (se estiver em REPO_ROOT) aos ignores globais: se já existe um objeto de config que tem apenas a chave `ignores`, acrescente o glob na lista dele; senão, adicione `{ ignores: ['<glob>'] }` como primeiro item da lista de configs exportada (dentro do array, ou como primeiro argumento de `defineConfig(...)`/`tseslint.config(...)`).
4. Se ESLINT = `legado`: acrescente `tools/ai-index/` ao `.eslintignore` da mesma pasta do arquivo de config do ESLint (crie se não existir). Se o config estiver em REPO_ROOT, use `<<G>>tools/ai-index/`.
5. Se TYPECHECK não for `nenhum`: dentro de APP_ROOT, rode `<PM_RUN> <TYPECHECK>`. Se houver erros em arquivos de `tools/ai-index/`, adicione `"tools/ai-index"` ao `exclude` do arquivo TSCONFIG (crie a chave `exclude` se não existir) e rode de novo. Erros em outros arquivos já existiam antes: não mexa, só registre no relatório.

**1.9 Criar `tools/ai-index/pre-commit.sh`** dentro de APP_ROOT, **conteúdo exato**. Hash esperado (regra 9): `b0e5b165c3b48c47028c07775671835e8ac5c86080b845019e2676094703ac73`

````sh
#!/bin/sh
# ai-index: regenera o índice de componentes/rotas quando o commit tem arquivos JS/TS ou mudança de dependências.
# Chamado pelo hook de pre-commit do repositório. Grava tools/ai-index/generated/component-index.{json,md} e os adiciona ao commit.
# AI_INDEX_FORCE=1 força a geração mesmo sem arquivos relevantes no commit (usado para testar o hook).
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
APP_ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)
REPO_ROOT=$(git -C "$APP_ROOT" rev-parse --show-toplevel)

# Dispara com qualquer JS/TS do repositório (inclui design system em outro pacote) ou mudança de dependências
CHANGED=$(git diff --cached --name-only --diff-filter=ACMRD | grep -E '\.(ts|tsx|js|jsx)$|(^|/)(package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?)$' | grep -v "tools/ai-index/")
if [ -z "$CHANGED" ] && [ "$AI_INDEX_FORCE" != "1" ]; then
  exit 0
fi

echo "[ai-index] Atualizando o índice de componentes..."
if [ -f "$APP_ROOT/.pnp.cjs" ] || [ -f "$REPO_ROOT/.pnp.cjs" ]; then
  (cd "$APP_ROOT" && yarn node "$SCRIPT_DIR/generate.mjs")
else
  node "$SCRIPT_DIR/generate.mjs"
fi
if [ $? -ne 0 ]; then
  echo "[ai-index] Falha ao gerar o índice. Commit abortado. Corrija o erro acima ou rode o script ai:index para ver detalhes."
  exit 1
fi
git add "$SCRIPT_DIR/generated/component-index.json" "$SCRIPT_DIR/generated/component-index.md"
exit 0
````

**1.10 Ligar o script ao pre-commit.** A linha do hook é sempre `sh <<G>>tools/ai-index/pre-commit.sh` (caminho relativo a REPO_ROOT, porque o git roda hooks a partir da raiz do repositório). Siga o caso de HOOKS:
- `husky`: acrescente a linha do hook em uma linha nova, no final de `<HUSKY_DIR>/pre-commit` (crie o arquivo se não existir). Não remova nem altere nenhuma linha existente.
- `husky-v4`: no `package.json` que tem a configuração do husky, em `husky.hooks.pre-commit`: se o valor já existir, acrescente ` && sh <caminho>` no final; se não existir, crie com `sh <caminho>`. Aqui `<caminho>` é o caminho de `tools/ai-index/pre-commit.sh` relativo à pasta desse `package.json`.
- `lefthook`: no arquivo do lefthook, dentro de `pre-commit`, acrescente um comando chamado `ai-index` com `run: sh <<G>>tools/ai-index/pre-commit.sh`. Se o arquivo usa `commands:`, adicione em `commands:`; se usa `jobs:`, adicione `- name: ai-index` com o `run:` em `jobs:`; se não existe a seção `pre-commit`, crie `pre-commit:` com `commands:`. Depois rode `npx lefthook install` (ou o equivalente com PM).
- `simple-git-hooks`: no `package.json` que tem a chave, acrescente ` && sh <<G>>tools/ai-index/pre-commit.sh` no final do valor de `pre-commit` (ou crie `"pre-commit": "sh <<G>>tools/ai-index/pre-commit.sh"`). Depois rode `npx simple-git-hooks` (ou o equivalente com PM).
- `pre-commit-python`: PARE e me pergunte.
- `nenhum`: instale o husky na raiz do repositório.
  1. Se REPO_ROOT não tiver `package.json`, PARE e me pergunte.
  2. Em REPO_ROOT: `npm install --save-dev husky` (npm) | `pnpm add -D -w husky` (pnpm) | `yarn add -D husky` (yarn) | `bun add -d husky` (bun).
  3. Se o `package.json` de REPO_ROOT já tiver o script `prepare`: não rode `husky init`; acrescente ` && husky` no final do `prepare` existente, crie `.husky/pre-commit` contendo só a linha do hook e rode `npx husky` (npm) | `pnpm exec husky` | `yarn husky` | `bunx husky`.
  4. Se não tiver `prepare`: rode `npx husky init` (npm) | `pnpm exec husky init` | `yarn husky init` | `bunx husky init`. Depois substitua todo o conteúdo de `.husky/pre-commit` pela linha do hook (o `husky init` cria esse arquivo com `npm test`; essa linha deve sumir).
- Teste do hook (sem fazer commit), a partir de REPO_ROOT:
  1. `sh -n <<G>>tools/ai-index/pre-commit.sh` não pode mostrar erro.
  2. `AI_INDEX_FORCE=1 sh <<G>>tools/ai-index/pre-commit.sh` deve mostrar `[ai-index] Atualizando o índice de componentes...` e depois `[ai-index] Gravado em ...`.
  3. Esse teste coloca os arquivos gerados no stage. Tire do stage: `git restore --staged <<G>>tools/ai-index/generated/`.

**1.11 Conferência no CI.** O comando de verificação é `<PM_RUN> ai:index:check`, rodado dentro de APP_ROOT. Ele falha se alguém commitou sem atualizar o índice (ex.: commit com `--no-verify`).
- Se CI_JOB não for `nenhum`: no job CI_JOB, adicione um passo logo depois do passo que instala as dependências. Formato por CI:
  - `github`: `- name: Verificar índice de componentes (ai-index)` com `run: <PM_RUN> ai:index:check` e `working-directory: <G sem a barra final>` (omita `working-directory` se G for vazio ou se o job já roda dentro de APP_ROOT).
  - `gitlab` e `bitbucket`: acrescente no `script` do job, logo depois da instalação: `- (cd <G sem a barra final, ou . se G for vazio> && <PM_RUN> ai:index:check)`.
  - `azure`: `- script: <PM_RUN> ai:index:check` com `displayName: Verificar índice de componentes (ai-index)` e `workingDirectory: $(System.DefaultWorkingDirectory)/<G sem a barra final>` (omita `workingDirectory` se G for vazio).
- Se CI_JOB = `nenhum` ou CI for `outro`/`nenhum`: não crie pipeline nem job novo. Registre no relatório final como pendente, com o comando.

## Fase 2: passo 2, servidor MCP `ui-index`

**2.1 Criar `tools/ai-index/mcp-server.mjs`** dentro de APP_ROOT, **conteúdo exato**. Hash esperado (regra 9): `bdf19c76f89b59e4edd77768d575e3b53df4d47ffe297b4d5b67de5a146a92e1`

````js
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
````

**2.2 Criar `tools/ai-index/mcp-smoke-test.mjs`** dentro de APP_ROOT, **conteúdo exato**. Hash esperado (regra 9): `bdf9ad28509dda7b610666d722a45528684c9798af4b1440d11bfa1984ca9827`

````js
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
````

**2.3 Registrar o servidor no Cursor**: arquivo `.cursor/mcp.json` em CURSOR_ROOT.
- Se o arquivo não existir, crie com este conteúdo (troque `<<P>>`; `${workspaceFolder}` fica literal, quem resolve é o Cursor):

````json
{
  "mcpServers": {
    "ui-index": {
      "command": "node",
      "args": ["${workspaceFolder}/<<P>>tools/ai-index/mcp-server.mjs"]
    }
  }
}
````

- Se o arquivo já existir: acrescente só a entrada `"ui-index"` (o objeto acima) dentro de `"mcpServers"`, sem mexer nos outros servidores. Se já existir uma entrada `"ui-index"`, PARE e me pergunte.

**2.4 Testar o servidor**: dentro de APP_ROOT, rode `node tools/ai-index/mcp-smoke-test.mjs "button"`. Todas as linhas devem começar com `OK`. Se alguma começar com `FALHOU`, PARE e me mostre a saída.

## Fase 3: passo 3, regra do agent

**3.1 Criar `.cursor/rules/reuse-first-ui.mdc`** em CURSOR_ROOT (crie as pastas se não existirem), **conteúdo exato**, trocando `<<P>>` e `<<RUN>>` pelos valores da Fase 0 (essa troca é a única diferença permitida; o arquivo final tem 88 linhas). Se já existir um arquivo com esse nome, PARE e me pergunte.

````markdown
---
description: Fluxo obrigatório "reaproveitar antes de criar" para qualquer tarefa de UI (telas, rotas, layouts e componentes)
alwaysApply: true
---

# Reaproveitar antes de criar (UI)

Este repositório tem um índice GERADO de todo o front: componentes do design system, componentes locais, telas, layouts, as props de cada componente, onde cada um é usado e todas as rotas. O índice é a fonte de verdade sobre o que já existe. Consulte-o SEMPRE antes de escrever código de UI.

## Quando esta regra vale

Em qualquer tarefa que crie ou altere tela/página, rota, layout ou componente visual, inclusive quando o pedido vier como design (Figma, print, imagem) ou como descrição em texto. Não vale para tarefas sem UI (só backend, só testes, só configuração).

## Como consultar o índice

1. Use as tools do MCP `ui-index`:
   - `search_components`: busca por termos; aceita `kind` (`component`, `page`, `layout`) e `source` (`design-system`, `local`).
   - `get_component`: props com tipos, descrição, arquivo, onde é usado e o que ele usa por dentro.
   - `find_usages`: todos os arquivos e rotas que usam o componente.
   - `list_routes` e `get_route`: rotas, tela e layouts de cada uma e componentes usados.
   - `refresh_index`: regera o índice.
2. Se as tools do `ui-index` não estiverem disponíveis nesta sessão, faça buscas de texto no arquivo `<<P>>tools/ai-index/generated/component-index.md` (procure por termos; não leia o arquivo inteiro de uma vez) e escreva na resposta: "MCP ui-index indisponível, usei o fallback do arquivo".
3. Se algo que existe no código não aparece no índice, rode `refresh_index` (ou `<<RUN>> <<P>>tools/ai-index/generate.mjs`) e consulte de novo.

## Fluxo obrigatório: siga na ordem, sem pular etapas

### Etapa 1: decompor a tela

Liste todas as peças de UI do pedido, de fora para dentro: rota e layout; cabeçalho e título; navegação (menu, abas, breadcrumb); filtros e busca; tabelas e listas; cards; formulários e campos; botões e ações; modais, drawers e confirmações; badges, tags e status; estados de carregamento, vazio e erro; mensagens (toast, alerta).

### Etapa 2: procurar candidatos para cada peça

Para CADA peça da Etapa 1:

1. Rode `search_components` pelo menos 2 vezes, com termos diferentes: o termo em português, o termo em inglês e sinônimos (ex.: "tabela table grid", "modal dialog drawer", "status badge tag chip").
2. Para cada candidato plausível, rode `get_component` (props e variantes) e `find_usages` (onde já é usado).
3. Abra pelo menos 1 arquivo onde o candidato escolhido já é usado e veja como ele é usado de verdade.
4. Prioridade entre candidatos: 1º design system; 2º componente local já usado em outras telas; 3º componente local de uma única feature.

### Etapa 3: rotas e telas parecidas

1. Rode `list_routes`: veja se a rota pedida já existe e qual rota pai/layout a nova tela deve usar.
2. Rode `search_components` com `kind: "page"` procurando uma tela parecida (outra listagem, outro detalhe, outro formulário). Se existir, rode `get_route` nela e use a mesma estrutura, o mesmo layout e os mesmos componentes.

### Etapa 4: plano de reaproveitamento (ANTES de escrever qualquer código)

Responda com esta tabela, uma linha por peça da Etapa 1:

| Peça da tela | Candidato(s) (nome + id) | Onde já é usado | Diferença para o pedido | Decisão | Justificativa |
|---|---|---|---|---|---|

A coluna "Decisão" aceita somente um destes valores, nesta ordem de preferência:

1. `REUSAR`: usar o componente existente como está.
2. `COMPOR`: montar a peça juntando componentes existentes na própria tela, sem componente novo.
3. `ESTENDER`: adicionar uma prop ou variante OPCIONAL a um componente existente. Obrigatório: rodar `find_usages`, informar quantos usos existem e garantir que o valor padrão mantém o comportamento atual de todos eles.
4. `CRIAR`: componente novo. Só é permitido quando `REUSAR`, `COMPOR` e `ESTENDER` forem inviáveis. A justificativa precisa citar cada candidato avaliado (nome + id) e o motivo concreto de ele não servir.

Depois da tabela, informe:

- Rota: caminho, se é nova ou existente, rota pai/layout e o arquivo onde a rota será registrada.
- Arquivos que serão criados e arquivos que serão alterados.

Então PARE e peça aprovação. Não escreva código antes da aprovação. Única exceção: se o pedido disser explicitamente "pode implementar direto", entregue a tabela e siga.

### Etapa 5: implementar

- Siga a tabela aprovada. Se precisar mudar a decisão de alguma peça, pare e avise antes.
- Em `CRIAR`:
  - monte o componente com componentes do design system por dentro; não recrie com HTML/CSS próprio botão, input, select, tipografia, ícone, modal, tabela ou qualquer coisa que o design system já tenha;
  - salve na mesma estrutura de pastas de componentes parecidos (use o `file` dos candidatos como referência); se só esta tela usa, ele fica na pasta da feature;
  - escreva um comentário JSDoc de uma linha logo acima da declaração dizendo o que ele é (essa descrição alimenta a busca do índice).
- Proibido:
  - copiar e colar um componente existente para mudar um detalhe;
  - criar componente com nome ou responsabilidade que se sobreponha a um existente;
  - mudar o comportamento padrão de um componente existente;
  - editar `node_modules`;
  - alterar componente do design system, a não ser que a decisão aprovada seja `ESTENDER` aquele componente e ele esteja dentro deste repositório.

### Etapa 6: atualizar e conferir o índice

1. Rode `refresh_index` (ou `<<RUN>> <<P>>tools/ai-index/generate.mjs`).
2. Confirme com `get_component` que cada componente criado ou estendido aparece com as props certas e, com `get_route`, que a rota aparece.
3. Termine com a tabela da Etapa 4 atualizada com o que foi feito de fato.

## Arquivos gerados

`<<P>>tools/ai-index/generated/component-index.json` e `<<P>>tools/ai-index/generated/component-index.md` são gerados por `<<P>>tools/ai-index/generate.mjs`. Nunca edite esses arquivos à mão. Eles são atualizados automaticamente no commit (hook de pre-commit).
````

**3.2 Conferir regras existentes**: leia `.cursor/rules/` (todos os `.mdc`), `.cursorrules`, `AGENTS.md` e `CLAUDE.md`, se existirem. Não altere nenhum deles. Se algum contradiz a regra nova (ex.: manda criar componentes sem consultar o que existe, ou manda implementar sem pedir aprovação), cite no relatório final o arquivo e o trecho.

## Fase 4: validação final e relatório

**4.1 Rode e confira** (todos precisam passar):
1. Dentro de APP_ROOT: `<<RUN>> tools/ai-index/generate.mjs --check` → `[ai-index] OK: índice atualizado`.
2. Dentro de APP_ROOT: `node tools/ai-index/mcp-smoke-test.mjs "card"` → todas as linhas com `OK`.
3. Nenhum marcador sobrando: procure por `<<P>>`, `<<G>>` e `<<RUN>>` em `.cursor/` e em `tools/ai-index/` (exceto dentro de `tools/ai-index/generated/`). Não pode haver ocorrência.
4. `node -e "JSON.parse(require('fs').readFileSync('.cursor/mcp.json','utf8'))"` em CURSOR_ROOT não pode dar erro.
5. Em REPO_ROOT, `git check-ignore -q <<G>>tools/ai-index/generated/component-index.json` precisa terminar com código de saída 1 (o arquivo não pode estar no `.gitignore`). Se terminar com 0, PARE e me avise.
6. Repita a conferência de cópia (regra 9) para os quatro arquivos: `generate.mjs`, `pre-commit.sh`, `mcp-server.mjs` e `mcp-smoke-test.mjs`.
7. `git status --short` em REPO_ROOT: guarde a lista para o relatório.

**4.2 Entregue o relatório exatamente com estas seções:**

````markdown
## Relatório ai-index

### Variáveis da Fase 0
(tabela Variável | Valor | Como descobri)

### Arquivos criados
### Arquivos alterados
(arquivo e o que mudou em uma linha)

### Design system configurado
- packages: [...]
- folders: [...]
- tirados da sugestão e por quê: ...

### Índice gerado
(linha "Resumo: ..." e as primeiras 15 linhas da tabela de rotas)
(avisos e alertas dos itens 4 e 5 do passo 1.7, se houver)

### Smoke test do MCP
(saída completa do item 2 do passo 4.1)

### Hook de pre-commit
(ferramenta, arquivo alterado e resultado do teste do passo 1.10)

### CI
(arquivo e job alterados, ou "pendente" com o comando)

### Typecheck e lint
(resultado do passo 1.8)

### Conflitos com regras existentes
(ou "nenhum")

### O que você precisa fazer manualmente
1. No Cursor: Settings → MCP (ou "Tools & MCP") → habilitar o servidor `ui-index` e confirmar que aparecem 6 tools. Se ele aparecer com erro, o motivo mais comum é o Cursor não achar o `node`: troque `"command": "node"` em `.cursor/mcp.json` pelo caminho completo (saída de `which node` ou `where node`).
2. Revisar as mudanças e commitar (o hook vai atualizar o índice no próprio commit).
3. Avisar o time para rodar a instalação de dependências depois do pull (para o hook ser instalado).
(mais itens pendentes, se houver)
````
