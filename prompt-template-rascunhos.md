# Tarefa: configurar rascunhos de tela iteráveis (estilo artefato) para o agent de UI

Você vai configurar neste repositório um fluxo para criar telas novas como rascunho visual, que o usuário ajusta até ficar bom antes de virar código do produto:

1. **Página de rascunhos** (`/dev/rascunhos`, só em desenvolvimento): mostra cada rascunho numa moldura com abas de variantes e tamanhos de tela (celular, tablet, desktop), usando os componentes reais do projeto e dados fictícios.
2. **Skill `tela`** (`.cursor/skills/tela/`): comando `/tela` que recebe uma referência (print, link, outra tela ou ideia), monta o plano de reaproveitamento pelo índice `ui-index`, aplica a skill de estética do projeto dentro das regras do design system, cria o rascunho, confere no browser e, quando aprovado, promove o rascunho para a rota real.
3. **Ajuste na regra** `reuse-first-ui`: rascunho segue sem parar para aprovação; a parada passa a ser na promoção.

Este setup depende do anterior (`prompt-cursor-ai-index.md`): índice, servidor MCP `ui-index` e regra `reuse-first-ui` já precisam existir.

## Regras de execução (valem para a tarefa inteira)

1. Execute as fases na ordem: 0, 1, 2, 3, 4, 5. Não pule nem reordene passos.
2. Quando um passo disser **conteúdo exato**, o arquivo precisa ficar idêntico ao original: crie-o como manda a regra 9. Ao copiar de um bloco, copie caractere por caractere: não reformate, não "melhore", não traduza, não resuma, não remova comentários, não troque aspas. Os blocos são delimitados por quatro crases (````); as crases não fazem parte do arquivo.
3. As únicas decisões que são suas são os valores das variáveis deste documento (Fase 0 e `IMPORT`, no passo 2.4). Marcador é um nome de variável em MAIÚSCULAS entre `<<...>>` ou `<...>` (ex.: `<<RASCUNHOS>>`, `<FLAG_DEV>`, `<IMPORT>`): troque pelo valor da variável. Tags JSX como `<RascunhosPage />` e textos em minúsculas como `<slug>` dentro da skill são conteúdo e ficam como estão. Nenhum marcador pode sobrar nos arquivos finais.
4. Não altere nenhum arquivo que não esteja listado neste documento. Nunca edite `RascunhosPage.tsx`, `tipos.ts`, `registro.ts` nem `estetica-com-design-system.md` depois de criados: se um deles falhar, PARE e me mostre o erro completo.
5. Não instale nem atualize dependências.
6. Não faça commit, push nem abra PR. Deixe tudo no working tree para eu revisar.
7. Se um comando falhar: mostre o erro completo, corrija só o que for causado por esta tarefa e rode de novo. Se a correção exigir mexer em algo fora deste documento, PARE e me pergunte.
8. Quando este documento disser **PARE**, pare e espere minha resposta.
9. Arquivos de **conteúdo exato**:
   1. Baixe o original pelo link informado no passo, direto no caminho final e sem abrir o arquivo no editor: `curl -fsSL --create-dirs -o <arquivo> <link>` (no PowerShell, use `curl.exe` com os mesmos argumentos).
   2. Só se o download falhar (ex.: sem acesso ao GitHub), crie o arquivo com o conteúdo do bloco do passo.
   3. Confira a cópia: rode o comando abaixo trocando `<arquivo>` pelo caminho do arquivo e compare a saída com o hash esperado informado no passo.
   4. Se o hash for diferente: confira se a Fase 1 foi feita (um formatador que roda ao salvar, como Prettier, ESLint ou Biome, muda o arquivo depois que ele é escrito) e crie o arquivo de novo pelo item 1 ou 2. Se continuar diferente, PARE e me avise.
   `node -e "const c=require('fs').readFileSync(process.argv[1],'utf8').replace(/\r\n/g,'\n');console.log(require('crypto').createHash('sha256').update(c).digest('hex'))" <arquivo>`
