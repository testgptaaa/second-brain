import React, { useState } from "react";
import {
  FileSpreadsheet,
  FileText,
  FileCheck,
  Search,
  ExternalLink,
  FolderOpen,
  Filter,
} from "lucide-react";

interface FilesScreenProps {
  onSearchQuery: (query: string) => void;
}

export const FilesScreen: React.FC<FilesScreenProps> = ({ onSearchQuery }) => {
  const [filterType, setFilterType] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const files = [
    {
      id: "f-1",
      name: "Sales_Q4_v3.xlsx",
      app: "Excel",
      size: "12 МБ",
      date: "Сегодня, 10:24",
      path: "days/2026/10/25/sources/obs-sales.json",
      type: "sheet",
    },
    {
      id: "f-2",
      name: "Методика расчета KPI.docx",
      app: "Word",
      size: "2.1 МБ",
      date: "Вчера, 16:42",
      path: "days/2026/10/24/sources/obs-kpi.json",
      type: "doc",
    },
    {
      id: "f-3",
      name: "Презентация_спринт.pdf",
      app: "Preview / Acrobat",
      size: "8.4 МБ",
      date: "Вчера, 14:18",
      path: "days/2026/10/24/sources/obs-sprint.json",
      type: "pdf",
    },
    {
      id: "f-4",
      name: "Договор_Вектор_2026.pdf",
      app: "Chrome / Google Drive",
      size: "3.2 МБ",
      date: "23 окт, 11:05",
      path: "days/2026/10/23/sources/obs-contract.json",
      type: "pdf",
    },
    {
      id: "f-5",
      name: "Бюджет_маркетинг_итог.xlsx",
      app: "Excel",
      size: "4.8 МБ",
      date: "22 окт, 18:30",
      path: "days/2026/10/22/sources/obs-mktg.json",
      type: "sheet",
    },
  ];

  const filtered = files.filter((f) => {
    if (filterType === "sheet" && f.type !== "sheet") return false;
    if (filterType === "doc" && f.type !== "doc") return false;
    if (filterType === "pdf" && f.type !== "pdf") return false;
    if (searchTerm && !f.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Файлы и материалы</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Все зафиксированные в рабочей памяти документы с метаданными и ссылками
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search
            size={16}
            color="var(--text-light)"
            style={{ position: "absolute", left: 14, top: 12 }}
          />
          <input
            type="text"
            className="form-input-field"
            placeholder="Поиск по названию файла..."
            style={{ paddingLeft: 38 }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <button
            className={`badge-dropdown ${filterType === "all" ? "active" : ""}`}
            style={{ background: filterType === "all" ? "var(--primary-light)" : "#fff", color: filterType === "all" ? "var(--primary)" : "var(--text-secondary)" }}
            onClick={() => setFilterType("all")}
          >
            Все ({files.length})
          </button>
          <button
            className={`badge-dropdown ${filterType === "sheet" ? "active" : ""}`}
            style={{ background: filterType === "sheet" ? "var(--primary-light)" : "#fff", color: filterType === "sheet" ? "var(--primary)" : "var(--text-secondary)" }}
            onClick={() => setFilterType("sheet")}
          >
            Таблицы
          </button>
          <button
            className={`badge-dropdown ${filterType === "doc" ? "active" : ""}`}
            style={{ background: filterType === "doc" ? "var(--primary-light)" : "#fff", color: filterType === "doc" ? "var(--primary)" : "var(--text-secondary)" }}
            onClick={() => setFilterType("doc")}
          >
            Документы
          </button>
          <button
            className={`badge-dropdown ${filterType === "pdf" ? "active" : ""}`}
            style={{ background: filterType === "pdf" ? "var(--primary-light)" : "#fff", color: filterType === "pdf" ? "var(--primary)" : "var(--text-secondary)" }}
            onClick={() => setFilterType("pdf")}
          >
            PDF
          </button>
        </div>
      </div>

      {/* Files List */}
      <div className="card-box" style={{ padding: 0 }}>
        {filtered.map((f, idx) => (
          <div
            key={f.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 20px",
              borderBottom: idx < filtered.length - 1 ? "1px solid var(--border-color)" : "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                className={`material-icon-box ${
                  f.type === "sheet" ? "excel" : f.type === "doc" ? "word" : "pdf"
                }`}
              >
                {f.type === "sheet" ? (
                  <FileSpreadsheet size={18} />
                ) : f.type === "doc" ? (
                  <FileText size={18} />
                ) : (
                  <FileCheck size={18} />
                )}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{f.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  {f.date} • {f.app} • {f.size}
                </div>
              </div>
            </div>

            <button
              className="btn-secondary-action"
              style={{ fontSize: 12, padding: "6px 12px", display: "flex", alignItems: "center", gap: 6 }}
              onClick={() => onSearchQuery(f.name)}
            >
              <span>Спросить о файле</span>
              <ExternalLink size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
