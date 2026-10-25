import React, { useState, useEffect } from "react";
import "./App.css";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { ChatScreen } from "./sections/ChatScreen";
import { DashboardScreen } from "./sections/DashboardScreen";
import { TasksScreen } from "./sections/TasksScreen";
import { FilesScreen } from "./sections/FilesScreen";
import { HistoryScreen } from "./sections/HistoryScreen";
import { NotesScreen } from "./sections/NotesScreen";
import { SettingsScreen } from "./sections/SettingsScreen";
import {
  NavSection,
  DayDetail,
  DayOverview,
  PolicyStatus,
  TaskItem,
  ConflictItem,
  SuggestionItem,
  ModelConfig,
  QAResult,
} from "./types/api";

export const App: React.FC = () => {
  const [activeSection, setActiveSection] = useState<NavSection>("dashboard");
  const [policy, setPolicy] = useState<PolicyStatus | null>(null);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [days, setDays] = useState<DayOverview[]>([]);
  const [currentDay, setCurrentDay] = useState<DayDetail | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [modelConfig, setModelConfig] = useState<ModelConfig | null>(null);

  // Send request helper
  const send = async <T = any,>(type: string, payload: any = {}): Promise<T> => {
    if (window.secondBrain) {
      return await window.secondBrain.sendRequest<T>(type, payload);
    }
    return mockHandler(type, payload);
  };

  const loadData = async () => {
    try {
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
    } catch (e) {
      console.warn("Failed to load data:", e);
    }
  };

  useEffect(() => {
    loadData();
    if (window.secondBrain) {
      const u1 = window.secondBrain.onEvent("storage:file_changed", loadData);
      const u2 = window.secondBrain.onEvent("engine:ready", loadData);
      return () => {
        u1();
        u2();
      };
    }
  }, []);

  const handleTogglePause = async () => {
    const next = !policy?.is_paused;
    const updated = await send<PolicyStatus>("policy:set_pause", { paused: next });
    setPolicy(updated);
  };

  const handleSync = async () => {
    await send("storage:sync");
    await loadData();
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

  const handleToggleTaskStatus = async (id: string, currentStatus: TaskItem["status"]) => {
    const nextStatus = currentStatus === "done" ? "todo" : "done";
    await handleUpdateTaskStatus(id, nextStatus);
  };

  const handleCreateNote = async (title: string, content: string, tags?: string[]) => {
    await send("notes:create", { title, content, tags });
    const today = await send<DayDetail>("storage:get_day", {});
    setCurrentDay(today);
  };

  const handleAsk = async (question: string): Promise<QAResult> => {
    return await send<QAResult>("qa:ask", { question });
  };

  const handleSelectDay = async (d: string): Promise<DayDetail> => {
    return await send<DayDetail>("storage:get_day", { date: d });
  };

  const handleUpdateModel = async (cfg: ModelConfig) => {
    await send("model:update_config", cfg);
    setModelConfig(cfg);
  };

  const handleTestModel = async () => {
    return await send("model:test_connection");
  };

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
    await loadData();
    return r.indexed_count || 0;
  };

  return (
    <div className="app-container">
      {/* Sidebar with Logo, 7 Navigation Tabs, Observation Status & Storage */}
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        isPaused={policy?.is_paused || false}
        onTogglePause={handleTogglePause}
      />

      {/* Main Content View */}
      <div className="main-wrapper">
        <Header
          activeSection={activeSection}
          conflicts={conflicts}
          modelConfig={modelConfig}
          onSync={handleSync}
          onViewConflicts={() => setActiveSection("tasks")}
          onOpenSettings={() => setActiveSection("settings")}
        />

        <main className="content-area">
          {activeSection === "chat" && <ChatScreen onAsk={handleAsk} />}

          {activeSection === "dashboard" && (
            <DashboardScreen
              dayDetail={currentDay}
              tasks={tasks}
              suggestions={suggestions}
              onNavigate={setActiveSection}
              onToggleTaskStatus={handleToggleTaskStatus}
              onOpenNewTaskModal={() => setActiveSection("tasks")}
              onOpenQuickPrompt={(p) => {
                setActiveSection("chat");
              }}
            />
          )}

          {activeSection === "tasks" && (
            <TasksScreen
              tasks={tasks}
              conflicts={conflicts}
              onCreateTask={handleCreateTask}
              onUpdateStatus={handleUpdateTaskStatus}
            />
          )}

          {activeSection === "files" && (
            <FilesScreen
              onSearchQuery={(q) => {
                setActiveSection("chat");
              }}
            />
          )}

          {activeSection === "history" && (
            <HistoryScreen days={days} onSelectDay={handleSelectDay} />
          )}

          {activeSection === "notes" && (
            <NotesScreen onCreateNote={handleCreateNote} />
          )}

          {activeSection === "settings" && (
            <SettingsScreen
              policy={policy}
              modelConfig={modelConfig}
              onUpdateModelConfig={handleUpdateModel}
              onTestModelConnection={handleTestModel}
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

// Fallback data for standalone browser dev mode
function mockHandler(type: string, _payload: any): any {
  if (type === "policy:get") {
    return {
      is_paused: false,
      privacy_mode: "raw",
      analysis_mode: "direct_text",
      excluded_apps: ["1Password"],
      excluded_domains: ["sberbank.ru"],
    };
  }
  if (type === "storage:get_day") {
    return {
      date: new Date().toISOString().slice(0, 10),
      episodes: [
        {
          id: "ep1",
          title: "Битрикс24 — Задача №142: согласование сметы",
          body: "## Наблюдения\n\nОткрыта страница задачи. Бюджет — 500 000 ₽. Ответственный Иванов.\nСрок сдачи сметы — 1 ноября.",
          path: "days/2026/10/25/episodes/10-00-00_ep1.md",
          created_at: "2026-10-25T10:14:00",
        },
      ],
      notes: [],
    };
  }
  if (type === "tasks:list") {
    return {
      tasks: [
        {
          id: "t1",
          title: "Подготовка отчета Q4",
          status: "done",
          due_date: "2026-10-25",
          confirmed: 1,
          created_at: "2026-10-25T09:00:00",
        },
        {
          id: "t2",
          title: "Методика расчета KPI",
          status: "todo",
          due_date: "2026-10-26",
          confirmed: 1,
          created_at: "2026-10-25T10:15:00",
        },
        {
          id: "t3",
          title: "Обсуждение в Telegram",
          status: "in_progress",
          due_date: "2026-10-24",
          confirmed: 1,
          created_at: "2026-10-25T11:00:00",
        },
        {
          id: "t4",
          title: "План внедрения CRM",
          status: "waiting_reply",
          due_date: "2026-10-25",
          confirmed: 1,
          created_at: "2026-10-25T12:00:00",
        },
      ],
    };
  }
  if (type === "conflicts:list") return { conflicts: [] };
  if (type === "suggestions:list") return { suggestions: [] };
  if (type === "storage:list_days") {
    return {
      days: [
        { date: new Date().toISOString().slice(0, 10), path: "days/2026/10/25", episodes_count: 5, notes_count: 2 },
        { date: "2026-10-24", path: "days/2026/10/24", episodes_count: 8, notes_count: 1 },
      ],
    };
  }
  if (type === "model:get_config") {
    return { base_url: "http://localhost:1234/v1", api_key: "", model_name: "local-model" };
  }
  if (type === "qa:ask") {
    return {
      request_id: "mock",
      answer:
        "На основе зафиксированных документов:\n- В задаче Битрикс24 №142 (10:14) зафиксирован бюджет 500 000 ₽.\n- В файле Sales_Q4_v3.xlsx на листе «Октябрь» подтверждены соответствующие статьи расходов.",
      status: "success",
      sources: [
        {
          id: "src-1",
          title: "Битрикс24 — Задача №142",
          relative_path: "days/2026/10/25/episodes/10-00-00_ep1.md",
          snippet: "Бюджет — <b>500 000 ₽</b>. Ответственный Иванов.",
          created_at: "2026-10-25T10:14:00",
        },
        {
          id: "src-2",
          title: "Sales_Q4_v3.xlsx",
          relative_path: "days/2026/10/25/sources/obs-sales.json",
          snippet: "Смета расходов за 4 квартал 2026 года.",
          created_at: "2026-10-25T10:24:00",
        },
      ],
      tokens: { prompt: 240, completion: 65 },
    };
  }
  return { success: true };
}