10. Terminal: os comandos estão em sintaxe de shell POSIX (bash/zsh). Se o seu terminal for PowerShell, use a sintaxe equivalente.

## Fase 0: descoberta (somente leitura)

Não altere nada nesta fase. Descubra os valores abaixo e mostre-os numa tabela `Variável | Valor | Como descobri`. Depois siga para a Fase 1 sem esperar, a não ser que algum item mande PARAR.

**0.1 REPO_ROOT**: saída de `git rev-parse --show-toplevel`.

**0.2 CURSOR_ROOT**: pasta raiz do workspace aberto no Cursor (a raiz em que você está trabalhando).

**0.3 APP_ROOT**: pasta (dentro de CURSOR_ROOT, fora de `node_modules`) que contém `tools/ai-index/generate.mjs`. Se não existir, PARE e me avise: o setup do `prompt-cursor-ai-index.md` precisa ser feito antes. Se existir em mais de uma pasta, PARE e me pergunte qual. Confira também que existem `.cursor/rules/reuse-first-ui.mdc` e a entrada `ui-index` em `.cursor/mcp.json` (em CURSOR_ROOT); se faltar algum, PARE e me avise.

**0.4 P**: caminho de APP_ROOT relativo a CURSOR_ROOT, com `/` no final (ex.: `apps/web/`). Se forem a mesma pasta, P é vazio.

**0.5 APP**: P sem a barra final; se P for vazio, APP é `.`.

**0.6 PM e PM_RUN**: procure o lockfile primeiro em APP_ROOT e depois em REPO_ROOT. `pnpm-lock.yaml` → PM `pnpm`, PM_RUN `pnpm run`; `yarn.lock` → `yarn`, `yarn`; `bun.lockb` ou `bun.lock` → `bun`, `bun run`; `package-lock.json` ou nenhum → `npm`, `npm run`.

**0.7 RUN**: `yarn node` se existir `.pnp.cjs` em APP_ROOT ou em REPO_ROOT (Yarn Plug'n'Play); senão `node`.

**0.8 TSCONFIG**: o valor de `"tsconfig"` em `tools/ai-index/config.json` (dentro de APP_ROOT). Se for `null`, PARE e me avise: este setup cria arquivos `.tsx` e precisa de TypeScript.

**0.9 TYPECHECK**: se o `package.json` de APP_ROOT tiver um script só de checagem de tipos (`typecheck`, `type-check`, `check-types`, `tsc` ou `lint:types`), use `<PM_RUN> <nome do script>`; senão, use `npx tsc --noEmit -p <TSCONFIG>`.

**0.10 DEV_CMD**: se o `package.json` de APP_ROOT tiver o script `dev`, use `<PM_RUN> dev`; senão, se tiver `start`, use `<PM_RUN> start`; senão, PARE e me pergunte como o servidor de desenvolvimento é iniciado.

**0.11 RASCUNHOS_DIR** (relativo a APP_ROOT): `src/__rascunhos` se existir a pasta `src/` em APP_ROOT; senão `__rascunhos`. Se a pasta já existir, PARE e me avise.

**0.12 RASCUNHOS** (relativo a CURSOR_ROOT): P seguido de RASCUNHOS_DIR (ex.: `apps/web/src/__rascunhos`).

