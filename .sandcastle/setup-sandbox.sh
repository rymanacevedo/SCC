#!/usr/bin/env bash
# Runs inside the sandbox before each agent iteration (see config.ts hooks).
# Installs dependencies fresh from the lockfile every time: a worktree never
# inherits node_modules from the host, and a sandbox that already installed once
# may have merged branches that changed the lockfile since. A frozen install on
# top of an existing tree does not prune packages the lockfile no longer places
# there (a stale nested copy of a package shadows the hoisted one for TypeScript
# and Bun), so the tree is wiped first. The Bun cache is a shared host mount, so
# the install is a copy from cache rather than a download; the lock below keeps
# concurrent sandboxes from populating that cache at the same time.
set -euo pipefail

codex_mount=/mnt/host-codex
codex_home=${CODEX_HOME:-/home/agent/.codex}
tmp_dir=${TMPDIR:-/home/agent/tmp}
bun_cache_dir=${BUN_INSTALL_CACHE_DIR:-/home/agent/.bun-cache}
install_lock_dir="$bun_cache_dir/install.lock"
skip_auth=false

if [ "${1:-}" = "--skip-auth" ]; then
  skip_auth=true
fi

mkdir -p "$codex_home" "$tmp_dir" "$bun_cache_dir"

if [ "$skip_auth" = false ]; then
  test -f "$codex_mount/auth.json"
  cp "$codex_mount/auth.json" "$codex_home/auth.json"

  if [ -f "$codex_mount/config.toml" ]; then
    cp "$codex_mount/config.toml" "$codex_home/config.toml"
  fi
fi

verify_native_dependencies() {
  node <<'NODE'
const checks = [
  {
    name: 'esbuild',
    run: (mod) => mod.transformSync('const ok = true', { loader: 'js' }),
  },
  {
    name: 'rollup',
    run: (mod) => {
      if (typeof mod.rollup !== 'function') {
        throw new Error('rollup export missing');
      }
    },
  },
];

for (const check of checks) {
  let mod;
  try {
    mod = require(check.name);
  } catch (error) {
    if (error?.code === 'MODULE_NOT_FOUND') {
      continue;
    }
    throw error;
  }

  check.run(mod);
  console.log(`${check.name} native dependency ok`);
}
NODE
}

remove_installed_dependencies() {
  # Every node_modules directory in the worktree, including nested workspace
  # and tooling copies, but never descending into one to look for more.
  find . -name node_modules -type d -prune -exec rm -rf {} +
}

if [ -d "$install_lock_dir" ] && [ -z "$(find "$install_lock_dir" -mmin -20 -print -quit)" ]; then
  echo "Removing stale Bun install lock"
  rmdir "$install_lock_dir" 2>/dev/null || true
fi

lock_started=$SECONDS
while ! mkdir "$install_lock_dir" 2>/dev/null; do
  if (( SECONDS - lock_started > 240 )); then
    echo "Timed out waiting for Bun install lock" >&2
    exit 1
  fi
  sleep 1
done

cleanup_lock() {
  rmdir "$install_lock_dir" 2>/dev/null || true
}
trap cleanup_lock EXIT

echo "Installing sandbox dependencies from the lockfile"
remove_installed_dependencies
bun install --frozen-lockfile --backend=copy
verify_native_dependencies
