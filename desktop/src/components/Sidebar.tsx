import React from "react";
import {
  Brain,
  MessageSquare,
  LayoutDashboard,
  CheckSquare,
  Folder,
  Clock,
  FileText,
  Settings,
  Pause,
  Play,
} from "lucide-react";
import { NavSection } from "../types/api";

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  isPaused: boolean;
  onTogglePause: () => void;
  storageUsedMb?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  isPaused,
  onTogglePause,
  storageUsedMb = 0,
}) => {
  const navItems: Array<{
    id: NavSection;
    label: string;
    icon: React.ReactNode;
  }> = [
    { id: "chat", label: "Чат", icon: <MessageSquare size={17} /> },
    { id: "dashboard", label: "Дашборд", icon: <LayoutDashboard size={17} /> },
    { id: "tasks", label: "Задачи", icon: <CheckSquare size={17} /> },
    { id: "files", label: "Файлы", icon: <Folder size={17} /> },
    { id: "history", label: "История", icon: <Clock size={17} /> },
    { id: "notes", label: "Заметки", icon: <FileText size={17} /> },
    { id: "settings", label: "Настройки", icon: <Settings size={17} /> },
  ];

  const storageGb = (storageUsedMb / 1024).toFixed(1);

  return (
    <aside className="sidebar">
      {/* Brand Logo & Title */}
      <div className="sidebar-brand">
        <div className="sidebar-logo-icon">
          <Brain size={20} />
        </div>
        <div>
          <div className="sidebar-brand-title">Второй Мозг</div>
          <div className="sidebar-brand-desc">Ваш AI-помощник в работе</div>
        </div>
      </div>

      {/* Nav List */}
      <nav className="sidebar-nav" aria-label="Разделы">
        {navItems.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`nav-link ${activeSection === item.id ? "active" : ""}`}
            onClick={() => onSelectSection(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Bottom Status Card & Storage */}
      <div className="sidebar-bottom">
        <div className="status-card">
          <div className="status-header">
            <div className={`pulse-dot ${isPaused ? "paused" : "active"}`} />
            <span>
              {isPaused ? "Наблюдение выключено" : "Наблюдение выключено в M1"}
            </span>
          </div>
          <div className="status-desc">
            {isPaused
              ? "Сбор контекста приостановлен"
              : "Собираю контекст из приложений"}
          </div>
          <button className="btn-sidebar-pause" onClick={onTogglePause}>
            {isPaused ? (
              <>
                <Play size={13} color="var(--primary)" />
                <span>Настройки наблюдения</span>
              </>
            ) : (
              <>
                <Pause size={13} color="var(--warning)" />
                <span>Пауза</span>
              </>
            )}
          </button>
        </div>

        <p className="status-desc">
          Память хранится локально. Захват экрана выключен в M1.
        </p>
      </div>
    </aside>
  );
};