**0.13 ROUTER** (use o primeiro que se aplicar, olhando as dependências do `package.json` de APP_ROOT):
1. `next-app`: tem `next` e existe `app/` ou `src/app/` com um arquivo `layout.*`. Anote APP_DIR = essa pasta (relativa a APP_ROOT).
2. `next-pages`: tem `next` e existe `pages/` ou `src/pages/`. Anote PAGES_DIR = essa pasta.
3. Se tem `@react-router/dev` ou existe `react-router.config.*`: PARE e me avise (React Router em modo framework não é coberto).
4. `react-router`: tem `react-router` ou `react-router-dom`. Anote também:
   - ROUTES_FILE: o arquivo onde está a lista de rotas de nível mais alto (a que é passada para `createBrowserRouter`, `createHashRouter`, `createMemoryRouter` ou `useRoutes`) ou o `<Routes>` de nível mais alto. Para achar, use o índice (campo `definedIn` da rota `/` em `tools/ai-index/generated/component-index.json`) e confirme abrindo o arquivo. Se houver mais de um candidato, PARE e me pergunte.
   - RR_FORMA: `objetos` se as rotas de nível mais alto são uma lista de objetos (passada para `createBrowserRouter`, `createHashRouter`, `createMemoryRouter` ou `useRoutes`); `jsx` se são elementos `<Route>` dentro de `<Routes>`.
   - RR_DATA: `sim` se a lista é passada para `createBrowserRouter`, `createHashRouter` ou `createMemoryRouter`; `não` nos outros casos.
   - RR_VERSAO: a versão de `react-router-dom` (ou `react-router`) no `package.json`.
   - FLAG_DEV: `import.meta.env.DEV` se existe `vite` nas dependências (APP_ROOT ou REPO_ROOT); senão `process.env.NODE_ENV !== 'production'`.
5. Nenhum dos anteriores: PARE e me avise.

**0.14 MIDDLEWARE** (só para `next-app` e `next-pages`): se existir `middleware.*` ou `proxy.*` em APP_ROOT ou em `src/`, leia o arquivo. Se ele redireciona ou reescreve um caminho como `/dev/rascunhos` (ex.: prefixo de idioma, login obrigatório em todas as rotas), PARE e me pergunte. Se `next.config.*` definir `basePath`, anote o valor: o endereço dos rascunhos passa a ser `<basePath>/dev/rascunhos`.

**0.15 ROTA_LIVRE**: em `tools/ai-index/generated/component-index.json`, procure rotas com `path` igual a `/dev` ou começando com `/dev/`. Se existir alguma, PARE e me avise.

**0.16 ESTETICA**: procure a skill de estética do projeto: um `SKILL.md` com `name: frontend-design`, ou um arquivo de skill ou regra cujo nome ou descrição fale em "frontend-design" ou "frontend design". Procure nesta ordem e use o primeiro que encontrar:
1. em CURSOR_ROOT e em REPO_ROOT: `.cursor/skills/**/SKILL.md`, `.claude/skills/**/SKILL.md`, `.agents/skills/**/SKILL.md` e `.cursor/rules/**/*.mdc`;
2. na pasta do usuário: `~/.cursor/skills/**/SKILL.md`, `~/.claude/skills/**/SKILL.md`, `~/.agents/skills/**/SKILL.md` e `~/.codex/skills/**/SKILL.md`.

O valor é o caminho do arquivo: relativo a CURSOR_ROOT se estiver dentro dele, ou começando com `~/` se estiver na pasta do usuário. Anote também ESTETICA_ONDE = `repositório` ou `só nesta máquina`. Se não encontrar, ESTETICA = `nenhuma`.

**0.17 PRETTIER, ESLINT e BIOME**:
- PRETTIER: `sim` se existir `.prettierrc*`, `prettier.config.*` ou a chave `prettier` em algum `package.json` (APP_ROOT ou REPO_ROOT); senão `não`.
- ESLINT: `flat` se existir `eslint.config.*` (APP_ROOT ou REPO_ROOT); `legado` se existir `.eslintrc*` ou a chave `eslintConfig` em algum `package.json`; senão `não`. Anote o arquivo encontrado.
- BIOME: se existir `biome.json` ou `biome.jsonc` em APP_ROOT ou REPO_ROOT: `v2` se a versão de `@biomejs/biome` em algum `package.json` for 2.x (ou, sem essa dependência, se o `$schema` do arquivo apontar para uma versão 2.x); nos outros casos, `v1`. Sem arquivo do Biome: `não`. Anote o arquivo encontrado.

## Fase 1: tirar rascunhos e skill dos formatadores e do lint

Faça isto antes de criar qualquer arquivo. Os arquivos de infraestrutura precisam continuar idênticos aos originais, e rascunho é código descartável (o lint vale quando o rascunho é promovido). Os padrões começam com `**/` de propósito: valem em qualquer pasta.

