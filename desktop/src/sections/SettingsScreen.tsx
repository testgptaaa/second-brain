import React, { useState } from "react";
import {
  Cpu,
  Shield,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Plus,
  X,
  Lock,
} from "lucide-react";
import { PolicyStatus, ModelConfig } from "../types/api";

interface SettingsScreenProps {
  policy: PolicyStatus | null;
  modelConfig: ModelConfig | null;
  onUpdateModelConfig: (cfg: ModelConfig) => Promise<void>;
  onTestModelConnection: () => Promise<any>;
  onAddExclusion: (type: "app" | "domain", value: string) => Promise<void>;
  onRemoveExclusion: (type: "app" | "domain", value: string) => Promise<void>;
  onSetPrivacyMode: (mode: "raw" | "pseudonymize") => Promise<void>;
  onRebuildIndex: () => Promise<number>;
  captureInterval?: number;
  onUpdateCaptureInterval?: (sec: number) => Promise<void>;
  onCleanSnapshots?: () => Promise<{ deleted_count: number; freed_mb: number }>;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  policy,
  modelConfig,
  onUpdateModelConfig,
  onTestModelConnection,
  onAddExclusion,
  onRemoveExclusion,
  onSetPrivacyMode,
  onRebuildIndex,
  captureInterval = 15,
  onUpdateCaptureInterval,
  onCleanSnapshots,
}) => {
  const [baseUrl, setBaseUrl] = useState(modelConfig?.base_url || "http://localhost:1234/v1");
  const [apiKey, setApiKey] = useState(modelConfig?.api_key || "");
  const [modelName, setModelName] = useState(modelConfig?.model_name || "local-model");
  const [intervalSec, setIntervalSec] = useState<number>(captureInterval);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [newApp, setNewApp] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [reindexing, setReindexing] = useState(false);
  const [reindexMsg, setReindexMsg] = useState<string | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [cleanMsg, setCleanMsg] = useState<string | null>(null);

  const handleSaveModel = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateModelConfig({ base_url: baseUrl, api_key: apiKey, model_name: modelName });
    alert("Настройки модели успешно сохранены!");
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await onTestModelConnection();
      setTestResult(res);
    } catch (e: any) {
      setTestResult({ ok: false, error: e.message || String(e) });
    } finally {
      setTesting(false);
    }
  };

  const handleReindex = async () => {
    setReindexing(true);
    setReindexMsg(null);
    try {
      const count = await onRebuildIndex();
      setReindexMsg(`Успешно переиндексировано документов: ${count}`);
    } catch (e: any) {
      setReindexMsg(`Ошибка: ${e.message || e}`);
    } finally {
      setReindexing(false);
    }
  };

  return (
    <div style={{ maxWidth: 760 }}>
      {/* Block 1: Model Gateway */}
      <div className="card-box" style={{ marginBottom: 20 }}>
        <div className="card-title-row">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Cpu size={18} color="var(--primary)" />
            <span className="card-heading">Подключение модели (OpenAI API / LM Studio)</span>
          </div>
        </div>

        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
          Для локальной модели запустите LM Studio и укажите <code>http://localhost:1234/v1</code>. Ключ API для LM Studio не требуется.
        </p>

        <form onSubmit={handleSaveModel}>
          <div className="form-group-block">
            <label className="form-label-title">Base URL (Адрес эндпоинта)</label>
            <input
              type="text"
              className="form-input-field"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="http://localhost:1234/v1"
              required
            />
          </div>

          <div className="form-group-block">
            <label className="form-label-title">Имя модели</label>
            <input
              type="text"
              className="form-input-field"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="local-model или gpt-4o"
              required
            />
          </div>

          <div className="form-group-block">
            <label className="form-label-title">Ключ API (необязательно для локальных серверов)</label>
            <input
              type="password"
              className="form-input-field"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
            />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button type="submit" className="btn-primary-action">
              Сохранить параметры
            </button>
            <button
              type="button"
              className="btn-secondary-action"
              onClick={handleTest}
              disabled={testing}
            >
              {testing ? "Тестирую..." : "Тест соединения (Пинг)"}
            </button>
          </div>
        </form>

        {testResult && (
          <div
            style={{
              marginTop: 14,
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)",
              fontSize: 13,
              background: testResult.ok ? "#ecfdf5" : "#fef2f2",
              border: `1px solid ${testResult.ok ? "#a7f3d0" : "#fecaca"}`,
              color: testResult.ok ? "#065f46" : "#991b1b",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {testResult.ok ? (
              <>
                <CheckCircle2 size={16} />
                <span>
                  Соединение успешно! Задержка: <b>{testResult.latency_ms} мс</b>. Ответ модели: «{testResult.reply}»
                </span>
              </>
            ) : (
              <>
                <AlertCircle size={16} />
                <span>Ошибка подключения: {testResult.error}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Block 2: Exclusions */}
      <div className="card-box" style={{ marginBottom: 20 }}>
        <div className="card-title-row">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Shield size={18} color="var(--success)" />
            <span className="card-heading">Исключения (Приложения и Сайты)</span>
          </div>
        </div>

        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
          Данные из этих источников гарантированно не читаются, не сохраняются и не передаются в модель.
        </p>

        {/* Excluded Apps */}
        <div className="form-group-block">
          <label className="form-label-title">Исключённые приложения</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              className="form-input-field"
              placeholder="Например: 1Password, Telegram"
              value={newApp}
              onChange={(e) => setNewApp(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (newApp.trim()) {
                    onAddExclusion("app", newApp.trim());
                    setNewApp("");
                  }
                }
              }}
            />
            <button
              type="button"
              className="btn-secondary-action"
              onClick={() => {
                if (newApp.trim()) {
                  onAddExclusion("app", newApp.trim());
                  setNewApp("");
                }
              }}
            >
              Добавить
            </button>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            {policy?.excluded_apps?.map((app) => (
              <span
                key={app}
                style={{
                  background: "#f1f5f9",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-full)",
                  padding: "4px 10px",
                  fontSize: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>{app}</span>
                <X
                  size={12}
                  style={{ cursor: "pointer", color: "var(--danger)" }}
                  onClick={() => onRemoveExclusion("app", app)}
                />
              </span>
            ))}
          </div>
        </div>

        {/* Excluded Domains */}
        <div className="form-group-block" style={{ marginTop: 14 }}>
          <label className="form-label-title">Исключённые веб-домены</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              className="form-input-field"
              placeholder="Например: sberbank.ru, accounts.google.com"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (newDomain.trim()) {
                    onAddExclusion("domain", newDomain.trim());
                    setNewDomain("");
                  }
                }
              }}
            />
            <button
              type="button"
              className="btn-secondary-action"
              onClick={() => {
                if (newDomain.trim()) {
                  onAddExclusion("domain", newDomain.trim());
                  setNewDomain("");
                }
              }}
            >
              Добавить
            </button>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            {policy?.excluded_domains?.map((dom) => (
              <span
                key={dom}
                style={{
                  background: "#f1f5f9",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-full)",
                  padding: "4px 10px",
                  fontSize: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>{dom}</span>
                <X
                  size={12}
                  style={{ cursor: "pointer", color: "var(--danger)" }}
                  onClick={() => onRemoveExclusion("domain", dom)}
                />
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Block 3: Screenshot Capture & Retention (F06) */}
      <div className="card-box" style={{ marginBottom: 20 }}>
        <div className="card-title-row">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Cpu size={18} color="var(--primary)" />
            <span className="card-heading">Снимки экрана и OCR</span>
          </div>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
          Снимки экрана делаются автоматически с заданным интервалом и при смене окон. Нативный OCR (Apple Vision) распознаёт текст прямо на устройстве.
        </p>

        <div className="form-group-block">
          <label className="form-label-title">Интервал создания снимков (секунд)</label>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="number"
              min={5}
              max={300}
              className="form-input-field"
              style={{ width: 140 }}
              value={intervalSec}
              onChange={(e) => setIntervalSec(Math.max(5, parseInt(e.target.value) || 5))}
            />
            <button
              type="button"
              className="btn-secondary-action"
              onClick={async () => {
                if (onUpdateCaptureInterval) {
                  await onUpdateCaptureInterval(intervalSec);
                  alert(`Интервал снимков сохранен: ${intervalSec} сек.`);
                }
              }}
            >
              Сохранить интервал
            </button>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>
            По умолчанию 15 секунд. Если вы не работаете за компьютером более 5 минут, захват встаёт на паузу.
          </div>
        </div>

        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border-color)" }}>
          <label className="form-label-title">Очистка временных снимков (F06)</label>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 10 }}>
            Удаляет тяжёлые графические файлы <code>.png</code> из папки <code>attachments/</code>. Распознанный текст, заметки и история остаются полностью в сохранности.
          </p>
          <button
            type="button"
            className="btn-secondary-action"
            style={{ color: "var(--danger)", borderColor: "#fecaca" }}
            disabled={cleaning}
            onClick={async () => {
              if (window.confirm("Удалить все временные снимки экрана? Текст и заметки сохранятся.")) {
                setCleaning(true);
                try {
                  if (onCleanSnapshots) {
                    const res = await onCleanSnapshots();
                    setCleanMsg(`Удалено снимков: ${res.deleted_count}, освобождено: ${res.freed_mb} МБ`);
                  }
                } catch (e: any) {
                  setCleanMsg(`Ошибка: ${e.message || e}`);
                } finally {
                  setCleaning(false);
                }
              }
            }}
          >
            {cleaning ? "Очищаю..." : "Очистить временные снимки экрана"}
          </button>
          {cleanMsg && (
            <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--success)" }}>
              {cleanMsg}
            </div>
          )}
        </div>
      </div>

      {/* Block 4: Rebuild Index */}
      <div className="card-box">
        <div className="card-title-row">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <RefreshCw size={18} color="var(--purple)" />
            <span className="card-heading">Файловая память и переиндексация</span>
          </div>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>
          Все записи хранятся в открытом формате Markdown в папке <code>Memory/</code>. Если файлы правились вручную сторонними редакторами, переиндексируйте поисковую базу SQLite.
        </p>

        <button
          type="button"
          className="btn-secondary-action"
          onClick={handleReindex}
          disabled={reindexing}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <RefreshCw size={14} className={reindexing ? "animate-spin" : ""} />
          <span>{reindexing ? "Индексация..." : "Пересобрать поисковый индекс"}</span>
        </button>

        {reindexMsg && (
          <div style={{ marginTop: 10, fontSize: 13, color: "var(--success)" }}>
            {reindexMsg}
          </div>
        )}
      </div>
    </div>
  );
};
