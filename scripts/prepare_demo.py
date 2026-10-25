"""Prepare clearly labelled synthetic data in NEW isolated memory for a real demo.
Never overwrites an existing directory and never writes into personal Memory.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timedelta
from pathlib import Path
import sys

PROJECT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT / "core" / "src"))
from memory.storage import MemoryStorage
from memory.models import SourceRecord, SourceType, CaptureMethod, TaskStatus
from index.indexer import Indexer


def prepare(root: Path):
    root = root.resolve()
    root.mkdir(parents=True, exist_ok=False)
    storage = MemoryStorage(root / "Memory")
    storage.init_storage()
    now = datetime.now().replace(hour=10, minute=0, second=0, microsecond=0)
    notes = [
        (
            "Бриф: запуск проекта Вектор",
            "Тестовый рабочий день.\n\nБюджет проекта Вектор — 500 000 рублей.\nОтветственная — Марина.\nСледующий шаг — согласовать смету.\n\nЭто синтетические данные для демонстрации.",
            ["вектор", "бриф"],
        ),
        (
            "Итоги встречи по Вектору",
            "Вектор: клиент подтвердил бюджет 500 000 рублей.\nНужно отправить обновлённую смету и назначить следующий созвон.\nДанные подготовлены вручную для демо.",
            ["вектор", "встреча"],
        ),
        (
            "План недели",
            "Подготовить отчёт, проверить сроки задач и собрать материалы проекта.\nТестовые данные.",
            ["план"],
        ),
    ]
    for i, (title, body, tags) in enumerate(notes):
        storage.save_note(
            title, body, doc_id=f"demo-note-{i}", dt=now - timedelta(days=i), tags=tags
        )
    tasks = [
        ("Согласовать смету Вектора", TaskStatus.TODO, 0),
        ("Подготовить предложение клиенту", TaskStatus.IN_PROGRESS, 1),
        ("Получить ответ Марины", TaskStatus.WAITING_REPLY, 2),
        ("Проверить бюджет", TaskStatus.DONE, -1),
        ("Отправить прошлый отчёт", TaskStatus.TODO, -2),
        ("Собрать идеи на следующую неделю", TaskStatus.TODO, None),
        ("Старый вариант презентации", TaskStatus.CANCELLED, None),
    ]
    for i, (title, status, delta) in enumerate(tasks):
        storage.save_task(
            title,
            description="Синтетическая задача для демонстрации реального сохранения.",
            task_id=f"demo-task-{i}",
            status=status,
            due_date=(
                (now + timedelta(days=delta)).date().isoformat()
                if delta is not None
                else None
            ),
        )
    for i in range(3):
        dt = now - timedelta(days=i)
        source_id = f"demo-source-{i}"
        storage.save_source_record(
            SourceRecord(
                id=source_id,
                source_type=SourceType.NOTE,
                app_name="Демо: ручная подготовка",
                window_title=notes[i][0],
                uri="",
                captured_at=dt.isoformat(),
                method=CaptureMethod.MANUAL,
                metadata={
                    "synthetic": True,
                    "description": "Подготовленный пример, не автоматический захват экрана",
                },
            ),
            dt,
        )
        storage.save_episode(
            summary=notes[i][0],
            observations=notes[i][1],
            dt=dt,
            episode_id=f"demo-episode-{i}",
            source_ids=[source_id],
        )
        storage.update_day_index(dt)
    indexer = Indexer(storage.sqlite_path)
    indexer.set_setting("capture_consent", "false")
    indexer.set_setting("policy_is_paused", "true")
    indexer.set_setting("model_base_url", "https://api.sd1.su/v1")
    indexer.rebuild_from_storage(storage.root_dir)
    (root / "UserData").mkdir()
    (root / "demo-session.json").write_text(
        json.dumps({"synthetic": True, "schema": 1}), encoding="utf-8"
    )
    return storage.root_dir


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        type=Path,
        required=True,
        help="New demo session directory, never personal Memory",
    )
    args = parser.parse_args()
    try:
        memory = prepare(args.root)
    except FileExistsError:
        parser.error(
            "Directory already exists. Choose a new demo directory; existing data was not changed."
        )
    print(f"Demo memory ready: {memory}")
    print(
        "Synthetic fixtures: 3 notes, 7 tasks, 3 sources, 3 episodes. Capture disabled."
    )
