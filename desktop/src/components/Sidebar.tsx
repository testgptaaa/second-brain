import React from "react";
import {
  Calendar,
  MessageSquare,
  Clock,
  CheckSquare,
  Settings,
  Brain,
  FolderOpen,
} from "lucide-react";

export type SectionType = "today" | "ask" | "history" | "tasks" | "settings";

interface SidebarProps {
  activeSection: SectionType;
  onSelectSection: (section: SectionType) => void;
  memoryRoot?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  memoryRoot,
}) => {
  const navItems: Array<{ id: SectionType; label: string; icon: React.ReactNode }> = [
    { id: "today", label: "Сегодня", icon: <Calendar size={18} /> },
    { id: "ask", label: "Спросить", icon: <MessageSquare size={18} /> },
    { id: "history", label: "История", icon: <Clock size={18} /> },
    { id: "tasks", label: "Задачи и заметки", icon: <CheckSquare size={18} /> },
    { id: "settings", label: "Настройки", icon: <Settings size={18} /> },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <Brain size={18} />
        </div>
        <div>
          <div className="sidebar-title">Второй мозг</div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Десктоп-ассистент</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <div
            key={item.id}
            className={`nav-item ${activeSection === item.id ? "active" : ""}`}
            onClick={() => onSelectSection(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <FolderOpen size={14} />
          <span>Файловая память</span>
        </div>
        <div style={{ fontSize: "11px", color: "var(--text-muted)", wordBreak: "break-all" }}>
          {memoryRoot ? memoryRoot.split("/").slice(-2).join("/") : "runtime_data/Memory"}
        </div>
      </div>
    </aside>
  );
};
