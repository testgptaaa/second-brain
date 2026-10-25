"""Model Gateway supporting OpenAI-compatible endpoints, LM Studio, and audit logging."""
from __future__ import annotations

import time
import os
from typing import Any, Dict, List, Optional, Tuple
import httpx

from memory.models import ModelRequestRecord
from memory.storage import MemoryStorage
from index.indexer import Indexer
from policy.privacy import TextPrivacyEngine


class ModelGateway:
    def __init__(self, storage: MemoryStorage, indexer: Indexer):
        self.storage = storage
        self.indexer = indexer
        self.privacy_engine = TextPrivacyEngine()
        self._load_config()

    def _load_config(self) -> None:
        env_base_url = os.environ.get("LLM_BASE_URL")
        env_api_key = os.environ.get("LLM_API_KEY")
        env_model_name = os.environ.get("LLM_MODEL_NAME")

        self.base_url = self.indexer.get_setting("model_base_url", env_base_url or "http://localhost:1234/v1") or "http://localhost:1234/v1"
        self.api_key = self.indexer.get_setting("model_api_key", env_api_key or "") or ""
        self.model_name = self.indexer.get_setting("model_name", env_model_name or "local-model") or "local-model"
        self.timeout_seconds = float(self.indexer.get_setting("model_timeout", "30.0") or "30.0")

    def update_config(self, base_url: str, api_key: str, model_name: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model_name = model_name
        self.indexer.set_setting("model_base_url", self.base_url)
        self.indexer.set_setting("model_api_key", self.api_key)
        self.indexer.set_setting("model_name", self.model_name)

    def test_connection(self) -> Dict[str, Any]:
        """Test API connectivity using a neutral ping prompt."""
        endpoint = f"{self.base_url}/chat/completions"
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        payload = {
            "model": self.model_name,
            "messages": [{"role": "user", "content": "Ping. Answer with one word: Pong"}],
            "max_tokens": 10,
        }

        start_time = time.time()
        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.post(endpoint, json=payload, headers=headers)
                latency = round((time.time() - start_time) * 1000, 1)
                if res.status_code == 200:
                    data = res.json()
                    reply = data["choices"][0]["message"]["content"].strip()
                    return {
                        "ok": True,
                        "latency_ms": latency,
                        "model": self.model_name,
                        "reply": reply,
                    }
                else:
                    return {
                        "ok": False,
                        "latency_ms": latency,
                        "status_code": res.status_code,
                        "error": res.text,
                    }
        except Exception as e:
            return {
                "ok": False,
                "latency_ms": round((time.time() - start_time) * 1000, 1),
                "error": str(e),
            }

    def generate_answer(
        self,
        question: str,
        context_docs: List[Dict[str, Any]],
        mode: str = "text",
    ) -> Dict[str, Any]:
        """Generate answer with sources citing exact references.
        Saves audit log in requests/req-<id>.json (without API keys).
        """
        req_id = f"req-{int(time.time() * 1000)}"
        endpoint = f"{self.base_url}/chat/completions"

        # Construct prompt citing sources
        context_text = ""
        for i, doc in enumerate(context_docs[:5], 1):
            title = doc.get("title") or doc.get("relative_path")
            snippet = doc.get("snippet") or doc.get("body", "")[:300]
            context_text += f"\n[Источник {i}: {title} (ID: {doc.get('id')})]\n{snippet}\n"

        system_instruction = (
            "Ты — офисный ассистент «Второй мозг». Твоя задача — отвечать на вопросы "
            "пользователя строго на основе предоставленного контекста. "
            "Всегда указывай, из какого именно источника (файла или заметки) взята информация. "
            "Если информации нет в источниках, честно скажи, что в сохранённой памяти этих данных нет."
        )

        user_content = f"Вопрос пользователя: {question}\n\nКонтекст из сохранённой памяти:\n{context_text}"

        messages = [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": user_content},
        ]

        payload = {
            "model": self.model_name,
            "messages": messages,
            "temperature": 0.2,
        }

        # Sanitized payload summary for audit logging (F06 requirement)
        sanitized_summary = {
            "question": question,
            "sources_count": len(context_docs),
            "sources_ids": [d.get("id") for d in context_docs[:5]],
        }

        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        start_time = time.time()
        answer = ""
        status = "success"
        err_msg = None
        prompt_tokens = 0
        completion_tokens = 0

        try:
            with httpx.Client(timeout=self.timeout_seconds) as client:
                res = client.post(endpoint, json=payload, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    answer = data["choices"][0]["message"]["content"]
                    usage = data.get("usage", {})
                    prompt_tokens = usage.get("prompt_tokens", 0)
                    completion_tokens = usage.get("completion_tokens", 0)
                else:
                    status = "error"
                    err_msg = f"HTTP {res.status_code}: {res.text}"
                    answer = f"Ошибка обращения к модели: {res.status_code}"
        except Exception as e:
            status = "error"
            err_msg = str(e)
            # If offline or model not running, formulate a helpful fallback from local documents!
            if context_docs:
                answer = (
                    f"*(Локальный поиск)* По вашему запросу «{question}» найдены следующие материалы:\n\n"
                    + "\n".join(
                        f"- **{d.get('title') or d.get('relative_path')}**: {d.get('snippet', '')}"
                        for d in context_docs[:3]
                    )
                )
            else:
                answer = f"В сохранённой памяти не найдено записей по запросу «{question}»."

        # Save audit log record to requests/req-<id>.json
        req_record = ModelRequestRecord(
            id=req_id,
            timestamp=time.strftime("%Y-%m-%dT%H:%M:%S"),
            mode=mode,
            endpoint=endpoint,
            model=self.model_name,
            payload_summary=sanitized_summary,
            status=status,
            error_message=err_msg,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            response_summary=answer[:200],
        )
        self.storage.save_model_request_record(req_record)

        return {
            "request_id": req_id,
            "answer": answer,
            "status": status,
            "sources": context_docs[:5],
            "tokens": {"prompt": prompt_tokens, "completion": completion_tokens},
        }
