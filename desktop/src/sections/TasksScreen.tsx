import React, { useState } from "react";
import { Plus, CheckCircle2, Clock, AlertTriangle, X } from "lucide-react";
import { TaskItem, ConflictItem } from "../types/api";

interface TasksScreenProps {
  tasks: TaskItem[];
  conflicts: ConflictItem[];
  onCreateTask: (title: string, desc: string, due?: string) => Promise<void>;
  onUpdateStatus: (id: string, status: TaskItem["status"]) => Promise<void>;
}

export const TasksScreen: React.FC<TasksScreenProps> = ({
  tasks,
  conflicts,
  onCreateTask,
  onUpdateStatus,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [due, setDue] = useState("");

  const columns: Array<{ status: TaskItem["status"]; title: string; color: string }> = [
    { status: "todo", title: "К выполнению", color: "var(--primary)" },
    { status: "in_progress", title: "В работе", color: "var(--warning)" },
    { status: "waiting_reply", title: "Жду ответа", color: "var(--purple)" },
    { status: "done", title: "Выполнено", color: "var(--success)" },
  ];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await onCreateTask(title.trim(), desc.trim(), due || undefined);
    setTitle("");
    setDesc("");
    setDue("");
    setShowModal(false);
  };

  return (
    <div>
      {/* Header bar with button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Канбан задач</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Автоматически извлеченные из чатов и личные задачи
          </p>
        </div>
        <button
          className="btn-primary-action"
          onClick={() => setShowModal(true)}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <Plus size={16} />
          <span>Новая задача</span>
        </button>
      </div>

      {/* Conflicts Banner if any */}
      {conflicts.length > 0 && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "var(--radius-md)",
            padding: "12px 16px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "#991b1b",
            fontSize: 13,
          }}
        >
          <AlertTriangle size={18} color="var(--danger)" />
          <div>
            Обнаружено <b>{conflicts.length} расхождений</b> в файлах памяти. Ваши изменения сохранены в оригинальных файлах, версии приложения сохранены рядом в <code>conflicts/</code>.
          </div>
        </div>
      )}

      {/* 4 Kanban Columns */}
      <div className="kanban-board-grid">
        {columns.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.status);
          return (
            <div key={col.status} className="kanban-column">
              <div className="kanban-column-header">
                <span style={{ color: col.color }}>{col.title}</span>
                <span className="kanban-counter-badge">{colTasks.length}</span>
              </div>

              {colTasks.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--text-light)", textAlign: "center", padding: "30px 0" }}>
                  Нет задач
                </div>
              ) : (
                colTasks.map((t) => (
                  <div key={t.id} className="kanban-task-card">
                    <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 6 }}>{t.title}</div>
                    {t.due_date && (
                      <div
                        style={{
                          fontSize: 11.5,
                          color: "var(--text-muted)",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          marginBottom: 8,
                        }}
                      >
                        <Clock size={12} />
                        <span>До {t.due_date.slice(0, 10)}</span>
                      </div>
                    )}

                    {/* Transition action buttons */}
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
                      {col.status !== "todo" && (
                        <button
                          className="btn-secondary-action"
                          style={{ padding: "3px 8px", fontSize: 11 }}
                          onClick={() => onUpdateStatus(t.id, "todo")}
                        >
                          В план
                        </button>
                      )}
                      {col.status !== "in_progress" && (
                        <button
                          className="btn-secondary-action"
                          style={{ padding: "3px 8px", fontSize: 11 }}
                          onClick={() => onUpdateStatus(t.id, "in_progress")}
                        >
                          В работу
                        </button>
                      )}
                      {col.status !== "waiting_reply" && (
                        <button
                          className="btn-secondary-action"
                          style={{ padding: "3px 8px", fontSize: 11 }}
                          onClick={() => onUpdateStatus(t.id, "waiting_reply")}
                        >
                          Жду ответа
                        </button>
                      )}
                      {col.status !== "done" && (
                        <button
                          className="btn-secondary-action"
                          style={{ padding: "3px 8px", fontSize: 11, color: "var(--success)" }}
                          onClick={() => onUpdateStatus(t.id, "done")}
                        >
                          Готово
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

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content-box" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Создать задачу</h3>
              <button
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
                onClick={() => setShowModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="form-group-block">
                <label className="form-label-title">Название задачи</label>
                <input
                  type="text"
                  className="form-input-field"
                  placeholder="Что нужно сделать?"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="form-group-block">
                <label className="form-label-title">Описание или контекст</label>
                <textarea
                  className="form-input-field"
                  rows={3}
                  placeholder="Детали или ссылка на обсуждение..."
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                />
              </div>

              <div className="form-group-block">
                <label className="form-label-title">Срок выполнения</label>
                <input
                  type="date"
                  className="form-input-field"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
                <button type="button" className="btn-secondary-action" onClick={() => setShowModal(false)}>
                  Отмена
                </button>
                <button type="submit" className="btn-primary-action">
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