1. Sempre, mesmo com PRETTIER = `não`: acrescente as linhas `**/__rascunhos/` e `**/.cursor/skills/tela/` ao `.prettierignore` de CURSOR_ROOT (crie o arquivo se não existir). Se existir outro `.prettierignore` em APP_ROOT ou em REPO_ROOT, acrescente as mesmas linhas nele também.
2. Se ESLINT = `flat`: no arquivo encontrado na 0.17, acrescente `'**/__rascunhos/**'` aos ignores globais. Se já existe um objeto de config que tem apenas a chave `ignores` (por exemplo, com `**/tools/ai-index/**`), acrescente o padrão na lista dele; senão, adicione `{ ignores: ['**/__rascunhos/**'] }` como primeiro item da lista de configs exportada.
3. Se ESLINT = `legado`: acrescente a linha `**/__rascunhos/` ao `.eslintignore` da mesma pasta do arquivo de config do ESLint (crie se não existir).
4. Se BIOME = `v2`: acrescente `"!**/__rascunhos/**"` à lista `files.includes` do arquivo do Biome (se a lista não existir, crie `"includes": ["**", "!**/__rascunhos/**"]` dentro de `"files"`, sem apagar as outras chaves).
5. Se BIOME = `v1`: acrescente `"**/__rascunhos/**"` à lista `files.ignore` do arquivo do Biome (crie a lista, e `"files"`, se não existirem).

## Fase 2: página de rascunhos

**2.1 Criar `<RASCUNHOS_DIR>/RascunhosPage.tsx`** dentro de APP_ROOT, **conteúdo exato** (regra 9).
- Link do original: {{URL:RascunhosPage.tsx}}
- Hash esperado: `{{SHA:RascunhosPage.tsx}}`
- Bloco (só se o download falhar):

{{FILE:RascunhosPage.tsx}}

**2.2 Criar `<RASCUNHOS_DIR>/registro.ts`** dentro de APP_ROOT, **conteúdo exato** (regra 9).
- Link do original: {{URL:registro.ts}}
- Hash esperado: `{{SHA:registro.ts}}`
- Bloco (só se o download falhar):

{{FILE:registro.ts}}

**2.3 Criar `<RASCUNHOS_DIR>/tipos.ts`** dentro de APP_ROOT, **conteúdo exato** (regra 9).
- Link do original: {{URL:tipos.ts}}
- Hash esperado: `{{SHA:tipos.ts}}`
- Bloco (só se o download falhar):

{{FILE:tipos.ts}}

**2.4 Registrar a rota `/dev/rascunhos`**, que só existe em desenvolvimento. Nos blocos abaixo, `<IMPORT>` é o caminho relativo da pasta do arquivo editado até `<RASCUNHOS_DIR>/RascunhosPage`, sem extensão, começando com `./` ou `../` (ex.: de `src/app/dev/rascunhos/` até `src/__rascunhos/RascunhosPage` fica `../../../__rascunhos/RascunhosPage`). Siga o caso de ROUTER:

- `next-app`: crie `<APP_DIR>/dev/rascunhos/page.tsx` com:

````tsx
import { notFound } from 'next/navigation';
import RascunhosPage from '<IMPORT>';

/** Rascunhos de tela da skill "tela": só existe em desenvolvimento. */
export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <RascunhosPage />;
}
````

- `next-pages`: crie `<PAGES_DIR>/dev/rascunhos.tsx` com:

````tsx
import ErrorPage from 'next/error';
import RascunhosPage from '<IMPORT>';

/** Rascunhos de tela da skill "tela": só existe em desenvolvimento. */
export default function Page() {
  if (process.env.NODE_ENV === 'production') return <ErrorPage statusCode={404} />;
  return <RascunhosPage />;
}
````

