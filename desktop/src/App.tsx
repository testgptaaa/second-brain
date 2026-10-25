import React, { useState, useEffect } from "react";
import "./App.css";
import { Sidebar, SectionType } from "./components/Sidebar";
import { Header } from "./components/Header";
import { TodaySection } from "./sections/TodaySection";
import { AskSection } from "./sections/AskSection";
import { HistorySection } from "./sections/HistorySection";
import { TasksSection } from "./sections/TasksSection";
import { SettingsSection } from "./sections/SettingsSection";
import {
  DayDetail,
  DayOverview,
  PolicyStatus,
  TaskItem,
  ConflictItem,
  SuggestionItem,
  ModelConfig,
  QAResult,
} from "./types/api";

const SECTION_TITLES: Record<SectionType, string> = {
  today:    "Сегодня",
  ask:      "Поиск и вопросы",
  history:  "История по датам",
  tasks:    "Задачи и заметки",
  settings: "Настройки",
};

export const App: React.FC = () => {
  const [section, setSection]               = useState<SectionType>("today");
  const [policy, setPolicy]                 = useState<PolicyStatus | null>(null);
  const [conflicts, setConflicts]           = useState<ConflictItem[]>([]);
  const [tasks, setTasks]                   = useState<TaskItem[]>([]);
  const [days, setDays]                     = useState<DayOverview[]>([]);
  const [currentDay, setCurrentDay]         = useState<DayDetail | null>(null);
  const [suggestions, setSuggestions]       = useState<SuggestionItem[]>([]);
  const [modelConfig, setModelConfig]       = useState<ModelConfig | null>(null);
  const [askQuery, setAskQuery]             = useState("");

  const send = async <T = any,>(type: string, payload: any = {}): Promise<T> => {
    if (window.secondBrain) {
      return await window.secondBrain.sendRequest<T>(type, payload);
    }
    return mockHandler(type, payload);
  };

  const loadAll = async () => {
    const [pol, tList, cList, dList, today, sug, mCfg] = await Promise.all([
      send<PolicyStatus>("policy:get"),
      send<{ tasks: TaskItem[] }>("tasks:list"),
      send<{ conflicts: ConflictItem[] }>("conflicts:list"),
      send<{ days: DayOverview[] }>("storage:list_days"),
      send<DayDetail>("storage:get_day", {}),
      send<{ suggestions: SuggestionItem[] }>("suggestions:list"),
      send<ModelConfig>("model:get_config"),
    ]);
    setPolicy(pol);
    setTasks(tList.tasks || []);
    setConflicts(cList.conflicts || []);
    setDays(dList.days || []);
    setCurrentDay(today);
    setSuggestions(sug.suggestions || []);
    setModelConfig(mCfg);
  };

  useEffect(() => {
    loadAll();
    if (window.secondBrain) {
      const u1 = window.secondBrain.onEvent("storage:file_changed", loadAll);
      const u2 = window.secondBrain.onEvent("engine:ready", loadAll);
      return () => { u1(); u2(); };
    }
  }, []);

  const handleTogglePause = async () => {
    const next = !policy?.is_paused;
    const updated = await send<PolicyStatus>("policy:set_pause", { paused: next });
    setPolicy(updated);
  };

  const handleSync = async () => {
    await send("storage:sync");
    await loadAll();
  };

  const handleCreateTask = async (title: string, desc: string, due?: string) => {
    await send("tasks:create", { title, description: desc, due_date: due });
    const r = await send<{ tasks: TaskItem[] }>("tasks:list");
    setTasks(r.tasks || []);
  };

  const handleUpdateTaskStatus = async (id: string, status: TaskItem["status"]) => {
    await send("tasks:update", { id, status });
    const r = await send<{ tasks: TaskItem[] }>("tasks:list");
    setTasks(r.tasks || []);
  };

  const handleCreateNote = async (title: string, content: string, tags?: string[]) => {
    await send("notes:create", { title, content, tags });
    const today = await send<DayDetail>("storage:get_day", {});
    setCurrentDay(today);
  };

  const handleDismiss = async (id: string) => {
    await send("suggestions:dismiss", { id });
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
  };

  const handleAcceptTask = async (s: SuggestionItem) => {
    const title = s.payload?.suggested_title || s.title;
    const desc  = s.payload?.quote || s.description;
    await handleCreateTask(title, desc);
    await handleDismiss(s.id);
  };

  const handleAsk = async (q: string): Promise<QAResult> =>
    send<QAResult>("qa:ask", { question: q });

  const handleSelectDay = async (d: string): Promise<DayDetail> =>
    send<DayDetail>("storage:get_day", { date: d });

  const handleUpdateModel = async (cfg: ModelConfig) => {
    await send("model:update_config", cfg);
    setModelConfig(cfg);
  };

  const handleTestModel = async () => send("model:test_connection");

  const handleAddExclusion = async (type: "app" | "domain", value: string) => {
    const r = await send<PolicyStatus>("policy:add_exclusion", { [type]: value });
    setPolicy(r);
  };

  const handleRemoveExclusion = async (type: "app" | "domain", value: string) => {
    const r = await send<PolicyStatus>("policy:remove_exclusion", { [type]: value });
    setPolicy(r);
  };

  const handleSetPrivacy = async (mode: "raw" | "pseudonymize") => {
    const r = await send<PolicyStatus>("policy:set_privacy_mode", { mode });
    setPolicy(r);
  };

  const handleRebuildIndex = async (): Promise<number> => {
    const r = await send<{ indexed_count: number }>("storage:sync");
    await loadAll();
    return r.indexed_count || 0;
  };

  const today = new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="app-container">
      <Sidebar
        activeSection={section}
        onSelectSection={setSection}
        isPaused={policy?.is_paused ?? false}
        onTogglePause={handleTogglePause}
      />

      <div className="main-wrapper">
        <Header
          policy={policy}
          conflicts={conflicts}
          title={SECTION_TITLES[section]}
          subtitle={section === "today" ? today : undefined}
          onSync={handleSync}
          onViewConflicts={() => setSection("tasks")}
        />

        <main className="content-area">
          {section === "today" && (
            <TodaySection
              dayDetail={currentDay}
              suggestions={suggestions}
              onDismissSuggestion={handleDismiss}
              onAcceptTaskSuggestion={handleAcceptTask}
              onSelectAskQuery={(q) => { setAskQuery(q); setSection("ask"); }}
            />
          )}
          {section === "ask" && (
            <AskSection initialQuery={askQuery} onAsk={handleAsk} />
          )}
          {section === "history" && (
            <HistorySection days={days} onSelectDay={handleSelectDay} />
          )}
          {section === "tasks" && (
            <TasksSection
              tasks={tasks}
              conflicts={conflicts}
              onCreateTask={handleCreateTask}
              onUpdateTaskStatus={handleUpdateTaskStatus}
              onCreateNote={handleCreateNote}
            />
          )}
          {section === "settings" && (
            <SettingsSection
              policy={policy}
              modelConfig={modelConfig}
              onUpdateModelConfig={handleUpdateModel}
              onTestModelConnection={handleTestModel}
              onTogglePause={handleTogglePause}
              onAddExclusion={handleAddExclusion}
              onRemoveExclusion={handleRemoveExclusion}
              onSetPrivacyMode={handleSetPrivacy}
              onRebuildIndex={handleRebuildIndex}
            />
          )}
        </main>
      </div>
    </div>
  );
};

