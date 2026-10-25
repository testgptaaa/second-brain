import React, { useState } from "react";
import { Plus, Save, FileText, CheckCircle2, Tag } from "lucide-react";

interface NotesScreenProps {
  onCreateNote: (title: string, content: string, tags?: string[]) => Promise<void>;
}

export const NotesScreen: React.FC<NotesScreenProps> = ({ onCreateNote }) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [savedNotice, setSavedNotice] = useState(false);

  const sampleNotes = [
    {
      id: "note-1",
      title: "Договорённости с клиентом ООО Вектор",
      date: "Сегодня, 12:40",
      tags: ["клиент", "договор"],
      preview: "Обсудили продление договора на следующий квартал. Согласовали перенос на 10 ноября.",
    },
    {
      id: "note-2",
      title: "План перехода на новую версию CRM",
      date: "Вчера, 17:15",
      tags: ["битрикс", "crm"],
      preview: "Этапы миграции баз данных, обучение сотрудников и перенос кастомных полей.",
    },
    {
      id: "note-3",
      title: "Идеи по оптимизации еженедельной отчетности",
      date: "23 окт, 14:00",
      tags: ["отчеты", "процессы"],
      preview: "Автоматически подтягивать суммы из 1С и сверять со сметой в Excel.",
    },
  ];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const tagList = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    await onCreateNote(title.trim(), content.trim(), tagList);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Заметки</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Сохраняются напрямую в открытые файлы Markdown по датам
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20 }}>
        {/* Left Column: List of Notes */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>
            Недавние заметки
          </div>

          {sampleNotes.map((n) => (
            <div
              key={n.id}
              className="card-box"
              style={{ padding: "14px 16px", cursor: "pointer" }}
              onClick={() => {
                setTitle(n.title);
                setContent(n.preview);
                setTags(n.tags.join(", "));
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 4 }}>{n.title}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8, lineHeight: 1.4 }}>
                {n.preview}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 4 }}>
                  {n.tags.map((t) => (
                    <span
                      key={t}
                      style={{
                        fontSize: 10.5,
                        background: "#f1f5f9",
                        color: "var(--text-secondary)",
                        padding: "2px 6px",
                        borderRadius: 4,
                      }}
                    >
                      #{t}
                    </span>
                  ))}
                </div>
                <span style={{ fontSize: 11, color: "var(--text-light)" }}>{n.date}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Right Column: Note Editor */}
        <div className="card-box">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span className="card-heading">Редактор заметки</span>
            {savedNotice && (
              <span style={{ fontSize: 12.5, color: "var(--success)", display: "flex", alignItems: "center", gap: 6 }}>
                <CheckCircle2 size={15} /> Сохранено в Memory/days/...
              </span>
            )}
          </div>

          <form onSubmit={handleSave}>
            <div className="form-group-block">
              <label className="form-label-title">Заголовок заметки</label>
              <input
                type="text"
                className="form-input-field"
                placeholder="Например: Итоги созвона с Мариной"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group-block">
              <label className="form-label-title">Содержимое (Markdown)</label>
              <textarea
                className="form-input-field"
                rows={10}
                placeholder="Напишите текст, тезисы, ссылки или скопируйте важный фрагмент..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>

            <div className="form-group-block">
              <label className="form-label-title">Теги (через запятую)</label>
              <input
                type="text"
                className="form-input-field"
                placeholder="клиент, смета, 2026"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn-primary-action"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <Save size={15} />
              <span>Сохранить заметку</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
