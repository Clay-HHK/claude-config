#!/usr/bin/env bash
set -euo pipefail

CLAUDE_DIR="$HOME/.claude"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPONENTS=(skills commands agents rules hooks scripts CLAUDE.md CLAUDE.zh-CN.md)

info()  { echo -e "\033[1;34m[INFO]\033[0m $*"; }
warn()  { echo -e "\033[1;33m[WARN]\033[0m $*"; }
error() { echo -e "\033[1;31m[ERROR]\033[0m $*"; exit 1; }

check_deps() {
  command -v git  >/dev/null || error "Git is required. Install it first."
  command -v node >/dev/null || error "Node.js is required (hooks depend on it). Install it first."
}

# Create settings.json from template
create_settings() {
  local template="$1/settings.json.template"
  local target="$CLAUDE_DIR/settings.json"
  if [ -f "$template" ] && [ ! -f "$target" ]; then
    cp "$template" "$target"
    info "Created settings.json from template."
    info "  → Edit $target to add your GITHUB_PERSONAL_ACCESS_TOKEN (optional)."
  fi
}

# Merge hooks, mcpServers, enabledPlugins from template into existing settings.json
merge_settings() {
  local template="$1/settings.json.template"
  local target="$CLAUDE_DIR/settings.json"

  [ -f "$template" ] || return 0
  [ -f "$target" ]   || { create_settings "$1"; return 0; }

  # Backup
  cp "$target" "${target}.bak"
  info "Backed up settings.json → settings.json.bak"

  # Merge hooks, mcpServers, enabledPlugins (don't overwrite existing keys in mcpServers/enabledPlugins)
  node -e "
    const fs = require('fs');
    const existing = JSON.parse(fs.readFileSync('$target', 'utf8'));
    const template = JSON.parse(fs.readFileSync('$template', 'utf8'));
    // hooks: always overwrite with template (core functionality)
    if (template.hooks) existing.hooks = template.hooks;
    // mcpServers: merge, keep existing entries
    if (template.mcpServers) {
      existing.mcpServers = existing.mcpServers || {};
      for (const [k, v] of Object.entries(template.mcpServers)) {
        if (!existing.mcpServers[k]) existing.mcpServers[k] = v;
      }
    }
    // enabledPlugins: merge, keep existing entries
    if (template.enabledPlugins) {
      existing.enabledPlugins = existing.enabledPlugins || {};
      for (const [k, v] of Object.entries(template.enabledPlugins)) {
        if (!(k in existing.enabledPlugins)) existing.enabledPlugins[k] = v;
      }
    }
    fs.writeFileSync('$target', JSON.stringify(existing, null, 2) + '\n');
  " || { warn "Auto-merge failed. Please manually copy settings from settings.json.template."; return 0; }

  info "Merged hooks/mcpServers/enabledPlugins into settings.json."
}

# Copy component directories
copy_components() {
  local src="$1"
  for comp in "${COMPONENTS[@]}"; do
    if [ -e "$src/$comp" ]; then
      if [ -d "$src/$comp" ]; then
        mkdir -p "$CLAUDE_DIR/$comp"
        cp -r "$src/$comp/." "$CLAUDE_DIR/$comp/"
      else
        cp "$src/$comp" "$CLAUDE_DIR/$comp"
      fi
    fi
  done
  info "Copied components: ${COMPONENTS[*]}"
}

main() {
  echo ""
  echo "╔══════════════════════════════════════╗"
  echo "║       Claude Scholar Installer       ║"
  echo "╚══════════════════════════════════════╝"
  echo ""

  check_deps

  info "Installing from: $SRC_DIR"
  copy_components "$SRC_DIR"
  merge_settings "$SRC_DIR"
  info "Your existing env/permissions are preserved."

  echo ""
  info "Done! Restart Claude Code CLI to activate."
  echo ""
}

main "$@"
