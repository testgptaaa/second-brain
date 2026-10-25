# M1 — реализация и результаты проверки

Дата: 2026-10-25. Статус: **реализация подготовлена, облачные проверки пройдены, приёмка macOS BLOCKED**. Причина: доступная машина — Linux без macOS/Keychain/GUI; Mac runner в этой сессии не запускался. Это не полный акт приёмки M1.

База: `6935ec4a351b246160a75e4cc4c0c0328fb921a4`; изменения в рабочем checkout, без commit/push. Изначальные изменения README и плана сохранены и дополнены. Проверки используют временную память, а не пользовательские данные.

## Реализованный результат

- Семь вкладок работают через настоящий IPC. Silent mock и sample data удалены; browser без Electron честно сообщает об отсутствии ядра. Неиспользуемые старые Ask/Today/Tasks/History/SettingsSection удалены после проверки отсутствия импортов.
- Задачи: полные формы названия/описания/срока/статуса, пять статусов, удаление с подтверждением, список/канбан, активные/просроченные/статус, поиск, дата, сортировка и страницы по 20.
- Заметки: настоящий список, создание/редактирование/удаление, поиск по названию/тегам, сортировки, даты, страницы; edit не создаёт копию. Черновик сохраняется при смене вкладки; перед его заменой/закрытием приложения есть предупреждение.
- Файлы: каталог существующих source records, тип/запрос/даты/сортировка/страницы и детали. JSON источника не выдаётся за оригинальный Excel/PDF. Импорт — M3.
- История: реальные notes и episodes, выбор дня, фильтры и порядок; запоздавший ответ старого дня не заменяет новый. Чтение дня больше не создаёт пустые каталоги памяти.
- Dashboard: только вычисленные показатели задач/памяти; отсутствующий календарь обозначен как неподключённый. Quick prompt и новая задача передают нужное действие.
- Чат: локальный поиск явно обозначен без LLM; безопасные текстовые snippets; просмотр реального Markdown/JSON источника внутри приложения; ошибки возвращают введённый вопрос. История чата сохраняется при навигации. Добавлен расширенный FTS-поиск с типом/датами, BM25 или updated и серверной пагинацией. Импорт файлов явно недоступен.
- Единый locale-aware порядок, детерминированный ID tie-break, null/invalid dates last; task due ties — created DESC. Порядок применяется ко всему набору до страницы; FTS — SQL ORDER BY до LIMIT/OFFSET с allowlist. Выбор вкладки и настроек списков хранится в localStorage без содержимого заметок/ключей.
- TLS verification восстановлена; настройки URL допускают HTTPS и loopback HTTP, без embedded credentials. Ключи не возвращаются из DTO и не сохраняются в новых SQLite rows. macOS Keychain adapter проверяет запись перед миграцией legacy SQLite; отказ сохраняет recoverable legacy. Linux хранит новые ключи только в процессе. Replace/keep/delete различаются; audit ошибок и operational logs не содержат текста заметок/ключей.
- Backend capture запрещён без согласия; автоматический ticker полностью выключен в M1. Отзыв согласия сохраняется. Нативный OCR/permissions/live LLM не включены в приёмку M1.
- Файловая память: UUID новых note/task, вчерашняя заметка сохраняет ID/путь/created_at; delete убирает FTS; sync идемпотентен и очищает stale rows; watcher обрабатывает delete/move, ошибки не убивают worker молча. Сохраняется snapshot последней индексированной версии для внешних правок.
- Optimistic concurrency проверяет revision/body hash и полный file hash: даже внешняя правка только YAML-заголовка обнаруживается. Конфликты можно сравнить и явно разрешить; предыдущая версия и конфликтные файлы сохраняются. Пути/symlink за пределы memory root отвергаются.
- Bridge: startup handshake 15 s; локальный RPC 10 s, долгий 45 s; обработка spawn/pipe/exit/late response, очистка pending, ограниченное graceful shutdown с SIGKILL deadline 2 s. Долгие Python-команды вынесены в worker с очередью максимум 2, pause/health отвечают независимо; stdout сериализован одним lock.
- Диагностика: rotating JSONL Python и Electron, correlation request_id, duration, error code и sanitized traceback frames. Нет payload/Authorization/текста памяти. При недоступном log directory приложение продолжает работу. Settings показывает состояние, каталоги и последнюю ошибку, умеет открыть Electron logs.
- Версии Python/Node, стандартные verify/typecheck/test/format, Linux+macOS CI и native smoke. Внешние переходы Electron запрещены; навигация доступна кнопками с focus styles.

