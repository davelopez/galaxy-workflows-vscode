#!/usr/bin/env bash
# Finds pnpm by sourcing common Node version managers if needed.
# Works across environments: nvm, fnm, asdf, or system Node with corepack.
set -e

if command -v pnpm &>/dev/null; then exec pnpm "$@"; fi

# nvm
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" && exec pnpm "$@"

# fnm
[ -s "$HOME/.local/share/fnm/env.sh" ] && . "$HOME/.local/share/fnm/env.sh" && exec pnpm "$@"

# asdf
[ -s "$HOME/.asdf/asdf.sh" ] && . "$HOME/.asdf/asdf.sh" && exec pnpm "$@"

# corepack (built into Node.js 16.13+)
command -v corepack &>/dev/null && corepack enable pnpm 2>/dev/null && exec pnpm "$@"

echo "Error: pnpm not found. Install pnpm or a Node version manager." >&2
exit 1
