import React from "react";
import { ChevronDown, AlertTriangle, RefreshCw, Sparkles, Calendar } from "lucide-react";
import { NavSection, ConflictItem, ModelConfig } from "../types/api";

interface HeaderProps {
  activeSection: NavSection;
  conflicts: ConflictItem[];
  modelConfig: ModelConfig | null;
  onSync: () => void;
  onViewConflicts: () => void;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeSection,
  conflicts,
  modelConfig,
  onSync,
  onViewConflicts,
  onOpenSettings,
}) => {
  const getTitles = (): { title: string; subtitle: string } => {
    switch (activeSection) {
      case "chat":
        return {
          title: "Чат с памятью",
          subtitle: "Задавайте вопросы и получайте ответы со ссылками на источники",
        };
      case "dashboard":
        return {
          title: "Ваш рабочий день",
          subtitle: "Обзор активности, задач и материалов",
        };
      case "tasks":
        return {
          title: "Задачи",
          subtitle: "Контроль договоренностей и дедлайнов",
        };
      case "files":
        return {
          title: "Файлы и контекст",
          subtitle: "Сохранённые документы, таблицы и переписки",
        };
      case "history":
        return {
          title: "История активности",
          subtitle: "Хроника посещений сайтов и работы в приложениях",
        };
      case "notes":
        return {
          title: "Заметки",
          subtitle: "Личные записи и зафиксированные мысли",
        };
      case "settings":
        return {
          title: "Настройки",
          subtitle: "Параметры моделей, исключения и безопасность",
        };
    }
  };

  const { title, subtitle } = getTitles();
  const modelName = modelConfig?.text_model || modelConfig?.model_name || "gpt-5.6-luna";

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="topbar-page-title">{title}</h1>
        <span className="topbar-page-subtitle">• {subtitle}</span>
      </div>

      <div className="topbar-right">
        {/* Conflicts button */}
        {conflicts.length > 0 && (
          <button
            className="badge-dropdown"
            onClick={onViewConflicts}
            style={{ color: "var(--danger)", borderColor: "#fecaca", background: "#fef2f2" }}
          >
            <AlertTriangle size={14} />
            <span>{conflicts.length} расхождений</span>
          </button>
        )}

        {/* Sync Button */}
        <button className="badge-dropdown" onClick={onSync} title="Синхронизировать файлы">
          <RefreshCw size={13} />
          <span>Синхронизация</span>
        </button>

        {/* Context Badge (Model selector in chat, Date picker in dashboard) */}
        {activeSection === "chat" ? (
          <div className="badge-dropdown" onClick={onOpenSettings}>
            <Sparkles size={13} color="var(--primary)" />
            <span>{modelName}</span>
            <ChevronDown size={14} color="var(--text-muted)" />
          </div>
        ) : (
          <div className="badge-dropdown">
            <Calendar size={13} color="var(--primary)" />
            <span>Сегодня</span>
            <ChevronDown size={14} color="var(--text-muted)" />
          </div>
        )}

        {/* User Avatar Circle */}
        <div className="avatar-circle" title="Андрей (Офисный профиль)">
          А
        </div>
      </div>
    </header>
  );
};