## Результаты в текущей машине

| Проверка | Результат |
| --- | --- |
| `bash scripts/verify.sh` / Python часть | **30 passed**, exit 0 |
| `cd desktop && npm run verify` / Vitest | **17 passed**, 5 файлов, exit 0 |
| TypeScript typecheck | passed, exit 0 |
| Vite renderer + Electron TypeScript build | passed, exit 0 |
| `git diff --check` | passed |
| Синтаксис native-smoke.mjs | passed; это не выполнение smoke |
| GitHub CI | UNRUN: workflow добавлен, удалённый запуск не выполнялся |
| `npm run test:native` на Mac | UNRUN / BLOCKED: macOS отсутствует |

Python: 3.12.14; Node: 24.19.0. Набор Python вырос с 11 до 30, frontend/bridge — с 0 до 17. Исходные тесты сохранены. Первоначальные новые тесты обнаруживали поломки; после исправлений пройдены. Для канонизации Markdown уточнены ожидания конечного newline; для oracle сортировки исправлен пропущенный элемент контрольного набора, assertions не отключались.

## Доказательства по карточкам

| Карточки | Автоматическое доказательство | Что требует Mac |
| --- | --- | --- |
| SB-01 | verify/typecheck/build; CI yaml; версии | установка binary/реальный запуск |
| SB-02 | diagnostics.test.ts, operational log regression | открытие журнала из Electron |
| SB-03 | DTO roundtrip/delete, миграция/failure fake Keychain, TLS check, settings UI | настоящий Keychain, TLS с корпоративным CA при наличии |
| SB-04 | consent spy, real backend UI policy false | отсутствие захвата на реальном устройстве |
| SB-05 | bridge.test.ts: real restart/spawn/timeout/pending; slow RPC/queue regression | native lifecycle и tray |
| SB-06 | regressions: stale/delete/rebuild/metadata-only edit/path escape/conflict/search pages | внешнее редактирование реальным редактором |
| SB-07–11 | app.test.tsx: реальный Python, notes/tasks CRUD, settings, источники, изолированный endpoint failure, сохранение черновика; history.test.tsx: reverse responses | клики/клавиатура/геометрия реального окна |
| SB-12 | list.test.ts: 51 запись, ru/ties/null/invalid/TZ; FTS 51 записей SQL pages/date/type | удобство управления на трёх размерах окна |
| SB-13 | все suites запущены; assertions/exit codes сохранены | Mac-стадия CI |
| SB-14 | сценарий native-smoke.mjs подготовлен | фактический отчёт AC-01–AC-12 на Mac |

## Обязательный следующий шаг

На Mac, из корня checkout: создать `.venv`, установить `core/requirements.txt`, выполнить `bash scripts/verify.sh`; затем из `desktop` установить Electron binary, если отсутствует, и выполнить `npm run test:native`. Smoke запускает реальный Electron/preload/Python, проверяет persistence/FTS/consent, размеры 1440×900/1024×768/800×600 и Keychain set/restart/delete. Используются отдельные temporary memory/userData. Завершить ручную проверку tray, клавиатуры и сценариев AC-01–AC-12, сохранить отчёт с версией macOS/архитектурой и evidence. Только после него SB-14/M1 переводятся в DONE.

Никакие реальные credentials/live provider calls не требуются для локальной приёмки; они относятся к M2. На Mac доступ к Keychain должен быть разрешён стандартным механизмом ОС. Резервные SQLite-файлы старых версий могут содержать прежние секреты: автоматическое стирание копий не выполняется. Удаление документа сохраняет восстановительную версию в `.system/versions` — это не secure erase.
