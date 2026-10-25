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
  storageUsedMb = 2450,
}) => {
  const navItems: Array<{ id: NavSection; label: string; icon: React.ReactNode }> = [
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
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <div
            key={item.id}
            className={`nav-link ${activeSection === item.id ? "active" : ""}`}
            onClick={() => onSelectSection(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
          </div>
        ))}
      </nav>

      {/* Bottom Status Card & Storage */}
      <div className="sidebar-bottom">
        <div className="status-card">
          <div className="status-header">
            <div className={`pulse-dot ${isPaused ? "paused" : "active"}`} />
            <span>{isPaused ? "Наблюдение на паузе" : "Наблюдение активно"}</span>
          </div>
          <div className="status-desc">
            {isPaused ? "Сбор контекста приостановлен" : "Собираю контекст из приложений"}
          </div>
          <button className="btn-sidebar-pause" onClick={onTogglePause}>
            {isPaused ? (
              <>
                <Play size={13} color="var(--primary)" />
                <span>Возобновить</span>
              </>
            ) : (
              <>
                <Pause size={13} color="var(--warning)" />
                <span>Пауза</span>
              </>
            )}
          </button>
        </div>

        {/* Storage Bar */}
        <div className="storage-box">
          <div className="storage-header">
            <span>Хранилище</span>
            <span style={{ fontWeight: 600 }}>{storageGb} ГБ из 10 ГБ</span>
          </div>
          <div className="storage-bar-track">
            <div
              className="storage-bar-fill"
              style={{ width: `${Math.min(100, (storageUsedMb / 10240) * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </aside>
  );
};
