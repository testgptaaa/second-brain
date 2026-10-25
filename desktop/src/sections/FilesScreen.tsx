import { DateFilter } from "../lib/DateFilter";
import { usePreference, dateRange } from "../lib/preferences";
import React, { useEffect, useState } from "react";
import { ordered } from "../lib/list";
export const FilesScreen = ({
  request,
  onSearchQuery,
  revision,
}: {
  request: (type: string) => Promise<any>;
  onSearchQuery: (q: string) => void;
  revision?: number;
}) => {
  const [sources, setSources] = useState<any[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [query, setQuery] = usePreference("files.query", ""),
    [type, setType] = usePreference("files.type", "all"),
    [sort, setSort] = usePreference("files.sort", "captured_at"),
    [direction, setDirection] = usePreference("files.direction", -1),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState<any>(null);
  const [from, setFrom] = usePreference("files.from", "");
  const [to, setTo] = usePreference("files.to", "");
  useEffect(() => {
    let live = true;
    setLoading(true);
    request("sources:list")
      .then((r) => {
        if (live)
          setSources(
            r.sources.map((s: any) => ({
              ...s,
              title: s.window_title || s.id,
            })),
          );
      })
      .catch((e) => {
        if (live) setError(String(e));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [revision]);
  useEffect(() => {
    setPage(0);
  }, [query, type, sort, direction, from, to]);
  const rows = ordered(
    sources.filter(
      (s) =>
        (type === "all" || s.source_type === type) &&
        dateRange(s.captured_at, from, to) &&
        `${s.title} ${s.app_name} ${s.uri}`
          .toLocaleLowerCase("ru")
          .includes(query.toLocaleLowerCase("ru")),
    ),
    sort,
    direction,
  );
  useEffect(() => {
    setPage((p) => Math.min(p, Math.max(0, Math.ceil(rows.length / 20) - 1)));
  }, [rows.length]);
  return (
    <section>
      <h2>Сохранённые источники</h2>
      <DateFilter
        from={from}
        to={to}
        onFrom={setFrom}
        onTo={setTo}
        onReset={() => {
          setFrom("");
          setTo("");
          setQuery("");
          setType("all");
        }}
      />
      <p>
        Каталог записей памяти. Импорт произвольных документов относится к M3.
      </p>
      {error && <p role="alert">{error}</p>}
      {loading && <p>Загрузка источников…</p>}
      <input
        aria-label="Поиск источников"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <select
        aria-label="Тип источника"
        value={type}
        onChange={(e) => setType(e.target.value)}
      >
        <option value="all">Все типы</option>
        {[...new Set(sources.map((s) => s.source_type))].map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <select
        aria-label="Сортировка источников"
        value={sort}
        onChange={(e) => setSort(e.target.value)}
      >
        <option value="captured_at">Дата</option>
        <option value="title">Название</option>
        <option value="source_type">Тип</option>
      </select>
      <button onClick={() => setDirection(-direction)}>
        Порядок {direction === 1 ? "↑" : "↓"}
      </button>
      {!rows.length && !loading && <p>Нет сохранённых источников</p>}
      {rows.slice(page * 20, page * 20 + 20).map((s) => (
        <article className="card-box" key={s.id}>
          <h3>{s.title}</h3>
          <p>
            {s.app_name} · {s.captured_at}
          </p>
          <button onClick={() => setSelected(s)}>Подробнее</button>
          <button onClick={() => onSearchQuery(s.window_title || s.id)}>
            Искать в памяти
          </button>
        </article>
      ))}
      <button disabled={!page} onClick={() => setPage(page - 1)}>
        Назад
      </button>
      <span>
        {page + 1} · Всего {rows.length}
      </span>
      <button
        disabled={(page + 1) * 20 >= rows.length}
        onClick={() => setPage(page + 1)}
      >
        Далее
      </button>
      {selected && (
        <article className="card-box">
          <h3>{selected.title}</h3>
          <p>{selected.uri || "Локальное приложение"}</p>
          <pre>{JSON.stringify(selected.metadata, null, 2)}</pre>
          <p>Это запись источника, а не копия оригинального файла.</p>
          <button onClick={() => setSelected(null)}>Закрыть</button>
        </article>
      )}
    </section>
  );
};
