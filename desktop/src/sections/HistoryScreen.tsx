import React, { useState, useEffect } from "react";
import { Calendar, Clock, ChevronRight, Layers, FileText } from "lucide-react";
import { DayOverview, DayDetail } from "../types/api";

interface HistoryScreenProps {
  days: DayOverview[];
  onSelectDay: (dateStr: string) => Promise<DayDetail>;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ days, onSelectDay }) => {
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>История активности по датам</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Хроника рабочего контекста, сохраненная по дням в открытом файловом виде
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 20 }}>
        {/* Left Column: Dates list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
            Сохранённые дни ({days.length})
          </div>

          {days.length === 0 ? (
            <div className="card-box" style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Нет записей
            </div>
          ) : (
            days.map((d) => (
              <div
                key={d.date}
                className="card-box"
                style={{
                  padding: "12px 14px",
                  cursor: "pointer",
                  borderColor: selectedDate === d.date ? "var(--primary)" : "var(--border-color)",
                  background: selectedDate === d.date ? "#f0f6fe" : "#ffffff",
                }}
                onClick={() => setSelectedDate(d.date)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{d.date}</span>
                  <ChevronRight size={14} color="var(--text-light)" />
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>
                  {d.episodes_count} эпизодов • {d.notes_count} заметок
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right Column: Day Detail */}
        <div>
          {loading ? (
            <div className="card-box" style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
              Загрузка истории за {selectedDate}...
            </div>
          ) : !dayDetail ? (
            <div className="card-box" style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
              Выберите дату для просмотра
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="card-box">
                <div className="card-title-row">
                  <span className="card-heading">Эпизоды за {dayDetail.date} ({dayDetail.episodes.length})</span>
                </div>

                {dayDetail.episodes.length === 0 ? (
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>В этот день эпизодов не зафиксировано</div>
                ) : (
                  dayDetail.episodes.map((ep) => (
                    <div
                      key={ep.id}
                      style={{
                        padding: "12px 0",
                        borderBottom: "1px solid var(--border-color)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{ep.title}</span>
                        <span style={{ fontSize: 12, color: "var(--text-light)" }}>
                          {ep.created_at ? ep.created_at.slice(11, 16) : ""}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                        {ep.body}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                        Файл: <code>{ep.path}</code>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
