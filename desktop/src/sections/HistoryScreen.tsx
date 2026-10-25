import { DateFilter } from "../lib/DateFilter";
import { usePreference, dateRange } from "../lib/preferences";
import React, { useEffect, useState } from "react";
import { DayOverview, DayDetail } from "../types/api";
export const HistoryScreen = ({
  days,
  onSelectDay,
  revision,
}: {
  days: DayOverview[];
  onSelectDay: (date: string) => Promise<DayDetail>;
  revision?: number;
}) => {
  const [selected, setSelected] = useState(""),
    [detail, setDetail] = useState<DayDetail | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [ascending, setAscending] = usePreference("history.ascending", false),
    [kind, setKind] = usePreference("history.kind", "all");
  const [from, setFrom] = usePreference("history.from", "");
  const [to, setTo] = usePreference("history.to", "");
  useEffect(() => {
    if (!selected && days.length) setSelected(days[0].date);
  }, [days, selected]);
  useEffect(() => {
    let live = true;
    if (selected) {
      setLoading(true);
      setError("");
      onSelectDay(selected)
        .then((r) => {
          if (live) setDetail(r);
        })
        .catch((e) => {
          if (live) setError(String(e));
        })
        .finally(() => {
          if (live) setLoading(false);
        });
    }
    return () => {
      live = false;
    };
  }, [selected, revision]);
  const events = detail
    ? [
        ...detail.episodes.map((e) => ({ ...e, kind: "episode" })),
        ...detail.notes.map((n) => ({ ...n, kind: "note" })),
      ]
        .filter((e) => kind === "all" || e.kind === kind)
        .sort(
          (a, b) =>
            (ascending ? 1 : -1) * a.created_at.localeCompare(b.created_at) ||
            a.id.localeCompare(b.id),
        )
    : [];
  return (
    <section>
      <h2>История</h2>
      <DateFilter
        from={from}
        to={to}
        onFrom={setFrom}
        onTo={setTo}
        onReset={() => {
          setFrom("");
          setTo("");
          setKind("all");
        }}
      />
      {error && <p role="alert">{error}</p>}
      <button onClick={() => setAscending(!ascending)}>
        Дата {ascending ? "↑" : "↓"}
      </button>
      <select
        aria-label="Тип истории"
        value={kind}
        onChange={(e) => setKind(e.target.value)}
      >
        <option value="all">Все записи</option>
        <option value="episode">Эпизоды</option>
        <option value="note">Заметки</option>
      </select>
      <div className="m1-grid">
        <nav>
          {!days.length && <p>Нет записей</p>}
          {days
            .filter((d) => dateRange(d.date, from, to))
            .sort((a, b) => (ascending ? 1 : -1) * a.date.localeCompare(b.date))
            .map((d) => (
              <button
                style={{ display: "block" }}
                key={d.date}
                onClick={() => setSelected(d.date)}
              >
                {d.date} · {d.episodes_count} эпизодов · {d.notes_count} заметок
              </button>
            ))}
        </nav>
        <div>
          {loading ? (
            <p>Загрузка истории…</p>
          ) : !detail ? (
            <p>Выберите дату</p>
          ) : (
            <>
              <h3>{detail.date}</h3>
              {!events.length && <p>В этот день нет записей</p>}
              {events.map((e) => (
                <article className="card-box" key={e.id}>
                  <h4>{e.title}</h4>
                  <time>{e.created_at}</time>
                  <pre>{e.body}</pre>
                </article>
              ))}
            </>
          )}
        </div>
      </div>
    </section>
  );
};
