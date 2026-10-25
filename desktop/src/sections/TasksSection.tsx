import React, { useState } from "react";
import { Plus, Save, CheckCircle, X } from "lucide-react";
import { TaskItem, ConflictItem } from "../types/api";

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
  const [tab, setTab] = useState<"tasks" | "notes" | "conflicts">("tasks");
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc]   = useState("");
  const [newDue, setNewDue]     = useState("");

  const [noteTitle, setNoteTitle]   = useState("");
  const [noteBody, setNoteBody]     = useState("");
  const [noteTags, setNoteTags]     = useState("");
  const [noteSaved, setNoteSaved]   = useState(false);

  const columns: Array<{ s: TaskItem["status"]; label: string }> = [
    { s: "todo",          label: "К выполнению" },
    { s: "in_progress",   label: "В работе"     },
    { s: "waiting_reply", label: "Жду ответа"   },
    { s: "done",          label: "Готово"        },
  ];

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await onCreateTask(newTitle.trim(), newDesc.trim(), newDue || undefined);
    setNewTitle(""); setNewDesc(""); setNewDue(""); setShowModal(false);
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim()) return;
    const tags = noteTags.split(",").map((t) => t.trim()).filter(Boolean);
    await onCreateNote(noteTitle.trim(), noteBody.trim(), tags);
    setNoteTitle(""); setNoteBody(""); setNoteTags(""); setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 3000);
  };

  const nextStatus: Record<string, TaskItem["status"][]> = {
    todo:          ["in_progress", "done"],
    in_progress:   ["waiting_reply", "done"],
    waiting_reply: ["in_progress", "done"],
    done:          ["todo"],
  };

  return (
    <div>
      <div className="tabs">
        <button className={`tab-btn${tab === "tasks"     ? " active" : ""}`} onClick={() => setTab("tasks")}>
          Задачи ({tasks.length})
        </button>
        <button className={`tab-btn${tab === "notes"     ? " active" : ""}`} onClick={() => setTab("notes")}>
          Создать заметку
        </button>
        <button className={`tab-btn${tab === "conflicts" ? " active" : ""}`} onClick={() => setTab("conflicts")}
          style={{ color: conflicts.length > 0 ? "var(--danger)" : undefined }}
        >
          Конфликты ({conflicts.length})
        </button>
      </div>

      {/* ── Tasks ──────────────────────────────────────────────────────── */}
      {tab === "tasks" && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
              <Plus size={13} /> Новая задача
            </button>
          </div>
          <div className="kanban">
            {columns.map((col) => {
              const colTasks = tasks.filter((t) => t.status === col.s);
              return (
                <div key={col.s}>
                  <div className="kanban-col-head">
                    <span>{col.label}</span>
                    <span className="kanban-count">{colTasks.length}</span>
                  </div>
                  {colTasks.length === 0 && (
                    <div style={{ fontSize: 12, color: "var(--ink-3)", padding: "8px 0" }}>Нет задач</div>
                  )}
                  {colTasks.map((t) => (
                    <div key={t.id} className="task-card">
                      <div className="task-card-title">{t.title}</div>
                      {t.due_date && (
                        <div className="task-due">
                          До {t.due_date.slice(0, 10)}
                        </div>
                      )}
                      <div className="task-actions">
                        {(nextStatus[t.status] ?? []).map((ns) => (
                          <button
                            key={ns}
                            className="btn btn-secondary btn-sm"
                            onClick={() => onUpdateTaskStatus(t.id, ns)}
                          >
                            {ns === "done"          ? "Готово"         :
                             ns === "in_progress"   ? "В работу"       :
                             ns === "waiting_reply" ? "Жду ответа"     :
                             "К выполнению"}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Notes ──────────────────────────────────────────────────────── */}
      {tab === "notes" && (
        <div style={{ maxWidth: 640 }}>
          {noteSaved && (
            <div className="callout callout-success" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <CheckCircle size={15} /> Заметка сохранена в Memory/days/…
            </div>
          )}
          <form onSubmit={handleCreateNote}>
            <div className="form-row">
              <label className="form-label">Заголовок</label>
              <input className="form-input" placeholder="Название заметки" value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)} required />
            </div>
            <div className="form-row">
              <label className="form-label">Содержимое</label>
              <textarea className="form-input" rows={8} placeholder="Текст, договорённости, ссылки…"
                value={noteBody} onChange={(e) => setNoteBody(e.target.value)} />
            </div>
            <div className="form-row">
              <label className="form-label">Теги (через запятую)</label>
              <input className="form-input" placeholder="клиент, проект, важное" value={noteTags}
                onChange={(e) => setNoteTags(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary">
              <Save size={14} /> Сохранить
            </button>
          </form>
        </div>
      )}

      {/* ── Conflicts ──────────────────────────────────────────────────── */}
      {tab === "conflicts" && (
        <div>
          <div className="callout callout-warn" style={{ marginBottom: 16 }}>
            Когда вы редактируете файл памяти снаружи (например, в Obsidian) одновременно с тем,
            как приложение пишет в него — ваша версия всегда остаётся на месте. Версия приложения
            сохраняется рядом в папке <code>conflicts/</code>.
          </div>
          {conflicts.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-2)" }}>
              <CheckCircle size={16} color="var(--live)" /> Конфликтов нет — всё синхронизировано.
            </div>
          ) : (
            conflicts.map((c) => (
              <div key={c.id} className="card" style={{ marginBottom: 8, borderColor: "#FECACA" }}>
                <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--danger)", marginBottom: 6 }}>
                  Конфликт: {c.doc_id}
                </div>
                <div style={{ fontSize: 12.5, marginBottom: 6 }}><b>Причина:</b> {c.reason}</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
                  Ваша версия: <code>{c.canonical_path}</code>
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
                  Версия приложения: <code>{c.conflict_path}</code>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── New task modal ──────────────────────────────────────────────── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div className="modal-title" style={{ marginBottom: 0 }}>Новая задача</div>
              <button className="btn-link" style={{ color: "var(--ink-3)" }} onClick={() => setShowModal(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateTask}>
              <div className="form-row">
                <label className="form-label">Что нужно сделать</label>
                <input className="form-input" placeholder="Название задачи" value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)} autoFocus required />
              </div>
              <div className="form-row">
                <label className="form-label">Контекст или описание</label>
                <textarea className="form-input" rows={3} placeholder="Необязательно"
                  value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-label">Срок</label>
                <input type="date" className="form-input" value={newDue}
                  onChange={(e) => setNewDue(e.target.value)} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Отмена</button>
                <button type="submit" className="btn btn-primary">Создать</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
