import React, { useState, useEffect } from "react";
import { Calendar, Clock, ChevronRight, FileText, Globe, Monitor } from "lucide-react";
import { DayOverview, DayDetail } from "../types/api";

interface HistorySectionProps {
  days: DayOverview[];
  onSelectDay: (dateStr: string) => Promise<DayDetail>;
}

export const HistorySection: React.FC<HistorySectionProps> = ({ days, onSelectDay }) => {
  const [selectedDate, setSelectedDate] = useState<string>(days[0]?.date || "");
  const [dayDetail, setDayDetail] = useState<DayDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedDate) {
      setLoading(true);
      onSelectDay(selectedDate)
        .then((detail) => setDayDetail(detail))
        .finally(() => setLoading(false));
    }
  }, [selectedDate]);

  return (
    <div>
      <h1 className="section-title">История и память по датам</h1>
      <p className="section-desc">
        Все данные структурированы по дням в файловом хранилище. Вы можете просмотреть контекст любого дня.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: "24px" }}>
        {/* Left: Days list */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "4px" }}>
            Доступные даты ({days.length})
          </div>

          {days.length === 0 ? (
            <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Пока нет сохранённых дней</div>
          ) : (
            days.map((d) => (
              <div
                key={d.date}
                className="card"
                style={{
                  padding: "12px 14px",
                  margin: 0,
                  cursor: "pointer",
                  backgroundColor: selectedDate === d.date ? "var(--bg-card-hover)" : "var(--bg-card)",
                  borderColor: selectedDate === d.date ? "var(--accent-blue)" : "var(--border-color)",
                }}
                onClick={() => setSelectedDate(d.date)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 600, fontSize: "14px" }}>{d.date}</div>
                  <ChevronRight size={14} color="var(--text-muted)" />
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                  Эпизодов: {d.episodes_count} · Заметок: {d.notes_count}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right: Selected Day Details */}
        <div>
          {loading ? (
            <div style={{ color: "var(--text-muted)", padding: "40px", textAlign: "center" }}>
              Загрузка истории за {selectedDate}...
            </div>
          ) : !dayDetail ? (
            <div style={{ color: "var(--text-muted)", padding: "40px", textAlign: "center" }}>
              Выберите дату для просмотра архива
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                <Calendar size={18} color="var(--accent-blue)" />
                <h2 style={{ fontSize: "18px", fontWeight: 600 }}>Архив за {dayDetail.date}</h2>
              </div>

              {/* Episodes */}
              <h3 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "12px", color: "var(--text-secondary)" }}>
                Зафиксированные эпизоды работы ({dayDetail.episodes.length})
              </h3>

              {dayDetail.episodes.length === 0 ? (
                <div className="card" style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                  В этот день эпизодов не зафиксировано
                </div>
              ) : (
                dayDetail.episodes.map((ep) => (
                  <div key={ep.id} className="card">
                    <div className="card-header">
                      <span className="card-title">{ep.title}</span>
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        {ep.created_at ? ep.created_at.slice(11, 19) : ""}
                      </span>
                    </div>
                    <div style={{ fontSize: "13px", color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>
                      {ep.body}
                    </div>
                    <div style={{ marginTop: "10px", fontSize: "11px", color: "var(--text-muted)" }}>
                      Файл: <code>{ep.path}</code>
                    </div>
                  </div>
                ))
              )}

              {/* Notes */}
              <h3 style={{ fontSize: "15px", fontWeight: 600, marginTop: "24px", marginBottom: "12px", color: "var(--text-secondary)" }}>
                Сохранённые заметки ({dayDetail.notes.length})
              </h3>

              {dayDetail.notes.length === 0 ? (
                <div className="card" style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                  В этот день заметок не создавалось
                </div>
              ) : (
                dayDetail.notes.map((note) => (
                  <div key={note.id} className="card">
                    <div className="card-header">
                      <span className="card-title">{note.title}</span>
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        {note.created_at ? note.created_at.slice(11, 19) : ""}
                      </span>
                    </div>
                    <div style={{ fontSize: "13px", color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>
                      {note.body}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
