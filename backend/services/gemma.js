import { GoogleGenAI } from "@google/genai";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const dataDirectory = fileURLToPath(new URL("../data/", import.meta.url));
const cachePath = path.join(dataDirectory, "gemma_cache.json");
let ai;

export class GemmaError extends Error {
  constructor(code, message = "Gemma request failed") {
    super(message);
    this.name = "GemmaError";
    this.code = code;
  }
}

function client() {
  if (!process.env.GEMINI_API_KEY) {
    throw new GemmaError("gemma_failed", "GEMINI_API_KEY is not configured");
  }
  ai ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return ai;
}

function validateString(value) {
  return typeof value === "string";
}

function validateTitles(value) {
  return value && Array.isArray(value.titles) && value.titles.every((item) =>
    item && validateString(item.title) && validateString(item.author),
  );
}

function validateCover(value) {
  return value && validateString(value.title) && validateString(value.author);
}

function validatePicks(value) {
  return value && Array.isArray(value.picks) && value.picks.length <= 3 && value.picks.every((item) =>
    item && validateString(item.bookId) && validateString(item.reason),
  );
}

function validateTraits(value) {
  return value && validateString(value.archetype) && value.archetype.trim().length > 0 && value.archetype.length <= 80 &&
    validateString(value.mood) && value.mood.trim().length > 0 && value.mood.length <= 40 &&
    Array.isArray(value.top_subjects) && value.top_subjects.length <= 3 &&
    value.top_subjects.every(validateString);
}

function extractObject(text) {
  const unfenced = text.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
  const start = unfenced.indexOf("{");
  if (start < 0) throw new SyntaxError("JSON object not found");

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < unfenced.length; index += 1) {
    const character = unfenced[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) return JSON.parse(unfenced.slice(start, index + 1));
    }
  }
  throw new SyntaxError("JSON object is incomplete");
}

export function extractJson(text) {
  if (typeof text !== "string") throw new SyntaxError("Model returned no text");
  return extractObject(text);
}

function isRateLimited(error) {
  const status = error?.status ?? error?.code;
  const description = `${error?.message ?? ""} ${error?.statusText ?? ""}`.toLowerCase();
  return Number(status) === 429 || String(status).toLowerCase() === "resource_exhausted" ||
    description.includes("quota") || description.includes("rate limit") || description.includes("resource_exhausted");
}

async function readCache() {
  try {
    return JSON.parse(await fs.readFile(cachePath, "utf8"));
  } catch {
    return {};
  }
}

async function saveCache(functionName, result) {
  await fs.mkdir(dataDirectory, { recursive: true });
  const cache = await readCache();
  cache[functionName] = result;
  await fs.writeFile(cachePath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
}

async function invoke(functionName, prompt, validate, imageBuffer) {
  const contents = imageBuffer
    ? [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: await sharp(imageBuffer)
              .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
              .jpeg()
              .toBuffer()
              .then((buffer) => buffer.toString("base64")),
          },
        },
        { text: prompt },
      ]
    : prompt;
  const timeoutMs = Number(process.env.GEMMA_TIMEOUT_MS) || 30000;

  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const retryNote = attempt === 0 ? "" : " Your last reply was not valid JSON. Return only the JSON object.";
        const requestContents = typeof contents === "string"
          ? `${contents}${retryNote}`
          : [...contents.slice(0, -1), { text: `${prompt}${retryNote}` }];
        const response = await client().models.generateContent({
          model: process.env.GEMMA_MODEL || "gemma-4-26b-a4b-it",
          contents: requestContents,
          config: { abortSignal: controller.signal },
        });
        let result;
        try {
          result = extractJson(response.text);
          if (!validate(result)) throw new TypeError("Gemma response has an invalid shape");
        } catch (error) {
          if (attempt === 0) continue;
          throw error;
        }
        await saveCache(functionName, result);
        return result;
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new SyntaxError("Gemma response was not valid JSON");
  } catch (error) {
    if (process.env.DEMO_FALLBACK === "true") {
      const cached = (await readCache())[functionName];
      if (cached !== undefined) return cached;
    }
    if (error instanceof GemmaError) throw error;
    throw new GemmaError(isRateLimited(error) ? "rate_limited" : "gemma_failed", error.message);
  }
}

const jsonOnly = " Return JSON only, no markdown, no explanation.";

export function extractTitleFromCover(buffer) {
  return invoke(
    "extractTitleFromCover",
    `Read the book cover. Return the book title and author exactly as printed. If unreadable, use empty strings. Return {"title":"","author":""}.${jsonOnly}`,
    validateCover,
    buffer,
  );
}

export function extractTitlesFromImage(buffer) {
  return invoke(
    "extractTitlesFromImage",
    `This is a photo of a course reading list or syllabus. Extract every book title. Ignore chapter numbers, course codes, page ranges and notes. Use an empty author if none is shown. Return {"titles":[{"title":"","author":""}]}.${jsonOnly}`,
    validateTitles,
    buffer,
  );
}

export function extractTitlesFromText(text) {
  return invoke(
    "extractTitlesFromText",
    `This is text from a course reading list or syllabus. Extract every book title. Ignore chapter numbers, course codes, page ranges and notes. Use an empty author if none is shown. Return {"titles":[{"title":"","author":""}]}. Text: ${String(text)}.${jsonOnly}`,
    validateTitles,
  );
}

export function recommendAlternatives({ query, candidates }) {
  const promptCandidates = candidates.map(({ bookId, title, subjects }) => ({ bookId, title, subjects }));
  return invoke(
    "recommendAlternatives",
    `A reader searched for ${JSON.stringify(query)} but it is unavailable. Choose at most 3 books from these available candidates that best meet the same need. Each reason must be one short sentence of 12 words or fewer. Choose only from the provided IDs. Never invent a book. Candidates: ${JSON.stringify(promptCandidates)}. Return {"picks":[{"bookId":"","reason":""}]}.${jsonOnly}`,
    validatePicks,
  );
}

export function generateAvatarTraits(history) {
  return invoke(
    "generateAvatarTraits",
    `From these books this reader borrowed, return a short archetype label, up to 3 top subjects, and one mood word. Books: ${JSON.stringify(history)}. Return {"archetype":"","top_subjects":[""],"mood":""}.${jsonOnly}`,
    validateTraits,
  );
}