export function sendApiError(res, error) {
  if (error?.code === "rate_limited") {
    return res.status(503).json({ error: { code: "rate_limited", message: "Gemma is busy, try again" } });
  }
  if (error?.code === "gemma_failed") {
    return res.status(502).json({ error: { code: "gemma_failed", message: "Could not read that, try again" } });
  }
  return null;
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const gemmaResponse = sendApiError(res, error);
  if (gemmaResponse) return gemmaResponse;

  if (error?.name === "MulterError" && error.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: { code: "image_too_large", message: "Image must be 5MB or smaller" } });
  }
  if (error?.name === "MulterError") {
    return res.status(400).json({ error: { code: "invalid_upload", message: "Upload a valid image" } });
  }
  console.error(error);
  return res.status(500).json({ error: { code: "internal_error", message: "Something went wrong" } });
}