# cursor-ui-index

Prompt e ferramentas para fazer o agent do Cursor **reaproveitar componentes, telas e rotas que já existem** antes de criar algo novo num front-end React. Componente novo só em último caso, e com justificativa.

## Como usar

1. Abra o repositório do seu front no Cursor, no modo Agent.
2. Copie todo o conteúdo de [`prompt-cursor-ai-index.md`](prompt-cursor-ai-index.md) e cole no chat.
   Se o Cursor cortar o texto colado, salve o arquivo na raiz do seu repositório e peça: `Execute exatamente as instruções de @prompt-cursor-ai-index.md`.
3. O agent descobre como o seu projeto está montado, configura tudo e termina com um relatório. Ele para e pergunta quando encontra um caso que o prompt não cobre.
   Os arquivos de código são baixados deste repositório (links fixos num commit) e conferidos por hash SHA-256. Se não houver acesso ao GitHub, o agent copia dos blocos do próprio prompt. Antes de criar os arquivos, ele tira a pasta `tools/ai-index` do Prettier, do ESLint e do Biome, para nenhum formatador alterar os arquivos ao salvar.
4. Depois: habilite o servidor `ui-index` em Settings → MCP do Cursor e faça o commit.

## O que o prompt configura no seu repositório

| Parte | Arquivo | O que faz |
|---|---|---|
| Índice | `tools/ai-index/generate.mjs` | Lê o código com ts-morph e gera `tools/ai-index/generated/component-index.json` e `.md`: componentes do design system e locais, props, onde cada um é usado, telas, layouts e rotas (Next App Router, Next Pages Router e React Router). |
| Atualização | `tools/ai-index/pre-commit.sh` + hook + CI | Regenera o índice em todo commit; o CI falha se alguém commitar sem atualizar. |
| Consulta | `tools/ai-index/mcp-server.mjs` | Servidor MCP sem dependências com 6 tools: `search_components`, `get_component`, `find_usages`, `list_routes`, `get_route` e `refresh_index`. A busca entende termos em português. |
| Regra | `.cursor/rules/reuse-first-ui.mdc` | Obriga o fluxo: decompor a tela → buscar candidatos → plano REUSAR / COMPOR / ESTENDER / CRIAR → aprovação → implementar → atualizar o índice. |

## Rascunhos de tela iteráveis (segundo prompt)

Depois do setup acima, o [`prompt-cursor-rascunhos.md`](prompt-cursor-rascunhos.md) adiciona um fluxo parecido com os artefatos do Claude: você manda uma referência (print, link, "parecida com a tela X" ou só a ideia), o agent monta um rascunho com os componentes reais do design system e dados fictícios, você ajusta até ficar bom e só então ele vira código do produto.

| Parte | Arquivo | O que faz |
|---|---|---|
| Página de rascunhos | `src/__rascunhos/RascunhosPage.tsx` + rota `/dev/rascunhos` | Só existe em desenvolvimento. Mostra cada rascunho numa moldura com abas de variantes e tamanhos de tela (celular, tablet, desktop) e abre a variante sozinha para anotar com o Design Mode do Cursor. |
| Skill `tela` | `.cursor/skills/tela/SKILL.md` | `/tela` cria o rascunho (plano de reaproveitamento pelo `ui-index`, plano visual, variantes, conferência por screenshot); `/tela promover` leva a variante aprovada para a rota real, troca os dados fictícios pelos reais, apaga o rascunho e atualiza o índice. |
| Estética | `.cursor/skills/tela/references/estetica-com-design-system.md` | Usa a skill de estética do projeto (ex.: `frontend-design`) para composição, hierarquia e texto, sempre dentro do design system: nada de cor, fonte ou espaçamento fora dele. |
| Regra | `.cursor/rules/reuse-first-ui.mdc` | Rascunho segue sem parar para aprovação; a parada passa a ser na promoção. Produto nunca importa nada de `__rascunhos`. |

Funciona com Next (App Router e Pages Router) e React Router (rotas em objetos ou em JSX), com TypeScript. O Design Mode fica no browser do Agents Window do Cursor. Os rascunhos ficam fora do índice, do Prettier, do ESLint e do Biome, e não entram no build de produção (no Next, a rota responde 404).

