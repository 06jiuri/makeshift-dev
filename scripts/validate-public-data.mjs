import { readFileSync } from "node:fs";

const errors = [];
const invalidJson = Symbol("invalidJson");

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    errors.push(`${path}: invalid JSON (${error.message})`);
    return invalidJson;
  }
}

function requireArray(value, path) {
  if (!Array.isArray(value)) {
    errors.push(`${path}: expected an array`);
    return false;
  }
  return true;
}

function validatePerson(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${path}: expected an object`);
    return;
  }

  if (typeof value.qq !== "string" || !/^\d{5,12}$/.test(value.qq)) {
    errors.push(`${path}.qq: expected 5-12 digits as a string`);
  }
  if (
    typeof value.displayName !== "string" ||
    value.displayName.trim().length === 0 ||
    value.displayName.length > 40
  ) {
    errors.push(`${path}.displayName: expected 1-40 characters`);
  }

  const extraKeys = Object.keys(value).filter(
    (key) => !["qq", "displayName"].includes(key),
  );
  if (extraKeys.length > 0) {
    errors.push(`${path}: unexpected fields: ${extraKeys.join(", ")}`);
  }
}

function validatePeople(values, path) {
  if (!requireArray(values, path)) return;

  const seenQq = new Set();
  values.forEach((value, index) => {
    const itemPath = `${path}[${index}]`;
    validatePerson(value, itemPath);
    if (typeof value?.qq === "string") {
      if (seenQq.has(value.qq)) {
        errors.push(`${itemPath}.qq: duplicate QQ in ${path}`);
      }
      seenQq.add(value.qq);
    }
  });
}

const students = readJson("data/students.json");
if (students !== invalidJson) validatePeople(students, "data/students.json");

const quotes = readJson("data/quotes.json");
if (quotes !== invalidJson && requireArray(quotes, "data/quotes.json")) {
  const seenText = new Set();
  quotes.forEach((value, index) => {
    const path = `data/quotes.json[${index}]`;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      errors.push(`${path}: expected an object`);
      return;
    }
    if (
      typeof value.text !== "string" ||
      value.text.trim().length === 0 ||
      value.text.length > 500
    ) {
      errors.push(`${path}.text: expected 1-500 characters`);
    } else if (value.text !== value.text.trim()) {
      errors.push(`${path}.text: remove leading or trailing whitespace`);
    }
    if (typeof value.source !== "string" || value.source.length > 100) {
      errors.push(`${path}.source: expected a string up to 100 characters`);
    } else if (value.source !== value.source.trim()) {
      errors.push(`${path}.source: remove leading or trailing whitespace`);
    }
    if (typeof value.text === "string") {
      const normalized = value.text.trim();
      if (seenText.has(normalized)) {
        errors.push(`${path}.text: duplicate quote`);
      }
      seenText.add(normalized);
    }
    const extraKeys = Object.keys(value).filter(
      (key) => !["text", "source"].includes(key),
    );
    if (extraKeys.length > 0) {
      errors.push(`${path}: unexpected fields: ${extraKeys.join(", ")}`);
    }
  });
}

const team = readJson("data/team.json");
if (team !== invalidJson) {
  if (!team || typeof team !== "object" || Array.isArray(team)) {
    errors.push("data/team.json: expected an object");
  } else {
    for (const group of ["founders", "instructors"]) {
      validatePeople(team[group], `data/team.json.${group}`);
    }
    const extraKeys = Object.keys(team).filter(
      (key) => !["founders", "instructors"].includes(key),
    );
    if (extraKeys.length > 0) {
      errors.push(`data/team.json: unexpected groups: ${extraKeys.join(", ")}`);
    }
  }
}

if (errors.length > 0) {
  console.error("Public data validation failed:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Public data validation passed.");
