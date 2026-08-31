import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const baseRevision = process.argv[2];

if (!baseRevision) {
  console.error("Usage: node scripts/validate-quote-pr.mjs <base-revision>");
  process.exit(2);
}

function readQuotes(raw, source) {
  let value;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${source}: invalid JSON (${error.message})`);
  }

  if (!Array.isArray(value)) {
    throw new Error(`${source}: expected an array`);
  }

  return value;
}

try {
  const baseRaw = execFileSync(
    "git",
    ["show", `${baseRevision}:data/quotes.json`],
    { encoding: "utf8" },
  );
  const currentRaw = readFileSync("data/quotes.json", "utf8");
  const baseQuotes = readQuotes(baseRaw, `${baseRevision}:data/quotes.json`);
  const currentQuotes = readQuotes(currentRaw, "data/quotes.json");
  const baseTexts = new Set(
    baseQuotes
      .map((quote) => quote?.text)
      .filter((text) => typeof text === "string")
      .map((text) => text.trim()),
  );
  const addedQuotes = currentQuotes.filter(
    (quote) =>
      typeof quote?.text === "string" && !baseTexts.has(quote.text.trim()),
  );

  if (addedQuotes.length > 3) {
    console.error(
      `Quote contribution limit exceeded: added ${addedQuotes.length}, maximum is 3.`,
    );
    process.exit(1);
  }

  console.log(
    `Quote contribution limit passed: added ${addedQuotes.length} of 3 allowed.`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
