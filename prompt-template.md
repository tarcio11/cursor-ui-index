# Tarefa: configurar o fluxo "reaproveitar antes de criar" para o agent de UI

Você vai configurar neste repositório três coisas que trabalham juntas:

1. **Gerador de índice** (`tools/ai-index/generate.mjs`): lê o código do front com ts-morph e gera um índice com todos os componentes (design system e locais), as props de cada um, onde cada um é usado, telas, layouts e rotas. Ele se atualiza sozinho em todo commit (hook de pre-commit) e é conferido no CI.
2. **Servidor MCP `ui-index`** (`tools/ai-index/mcp-server.mjs`): deixa o agent consultar esse índice (buscar componentes, ver props, ver onde são usados, ver rotas). Não tem dependências.
3. **Regra do Cursor** (`.cursor/rules/reuse-first-ui.mdc`): obriga o agent a seguir a ordem reusar → compor → estender → só em último caso criar, e a entregar um plano de reaproveitamento antes de escrever código.

## Regras de execução (valem para a tarefa inteira)

1. Execute as fases na ordem: 0, 1, 2, 3, 4. Não pule nem reordene passos.
2. Quando um passo disser **conteúdo exato**, o arquivo precisa ficar idêntico ao original: crie-o como manda a regra 9. Ao copiar de um bloco, copie caractere por caractere: não reformate, não "melhore", não traduza, não resuma, não converta para TypeScript, não remova comentários, não troque aspas. Os blocos são delimitados por quatro crases (````); as crases não fazem parte do arquivo.
3. As únicas decisões que são suas são os valores das variáveis da Fase 0. Onde aparecer `<<P>>`, `<<G>>` ou `<<RUN>>`, substitua pelo valor da variável (P e G podem ser vazios). Nenhum `<<...>>` pode sobrar nos arquivos finais.
4. Não altere nenhum arquivo que não esteja listado neste documento. Nunca edite `generate.mjs`, `mcp-server.mjs`, `mcp-smoke-test.mjs` nem `pre-commit.sh` depois de criados: se um deles falhar, PARE e me mostre o erro completo.
5. Não rode `npm audit fix`, não atualize nem reinstale dependências existentes. A única dependência nova é `ts-morph` (e `husky`, só no caso previsto no passo 1.11).
6. Não faça commit, push nem abra PR. Deixe tudo no working tree para eu revisar.
7. Se um comando falhar: mostre o erro completo, corrija só o que for causado por esta tarefa e rode de novo. Se a correção exigir mexer em algo fora deste documento, PARE e me pergunte.
8. Quando este documento disser **PARE**, pare e espere minha resposta.
9. Arquivos de **conteúdo exato** (exceto a regra `.mdc`, que sempre vem do bloco):
   1. Baixe o original pelo link informado no passo, rodando dentro de APP_ROOT, direto no caminho final e sem abrir o arquivo no editor: `curl -fsSL --create-dirs -o <arquivo> <link>` (no PowerShell, use `curl.exe` com os mesmos argumentos).
   2. Só se o download falhar (ex.: sem acesso ao GitHub), crie o arquivo com o conteúdo do bloco do passo.
   3. Confira a cópia: rode dentro de APP_ROOT o comando abaixo trocando `<arquivo>` pelo caminho do arquivo e compare a saída com o hash esperado informado no passo.
   4. Se o hash for diferente: confira se o passo 1.2 foi feito (um formatador que roda ao salvar, como Prettier, ESLint ou Biome, muda o arquivo depois que ele é escrito) e crie o arquivo de novo pelo item 1 ou 2. Se continuar diferente, PARE e me avise.
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

**0.18 BIOME**: se existir `biome.json` ou `biome.jsonc` em APP_ROOT ou REPO_ROOT: `v2` se a versão de `@biomejs/biome` em algum `package.json` (APP_ROOT ou REPO_ROOT) for 2.x (ex.: `^2.1.0`) ou, sem essa dependência, se o `$schema` do arquivo apontar para uma versão 2.x; nos outros casos, `v1`. Se não existir arquivo do Biome: `não`. Anote o arquivo encontrado.

## Fase 1: passo 1, gerador do índice e atualização automática

**1.1 Instalar ts-morph** como devDependency de APP_ROOT, versão exata. Se `ts-morph` já estiver em `dependencies` ou `devDependencies` de APP_ROOT, não instale nada e siga.
- npm: dentro de APP_ROOT, `npm install --save-dev --save-exact ts-morph@28.0.0`. Se for monorepo com workspaces do npm, rode em REPO_ROOT: `npm install --save-dev --save-exact ts-morph@28.0.0 -w <G sem a barra final>`.
- pnpm: dentro de APP_ROOT, `pnpm add -D --save-exact ts-morph@28.0.0`.
- yarn: dentro de APP_ROOT, `yarn add -D --exact ts-morph@28.0.0`.
- bun: dentro de APP_ROOT, `bun add -d --exact ts-morph@28.0.0`.