- `react-router` com RR_FORMA = `objetos`, RR_DATA = `sim` e RR_VERSAO 6.9 ou maior: em ROUTES_FILE, acrescente como **último item da lista de rotas de nível mais alto** (no mesmo nível da rota `/`, nunca dentro de `children`):

````ts
  ...(<FLAG_DEV>
    ? [{ path: '/dev/rascunhos', lazy: async () => ({ Component: (await import('<IMPORT>')).default }) }]
    : []),
````

- `react-router` nos outros casos (RR_FORMA = `jsx`, ou RR_DATA = `não`, ou RR_VERSAO menor que 6.9). ROUTES_FILE precisa terminar em `.tsx` ou `.jsx`; se não terminar, PARE e me avise.
  1. Garanta que `lazy` e `Suspense` estão importados de `react` (acrescente ao import de `react` que já existe ou crie `import { lazy, Suspense } from 'react';`).
  2. Logo depois dos imports, acrescente:

````tsx
const RascunhosPage = <FLAG_DEV> ? lazy(() => import('<IMPORT>')) : null;
````

  3. Se RR_FORMA = `jsx`, acrescente como **último filho do `<Routes>` de nível mais alto** (nunca dentro de uma rota de layout):

````tsx
{RascunhosPage ? <Route path="/dev/rascunhos" element={<Suspense fallback={null}><RascunhosPage /></Suspense>} /> : null}
````

  4. Se RR_FORMA = `objetos`, acrescente como **último item da lista de rotas de nível mais alto**:

````tsx
  ...(RascunhosPage ? [{ path: '/dev/rascunhos', element: <Suspense fallback={null}><RascunhosPage /></Suspense> }] : []),
````

  Se já existir outro identificador chamado `RascunhosPage` no arquivo, PARE e me avise.

**2.5 Tirar os rascunhos do índice.** Em `tools/ai-index/config.json` (dentro de APP_ROOT), acrescente à lista `exclude` os itens `"**/__rascunhos/**"`, `"**/dev/rascunhos/**"` e `"**/dev/rascunhos.*"`. Depois, dentro de APP_ROOT:
1. `<RUN> tools/ai-index/generate.mjs` e depois `<RUN> tools/ai-index/generate.mjs --check` (tem que responder `[ai-index] OK: índice atualizado`).
2. Confira que o índice não tem nada de rascunho. Tem que imprimir `rotas: 0 componentes: 0`:

````sh
node -e "const i=require('./tools/ai-index/generated/component-index.json');console.log('rotas:',i.routes.filter(r=>r.path.includes('/dev/rascunhos')).length,'componentes:',i.components.filter(c=>(c.file||'').includes('__rascunhos')).length)"
````

**2.6 Typecheck**: dentro de APP_ROOT, rode TYPECHECK. Se houver erro em arquivos de `<RASCUNHOS_DIR>` ou no arquivo de rota do passo 2.4, PARE e me mostre. Erros em outros arquivos já existiam antes: não mexa, só registre no relatório.

**2.7 Conferir no browser**: se o servidor de desenvolvimento não estiver rodando, rode DEV_CMD dentro de APP_ROOT. Abra `<endereço do servidor>/dev/rascunhos` (com o `basePath`, se houver) no browser do Cursor. A página tem que mostrar o título "Rascunhos de tela" e o texto "Nenhum rascunho ainda", e o console não pode ter erros vindos de `<RASCUNHOS_DIR>`. Se você não tiver acesso ao browser, registre isso no relatório como pendente para eu conferir.

## Fase 3: skill `tela`

**3.1 Criar `.cursor/skills/tela/SKILL.md`** em CURSOR_ROOT (crie as pastas se não existirem), **conteúdo exato**, trocando os marcadores pelos valores da Fase 0: `<<RASCUNHOS>>` (RASCUNHOS), `<<DEV_CMD>>` (DEV_CMD), `<<APP>>` (APP), `<<TYPECHECK>>` (TYPECHECK), `<<ESTETICA>>` (ESTETICA), `<<RUN>>` (RUN) e `<<P>>` (P, pode ser vazio). Essa troca é a única diferença permitida; o arquivo final tem {{LINES:tela-SKILL.md}} linhas. Se a pasta `.cursor/skills/tela/` já existir, PARE e me pergunte.

