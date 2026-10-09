import cors from "cors";
import express from "express";
import catalogRoutes from "./routes/catalog.js";
import demoRoutes from "./routes/demo.js";
import notificationRoutes from "./routes/notifications.js";
import readerRoutes from "./routes/readers.js";
import { errorHandler } from "./middleware/errors.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use("/api/readers", readerRoutes);
app.use("/api", catalogRoutes);
app.use("/api/demo", demoRoutes);
app.use("/api/notifications", notificationRoutes);
app.use((req, res) => res.status(404).json({ error: { code: "not_found", message: "Route was not found" } }));
app.use(errorHandler);

export default app;