**1.2 Proteger a pasta `tools/ai-index` dos formatadores e do lint**, antes de criar qualquer arquivo nela. Os padrões abaixo começam com `**/` de propósito: valem em qualquer pasta, então são os mesmos com config na raiz do repositório ou no app.
1. Sempre, mesmo com PRETTIER = `não` (o Cursor pode usar o Prettier ao salvar pelas configurações do próprio usuário): acrescente a linha `**/tools/ai-index/` ao `.prettierignore` de CURSOR_ROOT, que é o que o Cursor consulta ao formatar (crie o arquivo se não existir). Se existir outro `.prettierignore` em APP_ROOT ou em REPO_ROOT, acrescente a mesma linha nele também.
2. Se ESLINT = `flat`: no arquivo encontrado na 0.16, acrescente `'**/tools/ai-index/**'` aos ignores globais. Se já existe um objeto de config que tem apenas a chave `ignores`, acrescente o padrão na lista dele; senão, adicione `{ ignores: ['**/tools/ai-index/**'] }` como primeiro item da lista de configs exportada (dentro do array, ou como primeiro argumento de `defineConfig(...)`/`tseslint.config(...)`).
3. Se ESLINT = `legado`: acrescente a linha `**/tools/ai-index/` ao `.eslintignore` da mesma pasta do arquivo de config do ESLint (crie se não existir).
4. Se BIOME = `v2`: no arquivo do Biome, acrescente `"!**/tools/ai-index/**"` à lista `files.includes`. Se a lista não existir, crie `"includes": ["**", "!**/tools/ai-index/**"]` dentro de `"files"` (crie `"files"` se não existir, sem apagar as outras chaves dele).
5. Se BIOME = `v1`: no arquivo do Biome, acrescente `"**/tools/ai-index/**"` à lista `files.ignore` (crie a lista, e `"files"`, se não existirem).
6. Se `.vscode/settings.json` (em CURSOR_ROOT ou APP_ROOT) apontar `editor.defaultFormatter` para outro formatador (ex.: dprint), adicione a pasta `tools/ai-index` ao ignore dele também.

**1.3 Criar `tools/ai-index/config.json`** dentro de APP_ROOT com este conteúdo, trocando `"<TSCONFIG>"` pelo valor de TSCONFIG entre aspas (ou por `null` sem aspas) e `<INCLUDE>` pela lista INCLUDE. Deixe `packages` e `folders` vazios por enquanto; eles são preenchidos no passo 1.7.

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

**1.4 Criar `tools/ai-index/generate.mjs`** dentro de APP_ROOT, **conteúdo exato** (regra 9).
- Link do original: {{URL:generate.mjs}}
- Hash esperado: `{{SHA:generate.mjs}}`
- Bloco (só se o download falhar):

{{FILE:generate.mjs}}

**1.5 Adicionar scripts** ao `package.json` de APP_ROOT (dentro de `"scripts"`, sem alterar os scripts que já existem). Se algum desses nomes já existir, PARE e me pergunte.

````json
"ai:index": "node tools/ai-index/generate.mjs",
"ai:index:check": "node tools/ai-index/generate.mjs --check",
"ai:index:discover": "node tools/ai-index/generate.mjs --discover",
"ai:mcp:test": "node tools/ai-index/mcp-smoke-test.mjs"
````

**1.6 Rodar a descoberta**: dentro de APP_ROOT, `<<RUN>> tools/ai-index/generate.mjs --discover`. Mostre a saída completa no chat.

**1.7 Preencher o design system** em `tools/ai-index/config.json`: copie para `designSystem.packages` e `designSystem.folders` exatamente as listas da seção `SUGESTÃO` no fim da saída do passo 1.6. Só há uma exceção: tire da lista um pacote sugerido que você tenha certeza de que não é biblioteca de componentes visuais (ex.: é de dados, roteamento, formulário ou ícones). Não acrescente nada que não esteja na sugestão. Registre no relatório final o que entrou, o que saiu e por quê.

**1.8 Gerar e validar o índice** (dentro de APP_ROOT):
1. `<<RUN>> tools/ai-index/generate.mjs`. A última linha deve começar com `[ai-index] Gravado em`. Se aparecer erro, PARE e me mostre a saída completa.
2. `<<RUN>> tools/ai-index/generate.mjs --check`. Deve responder `[ai-index] OK: índice atualizado`.
3. Abra `tools/ai-index/generated/component-index.md` e copie para o relatório final: a linha `Resumo: ...` e as primeiras 15 linhas da tabela de rotas.
4. Se a saída tiver linhas `[ai-index] AVISO:`, copie-as para o relatório final.
5. Se `designSystem` não estiver vazio e o resumo mostrar `0 do design system`, ou se STACK tem `next`/`react-router` e o índice tem `0 rotas`, não tente consertar: registre no relatório final para eu analisar.

