# Второй мозг для офисного сотрудника

Десктопный помощник для macOS и Windows, который связывает рабочие документы, страницы, обсуждения и действия в память о задачах. Помогает вспомнить, на чём остановилась работа, найти источник информации и вовремя вернуться к договорённостям.

## M1: локальное приложение macOS

Реализованы семь вкладок с настоящей памятью, CRUD задач и заметок, поиск FTS, сортировки/фильтры и страницы, настройки моделей, просмотр источников и конфликтов, диагностика и устойчивый Python bridge. Демонстрационные данные и тихая подмена backend удалены. Сбор экрана в M1 выключен; интеграции/OCR входят в M2–M3.

**Проверено в Linux:** 30 Python-тестов и 17 frontend/bridge-тестов, typecheck, renderer/Electron build. UI-интеграционные тесты вызывают реальный Python через bridge; это не проверка самого Electron окна. **Приёмка M1 на macOS ещё не выполнена.** Для неё подготовлен `npm run test:native` и Mac-стадия CI; без их фактического результата M1 не объявляется принятым.

- [Milestone и границы готовности](docs/delivery/MILESTONES.md)
- [Исходное ревью](docs/delivery/REVIEW.md) и [текущий отчёт реализации](docs/delivery/reports/2026-10-25-M1-implementation.md)
- [Задачи и статус](docs/delivery/BACKLOG.md)
- [Сценарии приёмки](docs/delivery/TESTING.md) и [регламент Antigravity](docs/delivery/ANTIGRAVITY.md)

## Установка и запуск

Требуются Python 3.12 и Node 24 (см. `.python-version`, `.nvmrc`). Из корня checkout:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r core/requirements.txt
cd desktop
npm ci
# Если npm отключает lifecycle scripts и Electron binary отсутствует:
node node_modules/electron/install.js
npm start
```

На macOS ключи хранятся в Keychain. Пустое поле при сохранении настроек оставляет существующий ключ; удаление — отдельная кнопка. Старая SQLite credential переносится только после успешной записи и проверки Keychain. При отказе доступа исходное значение сохраняется для повторной миграции; резервные копии SQLite могут содержать старые ключи. На других ОС новые ключи живут только до завершения процесса. Без ключа «Чат» явно работает как локальный поиск.

Память: существующий `runtime_data/Memory` сохраняется и используется, если найден; иначе Electron использует свой `userData/Memory`. `SECOND_BRAIN_MEMORY_ROOT` и `SECOND_BRAIN_USER_DATA` задают отдельные каталоги для проверок. Не направляйте тесты в личную память. Удаление документа убирает его из памяти и поиска, предыдущая версия остаётся в `.system/versions` для восстановления.

Все проверки в облаке:

```bash
bash scripts/verify.sh
```

Реальная проверка окна/preload/bridge/перезапуска/Keychain на Mac:

```bash
cd desktop
npm run test:native
```

Этот smoke использует временные Memory/userData; фактические результаты фиксируются в `docs/delivery/reports`. `npm run dev` предназначен для разработки renderer: без Electron он честно показывает отсутствие ядра, не подставляет выдуманные данные.

Для форматирования Python: установить `core/requirements-dev.txt` и использовать Black. Для TypeScript: `cd desktop && npm run format`; `npm run format:check` проверяет формат без изменений.

## Структура репозитория

```text
├── docs/                 # Архитектура, ТЗ, хранилище, интеграции, план реализации
├── core/                 # Бэкенд-ядро на Python
│   ├── src/
│   │   ├── memory/       # Файловая память, парсер Markdown/YAML, версионирование, конфликты
│   │   ├── index/        # SQLite FTS5 индекс, BM25 поиск, переиндексация из файлов
│   │   ├── watcher/      # Наблюдатель watchdog с дебаунсом и стабилизацией внешних правок
│   │   ├── policy/       # Исключения приложений/доменов, пауза, режимы приватности
│   │   ├── gateway/      # Клиент OpenAI / LM Studio с журналом аудита запросов
│   │   ├── suggestions/  # 8 инициативных сценариев (P01–P08)
│   │   ├── adapters/     # Системные адаптеры окон и контекста
│   │   └── ipc/          # Протокол JSON RPC stdin/stdout для Electron
│   ├── tests/            # Набор автоматических тестов (pytest)
│   └── requirements.txt
├── desktop/              # Десктопное приложение Electron + React + TypeScript
│   ├── electron/         # Main процесс, трей, системное меню, мост к Python
│   ├── src/
│   │   ├── sections/     # 5 разделов: Сегодня, Спросить, История, Задачи, Настройки
│   │   ├── components/   # Шапка со статусом паузы/конфликтов, навигационный сайдбар
│   │   └── types/        # TypeScript контракты и API
│   ├── tests/           # Renderer → реальный Python, IPC lifecycle, сортировки
│   └── package.json
└── README.md
```

## Документация

| Документ | Назначение |
| --- | --- |
| [Техническое задание](docs/SPECIFICATION.md) | Сценарии, требования и критерии приёмки |
| [Файловое хранилище](docs/STORAGE.md) | Согласованные Markdown/JSON, папки по датам и восстановление поиска |
| [Внешние правки](docs/EXTERNAL_EDITS.md) | Подхват изменений, ревизии, конфликты и приёмка |
| [Архитектура](docs/ARCHITECTURE.md) | Компоненты, потоки данных, хранение и поиск |
| [План реализации](docs/IMPLEMENTATION_PLAN.md) | Этапы, зависимости, роли и проверки |
| [Подключение источников](docs/INTEGRATIONS.md) | Способы доступа, ограничения и подтверждающие документы |
| [Концепция](docs/CONCEPT.md) | Идея и принятые продуктовые решения |
| [Функции](docs/FEATURES.md) | Подробности возможностей и предложения |
| [OCR и обезличивание](docs/PROCESSING_RESEARCH.md) | LM Studio, OCR, Unstructured, Presidio, NeuralDeep |
| [Журнал обсуждения](docs/DISCOVERY_LOG.md) | История решений и точные ответы пользователя |