function mockHandler(type: string, _payload: any): any {
  if (type === "policy:get")       return { is_paused: false, privacy_mode: "raw", analysis_mode: "direct_text", excluded_apps: ["1Password"], excluded_domains: ["sberbank.ru"] };
  if (type === "storage:get_day")  return {
    date: new Date().toISOString().slice(0, 10),
    episodes: [
      { id: "ep1", title: "Битрикс24 — Задача №142: согласование сметы", body: "## Наблюдения\n\nОткрыта страница задачи. Бюджет — 500 000 ₽. Ответственный Иванов.\nОбсуждение в комментариях: срок — 1 ноября.", path: "days/2026/10/25/episodes/10-00-00_ep1.md", created_at: "2026-10-25T10:14:00" },
      { id: "ep2", title: "Excel — Смета_Q4_v3.xlsx", body: "## Наблюдения\n\nОткрыта таблица сметы. Лист «Октябрь», строка 14 — итоговая сумма.", path: "days/2026/10/25/episodes/11-30-00_ep2.md", created_at: "2026-10-25T11:32:00" },
      { id: "ep3", title: "Telegram — чат «Команда проекта»", body: "## Наблюдения\n\nПоступило сообщение от Марины: «Можешь подготовить цифры к утреннему звонку?».", path: "days/2026/10/25/episodes/13-45-00_ep3.md", created_at: "2026-10-25T13:47:00" },
    ],
    notes: [
      { id: "n1", title: "Звонок с поставщиком", body: "Обсудили сроки поставки. Перенесли на 10 ноября.", path: "days/2026/10/25/notes/12-00-00_n1.md", created_at: "2026-10-25T12:01:00", tags: ["поставщик", "сроки"] },
    ],
  };
  if (type === "tasks:list")       return { tasks: [
    { id: "t1", title: "Подготовить цифры к звонку", status: "todo", due_date: "2026-10-26", confirmed: 1, created_at: "2026-10-25T13:48:00" },
    { id: "t2", title: "Согласовать смету с Ивановым", status: "in_progress", due_date: "2026-11-01", confirmed: 1, created_at: "2026-10-25T10:15:00" },
    { id: "t3", title: "Ответить Марине по цифрам", status: "waiting_reply", confirmed: 1, created_at: "2026-10-25T13:48:00" },
  ]};
  if (type === "conflicts:list")   return { conflicts: [] };
  if (type === "suggestions:list") return { suggestions: [
    { id: "s1", scenario_id: "P03", title: "Запрос от Марины требует задачи", description: "В Telegram найден запрос: «Можешь подготовить цифры к утреннему звонку?». Создать задачу?", source_refs: [{ id: "ep3", title: "Telegram — чат «Команда проекта»" }], actions: ["accept_task", "dismiss"], is_notification: false, created_at: new Date().toISOString(), dismissed: false, payload: { suggested_title: "Подготовить цифры к звонку", quote: "«Можешь подготовить цифры к утреннему звонку?»" } },
  ]};
  if (type === "storage:list_days") return { days: [
    { date: new Date().toISOString().slice(0,10), path: "days/2026/10/25", episodes_count: 3, notes_count: 1 },
    { date: "2026-10-24", path: "days/2026/10/24", episodes_count: 7, notes_count: 2 },
    { date: "2026-10-23", path: "days/2026/10/23", episodes_count: 4, notes_count: 0 },
  ]};
  if (type === "model:get_config")  return { base_url: "http://localhost:1234/v1", api_key: "", model_name: "local-model" };
  if (type === "qa:ask")            return {
    request_id: "mock",
    answer: "По вашему запросу найдена информация из сметы. Сумма 500 000 ₽ зафиксирована в задаче Битрикс №142 (10:14) и подтверждена в таблице Смета_Q4_v3.xlsx, лист «Октябрь», строка 14 (11:32).",
    status: "success",
    sources: [
      { id: "ep1", title: "Битрикс24 — Задача №142", relative_path: "days/2026/10/25/episodes/10-00-00_ep1.md", snippet: "Бюджет — <b>500 000 ₽</b>. Ответственный Иванов.", created_at: "2026-10-25T10:14:00" },
      { id: "ep2", title: "Excel — Смета_Q4_v3.xlsx", relative_path: "days/2026/10/25/episodes/11-30-00_ep2.md", snippet: "Лист «Октябрь», строка 14 — <b>итоговая сумма</b>.", created_at: "2026-10-25T11:32:00" },
    ],
    tokens: { prompt: 312, completion: 87 },
  };
  return { success: true, tasks: [], conflicts: [], suggestions: [], indexed_count: 0, days: [] };
}
