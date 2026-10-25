import { DateFilter } from "../lib/DateFilter";
import { usePreference, dateRange } from "../lib/preferences";
import React, { useEffect, useState } from "react";
import { TaskItem } from "../types/api";
import { ordered, localDate } from "../lib/list";
const statuses = {
  todo: "К выполнению",
  in_progress: "В работе",
  waiting_reply: "Жду ответа",
  done: "Выполнено",
  cancelled: "Отменено",
};
export const TasksScreen = ({
  tasks,
  request,
  onRefresh,
  createSignal = 0,
}: {
  tasks: TaskItem[];
  request: (type: string, payload?: any) => Promise<any>;
  onRefresh: () => Promise<void>;
  createSignal?: number;
  [key: string]: any;
}) => {
  const [editing, setEditing] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [filter, setFilter] = usePreference("tasks.filter", "active");
  const [sort, setSort] = usePreference("tasks.sort", "due_date");
  const [direction, setDirection] = usePreference("tasks.direction", 1),
    [query, setQuery] = usePreference("tasks.query", ""),
    [page, setPage] = useState(0),
    [view, setView] = usePreference("tasks.view", "list");
  const [from, setFrom] = usePreference("tasks.from", "");
  const [to, setTo] = usePreference("tasks.to", "");
  const fresh = () => {
    if (editing && !window.confirm("Заменить несохранённый черновик задачи?"))
      return;
    setEditing({ title: "", description: "", due_date: "", status: "todo" });
  };
  useEffect(() => {
    const protect = (e: BeforeUnloadEvent) => {
      if (editing) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [editing]);
  useEffect(() => {
    if (createSignal) fresh();
  }, [createSignal]);
  useEffect(() => {
    setPage(0);
  }, [filter, sort, direction, query, from, to]);
  const run = async (type: string, payload: any) => {
    setBusy(true);
    setError("");
    try {
      await request(type, payload);
      await onRefresh();
      return true;
    } catch (e) {
      setError(String(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const visible = ordered(
    tasks.filter(
      (t) =>
        (filter === "all" ||
          (filter === "active" && !["done", "cancelled"].includes(t.status)) ||
          (filter === "overdue" &&
            !!t.due_date &&
            t.due_date < localDate() &&
            !["done", "cancelled"].includes(t.status)) ||
          filter === t.status) &&
        dateRange(t.due_date, from, to) &&
        t.title.toLocaleLowerCase("ru").includes(query.toLocaleLowerCase("ru")),
    ),
    sort,
    direction,
  );
  useEffect(() => {
    setPage((p) =>
      Math.min(p, Math.max(0, Math.ceil(visible.length / 20) - 1)),
    );
  }, [visible.length]);
  const card = (t: TaskItem) => (
    <article className="card-box" key={t.id}>
      <h3>{t.title}</h3>
      <p>
        {statuses[t.status]} · {t.due_date || "Без срока"}
      </p>
      <p>{t.description}</p>
      <button disabled={busy} onClick={() => setEditing({ ...t })}>
        Редактировать
      </button>
      <button
        disabled={busy}
        onClick={() => {
          if (window.confirm("Удалить задачу?"))
            void run("tasks:delete", { id: t.id, revision: t.revision });
        }}
      >
        Удалить
      </button>
    </article>
  );
  return (
    <section>
      <h2>Задачи</h2>
      <DateFilter
        from={from}
        to={to}
        onFrom={setFrom}
        onTo={setTo}
        onReset={() => {
          setFrom("");
          setTo("");
          setQuery("");
          setFilter("active");
        }}
      />
      {error && <p role="alert">{error}</p>}
      <button onClick={fresh}>Новая задача</button>
      <input
        aria-label="Поиск задач"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <select
        aria-label="Фильтр задач"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      >
        <option value="active">Активные</option>
        <option value="all">Все</option>
        <option value="overdue">Просроченные</option>
        {Object.entries(statuses).map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
      <select
        aria-label="Сортировка задач"
        value={sort}
        onChange={(e) => setSort(e.target.value)}
      >
        <option value="due_date">Срок</option>
        <option value="created_at">Создание</option>
        <option value="title">Название</option>
      </select>
      <button onClick={() => setDirection(-direction)}>
        Порядок {direction === 1 ? "↑" : "↓"}
      </button>
      <button onClick={() => setView(view === "list" ? "board" : "list")}>
        {view === "list" ? "Канбан" : "Список"}
      </button>
      {!visible.length && <p>Нет задач по выбранным условиям</p>}
      {view === "list" ? (
        visible.slice(page * 20, page * 20 + 20).map(card)
      ) : (
        <div className="m1-grid">
          {Object.entries(statuses).map(([status, label]) => (
            <div key={status}>
              <h3>{label}</h3>
              {visible.filter((t) => t.status === status).map(card)}
            </div>
          ))}
        </div>
      )}
      {view === "list" && (
        <div>
          <button disabled={!page} onClick={() => setPage(page - 1)}>
            Назад
          </button>
          <span>
            Страница {page + 1} · Всего {visible.length}
          </span>
          <button
            disabled={(page + 1) * 20 >= visible.length}
            onClick={() => setPage(page + 1)}
          >
            Далее
          </button>
        </div>
      )}
      {editing && (
        <div role="dialog" aria-label="Редактор задачи" className="card-box">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await run(editing.id ? "tasks:update" : "tasks:create", {
                  ...editing,
                  due_date: editing.due_date || null,
                })
              )
                setEditing(null);
            }}
          >
            <label>
              Название
              <input
                className="form-input-field"
                required
                value={editing.title}
                onChange={(e) =>
                  setEditing({ ...editing, title: e.target.value })
                }
              />
            </label>
            <label>
              Описание
              <textarea
                className="form-input-field"
                value={editing.description || ""}
                onChange={(e) =>
                  setEditing({ ...editing, description: e.target.value })
                }
              />
            </label>
            <label>
              Срок
              <input
                className="form-input-field"
                type="date"
                value={editing.due_date || ""}
                onChange={(e) =>
                  setEditing({ ...editing, due_date: e.target.value })
                }
              />
            </label>
            <label>
              Статус
              <select
                value={editing.status}
                onChange={(e) =>
                  setEditing({ ...editing, status: e.target.value })
                }
              >
                {Object.entries(statuses).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button disabled={busy || !editing.title.trim()}>
              Сохранить задачу
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm("Закрыть редактор без сохранения?"))
                  setEditing(null);
              }}
            >
              Закрыть
            </button>
          </form>
        </div>
      )}
    </section>
  );
};
