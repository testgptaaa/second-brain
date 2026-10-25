import { SearchPanel } from "./sections/SearchPanel";
import React, { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import { Sidebar } from "./components/Sidebar";
import { ChatScreen } from "./sections/ChatScreen";
import { DashboardScreen } from "./sections/DashboardScreen";
import { TasksScreen } from "./sections/TasksScreen";
import { FilesScreen } from "./sections/FilesScreen";
import { HistoryScreen } from "./sections/HistoryScreen";
import { NotesScreen } from "./sections/NotesScreen";
import { SettingsScreen } from "./sections/SettingsScreen";
import { request } from "./lib/transport";
import {
  NavSection,
  TaskItem,
  DayDetail,
  DayOverview,
  PolicyStatus,
  ModelConfig,
  ConflictItem,
} from "./types/api";
const tabs: NavSection[] = [
  "dashboard",
  "chat",
  "tasks",
  "files",
  "history",
  "notes",
  "settings",
];
export const App = () => {
  const [active, setActive] = useState<NavSection>(() => {
    const saved = localStorage.getItem("section");
    return tabs.includes(saved as NavSection)
      ? (saved as NavSection)
      : "dashboard";
  });
  const [visited, setVisited] = useState<NavSection[]>([active]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [revision, setRevision] = useState(0);
  const [tasks, setTasks] = useState<TaskItem[]>([]),
    [days, setDays] = useState<DayOverview[]>([]),
    [today, setToday] = useState<DayDetail | null>(null),
    [policy, setPolicy] = useState<PolicyStatus | null>(null),
    [model, setModel] = useState<ModelConfig | null>(null),
    [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [prompt, setPrompt] = useState({ text: "", id: 0 }),
    [newTask, setNewTask] = useState(0),
    [evidence, setEvidence] = useState<any>(null),
    [conflict, setConflict] = useState<any>(null);
  const generation = useRef(0);
  const navigate = (tab: NavSection) => {
    setActive(tab);
    localStorage.setItem("section", tab);
    setVisited((v) => (v.includes(tab) ? v : [...v, tab]));
  };
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    setError("");
    const jobs: [string, (value: any) => void][] = [
      ["tasks:list", (r) => setTasks(r.tasks)],
      ["storage:list_days", (r) => setDays(r.days)],
      ["storage:get_day", setToday],
      ["policy:get", setPolicy],
      ["model:get_config", setModel],
      ["conflicts:list", (r) => setConflicts(r.conflicts)],
    ];
    const results = await Promise.allSettled(
      jobs.map(async ([type, apply]) => {
        const data = await request(type);
        if (current === generation.current) apply(data);
      }),
    );
    if (current === generation.current) {
      setConnected(results.some((r) => r.status === "fulfilled"));
      const failures = results.filter(
        (r) => r.status === "rejected",
      ) as PromiseRejectedResult[];
      setError(failures.map((r) => String(r.reason)).join("; "));
      setLoading(false);
      setRevision((v) => v + 1);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const unsub = window.secondBrain?.onEvent(
      "storage:file_changed",
      () => void refresh(),
    );
    const off = window.secondBrain?.onEvent("engine:unavailable", () => {
      setConnected(false);
      setError("Ядро остановлено. Перезапустите приложение.");
    });
    return () => {
      off?.();
      unsub?.();
      generation.current++;
    };
  }, [refresh]);
  const safe = async (type: string, payload: any = {}) => {
    try {
      const value = await request(type, payload);
      await refresh();
      return value;
    } catch (e) {
      setError(String(e));
      return null;
    }
  };
  const openEvidence = async (path: string) => {
    try {
      setEvidence(await request("document:read", { path }));
    } catch (e) {
      setError(String(e));
    }
  };
  const ask = (text: string) => {
    setPrompt((v) => ({ text, id: v.id + 1 }));
    navigate("chat");
  };
  return (
    <div className="app-container">
      <Sidebar
        activeSection={active}
        onSelectSection={navigate}
        isPaused={!policy?.capture_consent || policy.is_paused}
        onTogglePause={() => {
          if (!policy?.capture_consent) {
            navigate("settings");
            return;
          }
          void safe("policy:set_pause", { paused: !policy.is_paused });
        }}
      />
      <div className="main-wrapper">
        <header className="m1-header">
          <strong>Второй мозг · M1</strong>
          <button onClick={() => void refresh()} disabled={loading}>
            Обновить
          </button>
          <span role="status">
            {loading
              ? "Загрузка…"
              : connected
                ? "Ядро подключено"
                : "Ядро недоступно"}
          </span>
        </header>
        <main className="content-area">
          {error && (
            <div role="alert">
              {error}
              <button onClick={() => void refresh()}>Повторить</button>
            </div>
          )}
          {conflicts.length > 0 && (
            <article className="card-box">
              <h3>Конфликты памяти ({conflicts.length})</h3>
              {conflicts.map((c) => (
                <button
                  key={c.id}
                  onClick={async () => {
                    const data = await safe("conflicts:read", { id: c.id });
                    if (data) setConflict(data);
                  }}
                >
                  {c.canonical_path}
                </button>
              ))}
            </article>
          )}
          {tabs
            .filter((t) => visited.includes(t))
            .map((tab) => (
              <div hidden={tab !== active} key={tab}>
                {tab === "dashboard" && (
                  <DashboardScreen
                    dayDetail={today}
                    tasks={tasks}
                    onNavigate={navigate}
                    onOpenNewTaskModal={() => {
                      setNewTask((v) => v + 1);
                      navigate("tasks");
                    }}
                    onOpenQuickPrompt={ask}
                  />
                )}
                {tab === "chat" && (
                  <>
                    <SearchPanel request={request} onOpen={openEvidence} />
                    <ChatScreen
                      initialPrompt={prompt.text}
                      promptSignal={prompt.id}
                      onAsk={(q) => request("qa:ask", { question: q })}
                      onOpenSource={openEvidence}
                    />
                  </>
                )}
                {tab === "tasks" && (
                  <TasksScreen
                    tasks={tasks}
                    request={request}
                    onRefresh={refresh}
                    createSignal={newTask}
                  />
                )}
                {tab === "notes" && (
                  <NotesScreen
                    request={request}
                    revision={revision}
                    onRefresh={refresh}
                  />
                )}
                {tab === "files" && (
                  <FilesScreen
                    request={request}
                    revision={revision}
                    onSearchQuery={ask}
                  />
                )}
                {tab === "history" && (
                  <HistoryScreen
                    days={days}
                    onSelectDay={(date) => request("storage:get_day", { date })}
                    revision={revision}
                  />
                )}
                {tab === "settings" && (
                  <SettingsScreen
                    request={request}
                    onRefresh={refresh}
                    modelConfig={model}
                    policy={policy}
                  />
                )}
              </div>
            ))}
          {evidence && (
            <div role="dialog" aria-label="Источник" className="card-box">
              <button onClick={() => setEvidence(null)}>
                Закрыть источник
              </button>
              <h3>{evidence.path}</h3>
              <pre style={{ whiteSpace: "pre-wrap" }}>{evidence.content}</pre>
            </div>
          )}
          {conflict && (
            <div
              role="dialog"
              aria-label="Разрешение конфликта"
              className="card-box"
            >
              <h3>Сравнение версий</h3>
              <div className="m1-grid">
                <article>
                  <h4>Внешняя версия</h4>
                  <pre>{conflict.human}</pre>
                </article>
                <article>
                  <h4>Версия приложения</h4>
                  <pre>{conflict.app}</pre>
                </article>
              </div>
              {["human", "app"].map((choice) => (
                <button
                  key={choice}
                  onClick={async () => {
                    if (
                      await safe("conflicts:resolve", { ...conflict, choice })
                    )
                      setConflict(null);
                  }}
                >
                  Оставить{" "}
                  {choice === "human" ? "внешнюю версию" : "версию приложения"}
                </button>
              ))}
              <button onClick={() => setConflict(null)}>Отмена</button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
