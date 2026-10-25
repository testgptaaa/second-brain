import React, { useState } from "react";
import {
  CheckSquare,
  Plus,
  AlertTriangle,
  Clock,
  CheckCircle,
  Circle,
  FileText,
  Save,
} from "lucide-react";
import { TaskItem, ConflictItem, MemoryDoc } from "../types/api";

interface TasksSectionProps {
  tasks: TaskItem[];
  conflicts: ConflictItem[];
  onCreateTask: (title: string, description: string, dueDate?: string) => Promise<void>;
  onUpdateTaskStatus: (id: string, status: TaskItem["status"]) => Promise<void>;
  onCreateNote: (title: string, content: string, tags?: string[]) => Promise<void>;
}

export const TasksSection: React.FC<TasksSectionProps> = ({
  tasks,
  conflicts,
  onCreateTask,
  onUpdateTaskStatus,
  onCreateNote,
}) => {
  const [activeTab, setActiveTab] = useState<"tasks" | "notes" | "conflicts">("tasks");

  // New task form state
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskDue, setNewTaskDue] = useState("");

  // New note form state
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [newNoteTags, setNewNoteTags] = useState("");

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    await onCreateTask(newTaskTitle.trim(), newTaskDesc.trim(), newTaskDue || undefined);
    setNewTaskTitle("");
    setNewTaskDesc("");
    setNewTaskDue("");
    setShowNewTaskModal(false);
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteTitle.trim()) return;
    const tags = newNoteTags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    await onCreateNote(newNoteTitle.trim(), newNoteContent.trim(), tags);
    setNewNoteTitle("");
    setNewNoteContent("");
    setNewNoteTags("");
    alert("Заметка успешно сохранена в Memory/days/...");
  };

  const columns: Array<{ status: TaskItem["status"]; title: string; color: string }> = [
    { status: "todo", title: "К выполнению", color: "var(--accent-blue)" },
    { status: "in_progress", title: "В работе", color: "var(--accent-amber)" },
    { status: "waiting_reply", title: "Жду ответа", color: "var(--accent-purple)" },
    { status: "done", title: "Выполнено", color: "var(--accent-green)" },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 className="section-title">Задачи, заметки и конфликты</h1>
          <p className="section-desc">Управление договорённостями, личные заметки и разрешение внешних правок</p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            className="btn-primary"
            onClick={() => setShowNewTaskModal(true)}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Plus size={16} />
            <span>Новая задача</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--border-color)", marginBottom: "20px" }}>
        <button
          className="btn-secondary"
          style={{
            borderBottom: activeTab === "tasks" ? "2px solid var(--accent-blue)" : "none",
            borderRadius: "6px 6px 0 0",
            color: activeTab === "tasks" ? "var(--accent-blue)" : "var(--text-secondary)",
          }}
          onClick={() => setActiveTab("tasks")}
        >
          Задачи ({tasks.length})
        </button>
        <button
          className="btn-secondary"
          style={{
            borderBottom: activeTab === "notes" ? "2px solid var(--accent-blue)" : "none",
            borderRadius: "6px 6px 0 0",
            color: activeTab === "notes" ? "var(--accent-blue)" : "var(--text-secondary)",
          }}
          onClick={() => setActiveTab("notes")}
        >
          Создать заметку
        </button>
        <button
          className="btn-secondary"
          style={{
            borderBottom: activeTab === "conflicts" ? "2px solid var(--accent-red)" : "none",
            borderRadius: "6px 6px 0 0",
            color: conflicts.length > 0 ? "var(--accent-red)" : "var(--text-secondary)",
          }}
          onClick={() => setActiveTab("conflicts")}
        >
          Конфликты правок ({conflicts.length})
        </button>
      </div>

      {/* TAB 1: Tasks Kanban */}
      {activeTab === "tasks" && (
        <div className="kanban-grid">
          {columns.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.status);
            return (
              <div key={col.status} className="kanban-col">
                <div className="kanban-col-header">
                  <span style={{ color: col.color }}>{col.title}</span>
                  <span style={{ color: "var(--text-muted)" }}>{colTasks.length}</span>
                </div>

                {colTasks.length === 0 ? (
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", padding: "20px 0" }}>
                    Нет задач
                  </div>
                ) : (
                  colTasks.map((t) => (
                    <div key={t.id} className="card" style={{ marginBottom: "10px", padding: "12px" }}>
                      <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "6px" }}>{t.title}</div>
                      {t.due_date && (
                        <div style={{ fontSize: "11px", color: "var(--accent-amber)", display: "flex", alignItems: "center", gap: "4px", marginBottom: "8px" }}>
                          <Clock size={12} />
                          <span>Срок: {t.due_date.slice(0, 10)}</span>
                        </div>
                      )}

                      {/* State transition buttons */}
                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "8px" }}>
                        {col.status !== "todo" && (
                          <button
                            className="btn-secondary"
                            style={{ fontSize: "10px", padding: "2px 6px" }}
                            onClick={() => onUpdateTaskStatus(t.id, "todo")}
                          >
                            К выполнению
                          </button>
                        )}
                        {col.status !== "in_progress" && (
                          <button
                            className="btn-secondary"
                            style={{ fontSize: "10px", padding: "2px 6px" }}
                            onClick={() => onUpdateTaskStatus(t.id, "in_progress")}
                          >
                            В работу
                          </button>
                        )}
                        {col.status !== "waiting_reply" && (
                          <button
                            className="btn-secondary"
                            style={{ fontSize: "10px", padding: "2px 6px" }}
                            onClick={() => onUpdateTaskStatus(t.id, "waiting_reply")}
                          >
                            Жду ответа
                          </button>
                        )}
                        {col.status !== "done" && (
                          <button
                            className="btn-secondary"
                            style={{ fontSize: "10px", padding: "2px 6px", color: "var(--accent-green)" }}
                            onClick={() => onUpdateTaskStatus(t.id, "done")}
                          >
                            Завершить
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: Notes Editor */}
      {activeTab === "notes" && (
        <div className="card" style={{ maxWidth: "700px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <FileText size={18} />
            <span>Новая заметка в локальную память</span>
          </h2>

          <form onSubmit={handleCreateNote}>
            <div className="form-group">
              <label className="form-label">Заголовок заметки</label>
              <input
                type="text"
                className="form-input"
                placeholder="Например: Итоги встречи с поставщиком"
                value={newNoteTitle}
                onChange={(e) => setNewNoteTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Содержимое (Markdown)</label>
              <textarea
                className="form-input"
                rows={8}
                placeholder="Запишите мысли, договорённости или скопированный текст..."
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Теги (через запятую)</label>
              <input
                type="text"
                className="form-input"
                placeholder="клиент, договор, 2026"
                value={newNoteTags}
                onChange={(e) => setNewNoteTags(e.target.value)}
              />
            </div>

            <button type="submit" className="btn-primary" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Save size={16} />
              <span>Сохранить в Memory</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: Conflicts Viewer (EXTERNAL_EDITS.md) */}
      {activeTab === "conflicts" && (
        <div>
          <div className="card" style={{ backgroundColor: "rgba(248, 113, 113, 0.08)", borderColor: "rgba(248, 113, 113, 0.3)", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--accent-red)", fontWeight: 600, marginBottom: "6px" }}>
              <AlertTriangle size={18} />
              <span>Правило разрешения конфликтов внешних правок</span>
            </div>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Приложение никогда не затирает файл, изменённый вами в сторонней программе (Obsidian, VS Code и др.). Ваши изменения сохранены в оригинальном файле. Версия приложения сохранена рядом в папке <code>conflicts/</code>.
            </p>
          </div>

          {conflicts.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
              <CheckCircle size={32} color="var(--accent-green)" style={{ margin: "0 auto 10px", display: "block" }} />
              Конфликтов нет. Все файлы памяти синхронизированы с базой данных.
            </div>
          ) : (
            conflicts.map((cnf) => (
              <div key={cnf.id} className="card" style={{ borderColor: "var(--accent-red)" }}>
                <div className="card-header">
                  <span className="card-title" style={{ color: "var(--accent-red)" }}>
                    Конфликт: {cnf.doc_id}
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{cnf.created_at}</span>
                </div>
                <div style={{ fontSize: "13px", marginBottom: "8px" }}>
                  <b>Причина:</b> {cnf.reason}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div>
                    Ваша версия осталась на месте: <code>{cnf.canonical_path}</code>
                  </div>
                  <div>
                    Версия приложения записана в: <code>{cnf.conflict_path}</code>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal for creating task */}
      {showNewTaskModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div className="card" style={{ width: "480px", maxWidth: "90vw", background: "var(--bg-primary)" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>Создать новую задачу</h2>
            <form onSubmit={handleCreateTask}>
              <div className="form-group">
                <label className="form-label">Название задачи</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Что необходимо сделать?"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Описание / контекст</label>
                <textarea
                  className="form-input"
                  rows={4}
                  placeholder="Дополнительные детали или цитата из чата..."
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Срок выполнения (дедлайн)</label>
                <input
                  type="date"
                  className="form-input"
                  value={newTaskDue}
                  onChange={(e) => setNewTaskDue(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
                <button type="button" className="btn-secondary" onClick={() => setShowNewTaskModal(false)}>
                  Отмена
                </button>
                <button type="submit" className="btn-primary">
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
