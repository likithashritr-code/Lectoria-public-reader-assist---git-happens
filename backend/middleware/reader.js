import { Reader } from "../models/index.js";

export async function requireReader(req, res, next) {
  const readerId = req.get("X-Reader-Id");
  if (!readerId) {
    return res.status(401).json({ error: { code: "reader_required", message: "Reader identity is required" } });
  }

  try {
    const reader = await Reader.findById(readerId);
    if (!reader) {
      return res.status(401).json({ error: { code: "reader_unknown", message: "Reader was not found" } });
    }
    req.reader = reader;
    return next();
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(401).json({ error: { code: "reader_unknown", message: "Reader was not found" } });
    }
    return next(error);
  }
}

export function requireMatchingReader(req, res, next) {
  if (String(req.params.id) !== String(req.reader._id)) {
    return res.status(403).json({ error: { code: "reader_mismatch", message: "Reader identity does not match" } });
  }
  return next();
}