import React, { useState } from "react";
import {
  Cpu,
  Eye,
  Shield,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Plus,
  X,
  Lock,
  Zap,
  Clock,
  Trash2,
} from "lucide-react";
import { PolicyStatus, ModelConfig } from "../types/api";

interface SettingsScreenProps {
  policy: PolicyStatus | null;
  modelConfig: ModelConfig | null;
  onUpdateModelConfig: (cfg: ModelConfig) => Promise<void>;
  onTestModelConnection: (model?: string) => Promise<any>;
  onTestNeuralDeep?: () => Promise<any>;
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
  onTestNeuralDeep,
  onAddExclusion,
  onRemoveExclusion,
  onSetPrivacyMode,
  onRebuildIndex,
  captureInterval = 15,
  onUpdateCaptureInterval,
  onCleanSnapshots,
}) => {
  const [baseUrl, setBaseUrl] = useState(modelConfig?.base_url || "https://api.sd1.su/v1");
  const [apiKey, setApiKey] = useState(modelConfig?.api_key || "");
  const [textModel, setTextModel] = useState(modelConfig?.text_model || modelConfig?.model_name || "gpt-5.6-luna");
  const [visionModel, setVisionModel] = useState(modelConfig?.vision_model || "gemini-3-flash");

  const [ndEndpoint, setNdEndpoint] = useState(modelConfig?.nd_endpoint || "https://api.neuraldeep.ru/v1");
  const [ndApiKey, setNdApiKey] = useState(modelConfig?.nd_api_key || "");

  const [intervalSec, setIntervalSec] = useState<number>(captureInterval);
  const [testingText, setTestingText] = useState(false);
  const [testingVision, setTestingVision] = useState(false);
  const [testingNd, setTestingNd] = useState(false);

  const [textTestResult, setTextTestResult] = useState<any>(null);
  const [visionTestResult, setVisionTestResult] = useState<any>(null);
  const [ndTestResult, setNdTestResult] = useState<any>(null);

  const [newApp, setNewApp] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [reindexing, setReindexing] = useState(false);
  const [reindexMsg, setReindexMsg] = useState<string | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [cleanMsg, setCleanMsg] = useState<string | null>(null);

  const handleSaveModel = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateModelConfig({
      base_url: baseUrl,
      api_key: apiKey,
      model_name: textModel,
      text_model: textModel,
      vision_model: visionModel,
      nd_endpoint: ndEndpoint,
      nd_api_key: ndApiKey,
    });
    alert("Параметры моделей и NeuralDeep успешно сохранены!");
  };

  const handleTestTextModel = async () => {
    setTestingText(true);
    setTextTestResult(null);
    try {
      const res = await onTestModelConnection(textModel);
      setTextTestResult(res);
    } catch (e: any) {
      setTextTestResult({ ok: false, error: e.message || String(e) });
    } finally {
      setTestingText(false);
    }
  };

  const handleTestVisionModel = async () => {
    setTestingVision(true);
    setVisionTestResult(null);
    try {
      const res = await onTestModelConnection(visionModel);
      setVisionTestResult(res);
    } catch (e: any) {
      setVisionTestResult({ ok: false, error: e.message || String(e) });
    } finally {
      setTestingVision(false);
    }
  };

  const handleTestNeuralDeepConnection = async () => {
    if (!onTestNeuralDeep) return;
    setTestingNd(true);
    setNdTestResult(null);
    try {
      const res = await onTestNeuralDeep();
      setNdTestResult(res);
    } catch (e: any) {
      setNdTestResult({ ok: false, error: e.message || String(e) });
    } finally {
      setTestingNd(false);
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
    <div style={{ maxWidth: 840, paddingBottom: 60 }}>
      {/* Block 1: LLM Models Configuration */}
      <div className="card-box" style={{ marginBottom: 20 }}>
        <div className="card-title-row">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Cpu size={18} color="var(--primary)" />
            <span className="card-heading">Шлюз моделей LLM (api.sd1.su / OpenAI)</span>
          </div>
        </div>

        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
          Интеграция с моделями ИИ: для текстового анализа и ответов на вопросы используется <b>GPT (gpt-5.6-luna)</b>, для визуального распознавания снимков экрана — <b>Gemini (gemini-3-flash)</b>.
        </p>

        <form onSubmit={handleSaveModel}>
          <div className="form-group-block">
            <label className="form-label-title">API Base URL</label>
            <input
              type="text"
              className="form-input-field"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.sd1.su/v1"
              required
            />
          </div>

          <div className="form-group-block">
            <label className="form-label-title">Ключ API (Authorization Bearer)</label>
            <input
              type="password"
              className="form-input-field"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sd-bcf14e37..."
            />
          </div>

          {/* Model Row: Text + Vision */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="form-group-block">
              <label className="form-label-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Zap size={14} color="var(--primary)" />
                <span>Текстовая модель (Чат и рассуждения)</span>
              </label>
              <select
                className="form-input-field"
                value={textModel}
                onChange={(e) => setTextModel(e.target.value)}
              >
                <option value="gpt-5.6-luna">gpt-5.6-luna (Основная)</option>
                <option value="gpt-4o">gpt-4o</option>
                <option value="gpt-4o-mini">gpt-4o-mini</option>
                <option value="gpt-5-mini">gpt-5-mini</option>
                <option value="gpt-4.1-mini">gpt-4.1-mini</option>
              </select>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                Используется для синтеза ответов по найденным источникам.
              </div>
            </div>

            <div className="form-group-block">
              <label className="form-label-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Eye size={14} color="var(--accent)" />
                <span>Модель зрения (Анализ снимков экрана)</span>
              </label>
              <select
                className="form-input-field"
                value={visionModel}
                onChange={(e) => setVisionModel(e.target.value)}
              >
                <option value="gemini-3-flash">gemini-3-flash (Gemini 3 Flash — Основная)</option>
                <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite</option>
                <option value="gemini-2.5-pro">gemini-2.5-pro</option>
              </select>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                Мультимодальный разбор скриншотов окон и документов.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
            <button type="submit" className="btn-primary-action">
              Сохранить параметры
            </button>
            <button
              type="button"
              className="btn-secondary-action"
              onClick={handleTestTextModel}
              disabled={testingText}
            >
              {testingText ? "Проверка..." : `Тест ${textModel} (Пинг)`}
            </button>
            <button
              type="button"
              className="btn-secondary-action"
              onClick={handleTestVisionModel}
              disabled={testingVision}
            >
              {testingVision ? "Проверка..." : `Тест ${visionModel} (Пинг)`}
            </button>
          </div>
        </form>

        {textTestResult && (
          <div
            style={{
              marginTop: 14,
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)",
              fontSize: 13,
              background: textTestResult.ok ? "#ecfdf5" : "#fef2f2",
              border: `1px solid ${textTestResult.ok ? "#a7f3d0" : "#fecaca"}`,
              color: textTestResult.ok ? "#065f46" : "#991b1b",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {textTestResult.ok ? (
              <>
                <CheckCircle2 size={16} />
                <span>
                  {textTestResult.model}: Связь подтверждена! Задержка: <b>{textTestResult.latency_ms} мс</b>. Ответ: «{textTestResult.reply}»
                </span>
              </>
            ) : (
              <>
                <AlertCircle size={16} />
                <span>Ошибка {textModel}: {textTestResult.error}</span>
              </>
            )}
          </div>
        )}

        {visionTestResult && (
          <div
            style={{
              marginTop: 10,
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)",
              fontSize: 13,
              background: visionTestResult.ok ? "#ecfdf5" : "#fef2f2",
              border: `1px solid ${visionTestResult.ok ? "#a7f3d0" : "#fecaca"}`,
              color: visionTestResult.ok ? "#065f46" : "#991b1b",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {visionTestResult.ok ? (
              <>
                <CheckCircle2 size={16} />
                <span>
                  {visionTestResult.model}: Связь подтверждена! Задержка: <b>{visionTestResult.latency_ms} мс</b>. Ответ: «{visionTestResult.reply}»
                </span>
              </>
            ) : (
              <>
                <AlertCircle size={16} />
                <span>Ошибка {visionModel}: {visionTestResult.error}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Block 2: NeuralDeep Integration */}
      <div className="card-box" style={{ marginBottom: 20 }}>
        <div className="card-title-row">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Zap size={18} color="var(--purple)" />
            <span className="card-heading">Сервис NeuralDeep (api.neuraldeep.ru)</span>
          </div>
        </div>

        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
          Шлюз моделей и эмбеддингов для семантического поиска (BGE-M3, E5-Large, Qwen3.6, Whisper).
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="form-group-block">
            <label className="form-label-title">NeuralDeep Endpoint</label>
            <input
              type="text"
              className="form-input-field"
              value={ndEndpoint}
              onChange={(e) => setNdEndpoint(e.target.value)}
              placeholder="https://api.neuraldeep.ru/v1"
            />
          </div>

          <div className="form-group-block">
            <label className="form-label-title">NeuralDeep API Key</label>
            <input
              type="password"
              className="form-input-field"
              value={ndApiKey}
              onChange={(e) => setNdApiKey(e.target.value)}
              placeholder="sk-cf0g4O0..."
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button
            type="button"
            className="btn-secondary-action"
            onClick={handleTestNeuralDeepConnection}
            disabled={testingNd || !onTestNeuralDeep}
          >
            {testingNd ? "Проверка..." : "Проверить статус NeuralDeep"}
          </button>
        </div>

        {ndTestResult && (
          <div
            style={{
              marginTop: 14,
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)",
              fontSize: 13,
              background: ndTestResult.ok ? "#ecfdf5" : "#fef2f2",
              border: `1px solid ${ndTestResult.ok ? "#a7f3d0" : "#fecaca"}`,
              color: ndTestResult.ok ? "#065f46" : "#991b1b",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {ndTestResult.ok ? (
              <>
                <CheckCircle2 size={16} />
                <span>
                  NeuralDeep доступен! Задержка: <b>{ndTestResult.latency_ms} мс</b>, доступно моделей: <b>{ndTestResult.models_count}</b> (включая BGE-M3, Qwen3.6, Whisper).
                </span>
              </>
            ) : (
              <>
                <AlertCircle size={16} />
                <span>Ошибка подключения к NeuralDeep: {ndTestResult.error}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Block 3: Capture Interval & Automatic Screenshots */}
      <div className="card-box" style={{ marginBottom: 20 }}>
        <div className="card-title-row">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Clock size={18} color="var(--primary)" />
            <span className="card-heading">Периодичность снимков экрана и OCR</span>
          </div>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
          Снимки экрана делаются автоматически каждые <b>N секунд</b> (по умолчанию 15 с) и при переключении между приложениями. Локальный Apple Vision OCR мгновенно переводит экран в поисковый текст.
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
            При отсутствии активности пользователя более 5 минут захват автоматически ставится на паузу.
          </div>
        </div>

        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border-color)" }}>
          <label className="form-label-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Trash2 size={15} color="var(--danger)" />
            <span>Очистка временных снимков (F06)</span>
          </label>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 10 }}>
            Удаляет графические файлы <code>.png</code> из папки <code>attachments/</code>. Распознанный текст, контекст, заметки и история задач остаются в сохранности.
          </p>
          <button
            type="button"
            className="btn-secondary-action"
            style={{ color: "var(--danger)", borderColor: "#fecaca" }}
            disabled={cleaning}
            onClick={async () => {
              if (window.confirm("Удалить временные скриншоты экрана? Распознанный текст и заметки сохранятся.")) {
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

      {/* Block 4: Excluded Apps and Domains */}
      <div className="card-box" style={{ marginBottom: 20 }}>
        <div className="card-title-row">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Shield size={18} color="var(--success)" />
            <span className="card-heading">Исключения (Приложения и Сайты)</span>
          </div>
        </div>

        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
          Данные из этих приложений и веб-доменов никогда не фиксируются, не сохраняются на диск и не отправляются в модели.
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

      {/* Block 5: Rebuild Index */}
      <div className="card-box">
        <div className="card-title-row">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <RefreshCw size={18} color="var(--purple)" />
            <span className="card-heading">Файловая память и переиндексация</span>
          </div>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>
          Все данные хранятся в открытом формате Markdown в папке <code>Memory/</code>. Если файлы правились вручную сторонними редакторами, переиндексируйте поисковую базу SQLite.
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
