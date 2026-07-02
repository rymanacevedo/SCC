#!/usr/bin/env bash
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
  if [ ! -d node_modules ]; then
    return 1
  fi

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
  {
    name: '@rolldown/binding-linux-arm64-gnu',
    optional: true,
    run: () => undefined,
  },
];

for (const check of checks) {
  let mod;
  try {
    mod = require(check.name);
  } catch (error) {
    if (check.optional || error?.code === 'MODULE_NOT_FOUND') {
      continue;
    }
    throw error;
  }

  check.run(mod);
  console.log(`${check.name} native dependency ok`);
}
NODE
}

reset_node_modules() {
  echo "Resetting sandbox node_modules"
  if [ -L node_modules ]; then
    rm node_modules
  else
    rm -rf node_modules
  fi
}

if [ -e node_modules ]; then
  if verify_native_dependencies; then
    echo "Sandbox dependencies valid"
    exit 0
  fi

  reset_node_modules
fi

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

if [ -e node_modules ]; then
  if verify_native_dependencies; then
    echo "Sandbox dependencies valid after waiting"
    exit 0
  fi

  reset_node_modules
fi

echo "Installing sandbox dependencies"
bun install --frozen-lockfile --backend=copy
verify_native_dependencies
