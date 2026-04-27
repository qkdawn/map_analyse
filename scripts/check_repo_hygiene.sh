#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [[ $# -gt 0 ]]; then
  ROOT_DIR="$(cd "$1" && pwd)"
elif [[ -f "./AGENTS.md" && -d "./frontend" && -f "./pyproject.toml" ]]; then
  ROOT_DIR="$(pwd)"
else
  ROOT_DIR="$(cd "$SCRIPT_DIR/../gaode-map" && pwd)"
fi

cd "$ROOT_DIR"

fail=0

if ! command -v git >/dev/null 2>&1; then
  echo "Missing required command: git" >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Missing required command: npm" >&2
  exit 1
fi

echo "[check] repo root: $ROOT_DIR"

echo "[check] Python/cache artifact cleanup"
runtime_forbidden="$(
  find . \
    -path './.git' -prune -o \
    -path './.venv' -prune -o \
    -path './frontend/node_modules' -prune -o \
    \( \
      -type d -name '__pycache__' -o \
      -type d -name '.pytest_cache' -o \
      -type d -name '.playwright-cli' -o \
      -type f -name '*.pyc' -o \
      -type f -name '*.bak' \
    \) -print
)"
if [[ -n "$runtime_forbidden" ]]; then
  writable_runtime_forbidden=""
  readonly_runtime_forbidden=""
  while IFS= read -r path; do
    [[ -n "$path" ]] || continue
    if [[ -w "$path" || ( -d "$path" && -w "$path" ) ]]; then
      writable_runtime_forbidden+="$path"$'\n'
    else
      readonly_runtime_forbidden+="$path"$'\n'
    fi
  done <<< "$runtime_forbidden"
  if [[ -n "$writable_runtime_forbidden" ]]; then
    echo "Forbidden runtime files found:"
    echo "$writable_runtime_forbidden"
    fail=1
  fi
  if [[ -n "$readonly_runtime_forbidden" ]]; then
    echo "Warning: forbidden runtime files exist but are not writable by current user:"
    echo "$readonly_runtime_forbidden"
    echo "Please clean them with elevated privileges if needed."
  fi
fi

echo "[check] no forbidden legacy module/path references"
legacy_hits="$(
  {
    git grep -n -E \
      -e 'modules\.(grid_h3|road_syntax|export_bundle|gaode_service|isochrone_service)' \
      -- . \
      ':(exclude)AGENTS.md' \
      ':(exclude)README.md' \
      ':(exclude)docs/**' || true
    git grep -n -F \
      -e 'templates/analysis.html' \
      -e 'static/js/analysis' \
      -- . \
      ':(exclude)AGENTS.md' \
      ':(exclude)README.md' \
      ':(exclude)docs/**' || true
  } | sed '/^$/d'
)"
if [[ -n "$legacy_hits" ]]; then
  echo "Forbidden legacy references found:"
  echo "$legacy_hits"
  fail=1
fi

for path in \
  templates/analysis.html \
  static/js/analysis
do
  if [[ -e "$path" ]]; then
    echo "Forbidden legacy path still exists: $path"
    fail=1
  fi
done

for dir in \
  modules/grid_h3 \
  modules/road_syntax \
  modules/export_bundle \
  modules/gaode_service \
  modules/isochrone_service
do
  if [[ -d "$dir" ]]; then
    echo "Forbidden legacy module dir still exists: $dir"
    fail=1
  fi
done

echo "[check] hotspot file size thresholds"
while IFS='|' read -r path limit; do
  [[ -f "$path" ]] || continue
  line_count="$(wc -l < "$path")"
  line_count="${line_count//[[:space:]]/}"
  if (( line_count > limit )); then
    echo "Hotspot file exceeds threshold: $path ($line_count > $limit)"
    fail=1
  fi
done <<'EOF'
router/domains/isochrone.py|120
modules/population/facade.py|500
modules/export/builder.py|750
modules/road/core.py|900
modules/h3/analysis.py|320
store/history_repo.py|220
router/domains/road.py|120
main.py|180
EOF

echo "[check] frontend build sync"
if [[ -f "frontend/package.json" ]]; then
  if ! (
    cd frontend
    npm run check:build-sync
  ); then
    fail=1
  fi
else
  echo "Missing frontend/package.json"
  fail=1
fi

if [[ "$fail" -ne 0 ]]; then
  echo "repo hygiene check failed"
  exit 1
fi

echo "repo hygiene check passed"
