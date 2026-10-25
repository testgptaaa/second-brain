"""Model Gateway supporting OpenAI-compatible endpoints, Multimodal Vision, and NeuralDeep."""
from __future__ import annotations

import base64
import os
import time
from pathlib import Path
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
        env_text_model = os.environ.get("LLM_TEXT_MODEL") or os.environ.get("LLM_MODEL_NAME")
        env_vision_model = os.environ.get("LLM_VISION_MODEL")

        env_nd_endpoint = os.environ.get("NEURALDEEP_ENDPOINT")
        env_nd_key = os.environ.get("NEURALDEEP_API_KEY")

        self.base_url = self.indexer.get_setting("model_base_url", env_base_url or "https://api.sd1.su/v1") or "https://api.sd1.su/v1"
        self.api_key = self.indexer.get_setting("model_api_key", env_api_key or "") or ""
        self.text_model = self.indexer.get_setting("text_model", env_text_model or "gpt-5.6-luna") or "gpt-5.6-luna"
        self.vision_model = self.indexer.get_setting("vision_model", env_vision_model or "gemini-3-flash") or "gemini-3-flash"
        self.model_name = self.text_model  # for backward compatibility

        # NeuralDeep configuration
        self.nd_endpoint = self.indexer.get_setting("nd_endpoint", env_nd_endpoint or "https://api.neuraldeep.ru/v1") or "https://api.neuraldeep.ru/v1"
        self.nd_api_key = self.indexer.get_setting("nd_api_key", env_nd_key or "") or ""

        self.timeout_seconds = float(self.indexer.get_setting("model_timeout", "35.0") or "35.0")

    def update_config(
        self,
        base_url: str,
        api_key: str,
        text_model: Optional[str] = None,
        vision_model: Optional[str] = None,
        model_name: Optional[str] = None,
        nd_endpoint: Optional[str] = None,
        nd_api_key: Optional[str] = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        if text_model:
            self.text_model = text_model
            self.model_name = text_model
        elif model_name:
            self.text_model = model_name
            self.model_name = model_name

        if vision_model:
            self.vision_model = vision_model

        if nd_endpoint:
            self.nd_endpoint = nd_endpoint.rstrip("/")
        if nd_api_key is not None:
            self.nd_api_key = nd_api_key

        self.indexer.set_setting("model_base_url", self.base_url)
        self.indexer.set_setting("model_api_key", self.api_key)
        self.indexer.set_setting("text_model", self.text_model)
        self.indexer.set_setting("vision_model", self.vision_model)
        self.indexer.set_setting("model_name", self.model_name)
        self.indexer.set_setting("nd_endpoint", self.nd_endpoint)
        self.indexer.set_setting("nd_api_key", self.nd_api_key)

    def test_connection(self, model: Optional[str] = None) -> Dict[str, Any]:
        """Test API connectivity using a neutral ping prompt."""
        target_model = model or self.text_model
        endpoint = f"{self.base_url}/chat/completions"
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        payload = {
            "model": target_model,
            "messages": [{"role": "user", "content": "Ping. Answer with one word: Pong"}],
            "max_tokens": 10,
        }

        start_time = time.time()
        try:
            with httpx.Client(verify=False, timeout=12.0) as client:
                res = client.post(endpoint, json=payload, headers=headers)
                latency = round((time.time() - start_time) * 1000, 1)
                if res.status_code == 200:
                    data = res.json()
                    reply = data["choices"][0]["message"]["content"].strip()
                    return {
                        "ok": True,
                        "latency_ms": latency,
                        "model": target_model,
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

    def test_neuraldeep_connection(self) -> Dict[str, Any]:
        """Test NeuralDeep connectivity to /v1/models."""
        endpoint = f"{self.nd_endpoint}/models"
        headers = {}
        if self.nd_api_key:
            headers["Authorization"] = f"Bearer {self.nd_api_key}"

        start_time = time.time()
        try:
            with httpx.Client(verify=False, timeout=10.0) as client:
                res = client.get(endpoint, headers=headers)
                latency = round((time.time() - start_time) * 1000, 1)
                if res.status_code == 200:
                    data = res.json()
                    model_count = len(data.get("data", []))
                    return {
                        "ok": True,
                        "latency_ms": latency,
                        "models_count": model_count,
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

    def analyze_screenshot(
        self,
        image_path: Path | str,
        custom_prompt: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Multimodal analysis of a screenshot using Gemini Vision model.
        Logs audit record to requests/req-<id>.json without leaking image bytes.
        """
        img_path = Path(image_path)
        if not img_path.exists():
            return {"ok": False, "error": f"Image file not found: {image_path}"}

        try:
            with open(img_path, "rb") as f:
                img_b64 = base64.b64encode(f.read()).decode("ascii")
        except Exception as e:
            return {"ok": False, "error": f"Failed to read image: {str(e)}"}

        req_id = f"req-{int(time.time() * 1000)}"
        endpoint = f"{self.base_url}/chat/completions"

        prompt = custom_prompt or (
            "Опиши подробно, что изображено на скриншоте рабочего стола офисного сотрудника:\n"
            "1. Какое приложение и документ открыты?\n"
            "2. Какую задачу решает сотрудник?\n"
            "3. Есть ли конкретные задачи, дедлайны или важные числовые данные?\n"
            "Ответь структурированно и кратко на русском языке."
        )

        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/png;base64,{img_b64}"},
                    },
                ],
            }
        ]

        payload = {
            "model": self.vision_model,
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 1000,
        }

        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        start_time = time.time()
        analysis_text = ""
        status = "success"
        err_msg = None
        prompt_tokens = 0
        completion_tokens = 0

        try:
            with httpx.Client(verify=False, timeout=self.timeout_seconds) as client:
                res = client.post(endpoint, json=payload, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    analysis_text = data["choices"][0]["message"]["content"]
                    usage = data.get("usage", {})
                    prompt_tokens = usage.get("prompt_tokens", 0)
                    completion_tokens = usage.get("completion_tokens", 0)
                else:
                    status = "error"
                    err_msg = f"HTTP {res.status_code}: {res.text}"
        except Exception as e:
            status = "error"
            err_msg = str(e)

        # Audit log (without base64 payload bytes)
        sanitized_summary = {
            "type": "screenshot_vision_analysis",
            "image_filename": img_path.name,
            "vision_model": self.vision_model,
        }

        req_record = ModelRequestRecord(
            id=req_id,
            timestamp=time.strftime("%Y-%m-%dT%H:%M:%S"),
            mode="vision",
            endpoint=endpoint,
            model=self.vision_model,
            payload_summary=sanitized_summary,
            status=status,
            error_message=err_msg,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            response_summary=analysis_text[:200] if analysis_text else "",
        )
        self.storage.save_model_request_record(req_record)

        return {
            "ok": status == "success",
            "request_id": req_id,
            "analysis": analysis_text,
            "error": err_msg,
            "latency_ms": round((time.time() - start_time) * 1000, 1),
            "tokens": {"prompt": prompt_tokens, "completion": completion_tokens},
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
            snippet = doc.get("snippet") or doc.get("body", "")[:350]
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

        target_model = self.text_model or self.model_name
        payload = {
            "model": target_model,
            "messages": messages,
            "temperature": 0.2,
        }

        # Sanitized payload summary for audit logging (F06 requirement)
        sanitized_summary = {
            "question": question,
            "sources_count": len(context_docs),
            "sources_ids": [d.get("id") for d in context_docs[:5]],
            "model": target_model,
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
            with httpx.Client(verify=False, timeout=self.timeout_seconds) as client:
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
            model=target_model,
            payload_summary=sanitized_summary,
            status=status,
            error_message=err_msg,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            response_summary=answer[:200] if answer else "",
        )
        self.storage.save_model_request_record(req_record)

        return {
            "request_id": req_id,
            "answer": answer,
            "status": status,
            "sources": context_docs[:5],
            "tokens": {"prompt": prompt_tokens, "completion": completion_tokens},
        }