**1.9 Ajustes de ferramentas do projeto:**
1. `.gitattributes` em REPO_ROOT (crie se não existir): acrescente a linha `<<G>>tools/ai-index/generated/** linguist-generated=true`.
2. Se TYPECHECK não for `nenhum`: dentro de APP_ROOT, rode `<PM_RUN> <TYPECHECK>`. Se houver erros em arquivos de `tools/ai-index/`, adicione `"tools/ai-index"` ao `exclude` do arquivo TSCONFIG (crie a chave `exclude` se não existir) e rode de novo. Erros em outros arquivos já existiam antes: não mexa, só registre no relatório.

**1.10 Criar `tools/ai-index/pre-commit.sh`** dentro de APP_ROOT, **conteúdo exato** (regra 9).
- Link do original: {{URL:pre-commit.sh}}
- Hash esperado: `{{SHA:pre-commit.sh}}`
- Bloco (só se o download falhar):

{{FILE:pre-commit.sh}}

**1.11 Ligar o script ao pre-commit.** A linha do hook é sempre `sh <<G>>tools/ai-index/pre-commit.sh` (caminho relativo a REPO_ROOT, porque o git roda hooks a partir da raiz do repositório). Siga o caso de HOOKS:
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

**1.12 Conferência no CI.** O comando de verificação é `<PM_RUN> ai:index:check`, rodado dentro de APP_ROOT. Ele falha se alguém commitou sem atualizar o índice (ex.: commit com `--no-verify`).
- Se CI_JOB não for `nenhum`: no job CI_JOB, adicione um passo logo depois do passo que instala as dependências. Formato por CI:
  - `github`: `- name: Verificar índice de componentes (ai-index)` com `run: <PM_RUN> ai:index:check` e `working-directory: <G sem a barra final>` (omita `working-directory` se G for vazio ou se o job já roda dentro de APP_ROOT).
  - `gitlab` e `bitbucket`: acrescente no `script` do job, logo depois da instalação: `- (cd <G sem a barra final, ou . se G for vazio> && <PM_RUN> ai:index:check)`.
  - `azure`: `- script: <PM_RUN> ai:index:check` com `displayName: Verificar índice de componentes (ai-index)` e `workingDirectory: $(System.DefaultWorkingDirectory)/<G sem a barra final>` (omita `workingDirectory` se G for vazio).
- Se CI_JOB = `nenhum` ou CI for `outro`/`nenhum`: não crie pipeline nem job novo. Registre no relatório final como pendente, com o comando.

## Fase 2: passo 2, servidor MCP `ui-index`

**2.1 Criar `tools/ai-index/mcp-server.mjs`** dentro de APP_ROOT, **conteúdo exato** (regra 9).
- Link do original: {{URL:mcp-server.mjs}}
- Hash esperado: `{{SHA:mcp-server.mjs}}`
- Bloco (só se o download falhar):

{{FILE:mcp-server.mjs}}

**2.2 Criar `tools/ai-index/mcp-smoke-test.mjs`** dentro de APP_ROOT, **conteúdo exato** (regra 9).
- Link do original: {{URL:mcp-smoke-test.mjs}}
- Hash esperado: `{{SHA:mcp-smoke-test.mjs}}`
- Bloco (só se o download falhar):

{{FILE:mcp-smoke-test.mjs}}

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

**3.1 Criar `.cursor/rules/reuse-first-ui.mdc`** em CURSOR_ROOT (crie as pastas se não existirem), **conteúdo exato**, trocando `<<P>>` e `<<RUN>>` pelos valores da Fase 0 (essa troca é a única diferença permitida; o arquivo final tem {{LINES:reuse-first-ui.mdc}} linhas). Se já existir um arquivo com esse nome, PARE e me pergunte.

{{FILE:reuse-first-ui.mdc}}

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
(avisos e alertas dos itens 4 e 5 do passo 1.8, se houver)

### Conferência de cópia
(para cada um dos 4 arquivos: se veio do download ou do bloco, e se o hash bateu)

### Smoke test do MCP
(saída completa do item 2 do passo 4.1)

### Hook de pre-commit
(ferramenta, arquivo alterado e resultado do teste do passo 1.11)

### CI
(arquivo e job alterados, ou "pendente" com o comando)

### Formatadores, lint e typecheck
(o que foi ignorado no passo 1.2 e o resultado do passo 1.9)

### Conflitos com regras existentes
(ou "nenhum")

### O que você precisa fazer manualmente
1. No Cursor: Settings → MCP (ou "Tools & MCP") → habilitar o servidor `ui-index` e confirmar que aparecem 6 tools. Se ele aparecer com erro, o motivo mais comum é o Cursor não achar o `node`: troque `"command": "node"` em `.cursor/mcp.json` pelo caminho completo (saída de `which node` ou `where node`).
2. Revisar as mudanças e commitar (o hook vai atualizar o índice no próprio commit).
3. Avisar o time para rodar a instalação de dependências depois do pull (para o hook ser instalado).
(mais itens pendentes, se houver)
````