{{FILE:tela-SKILL.md}}

**3.2 Criar `.cursor/skills/tela/references/estetica-com-design-system.md`** em CURSOR_ROOT, **conteúdo exato** (regra 9; rode o comando de hash a partir de CURSOR_ROOT).
- Link do original: {{URL:estetica-com-design-system.md}}
- Hash esperado: `{{SHA:estetica-com-design-system.md}}`
- Bloco (só se o download falhar):

{{FILE:estetica-com-design-system.md}}

## Fase 4: ajustar a regra `reuse-first-ui`

No arquivo `.cursor/rules/reuse-first-ui.mdc` (em CURSOR_ROOT), faça as duas inserções abaixo. Se o texto a inserir já estiver no arquivo, pule aquela inserção. Se a linha de referência não existir, PARE e me avise.

1. Logo depois da linha que começa com `Então PARE e peça aprovação.`, insira uma linha em branco e esta linha:

````markdown
Exceção para rascunhos: se a tarefa for um rascunho da skill `tela` (arquivos só dentro da pasta `__rascunhos`), entregue a tabela e siga sem parar. A aprovação acontece quando o rascunho for promovido para a rota real, e na promoção esta regra vale inteira, com a parada.
````

2. Na lista "Proibido", logo depois da linha que diz editar `node_modules` (ela começa com dois espaços e um hífen), insira esta linha, com os mesmos dois espaços no começo:

````markdown
  - importar qualquer coisa da pasta `__rascunhos` em código do produto;
````

## Fase 5: validação final e relatório

**5.1 Rode e confira** (todos precisam passar):
1. A conferência de cópia (regra 9) dos quatro arquivos de conteúdo exato: `RascunhosPage.tsx`, `registro.ts`, `tipos.ts` e `estetica-com-design-system.md`.
2. Nenhum marcador sobrando: procure por `<<` e por `<IMPORT>` em `.cursor/skills/tela/` e no arquivo de rota do passo 2.4. Não pode haver ocorrência.
3. Dentro de APP_ROOT: `<RUN> tools/ai-index/generate.mjs --check` → `[ai-index] OK: índice atualizado`.
4. O typecheck do passo 2.6 sem erros nos arquivos desta tarefa.
5. `git status --short` em REPO_ROOT: guarde a lista para o relatório.

**5.2 Entregue o relatório exatamente com estas seções:**

````markdown
## Relatório rascunhos de tela

### Variáveis da Fase 0
(tabela Variável | Valor | Como descobri)

### Arquivos criados
### Arquivos alterados
(arquivo e o que mudou em uma linha)

### Rota /dev/rascunhos
(ROUTER, arquivo criado ou alterado e o trecho inserido)

### Skill de estética
(ESTETICA e ESTETICA_ONDE)

### Conferência de cópia
(para cada um dos 4 arquivos: se veio do download ou do bloco, e se o hash bateu)

### Índice, typecheck e browser
(saídas dos passos 2.5, 2.6 e 2.7)

### O que você precisa fazer manualmente
1. Usar o fluxo no Agents Window do Cursor (o Design Mode fica no browser de lá): digitar `/tela` e mandar a referência (print, link, "parecida com a tela X" ou a ideia).
2. Para ajustar: abrir a variante sozinha (`/dev/rascunhos?r=<slug>&v=A&bare=1`), ligar o Design Mode com Cmd/Ctrl + Shift + D e clicar, desenhar ou falar o que mudar; ou pedir no chat.
3. Quando gostar do resultado: `/tela promover <slug> <variante>`.
4. Revisar as mudanças e commitar.
(se ESTETICA_ONDE = `só nesta máquina`: avisar que o time precisa ter a skill de estética na máquina, ou que ela pode ser copiada para `.cursor/skills/` do repositório; sem ela, o fluxo usa só o arquivo de referência)
(mais itens pendentes, se houver)
````
