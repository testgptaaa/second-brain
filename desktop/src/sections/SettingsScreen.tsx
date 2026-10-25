import React, { useEffect, useState } from "react";
import { ModelConfig, PolicyStatus } from "../types/api";
export const SettingsScreen = ({
  request,
  onRefresh,
  modelConfig,
  policy,
}: {
  request: (type: string, payload?: any) => Promise<any>;
  onRefresh: () => Promise<void>;
  modelConfig: ModelConfig | null;
  policy: PolicyStatus | null;
}) => {
  const [draft, setDraft] = useState<ModelConfig | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const [diagnostics, setDiagnostics] = useState<any>(null),
    [exclusion, setExclusion] = useState(""),
    [kind, setKind] = useState("app");
  useEffect(() => {
    if (modelConfig && !draft)
      setDraft({ ...modelConfig, api_key: "", nd_api_key: "" });
  }, [modelConfig, draft]);
  const run = async (type: string, payload: any = {}) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await request(type, payload);
      setNotice(
        result.ok === false
          ? `Ошибка: ${result.error || result.status_code}`
          : "Операция выполнена",
      );
      await onRefresh();
      return result;
    } catch (e) {
      setError(String(e));
      return null;
    } finally {
      setBusy(false);
    }
  };
  return (
    <section>
      <h2>Настройки</h2>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <article className="card-box">
        <h3>Модели и ключи</h3>
        <p>{modelConfig?.credential_status}</p>
        <p>
          Пустое поле ключа оставляет существующий ключ. Удаление выполняется
          отдельным действием.
        </p>
        {!draft ? (
          <p>Настройки загружаются</p>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (await run("model:update_config", draft))
                setDraft({ ...draft, api_key: "", nd_api_key: "" });
            }}
          >
            {(
              [
                ["base_url", "URL LLM"],
                ["text_model", "Текстовая модель"],
                ["vision_model", "Vision модель"],
                ["nd_endpoint", "URL NeuralDeep"],
              ] as const
            ).map(([field, label]) => (
              <label key={field}>
                {label}
                <input
                  className="form-input-field"
                  required
                  value={draft[field] || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, [field]: e.target.value })
                  }
                />
              </label>
            ))}
            <label>
              Новый ключ LLM (сейчас{" "}
              {modelConfig?.has_api_key ? "задан" : "не задан"})
              <input
                className="form-input-field"
                type="password"
                autoComplete="off"
                value={draft.api_key}
                onChange={(e) =>
                  setDraft({ ...draft, api_key: e.target.value })
                }
              />
            </label>
            <label>
              Новый ключ NeuralDeep (сейчас{" "}
              {modelConfig?.has_nd_api_key ? "задан" : "не задан"})
              <input
                className="form-input-field"
                type="password"
                autoComplete="off"
                value={draft.nd_api_key || ""}
                onChange={(e) =>
                  setDraft({ ...draft, nd_api_key: e.target.value })
                }
              />
            </label>
            <button disabled={busy}>Сохранить настройки</button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm("Удалить ключ LLM?"))
                  void run("model:update_config", { clear_api_key: true });
              }}
            >
              Удалить ключ LLM
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm("Удалить ключ NeuralDeep?"))
                  void run("model:update_config", { clear_nd_api_key: true });
              }}
            >
              Удалить ключ NeuralDeep
            </button>
            <p>
              Проверки соединения используют сохранённые настройки и отправляют
              только тестовый запрос.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void run("model:test_connection")}
            >
              Проверить LLM
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void run("model:test_neuraldeep")}
            >
              Проверить NeuralDeep
            </button>
          </form>
        )}
      </article>
      <article className="card-box">
        <h3>Наблюдение и приватность</h3>
        <p>
          В M1 захват экрана выключен. Приёмка разрешений и OCR относится к M2.
        </p>
        <p>
          Согласие: {policy?.capture_consent ? "дано" : "не дано"}. Пауза:{" "}
          {policy?.is_paused ? "да" : "нет"}.
        </p>
        <button
          disabled={busy}
          onClick={() => void run("policy:set_consent", { enabled: false })}
        >
          Отозвать согласие и остановить сбор
        </button>
        <label>
          Обработка текста
          <select
            value={policy?.privacy_mode || "raw"}
            onChange={(e) =>
              void run("policy:set_privacy_mode", { mode: e.target.value })
            }
          >
            <option value="raw">Исходный текст</option>
            <option value="pseudonymize">Псевдонимизация</option>
          </select>
        </label>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              exclusion.trim() &&
              (await run("policy:add_exclusion", { [kind]: exclusion.trim() }))
            )
              setExclusion("");
          }}
        >
          <label>
            Исключение
            <input
              value={exclusion}
              onChange={(e) => setExclusion(e.target.value)}
            />
          </label>
          <select
            aria-label="Тип исключения"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="app">Приложение</option>
            <option value="domain">Домен</option>
          </select>
          <button disabled={busy || !exclusion.trim()}>
            Добавить исключение
          </button>
        </form>
        {(["app", "domain"] as const).map((type) => (
          <ul key={type}>
            {(type === "app"
              ? policy?.excluded_apps
              : policy?.excluded_domains
            )?.map((value) => (
              <li key={value}>
                {value}{" "}
                <button
                  disabled={busy}
                  onClick={() =>
                    void run("policy:remove_exclusion", { [type]: value })
                  }
                >
                  Удалить исключение
                </button>
              </li>
            ))}
          </ul>
        ))}
      </article>
      <article className="card-box">
        <h3>Память и диагностика</h3>
        <button disabled={busy} onClick={() => void run("app:open_logs")}>
          Открыть журналы Electron
        </button>
        <button
          disabled={busy}
          onClick={async () => {
            const r = await run("diagnostics:status");
            if (r) setDiagnostics(r);
          }}
        >
          Показать диагностику
        </button>
        <button disabled={busy} onClick={() => void run("storage:sync")}>
          Перестроить индекс
        </button>
        <button
          disabled={busy}
          onClick={() => {
            if (
              window.confirm(
                "Удалить временные снимки экрана? Текстовая память сохранится.",
              )
            )
              void run("storage:clean_snapshots");
          }}
        >
          Очистить снимки
        </button>
        {diagnostics && (
          <dl>
            {Object.entries(diagnostics).map(([k, v]) => (
              <React.Fragment key={k}>
                <dt>{k}</dt>
                <dd>{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd>
              </React.Fragment>
            ))}
          </dl>
        )}
        {diagnostics?.legacy_credentials && (
          <p role="alert">
            Остались ключи в старой SQLite. Для миграции нужен доступ к Keychain
            на Mac. Резервные копии SQLite также могут содержать старые ключи.
          </p>
        )}
      </article>
    </section>
  );
};
