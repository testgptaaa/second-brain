import React, { useState } from "react";
import { Search, Send, Sparkles, BookOpen, ExternalLink, HelpCircle } from "lucide-react";
import { QAResult } from "../types/api";

interface AskSectionProps {
  initialQuery?: string;
  onAsk: (question: string) => Promise<QAResult>;
}

export const AskSection: React.FC<AskSectionProps> = ({ initialQuery = "", onAsk }) => {
  const [question, setQuestion] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QAResult | null>(null);

  const quickQuestions = [
    "На чём я остановился?",
    "Откуда взялась цифра в бюджете?",
    "Какие договорённости были с клиентом?",
    "Что обсуждалось в чатах за сегодня?",
  ];

  const handleSearch = async (queryText?: string) => {
    const q = (queryText !== undefined ? queryText : question).trim();
    if (!q) return;
    setLoading(true);
    try {
      const res = await onAsk(q);
      setResult(res);
    } catch (err: any) {
      setResult({
        request_id: "",
        answer: `Ошибка при обработке запроса: ${err.message || err}`,
        status: "error",
        sources: [],
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="section-title">Спросить память</h1>
      <p className="section-desc">
        Задайте вопрос на естественном языке. Помощник сформирует ответ со ссылками на точные файлы и доказательства.
      </p>

      {/* Search Input */}
      <div className="search-box">
        <input
          type="text"
          className="search-input"
          placeholder="Например: На чём я остановился? Или: Где договор с ООО Вектор?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearch();
          }}
        />
        <button
          className="btn-primary"
          onClick={() => handleSearch()}
          disabled={loading}
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
        >
          {loading ? <Sparkles size={16} className="animate-spin" /> : <Send size={16} />}
          <span>{loading ? "Ищем..." : "Спросить"}</span>
        </button>
      </div>

      {/* Suggested chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "28px" }}>
        <span style={{ fontSize: "12px", color: "var(--text-muted)", alignSelf: "center" }}>
          Быстрые вопросы:
        </span>
        {quickQuestions.map((chip) => (
          <button
            key={chip}
            className="btn-secondary"
            style={{ fontSize: "12px", padding: "4px 10px", borderRadius: "14px" }}
            onClick={() => {
              setQuestion(chip);
              handleSearch(chip);
            }}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Result Display */}
      {result && (
        <div>
          <div className="card" style={{ borderColor: "var(--accent-blue)", background: "#111c33", marginBottom: "24px" }}>
            <div className="card-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Sparkles size={18} color="var(--accent-blue)" />
                <span className="card-title" style={{ color: "var(--accent-blue)" }}>
                  Ответ ассистента
                </span>
              </div>
              {result.tokens && (
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  Токенов: {result.tokens.prompt + result.tokens.completion}
                </span>
              )}
            </div>

            <div style={{ fontSize: "14px", lineHeight: 1.7, whiteSpace: "pre-wrap", color: "var(--text-primary)" }}>
              {result.answer}
            </div>
          </div>

          {/* Sources and Verifiable Evidence */}
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <BookOpen size={16} />
              <span>Подтверждающие источники ({result.sources.length})</span>
            </h2>

            {result.sources.length === 0 ? (
              <div className="card" style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                Точных подтверждающих документов в памяти не найдено.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px" }}>
                {result.sources.map((src, i) => (
                  <div key={src.id || i} className="card" style={{ margin: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <span style={{ fontWeight: 600, fontSize: "14px", color: "var(--accent-blue)" }}>
                        [{i + 1}] {src.title || src.relative_path}
                      </span>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                        {src.created_at ? src.created_at.slice(0, 16).replace("T", " ") : ""}
                      </span>
                    </div>

                    {src.snippet && (
                      <div
                        style={{ fontSize: "13px", color: "var(--text-secondary)", backgroundColor: "var(--bg-primary)", padding: "10px", borderRadius: "6px", marginBottom: "8px" }}
                        dangerouslySetInnerHTML={{ __html: src.snippet }}
                      />
                    )}

                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      Путь к файлу: <code>{src.relative_path}</code>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
