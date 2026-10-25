import React, { useState } from "react";
import { X, ArrowRight, Check } from "lucide-react";
import { DayDetail, SuggestionItem } from "../types/api";

interface TodaySectionProps {
  dayDetail: DayDetail | null;
  suggestions: SuggestionItem[];
  onDismissSuggestion: (id: string) => void;
  onAcceptTaskSuggestion: (s: SuggestionItem) => void;
  onSelectAskQuery: (q: string) => void;
}

export const TodaySection: React.FC<TodaySectionProps> = ({
  dayDetail,
  suggestions,
  onDismissSuggestion,
  onAcceptTaskSuggestion,
  onSelectAskQuery,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const episodes = dayDetail?.episodes || [];
  const notes    = dayDetail?.notes    || [];

  const todayStr = new Date().toLocaleDateString("ru-RU", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <div>
      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div className="section-label">Ассистент заметил</div>
          {suggestions.map((s) => (
            <div key={s.id} className="suggestion-strip">
              <div className="suggestion-strip-header">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="suggestion-tag">{s.scenario_id}</span>
                  <span className="suggestion-title">{s.title}</span>
                </div>
                <button
                  className="btn-link"
                  style={{ color: "var(--ink-3)" }}
                  onClick={() => onDismissSuggestion(s.id)}
                >
                  <X size={14} />
                </button>
              </div>
              <p className="suggestion-desc">{s.description}</p>
              <div className="suggestion-actions">
                {s.actions.includes("accept_task") && (
                  <button className="btn btn-primary btn-sm" onClick={() => onAcceptTaskSuggestion(s)}>
                    <Check size={12} /> Добавить задачу
                  </button>
                )}
                {s.actions.includes("view_source") && (
                  <button className="btn btn-secondary btn-sm" onClick={() => onSelectAskQuery(s.title)}>
                    Найти в памяти
                  </button>
                )}
                <button className="btn btn-secondary btn-sm" onClick={() => onDismissSuggestion(s.id)}>
                  Понятно
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick ask strip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <div className="section-label" style={{ marginBottom: 0 }}>
          {episodes.length === 0 ? "Эпизодов пока нет" : `${episodes.length} эпизодов`}
          {notes.length > 0 && `, ${notes.length} заметок`}
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => onSelectAskQuery("На чём я остановился?")}
          style={{ display: "flex", alignItems: "center", gap: 5 }}
        >
          На чём я остановился? <ArrowRight size={12} />
        </button>
      </div>

      {/* Main layout: timeline + notes sidebar */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 24 }}>

        {/* Timeline */}
        <div>
          {episodes.length === 0 ? (
            <div className="card empty-state">
              <div className="empty-state-text">
                Наблюдение активно. Переключитесь между окнами — первые записи появятся здесь.
              </div>
            </div>
          ) : (
            <div className="timeline">
              {episodes.map((ep) => {
                const timeStr = ep.created_at?.slice(11, 16) ?? "";
                const isOpen  = expandedId === ep.id;
                return (
                  <div key={ep.id} className="timeline-entry">
                    <div className="timeline-time">{timeStr}</div>
                    <div className="timeline-body">
                      <div
                        className="timeline-card"
                        onClick={() => setExpandedId(isOpen ? null : ep.id)}
                      >
                        <div className="timeline-card-title">{ep.title}</div>
                        {isOpen && (
                          <div className="timeline-card-body" style={{ whiteSpace: "pre-wrap" }}>
                            {ep.body}
                          </div>
                        )}
                        {!isOpen && (
                          <div className="timeline-card-meta">
                            {ep.body.slice(0, 120).replace(/#+\s/g, "").trim()}
                            {ep.body.length > 120 ? "…" : ""}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Notes sidebar */}
        <div>
          <div className="section-label">Заметки за день</div>
          {notes.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
              Заметок нет. Создать можно в разделе «Задачи и заметки».
            </div>
          ) : (
            notes.map((n) => (
              <div key={n.id} className="card" style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{n.title}</div>
                <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5 }}>
                  {n.body.slice(0, 140)}{n.body.length > 140 ? "…" : ""}
                </div>
                {n.tags && n.tags.length > 0 && (
                  <div style={{ marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {n.tags.map((t) => (
                      <span key={t} className="pill" style={{ fontSize: 11 }}>{t}</span>
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
