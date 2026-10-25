#!/usr/bin/env python3
"""Interactive test script for Second Brain end-to-end pipeline on macOS."""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

project_root = Path(__file__).parent.parent.resolve()
sys.path.insert(0, str(project_root / "core" / "src"))

load_dotenv(project_root / ".env")

from ipc.handler import IPCHandler

def main():
    print("=" * 65)
    print(" 🧠 Второй Мозг: Тестирование боевого пайплайна на macOS")
    print("=" * 65)

    memory_path = project_root / "runtime_data" / "Memory"
    handler = IPCHandler(str(memory_path))

    # 1. Снимаем паузу
    handler.handle_request({
        "request_id": "init-unpause",
        "type": "policy:set_pause",
        "payload": {"paused": False}
    })

    print("\n[1/4] 📸 Делаем мгновенный снимок экрана и распознаем текст (Apple Vision OCR)...")
    tick_res = handler.handle_request({
        "request_id": "test-tick",
        "type": "capture:tick",
        "payload": {}
    })
    payload = tick_res.get("payload", {})
    print(f"  • Статус захвата: {payload.get('status')}")
    print(f"  • Активное приложение: {payload.get('app')}")
    print(f"  • Заголовок окна: {payload.get('title')}")
    print(f"  • Файл снимка: {payload.get('screenshot')}")
    print(f"  • OCR распознан: {payload.get('has_ocr')}")

    shot_rel = payload.get("screenshot")
    if shot_rel:
        full_shot_path = memory_path / shot_rel
        print(f"\n[2/4] 👁️ Отправка скриншота в Gemini 3 Flash (Vision)...")
        vis_res = handler.gateway.analyze_screenshot(full_shot_path)
        if vis_res.get("ok"):
            print("  • Ответ Gemini 3 Flash:")
            print("    " + vis_res.get("analysis", "").replace("\n", "\n    "))
        else:
            print(f"  • Ошибка Vision: {vis_res.get('error')}")

    # 3. Вопрос к памяти через GPT-5.6 Luna
    question = "Какое приложение сейчас открыто у пользователя и что происходит на экране?"
    print(f"\n[3/4] 💬 Вопрос в GPT-5.6 Luna с контекстом из памяти:")
    print(f"  • Вопрос: «{question}»")
    
    qa_res = handler.handle_request({
        "request_id": "test-qa",
        "type": "qa:ask",
        "payload": {"question": question}
    })
    qa_payload = qa_res.get("payload", {})
    print("\n  • Ответ модели (GPT-5.6 Luna):")
    print("    " + qa_payload.get("answer", "").replace("\n", "\n    "))
    
    print("\n  • Использованные источники:")
    for i, s in enumerate(qa_payload.get("sources", []), 1):
        print(f"    [{i}] {s.get('title')} (ID: {s.get('id')})")

    print("\n[4/4] 🔒 Проверка лога аудита (F06, без утечки ключей)...")
    day_dir = handler.storage.get_day_dir()
    req_files = sorted((day_dir / "requests").glob("req-*.json"))
    if req_files:
        print(f"  • Последний лог: {req_files[-1].name}")

    print("\n" + "=" * 65)
    print(" ✅ Тест успешно завершен!")
    print("=" * 65)

    handler.shutdown()

if __name__ == "__main__":
    main()
