import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("完成Blossomを指定cropの同一オリジンassetとして配信する", async () => {
  const asset = await readFile(
    new URL("../public/assets/openai-blossom-dark.svg", import.meta.url),
    "utf8",
  );
  const server = await readFile(
    new URL("../scripts/server.js", import.meta.url),
    "utf8",
  );

  assert.match(asset, /viewBox="624 82 560 559"/);
  assert.match(server, /\/assets\/openai-blossom-dark\.svg/);
});

test("CLIMAX中は舞台コピーとカメラインジケーターを隠す", async () => {
  const styles = await readFile(
    new URL("../public/styles.css", import.meta.url),
    "utf8",
  );

  assert.match(
    styles,
    /\.stage\[data-phase="climax"\][^{]*\.stage-copy/,
  );
  assert.match(
    styles,
    /\.stage\[data-phase="climax"\][^{]*\.live-indicator/,
  );
  assert.match(
    styles,
    /\.stage\[data-phase="climax"\] \.stage-copy,[\s\S]*?transition: none;/,
    "CLIMAXの暗転開始時はコピーを即時に消す",
  );
  assert.ok(
    styles.lastIndexOf('.stage[data-phase="climax"] .stage-copy') >
      styles.lastIndexOf('.stage[data-live="true"] .stage-copy'),
    "映像入力中でもCLIMAXの非表示を後段で優先する",
  );
});
