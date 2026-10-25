import React, { useState } from "react";
import {
  Sparkles,
  Check,
  X,
  FileText,
  Clock,
  Layers,
  ArrowRight,
} from "lucide-react";
import { DayDetail, SuggestionItem } from "../types/api";

interface TodaySectionProps {
  dayDetail: DayDetail | null;
  suggestions: SuggestionItem[];
  onDismissSuggestion: (id: string) => void;
  onAcceptTaskSuggestion: (suggestion: SuggestionItem) => void;
  onSelectAskQuery: (query: string) => void;
}

export const TodaySection: React.FC<TodaySectionProps> = ({
  dayDetail,
  suggestions,
  onDismissSuggestion,
  onAcceptTaskSuggestion,
  onSelectAskQuery,
}) => {
  const [expandedEpisode, setExpandedEpisode] = useState<string | null>(null);

  const episodes = dayDetail?.episodes || [];
  const notes = dayDetail?.notes || [];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="section-title">Сегодня — {dayDetail?.date || new Date().toISOString().slice(0, 10)}</h1>
          <p className="section-desc">
            Хроника рабочего дня, зафиксированные эпизоды и инициативные подсказки
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            className="btn-secondary"
            onClick={() => onSelectAskQuery("На чём я остановился?")}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <span>«На чём я остановился?»</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Proactive Suggestions (P01–P08) */}
      {suggestions.length > 0 && (
        <div style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <Sparkles size={16} color="var(--accent-blue)" />
            <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--accent-blue)" }}>
              Инициативные подсказки ассистента ({suggestions.length})
            </span>
          </div>

          {suggestions.map((sug) => (
            <div key={sug.id} className="suggestion-card">
              <div className="suggestion-header">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className="scenario-tag">{sug.scenario_id}</span>
                  <span style={{ fontWeight: 600, fontSize: "14px" }}>{sug.title}</span>
                </div>
                <button
                  className="btn-secondary"
                  style={{ padding: "4px 8px" }}
                  onClick={() => onDismissSuggestion(sug.id)}
                  title="Скрыть подсказку"
                >
                  <X size={14} />
                </button>
              </div>

              <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                {sug.description}
              </p>

              {sug.source_refs && sug.source_refs.length > 0 && (
                <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--text-muted)" }}>
                  Связанные источники:{" "}
                  {sug.source_refs.map((ref) => (
                    <span key={ref.id} style={{ color: "var(--accent-blue)", marginRight: "8px" }}>
                      #{ref.title || ref.id}
                    </span>
                  ))}
                </div>
              )}

              <div className="suggestion-actions">
                {sug.actions.includes("accept_task") && (
                  <button className="btn-primary" onClick={() => onAcceptTaskSuggestion(sug)}>
                    <Check size={14} style={{ marginRight: "6px", verticalAlign: "middle" }} />
                    Добавить в задачи
                  </button>
                )}
                {sug.actions.includes("view_source") && (
                  <button
                    className="btn-secondary"
                    onClick={() => onSelectAskQuery(sug.title)}
                  >
                    Посмотреть детали
                  </button>
                )}
                <button className="btn-secondary" onClick={() => onDismissSuggestion(sug.id)}>
                  Понятно
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grid: Episodes timeline & Notes */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px" }}>
        {/* Left: Episodes */}
        <div>
          <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Layers size={16} />
            <span>Эпизоды работы ({episodes.length})</span>
          </h2>

          {episodes.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
              <Clock size={32} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
              <p>Наблюдение активно. Новые рабочие эпизоды появятся здесь по мере переключения между окнами и документами.</p>
            </div>
          ) : (
            <div>
              {episodes.map((ep) => {
                const isExpanded = expandedEpisode === ep.id;
                const timeStr = ep.created_at ? ep.created_at.slice(11, 16) : "";
                return (
                  <div key={ep.id} className="timeline-item">
                    <div className="timeline-dot" />
                    <div className="timeline-time">{timeStr}</div>
                    <div className="card" style={{ cursor: "pointer" }} onClick={() => setExpandedEpisode(isExpanded ? null : ep.id)}>
                      <div className="card-header">
                        <span className="card-title">{ep.title}</span>
                        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                          {isExpanded ? "Свернуть" : "Развернуть"}
                        </span>
                      </div>
                      <div style={{ fontSize: "13px", color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>
                        {isExpanded ? ep.body : ep.body.slice(0, 180) + (ep.body.length > 180 ? "..." : "")}
                      </div>
                      <div style={{ marginTop: "10px", fontSize: "11px", color: "var(--text-muted)" }}>
                        Файл: <code>{ep.path}</code>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Notes created today */}
        <div>
          <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <FileText size={16} />
            <span>Заметки за день ({notes.length})</span>
          </h2>

          {notes.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "30px 16px", color: "var(--text-muted)", fontSize: "13px" }}>
              Заметок за сегодня пока нет. Создать можно во вкладке «Задачи и заметки».
            </div>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="card" style={{ marginBottom: "12px" }}>
                <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "6px" }}>
                  {note.title}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", maxHeight: "100px", overflow: "hidden" }}>
                  {note.body}
                </div>
                {note.tags && note.tags.length > 0 && (
                  <div style={{ marginTop: "8px", display: "flex", gap: "4px" }}>
                    {note.tags.map((t) => (
                      <span key={t} className="tag-pill" style={{ fontSize: "10px", padding: "2px 8px" }}>
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
