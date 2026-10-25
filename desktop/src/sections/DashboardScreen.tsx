import React from "react";
import { DayDetail, TaskItem, NavSection } from "../types/api";
export const DashboardScreen = ({
  dayDetail,
  tasks,
  onNavigate,
  onOpenNewTaskModal,
  onOpenQuickPrompt,
}: {
  dayDetail: DayDetail | null;
  tasks: TaskItem[];
  onNavigate: (s: NavSection) => void;
  onOpenNewTaskModal: () => void;
  onOpenQuickPrompt: (p: string) => void;
  [key: string]: any;
}) => (
  <section>
    <h2>Сегодня</h2>
    <p>Данные из локальной памяти за {dayDetail?.date || "текущий день"}.</p>
    <div className="m1-grid">
      <article className="card-box">
        <h3>Задачи</h3>
        <p>
          Активных:{" "}
          {
            tasks.filter((t) => !["done", "cancelled"].includes(t.status))
              .length
          }
        </p>
        <button onClick={onOpenNewTaskModal}>Новая задача</button>
        <button onClick={() => onNavigate("tasks")}>Все задачи</button>
      </article>
      <article className="card-box">
        <h3>Память</h3>
        <p>Эпизодов сегодня: {dayDetail?.episodes.length || 0}</p>
        <p>Заметок сегодня: {dayDetail?.notes.length || 0}</p>
        <button onClick={() => onNavigate("history")}>История</button>
      </article>
      <article className="card-box">
        <h3>Календарь</h3>
        <p>Не подключён. Интеграция запланирована после M1.</p>
      </article>
    </div>
    <button
      onClick={() => onOpenQuickPrompt("Что сохранено в рабочей памяти?")}
    >
      Спросить о памяти
    </button>
    <button onClick={() => onNavigate("notes")}>Заметки</button>
  </section>
);
