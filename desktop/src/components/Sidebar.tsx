import React from "react";
import { Calendar, MessageSquare, Clock, CheckSquare, Settings } from "lucide-react";

export type SectionType = "today" | "ask" | "history" | "tasks" | "settings";

interface SidebarProps {
  activeSection: SectionType;
  onSelectSection: (s: SectionType) => void;
  isPaused: boolean;
  onTogglePause: () => void;
  memoryRoot?: string;
  currentApp?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  isPaused,
  onTogglePause,
  memoryRoot,
  currentApp,
}) => {
  const nav: Array<{ id: SectionType; label: string; icon: React.ReactNode }> = [
    { id: "today",   label: "Сегодня",          icon: <Calendar size={15} /> },
    { id: "ask",     label: "Поиск и вопросы",   icon: <MessageSquare size={15} /> },
    { id: "history", label: "История",           icon: <Clock size={15} /> },
    { id: "tasks",   label: "Задачи и заметки",  icon: <CheckSquare size={15} /> },
    { id: "settings",label: "Настройки",         icon: <Settings size={15} /> },
  ];

  const today = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-name">Второй мозг</div>
        <div className="sidebar-brand-sub">{today}</div>
      </div>

      <nav className="sidebar-nav">
        {nav.map((item) => (
          <div
            key={item.id}
            className={`nav-item${activeSection === item.id ? " active" : ""}`}
            onClick={() => onSelectSection(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
          </div>
        ))}
      </nav>

      <div className="sidebar-status">
        <div className="status-row">
          <div className={`status-dot${isPaused ? " paused" : " live"}`} />
          <span>{isPaused ? "Пауза" : "Наблюдение"}</span>
        </div>
        {!isPaused && currentApp && (
          <div className="status-app-name" title={currentApp}>{currentApp}</div>
        )}
        <button className="btn-pause" onClick={onTogglePause}>
          {isPaused ? "Возобновить" : "Пауза"}
        </button>
      </div>
    </aside>
  );
};
