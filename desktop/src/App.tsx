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

export const App: React.FC = () => {
  const [activeSection, setActiveSection] = useState<SectionType>("today");
  const [policy, setPolicy] = useState<PolicyStatus | null>(null);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [days, setDays] = useState<DayOverview[]>([]);
  const [currentDayDetail, setCurrentDayDetail] = useState<DayDetail | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [modelConfig, setModelConfig] = useState<ModelConfig | null>(null);
  const [askInitialQuery, setAskInitialQuery] = useState<string>("");
  const [memoryRoot, setMemoryRoot] = useState<string>("");

  // Helper to send request through window.secondBrain or browser fallback
  const send = async <T = any,>(type: string, payload: any = {}): Promise<T> => {
    if (window.secondBrain) {
      return await window.secondBrain.sendRequest<T>(type, payload);
    }
    console.warn(`[BrowserMode] Mocking IPC request: ${type}`, payload);
    // Fallback data for standalone browser dev mode
    return mockHandler(type, payload);
  };

  const loadInitialData = async () => {
    try {
      const pol = await send<PolicyStatus>("policy:get");
      setPolicy(pol);

      const tList = await send<{ tasks: TaskItem[] }>("tasks:list");
      setTasks(tList.tasks || []);

      const cList = await send<{ conflicts: ConflictItem[] }>("conflicts:list");
      setConflicts(cList.conflicts || []);

      const dList = await send<{ days: DayOverview[] }>("storage:list_days");
      setDays(dList.days || []);

      const todayDetail = await send<DayDetail>("storage:get_day", {});
      setCurrentDayDetail(todayDetail);

      const sugList = await send<{ suggestions: SuggestionItem[] }>("suggestions:list");
      setSuggestions(sugList.suggestions || []);

      const mCfg = await send<ModelConfig>("model:get_config");
      setModelConfig(mCfg);

      const stStatus = await send<{ root_dir: string }>("storage:status");
      if (stStatus?.root_dir) setMemoryRoot(stStatus.root_dir);
    } catch (err) {
      console.error("Failed to load initial data:", err);
    }
  };

  useEffect(() => {
    loadInitialData();

    // Listen to push events if running in Electron
    if (window.secondBrain) {
      const unsubFile = window.secondBrain.onEvent("storage:file_changed", () => {
        loadInitialData();
      });
      const unsubReady = window.secondBrain.onEvent("engine:ready", (data) => {
        if (data.memory_root) setMemoryRoot(data.memory_root);
        loadInitialData();
      });
      return () => {
        unsubFile();
        unsubReady();
      };
    }
  }, []);

  // Handlers
  const handleTogglePause = async () => {
    const nextPaused = !policy?.is_paused;
    const updated = await send<PolicyStatus>("policy:set_pause", { paused: nextPaused });
    setPolicy(updated);
  };

  const handleSync = async () => {
    await send("storage:sync");
    await loadInitialData();
  };

  const handleCreateTask = async (title: string, description: string, dueDate?: string) => {
    await send("tasks:create", { title, description, due_date: dueDate });
    const tList = await send<{ tasks: TaskItem[] }>("tasks:list");
    setTasks(tList.tasks || []);
  };

  const handleUpdateTaskStatus = async (id: string, status: TaskItem["status"]) => {
    await send("tasks:update", { id, status });
    const tList = await send<{ tasks: TaskItem[] }>("tasks:list");
    setTasks(tList.tasks || []);
  };

  const handleCreateNote = async (title: string, content: string, tags?: string[]) => {
    await send("notes:create", { title, content, tags });
    const todayDetail = await send<DayDetail>("storage:get_day", {});
    setCurrentDayDetail(todayDetail);
  };

  const handleDismissSuggestion = async (id: string) => {
    await send("suggestions:dismiss", { id });
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
  };

  const handleAcceptTaskSuggestion = async (sug: SuggestionItem) => {
    const title = sug.payload?.suggested_title || sug.title;
    const desc = sug.payload?.quote || sug.description;
    await handleCreateTask(title, desc);
    await handleDismissSuggestion(sug.id);
  };

  const handleAsk = async (question: string): Promise<QAResult> => {
    return await send<QAResult>("qa:ask", { question });
  };

  const handleSelectDay = async (dateStr: string): Promise<DayDetail> => {
    return await send<DayDetail>("storage:get_day", { date: dateStr });
  };

  const handleUpdateModelConfig = async (cfg: ModelConfig) => {
    await send("model:update_config", cfg);
    setModelConfig(cfg);
  };

  const handleTestModelConnection = async () => {
    return await send("model:test_connection");
  };

  const handleAddExclusion = async (type: "app" | "domain", value: string) => {
    const res = await send<PolicyStatus>("policy:add_exclusion", { [type]: value });
    setPolicy(res);
  };

  const handleRemoveExclusion = async (type: "app" | "domain", value: string) => {
    const res = await send<PolicyStatus>("policy:remove_exclusion", { [type]: value });
    setPolicy(res);
  };

  const handleSetPrivacyMode = async (mode: "raw" | "pseudonymize") => {
    const res = await send<PolicyStatus>("policy:set_privacy_mode", { mode });
    setPolicy(res);
  };

  const handleRebuildIndex = async (): Promise<number> => {
    const res = await send<{ indexed_count: number }>("storage:sync");
    await loadInitialData();
    return res.indexed_count || 0;
  };

  return (
    <div className="app-container">
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        memoryRoot={memoryRoot}
      />

      <div className="main-wrapper">
        <Header
          policy={policy}
          conflicts={conflicts}
          onTogglePause={handleTogglePause}
          onSync={handleSync}
          onViewConflicts={() => setActiveSection("tasks")}
        />

        <main className="content-area">
          {activeSection === "today" && (
            <TodaySection
              dayDetail={currentDayDetail}
              suggestions={suggestions}
              onDismissSuggestion={handleDismissSuggestion}
              onAcceptTaskSuggestion={handleAcceptTaskSuggestion}
              onSelectAskQuery={(q) => {
                setAskInitialQuery(q);
                setActiveSection("ask");
              }}
            />
          )}

          {activeSection === "ask" && (
            <AskSection initialQuery={askInitialQuery} onAsk={handleAsk} />
          )}

          {activeSection === "history" && (
            <HistorySection days={days} onSelectDay={handleSelectDay} />
          )}

          {activeSection === "tasks" && (
            <TasksSection
              tasks={tasks}
              conflicts={conflicts}
              onCreateTask={handleCreateTask}
              onUpdateTaskStatus={handleUpdateTaskStatus}
              onCreateNote={handleCreateNote}
            />
          )}

          {activeSection === "settings" && (
            <SettingsSection
              policy={policy}
              modelConfig={modelConfig}
              onUpdateModelConfig={handleUpdateModelConfig}
              onTestModelConnection={handleTestModelConnection}
              onTogglePause={handleTogglePause}
              onAddExclusion={handleAddExclusion}
              onRemoveExclusion={handleRemoveExclusion}
              onSetPrivacyMode={handleSetPrivacyMode}
              onRebuildIndex={handleRebuildIndex}
            />
          )}
        </main>
      </div>
    </div>
  );
};

