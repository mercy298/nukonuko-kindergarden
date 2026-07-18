import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const indexHtml = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const appSource = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

test("全画面化に成功したステージはキーボード操作を受け取れる", () => {
  assert.match(
    indexHtml,
    /<section\s+class="stage"\s+id="stage"\s+tabindex="-1"/,
    "stage は全画面化直後に programmatic focus できる tabindex=-1 を持つ",
  );
  assert.match(
    appSource,
    /await elements\.stage\.requestFullscreen\(\);\s*elements\.stage\.focus\(\);/,
    "requestFullscreen が成功してから stage へ focus する",
  );
});
