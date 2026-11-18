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