// Fallback mock responses when running in standard web browser without Electron
function mockHandler(type: string, payload: any): any {
  if (type === "policy:get") {
    return {
      is_paused: false,
      privacy_mode: "raw",
      analysis_mode: "direct_text",
      excluded_apps: ["1Password", "Bitwarden"],
      excluded_domains: ["sberbank.ru"],
    };
  }
  if (type === "storage:status") {
    return { root_dir: "/Users/user/Documents/Memory" };
  }
  if (type === "storage:get_day") {
    return {
      date: new Date().toISOString().slice(0, 10),
      episodes: [
        {
          id: "ep-mock-1",
          title: "Работа в Битрикс24: Задача №142 Согласование сметы",
          body: "## Что делали\nОткрыли вкладку сметы в браузере.\n## Наблюдения\nСогласован бюджет 500 000 руб.",
          path: "days/2026/10/25/episodes/14-00-00_ep-1.md",
          created_at: new Date().toISOString(),
        },
      ],
      notes: [],
    };
  }
  if (type === "tasks:list") {
    return {
      tasks: [
        {
          id: "t-1",
          title: "Проверить договор с клиентом Вектор",
          status: "todo",
          due_date: "2026-10-30",
          confirmed: 1,
          created_at: new Date().toISOString(),
        },
      ],
    };
  }
  if (type === "conflicts:list") return { conflicts: [] };
  if (type === "suggestions:list") {
    return {
      suggestions: [
        {
          id: "sug-demo-1",
          scenario_id: "P01",
          title: "Контекст задачи Битрикс",
          description: "Открыта задача Битрикс. Найдены связанные документы и прошлые решения.",
          source_refs: [{ id: "doc-1", title: "Смета_Альфа.docx" }],
          actions: ["view_source", "dismiss"],
          is_notification: false,
          created_at: new Date().toISOString(),
          dismissed: false,
        },
      ],
    };
  }
  if (type === "model:get_config") {
    return { base_url: "http://localhost:1234/v1", api_key: "", model_name: "local-model" };
  }
  if (type === "qa:ask") {
    return {
      request_id: "mock-req",
      answer: "По вашему запросу найдена информация о согласовании сметы на 500 000 руб.",
      status: "success",
      sources: [
        {
          id: "mock-src-1",
          title: "Смета_Альфа.docx",
          relative_path: "days/2026/10/25/episodes/14-00-00_ep-1.md",
          snippet: "Согласован бюджет <b>500 000 руб</b>.",
          created_at: new Date().toISOString(),
        },
      ],
    };
  }
  return { success: true };
}
