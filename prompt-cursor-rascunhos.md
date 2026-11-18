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
- Link do original: https://raw.githubusercontent.com/tarcio11/cursor-ui-index/cef261bcaca0e2033c1bf72c2f38ce593cc59264/src/rascunhos/RascunhosPage.tsx
- Hash esperado: `87503203023d3c9252d8c9ae0d11481df83727651676ebc043d375175ed35b45`
- Bloco (só se o download falhar):

````tsx
'use client';
/**
 * Página de rascunhos de tela, só para desenvolvimento (skill "tela" do cursor-ui-index).
 * Não edite este arquivo. Os rascunhos ficam em ./<slug>/ e são registrados em ./registro.ts.
 *
 *   /dev/rascunhos                       lista de rascunhos
 *   /dev/rascunhos?r=<slug>              moldura com as variantes e os tamanhos de tela
 *   /dev/rascunhos?r=<slug>&v=A&bare=1   só a variante, sem moldura (use esta para anotar com o Design Mode)
 */
import * as React from 'react';
import { rascunhos } from './registro';
import type { Rascunho, VarianteRascunho } from './tipos';

const TAMANHOS = [
  { id: 'celular', nome: 'Celular', largura: 375 },
  { id: 'tablet', nome: 'Tablet', largura: 768 },
  { id: 'desktop', nome: 'Desktop', largura: 1280 },
  { id: 'livre', nome: 'Largura total', largura: 0 },
];

interface Parametros {
  rascunho: string | null;
  variante: string | null;
  tamanho: string | null;
  sozinha: boolean;
}

type Navegar = (mudancas: Record<string, string | null>) => void;

function lerParametros(): Parametros {
  const busca = new URLSearchParams(window.location.search);
  return {
    rascunho: busca.get('r'),
    variante: busca.get('v'),
    tamanho: busca.get('t'),
    sozinha: busca.get('bare') === '1',
  };
}

function urlCom(mudancas: Record<string, string | null>): string {
  const busca = new URLSearchParams(window.location.search);
  for (const [chave, valor] of Object.entries(mudancas)) {
    if (valor === null) busca.delete(chave);
    else busca.set(chave, valor);
  }
  const texto = busca.toString();
  return window.location.pathname + (texto ? `?${texto}` : '');
}

function css(estilo: React.CSSProperties): React.CSSProperties {
  return estilo;
}

