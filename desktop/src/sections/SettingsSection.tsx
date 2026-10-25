import React, { useState } from "react";
import { CheckCircle, AlertCircle } from "lucide-react";
import { PolicyStatus, ModelConfig } from "../types/api";

interface SettingsSectionProps {
  policy: PolicyStatus | null;
  modelConfig: ModelConfig | null;
  onUpdateModelConfig: (c: ModelConfig) => Promise<void>;
  onTestModelConnection: () => Promise<any>;
  onTogglePause: () => void;
  onAddExclusion: (type: "app" | "domain", value: string) => Promise<void>;
  onRemoveExclusion: (type: "app" | "domain", value: string) => Promise<void>;
  onSetPrivacyMode: (m: "raw" | "pseudonymize") => Promise<void>;
  onRebuildIndex: () => Promise<number>;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  policy,
  modelConfig,
  onUpdateModelConfig,
  onTestModelConnection,
  onAddExclusion,
  onRemoveExclusion,
  onSetPrivacyMode,
  onRebuildIndex,
}) => {
  const [baseUrl, setBaseUrl]       = useState(modelConfig?.base_url ?? "http://localhost:1234/v1");
  const [apiKey, setApiKey]         = useState(modelConfig?.api_key ?? "");
  const [modelName, setModelName]   = useState(modelConfig?.model_name ?? "local-model");
  const [testing, setTesting]       = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [newApp, setNewApp]         = useState("");
  const [newDomain, setNewDomain]   = useState("");
  const [reindexing, setReindexing] = useState(false);
  const [reindexResult, setRR]      = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateModelConfig({ base_url: baseUrl, api_key: apiKey, model_name: modelName });
  };

  const handleTest = async () => {
    setTesting(true); setTestResult(null);
    try { setTestResult(await onTestModelConnection()); }
    catch (e: any) { setTestResult({ ok: false, error: e.message }); }
    finally { setTesting(false); }
  };

  const handleReindex = async () => {
    setReindexing(true); setRR(null);
    try { const n = await onRebuildIndex(); setRR(`Переиндексировано документов: ${n}`); }
    catch (e: any) { setRR(`Ошибка: ${e.message}`); }
    finally { setReindexing(false); }
  };

  return (
    <div style={{ maxWidth: 640 }}>

      {/* Model connection */}
      <div className="settings-block">
        <div className="settings-block-title">Модель</div>
        <div className="settings-block-sub">
          OpenAI-совместимый API. LM Studio: <code>http://localhost:1234/v1</code>, ключ не нужен.
        </div>
        <form onSubmit={handleSave}>
          <div className="form-row">
            <label className="form-label">Base URL</label>
            <input className="form-input" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} required />
          </div>
          <div className="form-row">
            <label className="form-label">Название модели</label>
            <input className="form-input" placeholder="local-model или gpt-4o-mini" value={modelName}
              onChange={(e) => setModelName(e.target.value)} required />
          </div>
          <div className="form-row">
            <label className="form-label">Ключ API (необязательно)</label>
            <input className="form-input" type="password" placeholder="sk-…" value={apiKey}
              onChange={(e) => setApiKey(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="btn btn-primary btn-sm">Сохранить</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleTest} disabled={testing}>
              {testing ? "Проверяю…" : "Тест соединения"}
            </button>
          </div>
        </form>
        {testResult && (
          <div className={`test-result ${testResult.ok ? "ok" : "err"}`}>
            {testResult.ok
              ? <><CheckCircle size={15} /> Подключение OK · {testResult.latency_ms} мс · «{testResult.reply}»</>
              : <><AlertCircle size={15} /> {testResult.error}</>
            }
          </div>
        )}
      </div>

      {/* Privacy */}
      <div className="settings-block">
        <div className="settings-block-title">Передача текста</div>
        <div className="settings-block-sub">
          Определяет, что отправляется в модель. Картинки этим не управляются.
        </div>
        <div className="radio-group">
          <label className="radio-label">
            <input type="radio" name="privacy" checked={policy?.privacy_mode === "raw"}
              onChange={() => onSetPrivacyMode("raw")} />
            <div>
              <div>Без маскировки</div>
              <div className="radio-desc">Исходный текст, включая имена и контакты</div>
            </div>
          </label>
          <label className="radio-label">
            <input type="radio" name="privacy" checked={policy?.privacy_mode === "pseudonymize"}
              onChange={() => onSetPrivacyMode("pseudonymize")} />
            <div>
              <div>Локальное обезличивание</div>
              <div className="radio-desc">Имена, телефоны, email — заменяются перед отправкой</div>
            </div>
          </label>
        </div>
      </div>

      {/* Exclusions */}
      <div className="settings-block">
        <div className="settings-block-title">Исключения</div>
        <div className="settings-block-sub">Эти приложения и сайты никогда не читаются и не фиксируются.</div>

        <div className="form-row">
          <label className="form-label">Приложения</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="form-input" placeholder="1Password, Telegram…" value={newApp}
              onChange={(e) => setNewApp(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (newApp.trim()) { onAddExclusion("app", newApp.trim()); setNewApp(""); } } }} />
            <button className="btn btn-secondary btn-sm" type="button"
              onClick={() => { if (newApp.trim()) { onAddExclusion("app", newApp.trim()); setNewApp(""); } }}>
              Добавить
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {policy?.excluded_apps?.map((a) => (
              <span key={a} className="pill">
                {a}
                <span className="pill-remove" onClick={() => onRemoveExclusion("app", a)}>×</span>
              </span>
            ))}
          </div>
        </div>

        <div className="form-row" style={{ marginBottom: 0 }}>
          <label className="form-label">Домены</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="form-input" placeholder="sberbank.ru, accounts.google.com…" value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (newDomain.trim()) { onAddExclusion("domain", newDomain.trim()); setNewDomain(""); } } }} />
            <button className="btn btn-secondary btn-sm" type="button"
              onClick={() => { if (newDomain.trim()) { onAddExclusion("domain", newDomain.trim()); setNewDomain(""); } }}>
              Добавить
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {policy?.excluded_domains?.map((d) => (
              <span key={d} className="pill">
                {d}
                <span className="pill-remove" onClick={() => onRemoveExclusion("domain", d)}>×</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Index rebuild */}
      <div className="settings-block">
        <div className="settings-block-title">Индекс поиска</div>
        <div className="settings-block-sub">
          Если вы вносили изменения в файлы Memory вручную, пересоберите индекс.
        </div>
        <button className="btn btn-secondary btn-sm" onClick={handleReindex} disabled={reindexing}>
          {reindexing ? "Индексирую…" : "Пересобрать индекс из файлов"}
        </button>
        {reindexResult && (
          <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--ink-2)" }}>{reindexResult}</div>
        )}
      </div>
    </div>
  );
};
