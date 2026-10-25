import React from "react";
import { Play, Pause, AlertTriangle, RefreshCw } from "lucide-react";
import { PolicyStatus, ConflictItem } from "../types/api";

interface HeaderProps {
  policy: PolicyStatus | null;
  conflicts: ConflictItem[];
  onTogglePause: () => void;
  onSync: () => void;
  onViewConflicts: () => void;
  activeApp?: string;
}

export const Header: React.FC<HeaderProps> = ({
  policy,
  conflicts,
  onTogglePause,
  onSync,
  onViewConflicts,
  activeApp,
}) => {
  const isPaused = policy ? policy.is_paused : false;

  return (
    <header className="top-header">
      <div className="header-left">
        <div className={`status-badge ${isPaused ? "paused" : "active"}`}>
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: isPaused ? "var(--accent-amber)" : "var(--accent-green)",
              display: "inline-block",
            }}
          />
          {isPaused ? "Наблюдение на паузе" : "Наблюдение активно"}
        </div>

        {activeApp && (
          <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            Активно: <b style={{ color: "var(--text-secondary)" }}>{activeApp}</b>
          </span>
        )}
      </div>

      <div className="header-right">
        {conflicts.length > 0 && (
          <div className="conflict-badge" onClick={onViewConflicts}>
            <AlertTriangle size={14} />
            <span>Конфликтов: {conflicts.length}</span>
          </div>
        )}

        <button className="btn-pause" onClick={onSync} title="Переиндексировать файлы из папки Memory">
          <RefreshCw size={14} />
          <span>Синхронизировать</span>
        </button>

        <button
          className="btn-pause"
          onClick={onTogglePause}
          style={{
            borderColor: isPaused ? "var(--accent-green)" : "var(--border-color)",
          }}
        >
          {isPaused ? <Play size={14} color="var(--accent-green)" /> : <Pause size={14} color="var(--accent-amber)" />}
          <span>{isPaused ? "Возобновить" : "Пауза"}</span>
        </button>
      </div>
    </header>
  );
};
