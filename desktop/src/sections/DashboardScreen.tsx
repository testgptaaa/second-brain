import React from "react";
import {
  Clock,
  CheckCircle2,
  Circle,
  FileText,
  BarChart3,
  Calendar,
  FileSpreadsheet,
  Plus,
  ArrowRight,
  TrendingUp,
  FileCode,
  FileCheck,
} from "lucide-react";
import { DayDetail, TaskItem, SuggestionItem, NavSection } from "../types/api";

interface DashboardScreenProps {
  dayDetail: DayDetail | null;
  tasks: TaskItem[];
  suggestions: SuggestionItem[];
  onNavigate: (section: NavSection) => void;
  onToggleTaskStatus: (id: string, currentStatus: TaskItem["status"]) => void;
  onOpenNewTaskModal: () => void;
  onOpenQuickPrompt: (prompt: string) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  dayDetail,
  tasks,
  suggestions,
  onNavigate,
  onToggleTaskStatus,
  onOpenNewTaskModal,
  onOpenQuickPrompt,
}) => {
  // Activity histogram values (simulating hours from 08:00 to 18:00)
  const activityHours = [
    { time: "08:00", height: 25 },
    { time: "09:00", height: 45 },
    { time: "10:00", height: 85 },
    { time: "11:00", height: 65 },
    { time: "12:00", height: 40 },
    { time: "13:00", height: 20 },
    { time: "14:00", height: 70 },
    { time: "15:00", height: 95, highlight: true },
    { time: "16:00", height: 60 },
    { time: "17:00", height: 50 },
    { time: "18:00", height: 35 },
  ];

  // Upcoming meetings from screenshot
  const meetings = [
    { time: "10:00", title: "Планирование спринта", sub: "Google Meet • 1 час" },
    { time: "13:00", title: "Обед", sub: "1 час" },
    { time: "15:00", title: "Обсуждение KPI", sub: "Zoom • 45 мин" },
    { time: "17:00", title: "Созвон с клиентом", sub: "Google Meet • 30 мин" },
  ];

  // Recent materials from screenshot
  const materials = [
    {
      id: "mat-1",
      title: "Sales_Q4_v3.xlsx",
      meta: "10:24 • Excel • 12 МБ",
      type: "excel",
    },
    {
      id: "mat-2",
      title: "Методика расчета KPI.docx",
      meta: "Вчера, 16:42 • Word • 2.1 МБ",
      type: "word",
    },
    {
      id: "mat-3",
      title: "Презентация_спринт.pdf",
      meta: "Вчера, 14:18 • PDF • 8.4 МБ",
      type: "pdf",
    },
  ];

  const todoTasks = tasks.slice(0, 4);

  return (
    <div className="dashboard-grid">
      {/* ROW 1: 3 Stat Cards from Screenshot */}
      <div className="stats-cards-row">
        {/* Card 1: Active Work */}
        <div className="stat-card">
          <div className="stat-icon-wrapper green">
            <Clock size={22} />
          </div>
          <div>
            <div className="stat-value">6 ч 20 мин</div>
            <div className="stat-label">Активной работы</div>
            <div className="stat-delta green">↑ 12% к вчера</div>
          </div>
        </div>

        {/* Card 2: Open Tasks */}
        <div className="stat-card">
          <div className="stat-icon-wrapper purple">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div className="stat-value">{tasks.filter((t) => t.status !== "done").length || 17}</div>
            <div className="stat-label">Открытых задач</div>
            <div className="stat-delta purple">+ 3 новых</div>
          </div>
        </div>

        {/* Card 3: Materials / Files */}
        <div className="stat-card">
          <div className="stat-icon-wrapper blue">
            <FileText size={22} />
          </div>
          <div>
            <div className="stat-value">24</div>
            <div className="stat-label">Новых материала</div>
            <div className="stat-delta blue">из 6 приложений</div>
          </div>
        </div>
      </div>

      {/* ROW 2: Activity by Time Bar Chart */}
      <div className="activity-chart-box">
        <div className="card-title-row">
          <span className="card-heading">Активность по времени</span>
          <span className="card-link" onClick={() => onNavigate("history")}>
            Подробнее <ArrowRight size={14} />
          </span>
        </div>

        <div className="histogram-row">
          {activityHours.map((item, idx) => (
            <div key={idx} className="hist-col">
              <div
                className={`hist-bar ${item.highlight ? "highlight" : ""}`}
                style={{ height: `${item.height}%` }}
                title={`${item.time}: ${item.height}% активности`}
              />
              <span className="hist-time">{item.time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ROW 3: Two Column Grid */}
      <div className="dashboard-middle-row">
        {/* LEFT COLUMN: Recent Apps & Current Tasks */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Card: Recent Apps */}
          <div className="card-box">
            <div className="card-title-row">
              <span className="card-heading">Недавние приложения</span>
            </div>

            <div className="recent-apps-row">
              <div className="app-tile">
                <div className="app-icon-circle app-icon-chrome">Cr</div>
                <div className="app-name-text">Chrome</div>
                <div className="app-time-text">2 ч 15 мин</div>
              </div>

              <div className="app-tile">
                <div className="app-icon-circle app-icon-excel">Xl</div>
                <div className="app-name-text">Excel</div>
                <div className="app-time-text">1 ч 40 мин</div>
              </div>

              <div className="app-tile">
                <div className="app-icon-circle app-icon-telegram">Tg</div>
                <div className="app-name-text">Telegram</div>
                <div className="app-time-text">Telegram</div>
              </div>

              <div className="app-tile">
                <div className="app-icon-circle app-icon-word">Wd</div>
                <div className="app-name-text">Word</div>
                <div className="app-time-text">30 мин</div>
              </div>

              <div className="app-tile">
                <div className="app-icon-circle app-icon-other">•••</div>
                <div className="app-name-text">Другие</div>
                <div className="app-time-text">&nbsp;</div>
              </div>
            </div>
          </div>

          {/* Card: Current Tasks */}
          <div className="card-box">
            <div className="card-title-row">
              <span className="card-heading">Текущие задачи</span>
              <span className="card-link" onClick={() => onNavigate("tasks")}>
                Все задачи <ArrowRight size={14} />
              </span>
            </div>

            <div className="task-checklist">
              {todoTasks.map((t) => {
                const isDone = t.status === "done";
                return (
                  <div key={t.id} className="task-check-row">
                    <div className="task-check-left">
                      <button
                        className="task-checkbox-btn"
                        onClick={() => onToggleTaskStatus(t.id, t.status)}
                      >
                        {isDone ? (
                          <CheckCircle2 size={18} color="var(--success)" />
                        ) : (
                          <Circle size={18} color="var(--border-color)" />
                        )}
                      </button>
                      <span className={`task-check-title ${isDone ? "completed" : ""}`}>
                        {t.title}
                      </span>
                    </div>
                    <span className="task-check-due">
                      {t.due_date ? t.due_date.slice(5, 10) : "Сегодня"}
                    </span>
                  </div>
                );
              })}

              <button className="btn-add-task-row" onClick={onOpenNewTaskModal}>
                <Plus size={15} />
                <span>Новая задача</span>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Quick Access & Upcoming Meetings */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Card: Quick Access (4 tiles) */}
          <div className="card-box">
            <div className="card-title-row">
              <span className="card-heading">Быстрый доступ</span>
            </div>

            <div className="quick-access-grid">
              <div
                className="qa-tile"
                onClick={() => onOpenQuickPrompt("Создать отчет по рабочему дню")}
              >
                <div className="qa-tile-icon" style={{ background: "#f5f3ff", color: "#8b5cf6" }}>
                  <FileText size={18} />
                </div>
                <span className="qa-tile-title">Создать отчет</span>
              </div>

              <div
                className="qa-tile"
                onClick={() => onOpenQuickPrompt("Проанализировать таблицу сметы")}
              >
                <div className="qa-tile-icon" style={{ background: "#ecfdf5", color: "#10b981" }}>
                  <BarChart3 size={18} />
                </div>
                <span className="qa-tile-title">Проанализировать таблицу</span>
              </div>

              <div
                className="qa-tile"
                onClick={() => onOpenQuickPrompt("Подготовить к встрече")}
              >
                <div className="qa-tile-icon" style={{ background: "#eff6ff", color: "#2563eb" }}>
                  <Calendar size={18} />
                </div>
                <span className="qa-tile-title">Подготовить к встрече</span>
              </div>

              <div
                className="qa-tile"
                onClick={() => onNavigate("notes")}
              >
                <div className="qa-tile-icon" style={{ background: "#fff7ed", color: "#f97316" }}>
                  <FileCode size={18} />
                </div>
                <span className="qa-tile-title">Новая заметка</span>
              </div>
            </div>
          </div>

          {/* Card: Upcoming Meetings */}
          <div className="card-box">
            <div className="card-title-row">
              <span className="card-heading">Ближайшие встречи</span>
              <span className="card-link" onClick={() => onNavigate("history")}>
                Все встречи <ArrowRight size={14} />
              </span>
            </div>

            <div className="meetings-list">
              {meetings.map((m, idx) => (
                <div key={idx} className="meeting-row">
                  <span className="meeting-time">{m.time}</span>
                  <div className="meeting-details">
                    <div className="meeting-title">{m.title}</div>
                    <div className="meeting-sub">{m.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ROW 4: Recent Materials */}
      <div className="card-box">
        <div className="card-title-row">
          <span className="card-heading">Недавние материалы</span>
          <span className="card-link" onClick={() => onNavigate("files")}>
            Все материалы <ArrowRight size={14} />
          </span>
        </div>

        <div className="materials-list">
          {materials.map((m) => (
            <div key={m.id} className="material-row">
              <div className={`material-icon-box ${m.type}`}>
                {m.type === "excel" ? (
                  <FileSpreadsheet size={18} />
                ) : m.type === "word" ? (
                  <FileText size={18} />
                ) : (
                  <FileCheck size={18} />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div className="material-title">{m.title}</div>
                <div className="material-meta">{m.meta}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
