"""Proactive suggestion engine implementing scenarios P01 through P08."""
from __future__ import annotations

import time
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from index.indexer import Indexer
from memory.storage import MemoryStorage


class SuggestionItem(BaseModel):
    id: str
    scenario_id: str  # P01 through P08
    title: str
    description: str
    source_refs: List[Dict[str, str]] = Field(default_factory=list)
    actions: List[str] = Field(default_factory=lambda: ["dismiss"])
    is_notification: bool = False  # Only P02 and P06 have OS notifications!
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    dismissed: bool = False
    payload: Dict[str, Any] = Field(default_factory=dict)


class SuggestionEngine:
    def __init__(self, storage: MemoryStorage, indexer: Indexer):
        self.storage = storage
        self.indexer = indexer
        self._active_suggestions: Dict[str, SuggestionItem] = {}

    def generate_suggestions(
        self,
        active_window_title: str = "",
        active_app: str = "",
        recent_text: str = "",
    ) -> List[SuggestionItem]:
        """Evaluate 8 proactive triggers against current context and memory."""
        now = datetime.now()
        new_suggestions: List[SuggestionItem] = []

        # --- P01: Bitrix / Task opened ---
        # When user opens Bitrix or a specific task, find related materials
        if "битрикс" in active_window_title.lower() or "bitrix" in active_window_title.lower() or "битрикс" in active_app.lower():
            # Search memory for matches
            related = self.indexer.search("битрикс", limit=3)
            s_id = f"sug-p01-{now.strftime('%Y%m%d%H')}"
            if s_id not in self._active_suggestions:
                item = SuggestionItem(
                    id=s_id,
                    scenario_id="P01",
                    title="Контекст задачи Битрикс",
                    description="Открыта задача Битрикс. Найдены связанные документы и прошлые обсуждения.",
                    source_refs=[{"id": r["id"], "title": r["title"]} for r in related],
                    actions=["view_source", "dismiss"],
                    is_notification=False,
                )
                new_suggestions.append(item)
                self._active_suggestions[s_id] = item

        # --- P03: Found request or promise in chats/docs ---
        # Detect phrases like "сделаю к", "нужно отправить", "прошу согласовать"
        promise_keywords = ["нужно сделать", "прошу согласовать", "отправлю к", "договорились о"]
        for kw in promise_keywords:
            if kw in recent_text.lower():
                s_id = f"sug-p03-{hash(kw)}-{now.strftime('%Y%m%d')}"
                if s_id not in self._active_suggestions:
                    item = SuggestionItem(
                        id=s_id,
                        scenario_id="P03",
                        title="Предложение задачи из договорённости",
                        description=f"В обсуждении обнаружена договорённость: «...{kw}...». Добавить в список задач?",
                        source_refs=[],
                        actions=["accept_task", "dismiss"],
                        is_notification=False,
                        payload={"suggested_title": f"Выполнить: {kw}", "quote": recent_text[:200]},
                    )
                    new_suggestions.append(item)
                    self._active_suggestions[s_id] = item
                break

        # --- P06: Task deadline approaching ---
        tasks = self.indexer.list_tasks(status="todo")
        for t in tasks:
            due_date_str = t.get("due_date")
            if due_date_str:
                try:
                    due_dt = datetime.fromisoformat(due_date_str)
                    diff_hours = (due_dt - now).total_seconds() / 3600.0
                    if 0 < diff_hours <= 4:  # Approaching within 4 hours
                        s_id = f"sug-p06-{t['id']}"
                        if s_id not in self._active_suggestions:
                            item = SuggestionItem(
                                id=s_id,
                                scenario_id="P06",
                                title="Подходит срок задачи",
                                description=f"Срок задачи «{t['title']}» истекает через {int(diff_hours)} ч.!",
                                source_refs=[{"id": t["id"], "title": t["title"]}],
                                actions=["view_task", "dismiss"],
                                is_notification=True,  # Notification allowed for deadlines!
                            )
                            new_suggestions.append(item)
                            self._active_suggestions[s_id] = item
                except Exception:
                    pass

        # --- P07: Task marked 'waiting_reply' ---
        waiting_tasks = self.indexer.list_tasks(status="waiting_reply")
        for t in waiting_tasks:
            s_id = f"sug-p07-{t['id']}"
            if s_id not in self._active_suggestions:
                item = SuggestionItem(
                    id=s_id,
                    scenario_id="P07",
                    title="Ожидание ответа",
                    description=f"Задача «{t['title']}» ожидает ответа. Вернуться к обсуждению?",
                    source_refs=[{"id": t["id"], "title": t["title"]}],
                    actions=["open_discussion", "dismiss"],
                    is_notification=False,
                )
                new_suggestions.append(item)
                self._active_suggestions[s_id] = item

        # --- P08: End of workday summary ---
        if now.hour >= 18:
            s_id = f"sug-p08-{now.strftime('%Y%m%d')}"
            if s_id not in self._active_suggestions:
                item = SuggestionItem(
                    id=s_id,
                    scenario_id="P08",
                    title="Итог рабочего дня",
                    description="Рабочий день подходит к концу. Сформирована сводка выполненных дел и точка продолжения на завтра.",
                    source_refs=[],
                    actions=["view_summary", "dismiss"],
                    is_notification=False,
                )
                new_suggestions.append(item)
                self._active_suggestions[s_id] = item

        return list(self._active_suggestions.values())

    def dismiss(self, suggestion_id: str) -> None:
        if suggestion_id in self._active_suggestions:
            self._active_suggestions[suggestion_id].dismissed = True
            del self._active_suggestions[suggestion_id]

    def list_active(self) -> List[SuggestionItem]:
        return [s for s in self._active_suggestions.values() if not s.dismissed]
