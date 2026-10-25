import React, { useRef, useState } from "react";
import { usePreference } from "../lib/preferences";
import { SearchResult } from "../types/api";
export function SearchPanel({
  request,
  onOpen,
}: {
  request: (type: string, payload: any) => Promise<any>;
  onOpen: (path: string) => void;
}) {
  const [query, setQuery] = usePreference("search.query", ""),
    [sort, setSort] = usePreference("search.sort", "relevance"),
    [type, setType] = usePreference("search.type", ""),
    [from, setFrom] = usePreference("search.from", ""),
    [to, setTo] = usePreference("search.to", "");
  const [rows, setRows] = useState<SearchResult[]>([]),
    [page, setPage] = useState(0),
    [more, setMore] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [searched, setSearched] = useState(false);
  const generation = useRef(0);
  const find = async (next = 0) => {
    const id = ++generation.current;
    setBusy(true);
    setError("");
    try {
      const result = await request("search:query", {
        query,
        sort,
        doc_type: type || null,
        date_from: from || null,
        date_to: to || null,
        offset: next * 20,
        limit: 20,
      });
      if (id === generation.current) {
        setRows(result.results);
        setMore(result.has_more);
        setPage(next);
        setSearched(true);
      }
    } catch (e) {
      if (id === generation.current) setError(String(e));
    } finally {
      if (id === generation.current) setBusy(false);
    }
  };
  return (
    <details className="card-box">
      <summary>Поиск в памяти: фильтры и сортировка</summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void find();
        }}
      >
        <label>
          Поисковый запрос
          <input value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label>
          Порядок поиска
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="relevance">Релевантность</option>
            <option value="updated">Недавно изменённые</option>
          </select>
        </label>
        <label>
          Тип документа
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Все типы</option>
            {["note", "task", "episode", "context"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          Поиск с даты
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Поиск по дату
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button disabled={busy || !query.trim()}>Найти</button>
        <button
          type="button"
          onClick={() => {
            setFrom("");
            setTo("");
            setType("");
            setQuery("");
            setRows([]);
            setSearched(false);
          }}
        >
          Сбросить поиск
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {searched && !rows.length && <p>Совпадений нет</p>}
      {rows.map((r) => (
        <article key={r.id}>
          <h4>{r.title}</h4>
          <p>{r.snippet?.replace(/<\/?b>/g, "")}</p>
          <button onClick={() => onOpen(r.relative_path)}>
            Источник {r.title}
          </button>
        </article>
      ))}
      {searched && (
        <div>
          <button disabled={busy || !page} onClick={() => void find(page - 1)}>
            Предыдущие результаты
          </button>
          <span>Страница {page + 1}</span>
          <button disabled={busy || !more} onClick={() => void find(page + 1)}>
            Следующие результаты
          </button>
        </div>
      )}
    </details>
  );
}
