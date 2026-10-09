import assert from "node:assert/strict";
import test from "node:test";
import { extractJson } from "../services/gemma.js";

test("extractJson parses fenced JSON with nested objects", () => {
  const parsed = extractJson('Model reply:\n```json\n{"titles":[{"title":"Silent Spring","author":"Rachel Carson"}]}\n```');
  assert.deepEqual(parsed, { titles: [{ title: "Silent Spring", author: "Rachel Carson" }] });
});

test("extractJson ignores braces inside quoted strings", () => {
  assert.deepEqual(extractJson('Prefix {"title":"A {small} book"} suffix'), { title: "A {small} book" });
});

test("extractJson rejects replies without a complete JSON object", () => {
  assert.throws(() => extractJson("No structured result"), SyntaxError);
  assert.throws(() => extractJson('{"title":"unfinished"'), SyntaxError);
});