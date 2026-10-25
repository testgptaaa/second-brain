import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { PythonBridge } from "../electron/pythonBridge";
import { App } from "../src/App";
let bridge: PythonBridge, dir: string;
beforeEach(async () => {
  sessionStorage.clear();
  localStorage.clear();
  dir = mkdtempSync(path.join(tmpdir(), "second-brain-ui-"));
  const root = path.resolve(import.meta.dirname, "../..");
  bridge = new PythonBridge(dir, {
    python: path.join(root, ".venv/bin/python"),
    script: path.join(root, "core/src/main.py"),
  });
  await bridge.start();
  window.secondBrain = {
    sendRequest: (type, payload) => bridge.sendRequest(type, payload),
    onEvent: (event, callback) => bridge.on(event, callback),
  };
  vi.spyOn(window, "confirm").mockReturnValue(true);
  // jsdom has no scrolling implementation.
  Element.prototype.scrollIntoView = () => {};
});
afterEach(async () => {
  cleanup();
  bridge?.shutdown();
  await new Promise<void>((r) => setTimeout(r, 150));
  rmSync(dir, { recursive: true, force: true });
  delete window.secondBrain;
  vi.restoreAllMocks();
});
const nav = (name: string) =>
  fireEvent.click(
    screen
      .getByRole("navigation", { name: "Разделы" })
      .querySelector(
        `button:nth-child(${["Чат", "Дашборд", "Задачи", "Файлы", "История", "Заметки", "Настройки"].indexOf(name) + 1})`,
      )!,
  );