## Revisão das telas prontas (terceiro prompt)

Quando as telas estiverem prontas, o [`prompt-revisao-telas.md`](prompt-revisao-telas.md) faz a revisão profunda: encontra o que foi criado e já existia no projeto, padroniza pelo design system, componentiza, remove code smells e revisa layout, UI/UX e acessibilidade (WCAG 2.2 AA). Funciona em qualquer modelo e não depende do índice, mas usa o `ui-index` se ele estiver configurado.

1. Preencha os campos entre colchetes na seção "Contexto do projeto" (stack, design system, telas, comandos).
2. Cole no chat. O agent levanta e analisa tudo, entrega um relatório com `arquivo:linha` e um plano em lotes, e **para antes de alterar qualquer arquivo**.
3. Aprove o plano (inteiro ou em parte). Ele executa um lote por vez, rodando lint, testes e build ao fim de cada um.

Ao contrário dos dois primeiros, este prompt não é gerado: edite o arquivo diretamente.

## Correções para quem já rodou o prompt

Cada arquivo em `correcoes/` é um prompt pronto: abra no GitHub, use o botão "Copy raw file" e cole no chat do Cursor, no modo Agent.

| Correção | Quando usar |
|---|---|
| [`correcoes/01-formatador-e-hashes.md`](correcoes/01-formatador-e-hashes.md) | Você rodou a primeira versão do prompt (commit `ccbd1fe`) e o hash de `generate.mjs`, `mcp-server.mjs` ou `mcp-smoke-test.mjs` não bateu, porque um formatador (normalmente o Prettier ao salvar) mudou os arquivos. |

## Requisitos

- Projeto React, com ou sem TypeScript.
- Node 20 ou maior.
- A única dependência adicionada ao projeto é `ts-morph@28.0.0` (mais o `husky`, se o repositório ainda não tiver ferramenta de git hooks).

## Estrutura deste repositório

| Caminho | Conteúdo |
|---|---|
| `prompt-cursor-ai-index.md` | O primeiro prompt pronto (índice, MCP e regra). É gerado: não edite à mão. |
| `prompt-cursor-rascunhos.md` | O segundo prompt pronto (rascunhos de tela e skill `tela`). É gerado: não edite à mão. |
| `prompt-revisao-telas.md` | O terceiro prompt (revisão de telas prontas). Não é gerado: edite à mão. |
| `prompt-template.md` e `prompt-template-rascunhos.md` | Texto dos prompts com os marcadores `{{FILE:...}}`, `{{SHA:...}}`, `{{LINES:...}}` e `{{URL:...}}`. |
| `src/` | Os arquivos que o prompt manda criar no seu repositório. |
| `correcoes/` | Prompts curtos para corrigir repositórios que já rodaram uma versão anterior do prompt. |
| `scripts/build-prompt.mjs` | Monta os prompts a partir dos templates e de `src/`: embute os arquivos, os hashes SHA-256 que o agent usa para conferir cada cópia e os links dos originais, fixos no último commit que mexeu em `src/`. |

Para mudar alguma coisa:

1. Edite `src/` ou `prompt-template.md`.
2. Se mexeu em `src/`, commite e dê push antes de gerar o prompt: os links do prompt apontam para esse commit (o script recusa gerar com mudanças não commitadas em `src/`).
3. Gere o prompt e depois commite e dê push dele:

```sh
node scripts/build-prompt.mjs
```

## Testado em

- [bulletproof-react](https://github.com/alan2207/bulletproof-react): os apps com React Router, Next App Router e Next Pages Router.
- Monorepo com o design system num pacote de workspace.
- Projeto só em JavaScript.
- Repositório novo seguindo o prompt de ponta a ponta, com commits passando pelo hook do husky.
- Rascunhos: página testada em TypeScript estrito; rota `/dev/rascunhos` com 404 em produção e 200 em desenvolvimento no Next 16 (App Router e Pages Router); fora do build de produção no Vite com React Router (objetos e JSX).
