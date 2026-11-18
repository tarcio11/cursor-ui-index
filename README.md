# cursor-ui-index

Prompt e ferramentas para fazer o agent do Cursor **reaproveitar componentes, telas e rotas que já existem** antes de criar algo novo num front-end React. Componente novo só em último caso, e com justificativa.

## Como usar

1. Abra o repositório do seu front no Cursor, no modo Agent.
2. Copie todo o conteúdo de [`prompt-cursor-ai-index.md`](prompt-cursor-ai-index.md) e cole no chat.
   Se o Cursor cortar o texto colado, salve o arquivo na raiz do seu repositório e peça: `Execute exatamente as instruções de @prompt-cursor-ai-index.md`.
3. O agent descobre como o seu projeto está montado, configura tudo e termina com um relatório. Ele para e pergunta quando encontra um caso que o prompt não cobre.
4. Depois: habilite o servidor `ui-index` em Settings → MCP do Cursor e faça o commit.

## O que o prompt configura no seu repositório

| Parte | Arquivo | O que faz |
|---|---|---|
| Índice | `tools/ai-index/generate.mjs` | Lê o código com ts-morph e gera `tools/ai-index/generated/component-index.json` e `.md`: componentes do design system e locais, props, onde cada um é usado, telas, layouts e rotas (Next App Router, Next Pages Router e React Router). |
| Atualização | `tools/ai-index/pre-commit.sh` + hook + CI | Regenera o índice em todo commit; o CI falha se alguém commitar sem atualizar. |
| Consulta | `tools/ai-index/mcp-server.mjs` | Servidor MCP sem dependências com 6 tools: `search_components`, `get_component`, `find_usages`, `list_routes`, `get_route` e `refresh_index`. A busca entende termos em português. |
| Regra | `.cursor/rules/reuse-first-ui.mdc` | Obriga o fluxo: decompor a tela → buscar candidatos → plano REUSAR / COMPOR / ESTENDER / CRIAR → aprovação → implementar → atualizar o índice. |

## Requisitos

- Projeto React, com ou sem TypeScript.
- Node 20 ou maior.
- A única dependência adicionada ao projeto é `ts-morph@28.0.0` (mais o `husky`, se o repositório ainda não tiver ferramenta de git hooks).

## Estrutura deste repositório

| Caminho | Conteúdo |
|---|---|
| `prompt-cursor-ai-index.md` | O prompt pronto. É gerado: não edite à mão. |
| `prompt-template.md` | Texto do prompt com os marcadores `{{FILE:...}}`, `{{SHA:...}}` e `{{LINES:...}}`. |
| `src/` | Os arquivos que o prompt manda criar no seu repositório. |
| `scripts/build-prompt.mjs` | Monta o prompt a partir do template e de `src/`, incluindo os hashes SHA-256 que o agent usa para conferir se copiou cada arquivo sem alteração. |

Para mudar alguma coisa, edite `src/` ou `prompt-template.md` e rode:

```sh
node scripts/build-prompt.mjs
```

## Testado em

- [bulletproof-react](https://github.com/alan2207/bulletproof-react): os apps com React Router, Next App Router e Next Pages Router.
- Monorepo com o design system num pacote de workspace.
- Projeto só em JavaScript.
- Repositório novo seguindo o prompt de ponta a ponta, com commits passando pelo hook do husky.
