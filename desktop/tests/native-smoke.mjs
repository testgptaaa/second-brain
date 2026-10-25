// Real Electron/preload/main/Python smoke. Run on macOS; no personal memory/keys.
import { _electron as electron } from "playwright";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const root = await mkdtemp(path.join(tmpdir(), "second-brain-native-"));
let app;
const launch = async () => {
  app = await electron.launch({
    args: [path.resolve(".")],
    env: {
      ...process.env,
      LLM_API_KEY: "",
      NEURALDEEP_API_KEY: "",
      SECOND_BRAIN_MEMORY_ROOT: path.join(root, "Memory"),
      SECOND_BRAIN_USER_DATA: path.join(root, "UserData"),
    },
  });
  const page = await app.firstWindow();
  await page.getByText("Ядро подключено", { exact: true }).waitFor();
  return page;
};
try {
  let page = await launch();
  for (const [width, height] of [
    [1440, 900],
    [1024, 768],
    [800, 600],
  ]) {
    await page.setViewportSize({ width, height });
    await page
      .getByRole("navigation", { name: "Разделы" })
      .getByRole("button", { name: "Настройки", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Настройки", exact: true })
      .waitFor();
    const box = await page
      .getByRole("button", { name: "Отозвать согласие и остановить сбор" })
      .boundingBox();
    assert(box && box.width > 0);
  }
  await page
    .getByRole("navigation", { name: "Разделы" })
    .getByRole("button", { name: "Заметки", exact: true })
    .click();
  await page
    .getByLabel("Название заметки", { exact: true })
    .fill("Native persisted note");
  await page
    .getByLabel("Markdown", { exact: true })
    .fill("NativeUniqueEvidence");
  await page
    .getByRole("button", { name: "Сохранить заметку", exact: true })
    .click();
  await page.getByText("Сохранено", { exact: true }).waitFor();
  const policy = await page.evaluate(() =>
    window.secondBrain.sendRequest("policy:get"),
  );
  assert.equal(policy.capture_consent, false);
  if (process.platform === "darwin") {
    await page.evaluate(() =>
      window.secondBrain.sendRequest("model:update_config", {
        api_key: "native-synthetic-credential",
      }),
    );
    const config = await page.evaluate(() =>
      window.secondBrain.sendRequest("model:get_config"),
    );
    assert.equal(config.has_api_key, true);
    assert.equal(config.api_key, "");
    assert.equal(config.credential_status, "macOS Keychain");
  }
  await app.close();
  app = null;
  page = await launch();
  await page
    .getByRole("navigation", { name: "Разделы" })
    .getByRole("button", { name: "Заметки", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Native persisted note", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("Markdown", { exact: true }).inputValue(),
    "NativeUniqueEvidence\n",
  );
  const results = await page.evaluate(() =>
    window.secondBrain.sendRequest("search:query", {
      query: "NativeUniqueEvidence",
    }),
  );
  assert.equal(results.results.length, 1);
  if (process.platform === "darwin") {
    const config = await page.evaluate(() =>
      window.secondBrain.sendRequest("model:get_config"),
    );
    assert.equal(config.has_api_key, true);
    await page.evaluate(() =>
      window.secondBrain.sendRequest("model:update_config", {
        clear_api_key: true,
      }),
    );
    const cleared = await page.evaluate(() =>
      window.secondBrain.sendRequest("model:get_config"),
    );
    assert.equal(cleared.has_api_key, false);
  }
  console.log(
    "PASS: real Electron preload/bridge, note persistence, FTS, consent, three window sizes",
  );
} finally {
  if (app) await app.close();
  if (process.platform === "darwin") {
    try {
      execFileSync(
        path.resolve("../.venv/bin/python"),
        [
          "-c",
          "import sys;from pathlib import Path;sys.path.insert(0,str(Path('../core/src').resolve()));from gateway.credentials import CredentialStore;s=CredentialStore(Path(sys.argv[1]).resolve());s.put('model_api_key','');s.put('nd_api_key','')",
          path.join(root, "Memory"),
        ],
        { stdio: "pipe" },
      );
    } catch {
      console.error("Keychain test cleanup failed");
      process.exitCode = 1;
    }
  }
  await rm(root, { recursive: true, force: true });
}