it("real backend: note CRUD, tab persistence and safe source rendering", async () => {
  render(<App />);
  await screen.findByText("Ядро подключено");
  nav("Заметки");
  const title = await screen.findByLabelText("Название заметки");
  fireEvent.change(title, { target: { value: "UIUniqueTitle" } });
  fireEvent.change(screen.getByLabelText("Markdown"), {
    target: {
      value: 'UIUniqueEvidence <img src=x onerror="window.__injected=true">',
    },
  });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить заметку" }));
  await screen.findByText("Сохранено");
  expect((await bridge.sendRequest("notes:list")).notes).toHaveLength(1);
  fireEvent.change(title, { target: { value: "Unsaved draft" } });
  nav("Задачи");
  nav("Заметки");
  expect(title).toHaveValue("Unsaved draft");
  fireEvent.change(title, { target: { value: "Updated title" } });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить заметку" }));
  await screen.findByText("Сохранено");
  expect((await bridge.sendRequest("notes:list")).notes).toHaveLength(1);
  nav("Чат");
  fireEvent.change(screen.getByPlaceholderText(/Напишите|Спросите|Задайте/), {
    target: { value: "UIUniqueEvidence" },
  });
  fireEvent.click(document.querySelector(".chat-send-btn")!);
  await screen.findByText(/Локальный поиск — модель не настроена/);
  expect((window as any).__injected).toBeUndefined();
  fireEvent.click(screen.getByRole("button", { name: /Открыть days/ }));
  await screen.findByRole("dialog", { name: "Источник" });
  nav("Заметки");
  fireEvent.click(screen.getByRole("button", { name: "Удалить заметку" }));
  await waitFor(async () =>
    expect((await bridge.sendRequest("notes:list")).notes).toHaveLength(0),
  );
});
it("real backend: task creation, patch, cancellation and deletion", async () => {
  render(<App />);
  await screen.findByText("Ядро подключено");
  fireEvent.click(screen.getByRole("button", { name: "Новая задача" }));
  const dialog = await screen.findByRole("dialog", { name: "Редактор задачи" });
  fireEvent.change(within(dialog).getByLabelText("Название"), {
    target: { value: "Actual task" },
  });
  fireEvent.change(within(dialog).getByLabelText("Описание"), {
    target: { value: "Keep description" },
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Сохранить задачу" }),
  );
  await screen.findByText("Actual task");
  fireEvent.click(screen.getByRole("button", { name: "Редактировать" }));
  const edit = screen.getByRole("dialog", { name: "Редактор задачи" });
  expect(within(edit).getByLabelText("Описание")).toHaveValue(
    "Keep description\n",
  );
  fireEvent.change(within(edit).getByLabelText("Статус"), {
    target: { value: "cancelled" },
  });
  fireEvent.click(
    within(edit).getByRole("button", { name: "Сохранить задачу" }),
  );
  await waitFor(async () =>
    expect((await bridge.sendRequest("tasks:list")).tasks[0].status).toBe(
      "cancelled",
    ),
  );
  fireEvent.change(screen.getByLabelText("Фильтр задач"), {
    target: { value: "cancelled" },
  });
  await screen.findByText("Actual task");
  fireEvent.click(screen.getByRole("button", { name: "Удалить" }));
  await waitFor(async () =>
    expect((await bridge.sendRequest("tasks:list")).tasks).toHaveLength(0),
  );
});
it("all tabs show empty real memory, no invented meetings/files; settings handles failure", async () => {
  render(<App />);
  await screen.findByText("Ядро подключено");
  expect(screen.queryByText("Планирование спринта")).not.toBeInTheDocument();
  nav("Файлы");
  await screen.findByText("Нет сохранённых источников");
  nav("История");
  await screen.findByText("Нет записей");
  nav("Настройки");
  fireEvent.click(screen.getByRole("button", { name: "Показать диагностику" }));
  await screen.findByText("memory_root");
  expect((await bridge.sendRequest("policy:get")).capture_consent).toBe(false);
});
it("a failed model endpoint does not hide tasks from independent loads", async () => {
  await bridge.sendRequest("tasks:create", {
    title: "Task survives settings failure",
  });
  const actual = window.secondBrain!.sendRequest;
  window.secondBrain!.sendRequest = async (type, payload) => {
    if (type === "model:get_config") throw new Error("Settings unavailable");
    return actual(type, payload);
  };
  render(<App />);
  await screen.findByRole("alert");
  nav("Задачи");
  await screen.findByText("Task survives settings failure");
});
it("stale note editing shows conflict and keeps the user draft", async () => {
  await bridge.sendRequest("notes:create", {
    title: "Concurrent note",
    content: "initial",
  });
  render(<App />);
  await screen.findByText("Ядро подключено");
  nav("Заметки");
  fireEvent.click(
    await screen.findByRole("button", { name: "Concurrent note" }),
  );
  const note = (await bridge.sendRequest("notes:list")).notes[0];
  await bridge.sendRequest("notes:update", {
    ...note,
    content: "external winner",
  });
  fireEvent.change(screen.getByLabelText("Markdown"), {
    target: { value: "my unsaved draft" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить заметку" }));
  await screen.findByText(/CONFLICT:/);
  expect(screen.getByLabelText("Markdown")).toHaveValue("my unsaved draft");
  expect((await bridge.sendRequest("notes:list")).notes[0].content).toBe(
    "external winner\n",
  );
});
it("settings save preserves an existing key and deletion is explicit", async () => {
  await bridge.sendRequest("model:update_config", {
    api_key: "ui-synthetic-credential",
  });
  render(<App />);
  await screen.findByText("Ядро подключено");
  nav("Настройки");
  const model = await screen.findByLabelText("Текстовая модель");
  fireEvent.change(model, { target: { value: "updated-model" } });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить настройки" }));
  await screen.findByText("Операция выполнена");
  let config = await bridge.sendRequest("model:get_config");
  expect(config.text_model).toBe("updated-model");
  expect(config.has_api_key).toBe(true);
  expect(config.api_key).toBe("");
  fireEvent.click(screen.getByRole("button", { name: "Удалить ключ LLM" }));
  await waitFor(async () =>
    expect((await bridge.sendRequest("model:get_config")).has_api_key).toBe(
      false,
    ),
  );
});
