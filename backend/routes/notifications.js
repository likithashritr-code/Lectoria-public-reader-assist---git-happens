import mongoose from "mongoose";
import { Router } from "express";
import { Notification } from "../models/index.js";
import { requireReader } from "../middleware/reader.js";

const router = Router();

router.post("/read", requireReader, async (req, res) => {
  const ids = req.body?.ids;
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string" || !mongoose.isValidObjectId(id))) {
    return res.status(400).json({ error: { code: "invalid_ids", message: "ids must be an array of notification ids" } });
  }
  const result = await Notification.updateMany(
    { _id: { $in: ids }, readerId: req.reader._id, isRead: false },
    { $set: { isRead: true } },
  );
  return res.json({ updated: result.modifiedCount });
});

export default router;