import React, { useState } from "react";
import {
  Settings,
  Cpu,
  Shield,
  EyeOff,
  Trash2,
  RefreshCw,
  Plus,
  X,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { PolicyStatus, ModelConfig } from "../types/api";

interface SettingsSectionProps {
  policy: PolicyStatus | null;
  modelConfig: ModelConfig | null;
  onUpdateModelConfig: (cfg: ModelConfig) => Promise<void>;
  onTestModelConnection: () => Promise<{ ok: boolean; latency_ms?: number; reply?: string; error?: string }>;
  onTogglePause: () => void;
  onAddExclusion: (type: "app" | "domain", value: string) => Promise<void>;
  onRemoveExclusion: (type: "app" | "domain", value: string) => Promise<void>;
  onSetPrivacyMode: (mode: "raw" | "pseudonymize") => Promise<void>;
  onRebuildIndex: () => Promise<number>;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  policy,
  modelConfig,
  onUpdateModelConfig,
  onTestModelConnection,
  onTogglePause,
  onAddExclusion,
  onRemoveExclusion,
  onSetPrivacyMode,
  onRebuildIndex,
}) => {
  // Model state
  const [baseUrl, setBaseUrl] = useState(modelConfig?.base_url || "http://localhost:1234/v1");
  const [apiKey, setApiKey] = useState(modelConfig?.api_key || "");
  const [modelName, setModelName] = useState(modelConfig?.model_name || "local-model");
  const [testResult, setTestResult] = useState<{ ok: boolean; latency_ms?: number; reply?: string; error?: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [reindexResult, setReindexResult] = useState<string | null>(null);

  // New exclusion inputs
  const [newApp, setNewApp] = useState("");
  const [newDomain, setNewDomain] = useState("");

  const handleSaveModel = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateModelConfig({
      base_url: baseUrl,
      api_key: apiKey,
      model_name: modelName,
    });
    alert("Настройки модели сохранены!");
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await onTestModelConnection();
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ ok: false, error: err.message || String(err) });
    } finally {
      setTesting(false);
    }
  };

  const handleAddApp = async () => {
    if (!newApp.trim()) return;
    await onAddExclusion("app", newApp.trim());
    setNewApp("");
  };

  const handleAddDomain = async () => {
    if (!newDomain.trim()) return;
    await onAddExclusion("domain", newDomain.trim());
    setNewDomain("");
  };

  const handleReindex = async () => {
    setReindexing(true);
    setReindexResult(null);
    try {
      const count = await onRebuildIndex();
      setReindexResult(`Успешно переиндексировано документов: ${count}`);
    } catch (err: any) {
      setReindexResult(`Ошибка переиндексации: ${err.message || err}`);
    } finally {
      setReindexing(false);
    }
  };

  return (
    <div style={{ maxWidth: "800px" }}>
      <h1 className="section-title">Настройки и безопасность</h1>
      <p className="section-desc">
        Управление подключением моделей, правилами исключений, приватностью и хранилищем
      </p>

      {/* Block 1: Model Gateway (F04) */}
      <div className="card" style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
          <Cpu size={18} color="var(--accent-blue)" />
          <span>Подключение модели (OpenAI API / LM Studio)</span>
        </h2>

        <form onSubmit={handleSaveModel}>
          <div className="form-group">
            <label className="form-label">Base URL (Адрес API)</label>
            <input
              type="text"
              className="form-input"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="http://localhost:1234/v1"
              required
            />
            <div className="form-help">
              Для LM Studio укажите <code>http://localhost:1234/v1</code>. Для OpenAI: <code>https://api.openai.com/v1</code>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Название модели</label>
            <input
              type="text"
              className="form-input"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="local-model или gpt-4o-mini"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Ключ API (необязательно для локального LM Studio)</label>
            <input
              type="password"
              className="form-input"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="lm-studio или sk-..."
            />
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button type="submit" className="btn-primary">
              Сохранить параметры
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleTestConnection}
              disabled={testing}
            >
              {testing ? "Проверка..." : "Проверить подключение (Тестовый пинг)"}
            </button>
          </div>
        </form>

        {/* Live connection test result */}
        {testResult && (
          <div
            style={{
              marginTop: "16px",
              padding: "12px",
              borderRadius: "6px",
              backgroundColor: testResult.ok ? "rgba(52, 211, 153, 0.1)" : "rgba(248, 113, 113, 0.1)",
              border: `1px solid ${testResult.ok ? "var(--accent-green)" : "var(--accent-red)"}`,
              fontSize: "13px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600 }}>
              {testResult.ok ? (
                <>
                  <CheckCircle size={16} color="var(--accent-green)" />
                  <span style={{ color: "var(--accent-green)" }}>
                    Подключение успешно! Задержка: {testResult.latency_ms} мс
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle size={16} color="var(--accent-red)" />
                  <span style={{ color: "var(--accent-red)" }}>Ошибка подключения к модели</span>
                </>
              )}
            </div>
            {testResult.reply && <div style={{ marginTop: "4px" }}>Ответ модели: <i>{testResult.reply}</i></div>}
            {testResult.error && <div style={{ marginTop: "4px", color: "var(--accent-red)" }}>{testResult.error}</div>}
          </div>
        )}
      </div>

      {/* Block 2: Exclusions and Privacy (F02, F05) */}
      <div className="card" style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
          <Shield size={18} color="var(--accent-green)" />
          <span>Исключения и приватность данных</span>
        </h2>

        {/* Privacy mode selector */}
        <div className="form-group">
          <label className="form-label">Режим отправки текста</label>
          <div style={{ display: "flex", gap: "16px", marginTop: "6px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px" }}>
              <input
                type="radio"
                name="privacy_mode"
                checked={policy?.privacy_mode === "raw"}
                onChange={() => onSetPrivacyMode("raw")}
              />
              <span>Без маскировки (исходный текст)</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px" }}>
              <input
                type="radio"
                name="privacy_mode"
                checked={policy?.privacy_mode === "pseudonymize"}
                onChange={() => onSetPrivacyMode("pseudonymize")}
              />
              <span>Локальное обезличивание (маскировка имён и телефонов)</span>
            </label>
          </div>
        </div>

        {/* Excluded Apps */}
        <div className="form-group" style={{ marginTop: "20px" }}>
          <label className="form-label">Исключённые приложения (не читаются и не фиксируются)</label>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="text"
              className="form-input"
              placeholder="Название приложения (например: 1Password, Telegram)"
              value={newApp}
              onChange={(e) => setNewApp(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddApp();
                }
              }}
            />
            <button type="button" className="btn-secondary" onClick={handleAddApp}>
              Добавить
            </button>
          </div>
          <div className="tag-list">
            {policy?.excluded_apps?.map((app) => (
              <span key={app} className="tag-pill">
                <span>{app}</span>
                <X size={12} className="tag-pill-remove" onClick={() => onRemoveExclusion("app", app)} />
              </span>
            ))}
          </div>
        </div>

        {/* Excluded Domains */}
        <div className="form-group" style={{ marginTop: "20px" }}>
          <label className="form-label">Исключённые веб-домены</label>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="text"
              className="form-input"
              placeholder="Домен (например: sberbank.ru, accounts.google.com)"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddDomain();
                }
              }}
            />
            <button type="button" className="btn-secondary" onClick={handleAddDomain}>
              Добавить
            </button>
          </div>
          <div className="tag-list">
            {policy?.excluded_domains?.map((dom) => (
              <span key={dom} className="tag-pill">
                <span>{dom}</span>
                <X size={12} className="tag-pill-remove" onClick={() => onRemoveExclusion("domain", dom)} />
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Block 3: Storage & Maintenance (F16) */}
      <div className="card">
        <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
          <RefreshCw size={18} color="var(--accent-purple)" />
          <span>Файловое хранилище и переиндексация</span>
        </h2>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px", lineHeight: 1.5 }}>
          Если вы вносили массовые изменения или удаляли файлы в папке <code>Memory/</code> вручную, нажмите кнопку ниже для полной синхронизации SQLite базы поиска с файлами.
        </p>

        <button
          className="btn-secondary"
          onClick={handleReindex}
          disabled={reindexing}
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
        >
          <RefreshCw size={14} className={reindexing ? "animate-spin" : ""} />
          <span>{reindexing ? "Индексация..." : "Восстановить и переиндексировать индекс"}</span>
        </button>

        {reindexResult && (
          <div style={{ marginTop: "12px", fontSize: "13px", color: "var(--accent-green)" }}>
            {reindexResult}
          </div>
        )}
      </div>
    </div>
  );
};
