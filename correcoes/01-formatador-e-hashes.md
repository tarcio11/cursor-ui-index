# Correção: arquivos do ai-index alterados por um formatador

Esta correção é para repositórios que rodaram a primeira versão do prompt `prompt-cursor-ai-index.md` (commit `ccbd1fe` do repositório tarcio11/cursor-ui-index) e em que o hash de `generate.mjs`, `mcp-server.mjs` ou `mcp-smoke-test.mjs` não bateu. A causa é um formatador (normalmente o Prettier, rodando ao salvar) que reformatou esses arquivos depois de criados. O código continua funcionando, mas os arquivos ficaram diferentes dos originais.

## Regras

- Faça só o que está abaixo, na ordem. Não altere nenhum outro arquivo.
- Não faça commit, push nem abra PR.
- Se um passo falhar, mostre o erro completo e PARE.
- Os comandos estão em sintaxe de shell POSIX (bash/zsh). No PowerShell, use a sintaxe equivalente e `curl.exe` no lugar de `curl`.

## Definições

- APP_ROOT: a pasta do app front-end que tem a pasta `tools/ai-index`.
- CURSOR_ROOT: a pasta raiz aberta no Cursor.
- REPO_ROOT: a saída de `git rev-parse --show-toplevel`.

## 1. Tirar a pasta `tools/ai-index` dos formatadores

1. Acrescente a linha `**/tools/ai-index/` ao `.prettierignore` de CURSOR_ROOT, que é o que o Cursor consulta ao formatar (crie o arquivo se não existir). Se existir outro `.prettierignore` em APP_ROOT ou em REPO_ROOT, acrescente a mesma linha nele também. Linhas antigas, como `tools/ai-index/generated/`, podem ficar.
2. ESLint: se o projeto tem ESLint, confira se a pasta `tools/ai-index` já está nos ignores (o prompt anterior fez isso). Se não estiver:
   - config flat (`eslint.config.*`): adicione `{ ignores: ['**/tools/ai-index/**'] }` como primeiro item da lista de configs exportada, ou acrescente o padrão a um objeto que já tenha só a chave `ignores`;
   - config legada (`.eslintrc*` ou chave `eslintConfig`): acrescente a linha `**/tools/ai-index/` ao `.eslintignore` da mesma pasta da config (crie se não existir).
3. Biome: se existir `biome.json` ou `biome.jsonc` em APP_ROOT ou REPO_ROOT:
   - com `@biomejs/biome` 2.x: acrescente `"!**/tools/ai-index/**"` à lista `files.includes`; se a lista não existir, crie `"includes": ["**", "!**/tools/ai-index/**"]` dentro de `"files"` (crie `"files"` se não existir, sem apagar as outras chaves dele);
   - com `@biomejs/biome` 1.x: acrescente `"**/tools/ai-index/**"` à lista `files.ignore` (crie a lista, e `"files"`, se não existirem).

## 2. Guardar os arquivos atuais para comparar

Copie `tools/ai-index/generate.mjs`, `tools/ai-index/mcp-server.mjs` e `tools/ai-index/mcp-smoke-test.mjs` (de APP_ROOT) para uma pasta temporária fora do repositório.

## 3. Baixar os originais

Dentro de APP_ROOT, baixe cada arquivo direto no caminho final, sem abrir nem salvar pelo editor:

```sh
curl -fsSL --create-dirs -o tools/ai-index/generate.mjs https://raw.githubusercontent.com/tarcio11/cursor-ui-index/ccbd1fe3fc8e8df85c179b0c12776b1118f5d629/src/tools/ai-index/generate.mjs
curl -fsSL --create-dirs -o tools/ai-index/mcp-server.mjs https://raw.githubusercontent.com/tarcio11/cursor-ui-index/ccbd1fe3fc8e8df85c179b0c12776b1118f5d629/src/tools/ai-index/mcp-server.mjs
curl -fsSL --create-dirs -o tools/ai-index/mcp-smoke-test.mjs https://raw.githubusercontent.com/tarcio11/cursor-ui-index/ccbd1fe3fc8e8df85c179b0c12776b1118f5d629/src/tools/ai-index/mcp-smoke-test.mjs
```

## 4. Conferir os hashes

Dentro de APP_ROOT, rode o comando abaixo para cada arquivo, trocando `<arquivo>` pelo caminho dele:

```sh
node -e "const c=require('fs').readFileSync(process.argv[1],'utf8').replace(/\r\n/g,'\n');console.log(require('crypto').createHash('sha256').update(c).digest('hex'))" <arquivo>
```

O resultado tem que ser exatamente este. O `pre-commit.sh` não é baixado de novo: só confira o hash dele.

| Arquivo | Hash esperado |
|---|---|
| `tools/ai-index/generate.mjs` | `40bce9b827bca5a504b9a7567d3f5b31670f92bfac1085a442971a6e280dbcbd` |
| `tools/ai-index/mcp-server.mjs` | `bdf19c76f89b59e4edd77768d575e3b53df4d47ffe297b4d5b67de5a146a92e1` |
| `tools/ai-index/mcp-smoke-test.mjs` | `bdf9ad28509dda7b610666d722a45528684c9798af4b1440d11bfa1984ca9827` |
| `tools/ai-index/pre-commit.sh` | `b0e5b165c3b48c47028c07775671835e8ac5c86080b845019e2676094703ac73` |

Se algum hash não bater, PARE e mostre os hashes obtidos.

## 5. Comparar o antes e o depois

Para cada um dos 3 arquivos baixados, rode `git diff --no-index <cópia antiga> <arquivo novo>` (o comando termina com código 1 quando há diferença; isso é esperado). Diga se as diferenças eram só de formatação (quebra de linha, aspas, vírgulas, parênteses, espaços) ou se havia alguma mudança de código.

## 6. Validar

Dentro de APP_ROOT (use `yarn node` no lugar de `node` se existir `.pnp.cjs`, ou seja, se o projeto usar Yarn Plug'n'Play):

1. `node tools/ai-index/generate.mjs --check` tem que responder `[ai-index] OK: índice atualizado`.
2. `node tools/ai-index/mcp-smoke-test.mjs "button"`: todas as linhas têm que começar com `OK`.

## 7. Relatório

Responda com:

- os arquivos alterados no passo 1 e a linha acrescentada em cada um;
- os 4 hashes obtidos no passo 4;
- o resultado da comparação do passo 5;
- a saída dos dois comandos do passo 6.
