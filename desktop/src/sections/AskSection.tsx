import React, { useState } from "react";
import { Send } from "lucide-react";
import { QAResult } from "../types/api";

interface AskSectionProps {
  initialQuery?: string;
  onAsk: (q: string) => Promise<QAResult>;
}

export const AskSection: React.FC<AskSectionProps> = ({ initialQuery = "", onAsk }) => {
  const [q, setQ]         = useState(initialQuery);
  const [loading, setL]   = useState(false);
  const [result, setR]    = useState<QAResult | null>(null);

  const chips = [
    "На чём я остановился?",
    "Откуда взялась эта цифра?",
    "Что обсуждали с клиентом?",
    "Какие у меня дедлайны?",
  ];

  const handle = async (text?: string) => {
    const query = (text ?? q).trim();
    if (!query) return;
    setL(true);
    try { setR(await onAsk(query)); }
    catch (e: any) { setR({ request_id: "", answer: `Ошибка: ${e.message}`, status: "error", sources: [] }); }
    finally { setL(false); }
  };

  return (
    <div>
      <div className="ask-bar">
        <input
          className="ask-input"
          placeholder="Спросите что-нибудь — «где договор с Вектором?», «что я делал вчера в 14:00?»"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handle()}
        />
        <button
          className="btn btn-primary"
          onClick={() => handle()}
          disabled={loading}
          style={{ padding: "0 18px" }}
        >
          {loading ? "Ищу…" : <Send size={15} />}
        </button>
      </div>

      <div className="chip-row">
        {chips.map((c) => (
          <button key={c} className="chip" onClick={() => { setQ(c); handle(c); }}>
            {c}
          </button>
        ))}
      </div>

      {result && (
        <>
          {/* Answer */}
          <div className="answer-card">
            <div className="answer-card-label">Ответ</div>
            <div className="answer-text">{result.answer}</div>
            {result.tokens && (
              <div style={{ marginTop: 12, fontSize: 11.5, color: "var(--ink-3)" }}>
                {result.tokens.prompt + result.tokens.completion} токенов
              </div>
            )}
          </div>

          {/* Sources */}
          {result.sources.length > 0 && (
            <div className="card">
              <div className="section-label" style={{ marginBottom: 4 }}>
                Источники ({result.sources.length})
              </div>
              {result.sources.map((src, i) => (
                <div key={src.id || i} className="source-row">
                  <div className="source-num">{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="source-title">{src.title || src.relative_path}</div>
                    <div className="source-meta">
                      {src.created_at?.slice(0, 16).replace("T", "  ")}
                      {src.relative_path && ` · ${src.relative_path}`}
                    </div>
                    {src.snippet && (
                      <div
                        className="source-snippet"
                        dangerouslySetInnerHTML={{ __html: src.snippet }}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {result.sources.length === 0 && (
            <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
              Подтверждающих документов не найдено в сохранённой памяти.
            </div>
          )}
        </>
      )}
    </div>
  );
};
