import React from "react";
export function DateFilter({
  from,
  to,
  onFrom,
  onTo,
  onReset,
}: {
  from: string;
  to: string;
  onFrom: (s: string) => void;
  onTo: (s: string) => void;
  onReset: () => void;
}) {
  return (
    <div>
      <label>
        С даты
        <input
          type="date"
          aria-label="С даты"
          value={from}
          onChange={(e) => onFrom(e.target.value)}
        />
      </label>
      <label>
        По дату
        <input
          type="date"
          aria-label="По дату"
          value={to}
          onChange={(e) => onTo(e.target.value)}
        />
      </label>
      <button onClick={onReset}>Сбросить фильтры</button>
      {from && to && from > to && (
        <p role="alert">Начало периода позже конца</p>
      )}
    </div>
  );
}
