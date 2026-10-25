#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo 'Для записи нативной демки запустите этот скрипт на Mac.' >&2
  exit 1
fi
if [[ "$#" == 0 ]]; then
  DEMO_SESSION_ROOT="$PWD/runtime_data/demo-$(date +%Y%m%d-%H%M%S)-$$"
  .venv/bin/python scripts/prepare_demo.py --root "$DEMO_SESSION_ROOT"
elif [[ "$#" == 2 && "$1" == '--resume' ]]; then
  DEMO_SESSION_ROOT="$(cd -- "$2" && pwd)"
  .venv/bin/python - "$DEMO_SESSION_ROOT" <<'PYCODE'
import json,sys
from pathlib import Path
root=Path(sys.argv[1])
assert json.loads((root/'demo-session.json').read_text()).get('synthetic') is True, 'Not a prepared demo session'
assert (root/'Memory').is_dir(), 'Demo memory missing'
(root/'UserData').mkdir(exist_ok=True)
PYCODE
else
  echo 'Usage: bash scripts/demo.sh [--resume /absolute/path/to/demo-session]' >&2
  exit 1
fi
export SECOND_BRAIN_MEMORY_ROOT="$DEMO_SESSION_ROOT/Memory"
export SECOND_BRAIN_USER_DATA="$DEMO_SESSION_ROOT/UserData"
export LLM_API_KEY=''
export NEURALDEEP_API_KEY=''
echo "Демо-сессия: $DEMO_SESSION_ROOT"
echo 'Это настоящее приложение с подготовленными тестовыми данными; внешний LLM и захват экрана выключены.'
cd desktop
npm start
