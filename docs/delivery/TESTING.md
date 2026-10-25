# Проверки и доказательства готовности M1

Статус: реализация M1 подготовлена; 30 Python-тестов и 17 Vitest-проверок проходят. Полные AC-01–AC-12 на реальном Mac остаются обязательными. Точные доказательства и ограничения — [в итоговом отчёте](reports/2026-10-25-M1-implementation.md); исходный аудит сохранён отдельно в REVIEW.

## Выполняемые команды

Из корня checkout (Python 3.12, Node 24):

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r core/requirements.txt
cd desktop
npm ci
cd ..
bash scripts/verify.sh
```

`verify.sh` запускает pytest, TypeScript typecheck, Vitest и обе сборки. Vitest включает реальный Python subprocess/bridge и renderer-интеграции с временной памятью. Он не доказывает работу Electron main/preload/window. Исправление CSS types уже внесено; дополнительные CLI-флаги для typecheck не требуются.

На Mac выполнить отдельно:

```bash
cd desktop
# Только если binary отсутствует:
node node_modules/electron/install.js
npm run test:native
```

`test:native` реализован в `desktop/tests/native-smoke.mjs` и подключён к macOS CI; в текущей Linux-сессии он не исполнялся. Он проверяет настоящее окно/preload/bridge, перезапуск с сохранённой заметкой, FTS, consent=false, три размера окна и Keychain set/restart/delete. После smoke обязательна ручная часть AC, включая tray/клавиатуру. Не записывать отчёт DONE до реального прогона.

`npm run dev` отдаёт renderer без мнимого backend; при отсутствии Electron видна ошибка подключения. HTTP 200 не является функциональной приёмкой. Для проверки UI в headless Linux используется `npm test`.

## Изолированные данные

Для каждого тестового прогона создать отдельный каталог памяти и отдельный Electron userData (поддерживаемый override добавить в SB-13). Никогда не использовать личный Memory. Начинать с пустой памяти и consent=false; synthetic fixture генерировать через поддерживаемый storage/API, не обходя проверяемое поведение.

Фиксировать clock для автоматических тестов: `2026-10-25T12:00:00+03:00`, TZ Europe/Moscow; отдельный timezone case UTC и America/Los_Angeles. Календарный due_date `YYYY-MM-DD` не сдвигается при смене TZ. Clock/данные теста не должны зависеть от текущего дня запуска.

Контрольный набор:

- 51 задача для проверки границ страниц по 20; все пять статусов; 3 overdue, 3 due today, 3 future, 3 без срока; одинаковые created_at, названия и due; один отменённый и один завершённый элемент каждого случая. Фиксированные ID и ожидаемый полный порядок фиксировать в fixture.
- 6 заметок минимум: сегодня и вчера, одинаковые заголовки, кириллица/латиница, теги с разным регистром, multiline Markdown, очень длинное название, пустое тело; одна HTML-строка `<img src=x onerror="window.__injected=true">`. Объект window.__injected после показа отсутствует.
- 4 записи источников: локальный доступный файл внутри тестового корня, отсутствующий файл, HTTPS URL, запрещённая схема. Проверить JSON метаданные отдельно от оригинального документа.
- Два дня истории с известными timestamps и фиксированными событиями. Ответы первого/второго запроса уметь вернуть в обратном порядке.
- Один управляемый конфликт внешней правки; обе версии известны. Два синтетических secret marker; ни один не должен оказаться в SQLite после миграции/в журнале/отчёте. Для реального Keychain использовать отдельный тестовый namespace.

## Приёмочные сценарии

| ID | Шаги | Ожидаемый результат | Уровень и задача |
| --- | --- | --- | --- |
| AC-01 | Чистая установка → pytest → typecheck → build → повторная установка | Ненулевое число тестов; все проверки успешны; manifest/lock без случайных изменений | cloud/CI, SB-01/13 |
| AC-02 | Пустая память → последовательно открыть 7 вкладок; повторить с fixture и ошибкой одного endpoint | Пустые состояния честные; нет демонстрационных встреч/файлов; соседние вкладки работают; ошибка видна и retry действует | UI components + Mac, SB-07/11 |
| AC-03 | Missing Python → запуск; затем ready → зависший запрос → crash → повторный запуск; отдельно зависший LLM + pause | Нет вечных обещаний/spinner; ожидаемые error codes; pending очищается; pause работает в пределах лимита; запись не ретраится автоматически | bridge/subprocess + Mac, SB-02/05/07 |
| AC-04 | Синтетический ключ → читать settings → сменить только модель → restart; replace/delete key; отказ Keychain; TLS недоверенный/доверенный | Ключ сохранён при patch; явно заменён/удалён по действию; маска не сохранена; TLS не обходится; секретов в SQLite/логах нет | contract + Mac Keychain, SB-03 |
| AC-05 | Fresh install → ждать ticks → restart → попытка capture RPC без consent; pause/resume после явного разрешения | Ноль capture/network до согласия; UI/tray/backend согласованы; отказ permissions не превращается в успех | unit spies + Mac, SB-04 |
| AC-06 | Новая заметка → edit → другая вкладка → restart → edit вчерашней → delete/cancel delete | Один ID и файл после edit; created_at неизменен; список/поиск актуальны; cancel ничего не удаляет; delete не оставляет FTS | storage + UI + Mac, SB-06/08 |
| AC-07 | Создать задачу → пять статусов → edit description/title → clear due → restart → delete | Все статусы доступны; patch не сбрасывает другие поля; due действительно null; карточка и disk совпадают | core + UI + Mac, SB-06/09 |
| AC-08 | Files → поиск → открыть материал → чат с переданным вопросом; quick prompt с dashboard; сохранить форму при отказе | Правильный query не теряется; история чата сохраняется; нет false success при domain conflict; двойной submit не дублирует | UI/transport + Mac, SB-07/10 |
| AC-09 | Fixture 51 task → каждый sort ↑↓ → filter → следующие страницы → сменить вкладку → вернуться | Порядок совпадает с oracle по всему набору; id tie-break; null last; нет пропусков/дублей страниц; настройки списка сохранены | query unit + UI, SB-09/12 |
| AC-10 | Внешний edit/atomic save/rename/delete → поиск → sync дважды → restart; conflict → разрешение; HTML snippet; forbidden path/URL | Нет stale records; настройки сохранены; обе конфликтные версии доступны; HTML инертен; небезопасное открытие отклонено | storage/watcher + renderer + Mac, SB-06/10/11 |
| AC-11 | Успешный RPC и failing RPC → посмотреть operational logs → rotation → readonly log dir | Есть session/request correlation и длительность; stdout JSON; нет secret/content markers; ошибка логирования не ломает RPC | automated + Mac diagnostics, SB-02/13 |
| AC-12 | Полный сценарий на Mac: создать note/task → поиск/источник → history → sort → settings → quit/reopen → повтор; три размера окна, клавиатура | Реальный bridge и сохранность доказаны; нет необработанных ошибок; все действия доступны; протокол с ОС/архитектурой и evidence | обязательная Mac acceptance, SB-14 |

## Как проверять сортировки

В oracle хранить ожидаемые ID, а не повторять реализацию comparator в тесте. Проверять перестановку всех записей, стабильность границ страниц и null policy. Название сортируется по явно выбранному ru collation; если SQLite и JS расходятся, контракт должен иметь один источник порядка. Не сортировать только видимую страницу. Для каждого фильтра проверить пустой результат и reset. Для due_today/overdue проверить локальную полночь и DST timezone отдельно.

## Критерии завершения

Тест обязан проверять поведение и падать при исходном дефекте. Не отключать assertions, TLS или провалившийся тест. Не заменять сценарий restart проверкой React state. Test runner exit code сохраняется, отчёт принадлежит текущему commit/прогону. Для watcher/async использовать deadline polling вместо случайных долгих sleep. Expected-failure, skipped, disabled, unrun и passed — разные результаты.

После изменения — проверки карточки + pytest/build/typecheck. Перед M1 — полный AC-01–AC-12 и ревью открытых P0/P1. Если в Linux всё зелёное, а Mac не проверен, это частичная валидация, M1 остаётся непринимаемым. Реальные provider calls и системный OCR не подменяются mocked transport; это M2.

## Шаблон отчёта

Сохранять `docs/delivery/reports/YYYY-MM-DD-SB-XX.md` (создать каталог при первом реальном отчёте):

```markdown
# SB-XX — название
Статус: DONE / BLOCKED / IN_PROGRESS
Commit/base и dirty diff: ...
Дата, ОС/архитектура, Python/Node/Electron: ...
Memory/userData: временные каталоги, без личных данных

## Воспроизведение до исправления
Шаги, ожидаемое/фактическое, failing test/evidence.

## Изменения
Что изменено и почему; затронутые контракты и миграция.

## Проверки
| Команда/AC | Exit code | Passed/failed/skipped/unrun | Evidence |
| --- | --- | --- | --- |

## Ревью diff
Ошибки/конфликты, restart, secrets, пути, сортировки, состояние UI.

## Ограничения и следующий шаг
Точная причина BLOCKED; что требуется и какие независимые проверки выполнены.
```

В evidence не вставлять ключи, личные документы и дампы окружения. Скриншот подтверждает отображение; сохранность доказывают чтение через API/с диска и перезапуск. Отчёт не создаётся заранее как будто работа уже выполнена.
