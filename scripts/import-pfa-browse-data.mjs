#!/usr/bin/env node
/**
 * Extract "Browse Data" from Amazon PFA .xlsm templates → JSON for the app category picker.
 *
 * Usage:
 *   node scripts/import-pfa-browse-data.mjs path/to/template.xlsm [more.xlsm ...]
 *
 * Output: artifacts/listing-auditor/src/data/pfa-browse-categories.json (merged, deduped by browse node id)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outPath = path.join(
  repoRoot,
  "artifacts/listing-auditor/src/data/pfa-browse-categories.json",
);

function parseXlsmBrowseRows(filePath) {
  const AdmZip = require("adm-zip");
  const { XMLParser } = require("fast-xml-parser");
  const zip = new AdmZip(filePath);
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

  const wb = parser.parse(zip.readAsText("xl/workbook.xml"));
  const sheets = [].concat(wb.workbook?.sheets?.sheet ?? []);
  const browseSheet = sheets.find((s) => String(s["@_name"]).toLowerCase() === "browse data");
  if (!browseSheet) {
    throw new Error(`${filePath}: no "Browse Data" sheet`);
  }
  const rId = browseSheet["@_r:id"];
  const rels = parser.parse(zip.readAsText("xl/_rels/workbook.xml.rels"));
  const relList = [].concat(rels.Relationships?.Relationship ?? []);
  const target = relList.find((r) => r["@_Id"] === rId)?.["@_Target"];
  if (!target) throw new Error(`${filePath}: Browse Data sheet target not found`);
  const normalized = String(target).replace(/^\.\//, "");
  const sheetPath = normalized.startsWith("xl/") ? normalized : `xl/${normalized}`;

  const sstRaw = parser.parse(zip.readAsText("xl/sharedStrings.xml"));
  const siList = [].concat(sstRaw.sst?.si ?? []);
  function readSharedString(si) {
    if (typeof si === "string") return si;
    if (si.t != null && typeof si.t !== "object") return String(si.t);
    if (typeof si.t === "string") return si.t;
    if (si.t && typeof si.t === "object" && si.t["#text"]) return String(si.t["#text"]);
    const runs = [].concat(si.r ?? []);
    return runs
      .map((run) => {
        if (!run) return "";
        if (typeof run.t === "string") return run.t;
        if (run.t && typeof run.t === "object" && run.t["#text"]) return String(run.t["#text"]);
        return "";
      })
      .join("");
  }
  const sharedStrings = siList.map(readSharedString);

  const sheet = parser.parse(zip.readAsText(sheetPath));
  const rows = [].concat(sheet.worksheet?.sheetData?.row ?? []);
  const out = [];

  for (const row of rows) {
    const rowNum = Number(row["@_r"] ?? 0);
    if (rowNum < 2) continue;
    const cells = [].concat(row.c ?? []);
    let browseNodeId = "";
    let browsePath = "";
    for (const cell of cells) {
      const ref = cell["@_r"] ?? "";
      const colLetters = ref.replace(/[0-9]/g, "");
      let col = 0;
      for (const ch of colLetters) col = col * 26 + (ch.charCodeAt(0) - 64);
      const v = cell.v;
      const text =
        cell["@_t"] === "s" && v != null ? sharedStrings[Number(v)] ?? "" : v != null ? String(v) : "";
      if (col === 1) browseNodeId = text.trim();
      if (col === 2) browsePath = text.trim();
    }
    if (!browseNodeId || !browsePath) continue;
    const label = browsePath.split(">").pop()?.trim() || browsePath;
    out.push({ browseNodeId, browsePath, label });
  }
  return out;
}

function main() {
  const inputs = process.argv.slice(2);
  if (inputs.length === 0) {
    console.error("Usage: node scripts/import-pfa-browse-data.mjs <file.xlsm> [...]");
    process.exit(1);
  }

  const byId = new Map();
  const sources = [];
  for (const input of inputs) {
    const abs = path.resolve(input);
    const rows = parseXlsmBrowseRows(abs);
    sources.push(path.basename(abs));
    for (const row of rows) {
      if (!byId.has(row.browseNodeId)) byId.set(row.browseNodeId, row);
    }
  }

  const categories = [...byId.values()].sort((a, b) =>
    a.browsePath.localeCompare(b.browsePath, undefined, { sensitivity: "base" }),
  );

  const payload = {
    sources,
    updatedAt: new Date().toISOString(),
    categories,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Wrote ${categories.length} browse categories → ${outPath}`);
}

main();
