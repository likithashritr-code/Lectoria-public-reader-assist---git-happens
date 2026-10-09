import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import app from "./app.js";
import { connectDatabase } from "./config/db.js";

dotenv.config({ path: fileURLToPath(new URL(".env", import.meta.url)) });

try {
  await connectDatabase();
  const port = Number(process.env.PORT) || 4000;
  app.listen(port, () => console.log(`Shelf Whisper API listening on port ${port}`));
} catch (error) {
  console.error("Backend startup failed:", error.message);
  process.exitCode = 1;
}