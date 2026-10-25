import { DateFilter } from "../lib/DateFilter";
import { usePreference, dateRange } from "../lib/preferences";
import React, { useEffect, useState } from "react";
import { ordered } from "../lib/list";
type Note = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  updated_at: string;
  created_at: string;
  revision: number;
  base_hash: string;
  file_hash: string;
};
export const NotesScreen = ({
  request,
  revision,
  onRefresh,
}: {
  request: (type: string, payload?: any) => Promise<any>;
  revision?: number;
  onRefresh?: () => Promise<void>;
}) => {
  const [notes, setNotes] = useState<Note[]>([]),
    [draft, setDraft] = useState<Partial<Note>>({
      title: "",
      content: "",
      tags: [],
    }),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [query, setQuery] = usePreference("notes.query", ""),
    [sort, setSort] = usePreference("notes.sort", "updated_at"),
    [direction, setDirection] = usePreference("notes.direction", -1),
    [page, setPage] = useState(0);
  const [from, setFrom] = usePreference("notes.from", "");
  const [to, setTo] = usePreference("notes.to", "");
  const load = async () => {
    const r = await request("notes:list");
    setNotes(r.notes);
    return r.notes as Note[];
  };
  useEffect(() => {
    let active = true;
    setLoading(true);
    request("notes:list")
      .then((r) => {
        if (active) setNotes(r.notes);
      })
      .catch((e) => {
        if (active) setError(String(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [revision]);
  useEffect(() => {
    setPage(0);
  }, [query, sort, direction, from, to]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  const select = (note?: Note) => {
    if (dirty && !window.confirm("Отменить несохранённые изменения?")) return;
    setDraft(note ? { ...note } : { title: "", content: "", tags: [] });
    setDirty(false);
    setNotice("");
    setError("");
  };
  const change = (patch: Partial<Note>) => {
    setDraft({ ...draft, ...patch });
    setDirty(true);
    setNotice("");
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await request(
        draft.id ? "notes:update" : "notes:create",
        draft,
      );
      const id = draft.id || result.doc.metadata.id;
      const list = await load();
      setDraft(list.find((n) => n.id === id) || draft);
      setDirty(false);
      setNotice("Сохранено");
      await onRefresh?.();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!window.confirm("Удалить заметку?")) return;
    setBusy(true);
    try {
      await request("notes:delete", draft);
      setDraft({ title: "", content: "", tags: [] });
      setDirty(false);
      await load();
      await onRefresh?.();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const visible = ordered(
    notes.filter(
      (n) =>
        dateRange(n.created_at, from, to) &&
        (n.title + " " + n.tags.join(" "))
          .toLocaleLowerCase("ru")
          .includes(query.toLocaleLowerCase("ru")),
    ),
    sort,
    direction,
  );
  useEffect(() => {
    setPage((p) =>
      Math.min(p, Math.max(0, Math.ceil(visible.length / 20) - 1)),
    );
  }, [visible.length]);
  return (
    <section>
      <h2>Заметки</h2>
      <DateFilter
        from={from}
        to={to}
        onFrom={setFrom}
        onTo={setTo}
        onReset={() => {
          setFrom("");
          setTo("");
          setQuery("");
        }}
      />
      {error && (
        <p role="alert">
          {error}
          <button
            onClick={() => {
              void load().catch((e) => setError(String(e)));
            }}
          >
            Перечитать список
          </button>
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {loading && <p>Загрузка заметок…</p>}
      <button onClick={() => select()}>Новая заметка</button>
      <input
        aria-label="Поиск заметок"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Заголовок или тег"
      />
      <select
        aria-label="Сортировка заметок"
        value={sort}
        onChange={(e) => setSort(e.target.value)}
      >
        <option value="updated_at">Изменение</option>
        <option value="created_at">Создание</option>
        <option value="title">Название</option>
      </select>
      <button onClick={() => setDirection(-direction)}>
        Порядок {direction === 1 ? "↑" : "↓"}
      </button>
      <div className="m1-grid">
        <div>
          {!visible.length && !loading && <p>Нет заметок</p>}
          {visible.slice(page * 20, page * 20 + 20).map((n) => (
            <button
              className="card-box"
              style={{ display: "block", width: "100%" }}
              key={n.id}
              onClick={() => select(n)}
            >
              {n.title}
            </button>
          ))}
          <button disabled={!page} onClick={() => setPage(page - 1)}>
            Назад
          </button>
          <span>
            {page + 1} · Всего {visible.length}
          </span>
          <button
            disabled={(page + 1) * 20 >= visible.length}
            onClick={() => setPage(page + 1)}
          >
            Далее
          </button>
        </div>
        <form onSubmit={save}>
          <p>{dirty ? "Есть несохранённые изменения" : "Редактор заметки"}</p>
          <label>
            Название заметки
            <input
              className="form-input-field"
              required
              value={draft.title}
              onChange={(e) => change({ title: e.target.value })}
            />
          </label>
          <label>
            Markdown
            <textarea
              className="form-input-field"
              rows={12}
              value={draft.content}
              onChange={(e) => change({ content: e.target.value })}
            />
          </label>
          <label>
            Теги
            <input
              className="form-input-field"
              value={draft.tags?.join(", ")}
              onChange={(e) =>
                change({
                  tags: e.target.value
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
          <button disabled={busy || !draft.title?.trim()}>
            Сохранить заметку
          </button>
          {draft.id && (
            <button disabled={busy} type="button" onClick={() => void remove()}>
              Удалить заметку
            </button>
          )}
        </form>
      </div>
    </section>
  );
};
