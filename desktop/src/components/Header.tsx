import React from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { PolicyStatus, ConflictItem } from "../types/api";

interface HeaderProps {
  policy: PolicyStatus | null;
  conflicts: ConflictItem[];
  title: string;
  subtitle?: string;
  onSync: () => void;
  onViewConflicts: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  policy,
  conflicts,
  title,
  subtitle,
  onSync,
  onViewConflicts,
}) => (
  <header className="topbar">
    <div className="topbar-left">
      <h1 className="topbar-title">{title}</h1>
      {subtitle && <span className="topbar-date">{subtitle}</span>}
    </div>
    <div className="topbar-right">
      {conflicts.length > 0 && (
        <button className="btn-ghost conflict-btn" onClick={onViewConflicts}>
          <AlertTriangle size={13} />
          {conflicts.length} конфликта правок
        </button>
      )}
      <button className="btn-ghost" onClick={onSync} title="Переиндексировать хранилище">
        <RefreshCw size={13} />
        Синхронизировать
      </button>
    </div>
  </header>
);