const FONTE = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const s = {
  tela: css({
    position: 'fixed',
    inset: 0,
    zIndex: 2147483000,
    display: 'flex',
    flexDirection: 'column',
    background: '#f4f4f5',
    color: '#18181b',
    fontFamily: FONTE,
    fontSize: 14,
    lineHeight: 1.4,
  }),
  lista: css({ maxWidth: 720, width: '100%', margin: '0 auto', padding: '40px 24px', overflowY: 'auto' }),
  tituloLista: css({ fontSize: 24, fontWeight: 600, margin: '0 0 8px' }),
  apoio: css({ margin: '0 0 24px', color: '#52525b' }),
  itens: css({ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }),
  item: css({
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    width: '100%',
    textAlign: 'left',
    padding: '12px 16px',
    background: '#ffffff',
    border: '1px solid #d4d4d8',
    borderRadius: 8,
    cursor: 'pointer',
    font: 'inherit',
    color: 'inherit',
  }),
  itemTitulo: css({ fontWeight: 600, fontSize: 15 }),
  itemDetalhe: css({ color: '#52525b', fontSize: 13 }),
  topo: css({
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    padding: '10px 16px',
    background: '#ffffff',
    borderBottom: '1px solid #d4d4d8',
  }),
  titulo: css({ fontSize: 16, fontWeight: 600, margin: 0, marginRight: 'auto' }),
  grupo: css({ display: 'flex', flexWrap: 'wrap', gap: 4 }),
  botao: css({
    padding: '6px 10px',
    background: '#ffffff',
    border: '1px solid #d4d4d8',
    borderRadius: 6,
    cursor: 'pointer',
    font: 'inherit',
    color: 'inherit',
  }),
  botaoAtivo: css({
    padding: '6px 10px',
    background: '#18181b',
    border: '1px solid #18181b',
    borderRadius: 6,
    cursor: 'pointer',
    font: 'inherit',
    color: '#ffffff',
  }),
  link: css({ color: '#1d4ed8', textDecoration: 'underline', background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit' }),
  info: css({ display: 'flex', flexWrap: 'wrap', gap: 16, padding: '8px 16px', color: '#52525b', fontSize: 13 }),
  palco: css({ flex: 1, minHeight: 0, display: 'flex', justifyContent: 'center', padding: 16, overflow: 'auto' }),
  moldura: css({ height: '100%', minHeight: 480, border: '1px solid #d4d4d8', borderRadius: 4, background: '#ffffff' }),
};

function Lista({ abrir }: { abrir: (slug: string) => void }) {
  return (
    <div style={s.tela}>
      <main style={s.lista}>
        <h1 style={s.tituloLista}>Rascunhos de tela</h1>
        <p style={s.apoio}>Rascunhos com os componentes reais e dados fictícios. Esta página só existe em desenvolvimento.</p>
        {rascunhos.length === 0 ? (
          <p style={s.apoio}>Nenhum rascunho ainda. Peça uma tela ao agent com /tela e ela aparece aqui.</p>
        ) : (
          <ul style={s.itens}>
            {rascunhos.map((item) => (
              <li key={item.slug}>
                <button type="button" style={s.item} onClick={() => abrir(item.slug)}>
                  <span style={s.itemTitulo}>{item.titulo}</span>
                  <span style={s.itemDetalhe}>
                    {item.slug}, {item.variantes.length === 1 ? '1 variante' : `${item.variantes.length} variantes`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function Aviso({ texto, voltar }: { texto: string; voltar: () => void }) {
  return (
    <div style={s.tela}>
      <main style={s.lista}>
        <h1 style={s.tituloLista}>{texto}</h1>
        <button type="button" style={s.link} onClick={voltar}>
          Ver todos os rascunhos
        </button>
      </main>
    </div>
  );
}

function Moldura({
  rascunho,
  variante,
  tamanho,
  navegar,
}: {
  rascunho: Rascunho;
  variante: VarianteRascunho;
  tamanho: string | null;
  navegar: Navegar;
}) {
  const atual = TAMANHOS.find((item) => item.id === tamanho) ?? TAMANHOS.find((item) => item.id === 'desktop');
  const largura = atual && atual.largura > 0 ? `${atual.largura}px` : '100%';
  const enderecoSozinha = urlCom({ v: variante.id, bare: '1', t: null });

  return (
    <div style={s.tela}>
      <header style={s.topo}>
        <button type="button" style={s.link} onClick={() => navegar({ r: null, v: null, t: null })}>
          Rascunhos
        </button>
        <h1 style={s.titulo}>{rascunho.titulo}</h1>
        <nav aria-label="Variantes" style={s.grupo}>
          {rascunho.variantes.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={item.id === variante.id}
              style={item.id === variante.id ? s.botaoAtivo : s.botao}
              onClick={() => navegar({ v: item.id })}
            >
              {item.id}. {item.nome}
            </button>
          ))}
        </nav>
        <nav aria-label="Tamanho da tela" style={s.grupo}>
          {TAMANHOS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={item.id === atual?.id}
              style={item.id === atual?.id ? s.botaoAtivo : s.botao}
              onClick={() => navegar({ t: item.id })}
            >
              {item.nome}
            </button>
          ))}
        </nav>
        <a href={enderecoSozinha} style={s.link}>
          Abrir só a variante para anotar
        </a>
      </header>
      {variante.descricao || rascunho.referencia ? (
        <div style={s.info}>
          {variante.descricao ? <span>{variante.descricao}</span> : null}
          {rascunho.referencia ? <span>Referência: {rascunho.referencia}</span> : null}
        </div>
      ) : null}
      <div style={s.palco}>
        <iframe
          key={enderecoSozinha}
          title={`${rascunho.titulo}, variante ${variante.id}`}
          src={enderecoSozinha}
          style={{ ...s.moldura, width: largura, maxWidth: '100%' }}
        />
      </div>
    </div>
  );
}

/** Página de rascunhos de tela (só em desenvolvimento). */
export default function RascunhosPage() {
  const [parametros, setParametros] = React.useState<Parametros | null>(null);

  React.useEffect(() => {
    const atualizar = () => setParametros(lerParametros());
    atualizar();
    window.addEventListener('popstate', atualizar);
    return () => window.removeEventListener('popstate', atualizar);
  }, []);

  const navegar = React.useCallback<Navegar>((mudancas) => {
    window.history.pushState(null, '', urlCom(mudancas));
    setParametros(lerParametros());
  }, []);

  if (!parametros) return null;

  const voltar = () => navegar({ r: null, v: null, t: null, bare: null });
  if (!parametros.rascunho) return <Lista abrir={(slug) => navegar({ r: slug, v: null, t: null, bare: null })} />;

  const rascunho = rascunhos.find((item) => item.slug === parametros.rascunho);
  if (!rascunho) return <Aviso texto={`Rascunho "${parametros.rascunho}" não encontrado`} voltar={voltar} />;

  const variante = rascunho.variantes.find((item) => item.id === parametros.variante) ?? rascunho.variantes[0];
  if (!variante) return <Aviso texto={`O rascunho "${rascunho.titulo}" não tem variantes`} voltar={voltar} />;

  if (parametros.sozinha) {
    const Tela = variante.Componente;
    return <Tela />;
  }

  return <Moldura rascunho={rascunho} variante={variante} tamanho={parametros.tamanho} navegar={navegar} />;
}
````

**2.2 Criar `<RASCUNHOS_DIR>/registro.ts`** dentro de APP_ROOT, **conteúdo exato** (regra 9).
- Link do original: https://raw.githubusercontent.com/tarcio11/cursor-ui-index/cef261bcaca0e2033c1bf72c2f38ce593cc59264/src/rascunhos/registro.ts
- Hash esperado: `0249e65d7592a2df9d1f163bc17b916093d9e58763bc33846c9fbd4b72066293`
- Bloco (só se o download falhar):

````ts
import type { Rascunho } from './tipos';

/**
 * Lista de rascunhos mostrada em /dev/rascunhos.
 * Ao criar um rascunho: importe o default de ./<slug> e adicione na lista.
 * Ao promover ou apagar um rascunho: remova o import e o item.
 */
export const rascunhos: Rascunho[] = [];
````

**2.3 Criar `<RASCUNHOS_DIR>/tipos.ts`** dentro de APP_ROOT, **conteúdo exato** (regra 9).
- Link do original: https://raw.githubusercontent.com/tarcio11/cursor-ui-index/cef261bcaca0e2033c1bf72c2f38ce593cc59264/src/rascunhos/tipos.ts
- Hash esperado: `4670c591db51f8ca4dd0bb708ee32790557923465239f8c5dcbb9f38d97dd39e`
- Bloco (só se o download falhar):

````ts
import type { ComponentType } from 'react';

/** Uma variante de um rascunho de tela. */
export interface VarianteRascunho {
  /** Letra da variante, por exemplo "A". */
  id: string;
  /** Nome curto mostrado na aba, por exemplo "Tabela densa". */
  nome: string;
  /** O que essa variante tenta, em uma linha. */
  descricao?: string;
  /** A tela inteira desta variante, só com dados fictícios. */
  Componente: ComponentType;
}

/** Um rascunho de tela criado pela skill "tela". */
export interface Rascunho {
  /** Identificador em kebab-case, igual ao nome da pasta do rascunho. */
  slug: string;
  /** Nome da tela. */
  titulo: string;
  /** Link ou descrição curta da referência usada. */
  referencia?: string;
  /** Variantes na ordem em que aparecem nas abas (a primeira abre por padrão). */
  variantes: VarianteRascunho[];
}
````

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

**3.1 Criar `.cursor/skills/tela/SKILL.md`** em CURSOR_ROOT (crie as pastas se não existirem), **conteúdo exato**, trocando os marcadores pelos valores da Fase 0: `<<RASCUNHOS>>` (RASCUNHOS), `<<DEV_CMD>>` (DEV_CMD), `<<APP>>` (APP), `<<TYPECHECK>>` (TYPECHECK), `<<ESTETICA>>` (ESTETICA), `<<RUN>>` (RUN) e `<<P>>` (P, pode ser vazio). Essa troca é a única diferença permitida; o arquivo final tem 92 linhas. Se a pasta `.cursor/skills/tela/` já existir, PARE e me pergunte.

````markdown
---
name: tela
description: Cria telas novas como rascunho visual com os componentes reais do design system, para o usuário ajustar até ficar bom (como um artefato) antes de virar código do produto. Use quando pedirem uma tela ou página nova, mandarem uma referência visual (print, link, outra tela, ideia) ou digitarem /tela. Para levar um rascunho aprovado para a rota real, use /tela promover.
---

# Tela: rascunho visual que o usuário ajusta até ficar bom

O rascunho é código de verdade: usa os componentes reais do projeto e dados fictícios, numa rota que só existe em desenvolvimento. Nada é ligado a API nem às rotas do produto até a promoção.

## Onde as coisas ficam

- Rascunhos: `<<RASCUNHOS>>/<slug>/`, com `index.tsx` (título, referência e variantes), `VarianteA.tsx`, `VarianteB.tsx`... e `dados.ts` (dados fictícios).
- Infraestrutura (não edite): `<<RASCUNHOS>>/RascunhosPage.tsx` e `<<RASCUNHOS>>/tipos.ts`. Em `<<RASCUNHOS>>/registro.ts`, só adicione ou remova rascunhos.
- Endereços, no servidor de desenvolvimento:
  - `/dev/rascunhos?r=<slug>`: moldura com abas de variantes e tamanhos de tela (celular, tablet, desktop);
  - `/dev/rascunhos?r=<slug>&v=<letra>&bare=1`: só a variante, sem moldura. É nesse endereço que o usuário anota com o Design Mode.
- Servidor de desenvolvimento: se já houver um rodando, use ele. Se não, rode `<<DEV_CMD>>` dentro de `<<APP>>` e use o endereço que ele mostrar.
- Typecheck: `<<TYPECHECK>>` dentro de `<<APP>>`.
- Skill de estética do projeto: `<<ESTETICA>>` (se estiver `nenhuma`, use só o arquivo de referência desta skill).

## Modo criar (padrão)

1. **Entender o pedido.** Veja o que veio como referência:
   - imagem colada: use como alvo visual;
   - link: abra no browser e tire screenshot;
   - "parecida com a tela X": encontre a rota com `list_routes` e `get_route` e abra no browser;
   - só texto: trabalhe com a descrição.

   Escreva em até 3 linhas: quem usa a tela, a tarefa principal e a informação mais importante. Se faltar algo que muda a tela inteira (por exemplo, se é uma listagem ou um formulário), faça uma pergunta e espere a resposta. O resto, decida e diga o que decidiu.
2. **Estética.** Leia o arquivo `references/estetica-com-design-system.md` desta skill e a skill de estética do projeto. O arquivo de referência vale por cima da skill de estética.
3. **Plano de reaproveitamento.** Faça as etapas 1, 2, 3 e 4 da regra `reuse-first-ui` (decompor, buscar no `ui-index`, rotas e telas parecidas, tabela). Entregue a tabela e siga sem esperar aprovação: rascunho não vai para o produto.
4. **Plano visual.** Antes de escrever código, escreva um wireframe em ASCII, o alinhamento, o único ponto de destaque da tela e os estados (carregando, vazio, erro). Revise o plano contra o pedido: o que parecer padrão genérico (por exemplo, tudo em cards iguais), troque e diga por quê.
5. **Criar o rascunho.**
   1. `slug` em kebab-case com o nome da tela (por exemplo, `vendas-por-parceiro`). Se a pasta já existir, escolha outro.
   2. `dados.ts`: dados fictícios realistas, no idioma e no assunto da tela (nada de "Lorem ipsum" ou "Item 1"). Inclua casos de borda: texto longo, lista vazia, número grande.
   3. `VarianteA.tsx`: a tela inteira, só com componentes do design system e componentes locais encontrados no índice. Sem chamada de API, sem router e sem estado global: tudo vem de `dados.ts`. Se a tela tiver estados (carregando, vazio, erro), mostre-os com um seletor simples no topo da variante.
   4. `index.tsx`, neste formato:

      ```tsx
      import type { Rascunho } from '../tipos';
      import VarianteA from './VarianteA';

      const rascunho: Rascunho = {
        slug: 'vendas-por-parceiro',
        titulo: 'Vendas por parceiro',
        referencia: 'print enviado no chat',
        variantes: [
          { id: 'A', nome: 'Tabela densa', descricao: 'Muitos parceiros por tela, foco em comparar', Componente: VarianteA },
        ],
      };

      export default rascunho;
      ```
   5. `registro.ts`: adicione o import (`import vendasPorParceiro from './vendas-por-parceiro';`) e o item na lista `rascunhos`.
   6. Rode o typecheck e corrija os erros dos arquivos do rascunho.
6. **Conferir antes de mostrar.** Abra `/dev/rascunhos?r=<slug>` no browser e confira o console sem erros. Tire screenshot nos tamanhos Desktop e Celular. Compare com a referência e com o plano visual e corrija o que estiver errado (alinhamento, quebra no celular, contraste, texto cortado, espaço sobrando). Faça uma rodada disso.
7. **Entregar.** Responda com:
   - o endereço do rascunho;
   - a tabela de reaproveitamento;
   - em 2 a 4 linhas, o que você fez e por quê;
   - as dúvidas que ficaram;
   - como ajustar: no browser do Agents Window, abrir a variante sozinha (`&v=A&bare=1`), ligar o Design Mode (Cmd/Ctrl + Shift + D) e clicar, desenhar ou falar o que mudar; ou pedir no chat.

## Modo ajustar

- A cada pedido de ajuste: altere a variante, confira de novo (passo 6 do modo criar) e diga o que mudou.
- "Me mostra outras opções": crie `VarianteB`, `VarianteC`... com direções de verdade diferentes (por exemplo, tabela densa, cards, lista com detalhe ao lado), nunca só troca de cor. Registre cada uma em `index.tsx`.
- Não apague variantes antigas sem o usuário pedir: elas são o histórico.
- Se o pedido precisar de algo que o design system não tem, diga isso e proponha COMPOR, ESTENDER ou CRIAR, como na tabela da regra.

## Modo promover (`/tela promover <slug> <variante>` ou quando o usuário aprovar)

Aqui a regra `reuse-first-ui` vale inteira, com a parada para aprovação.

1. **Plano de promoção:**
   - rota final: caminho, rota pai e layout (`list_routes`) e o arquivo onde a rota é registrada;
   - dados reais: de onde vêm (procure hooks e serviços existentes; se não achar, pergunte);
   - arquivos a criar e a alterar;
   - componentes novos e a pasta de cada um;
   - testes.

   PARE e peça aprovação.
2. **Implementar:** leve a variante aprovada para o lugar definitivo, troque `dados.ts` pelos dados reais e extraia componentes novos para as pastas certas, com JSDoc de uma linha. Nenhum import pode apontar para `<<RASCUNHOS>>`.
3. **Apagar o rascunho:** a pasta `<<RASCUNHOS>>/<slug>/`, o import e o item em `registro.ts`.
4. **Conferir:** `refresh_index` (ou `<<RUN>> <<P>>tools/ai-index/generate.mjs`), `get_route` na rota nova, typecheck, lint e testes do projeto, e abrir a rota real no browser.
5. **Responder** com a tabela final e o que foi feito.

## Proibido

- Importar qualquer coisa de `<<RASCUNHOS>>` em código do produto.
- Editar `RascunhosPage.tsx` e `tipos.ts`.
- Usar cor, fonte, espaçamento, sombra ou ícone fora do design system (detalhes em `references/estetica-com-design-system.md`).
````

**3.2 Criar `.cursor/skills/tela/references/estetica-com-design-system.md`** em CURSOR_ROOT, **conteúdo exato** (regra 9; rode o comando de hash a partir de CURSOR_ROOT).
- Link do original: https://raw.githubusercontent.com/tarcio11/cursor-ui-index/cef261bcaca0e2033c1bf72c2f38ce593cc59264/src/cursor/skills/tela/references/estetica-com-design-system.md
- Hash esperado: `ff7f026fdbf101b9f93fdba99e9d31560edcd6fcda51e11400f0827d6cae47e4`
- Bloco (só se o download falhar):

````markdown
# Estética dentro do design system

Use este arquivo junto com a skill de estética do projeto (por exemplo, `frontend-design`). Quando os dois discordarem, este arquivo vence: a tela precisa parecer parte do produto, não um projeto à parte.

## O design system decide

- **Cores:** só tokens e props de cor do design system. Nenhum hex, rgb, hsl ou gradiente novo.
- **Tipografia:** só as famílias e a escala do design system, pelos componentes de texto e título dele. Nenhuma fonte nova. A personalidade da tela vem de hierarquia, peso e espaço, não de trocar a fonte.
- **Espaçamento, raio de borda, sombra e ícones:** só da escala e da biblioteca do design system.
- **Componentes:** botão, campo, select, tabela, modal, abas, badge, toast e afins são sempre os do design system ou os componentes locais encontrados no índice. Nunca recrie com HTML e CSS próprios.
- **Pedido fora do design system:** se a skill de estética sugerir algo que o design system não tem (cor, fonte, efeito, textura), não implemente. Escreva como sugestão na resposta, para o time decidir.

## A skill de estética decide, dentro dessas regras

- **Assunto:** parta de quem usa a tela, da tarefa principal e dos dados reais do domínio. Os dados fictícios do rascunho precisam parecer do negócio.
- **Plano antes do código:** wireframe em ASCII, alinhamento e os princípios da tela. Revise o plano procurando escolhas genéricas e troque as que encontrar.
- **Hierarquia:** um único ponto de destaque por tela. O resto fica calmo e disciplinado.
- **Composição e densidade:** escolha de propósito. Tabela densa para comparar e analisar; cards só quando cada item é uma unidade independente; lista com detalhe ao lado quando o usuário abre um item por vez. Evite cortar tudo em cards iguais com a mesma sombra.
- **Estrutura que informa:** borda, divisória, numeração e rótulo só quando carregam informação. Numeração só para sequência de verdade (etapas, linha do tempo).
- **Sem os vícios de tela gerada:** rótulo em caixa alta acima de cada título, uma palavra destacada sozinha no título, metadados no formato "A · B · C", seta no fim do texto de botão e rótulos que só enfeitam.
- **Movimento:** só o que responde a uma ação do usuário (abrir, expandir, confirmar) e mostra o que mudou. Nada de animação de entrada em cada bloco.
- **Texto da interface:**
  - escrito do ponto de vista de quem usa, com voz ativa e frases em caixa normal;
  - o botão diz exatamente o que acontece, e a mesma ação mantém o mesmo nome no fluxo inteiro (botão "Publicar", aviso "Publicado");
  - mensagem de erro diz o que aconteceu e como resolver, sem pedir desculpa;
  - tela vazia convida a agir.
- **Qualidade mínima:** funciona até a largura de celular, foco visível no teclado, contraste acessível e respeito à preferência de reduzir movimento.
- **Autocrítica:** confira com screenshot antes de entregar e tire um enfeite antes de mostrar.
````

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
