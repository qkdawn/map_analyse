#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../gaode-map" && pwd)"
PYTHON_BIN="$ROOT_DIR/.venv/bin/python"

if [[ ! -x "$PYTHON_BIN" ]]; then
  echo "Python 虚拟环境未就绪：$PYTHON_BIN" >&2
  echo "请先在仓库根目录执行 uv sync" >&2
  exit 1
fi

USER_NAME="${USER:-$(id -un 2>/dev/null || echo unknown)}"
RUN_ID="${PPID:-$$}_$$"
TMP_ROOT="/tmp/gaode-map-pytest/$USER_NAME/$RUN_ID"
BASE_TEMP="$TMP_ROOT/basetemp"

mkdir -p "$BASE_TEMP"
export TMPDIR="$TMP_ROOT"
export PYTHONDONTWRITEBYTECODE=1

exec "$PYTHON_BIN" -m pytest --basetemp="$BASE_TEMP" "$@"
