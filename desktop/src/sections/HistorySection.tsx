import React, { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { DayOverview, DayDetail } from "../types/api";

interface HistorySectionProps {
  days: DayOverview[];
  onSelectDay: (d: string) => Promise<DayDetail>;
}

export const HistorySection: React.FC<HistorySectionProps> = ({ days, onSelectDay }) => {
  const [selected, setSelected] = useState<string>(days[0]?.date ?? "");
  const [detail, setDetail]     = useState<DayDetail | null>(null);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    onSelectDay(selected).then(setDetail).finally(() => setLoading(false));
  }, [selected]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 24, alignItems: "start" }}>
      {/* Date list */}
      <div>
        <div className="section-label">Даты</div>
        {days.length === 0 && (
          <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Нет сохранённых дней</div>
        )}
        {days.map((d) => (
          <div
            key={d.date}
            className={`date-list-item${selected === d.date ? " active" : ""}`}
            onClick={() => setSelected(d.date)}
          >
            <span>{d.date}</span>
            <span className="date-list-meta">{d.episodes_count}э · {d.notes_count}з</span>
          </div>
        ))}
      </div>

      {/* Detail panel */}
      <div>
        {loading && (
          <div style={{ color: "var(--ink-3)", fontSize: 13 }}>Загрузка…</div>
        )}
        {!loading && !detail && (
          <div style={{ color: "var(--ink-3)", fontSize: 13 }}>Выберите дату</div>
        )}
        {!loading && detail && (
          <>
            <div className="section-label">{detail.date} — эпизоды ({detail.episodes.length})</div>
            {detail.episodes.length === 0 ? (
              <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginBottom: 20 }}>Нет эпизодов</div>
            ) : (
              detail.episodes.map((ep) => (
                <div key={ep.id} className="card" style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 13.5 }}>{ep.title}</span>
                    <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                      {ep.created_at?.slice(11, 16)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-2)", whiteSpace: "pre-wrap", lineHeight: 1.55 }}>
                    {ep.body}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--ink-3)" }}>
                    {ep.path}
                  </div>
                </div>
              ))
            )}

            <div className="divider" />

            <div className="section-label">{detail.date} — заметки ({detail.notes.length})</div>
            {detail.notes.length === 0 ? (
              <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Нет заметок</div>
            ) : (
              detail.notes.map((n) => (
                <div key={n.id} className="card" style={{ marginBottom: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 6 }}>{n.title}</div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-2)", whiteSpace: "pre-wrap" }}>{n.body}</div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
};
