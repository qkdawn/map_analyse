#!/usr/bin/env bash
set -euo pipefail

set -a
. /mnt/d/Coding/map_analyse/gaode-map/.env
set +a

cd /mnt/d/Coding/map_analyse

gaode-map/.venv/bin/python scripts/nightlight/prepare_black_marble.py \
  --year 2024 \
  --data-root /mnt/e/NightlightData \
  --keep-raw \
  --download-workers 4

gaode-map/.venv/bin/python scripts/nightlight/prepare_black_marble.py \
  --year 2023 \
  --data-root /mnt/e/NightlightData \
  --keep-raw \
  --download-workers 4
