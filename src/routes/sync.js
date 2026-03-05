import express from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { applySyncItem } from "../services/syncService.js";
import { supabaseService } from "../config/supabase.js";

const router = express.Router();

/**
 * POST /api/sync/push
 * Synchronisation montante (offline → serveur)
 */
router.post("/push", requireAuth, async (req, res) => {
  const startedAt = new Date().toISOString();
  const deviceId = req.headers["x-device-id"] || null;

  console.log("===================================");
  console.log("📥 [SYNC PUSH]");
  console.log("🕒", startedAt);
  console.log("🏫 École:", req.ecoleId);
  console.log("📱 Device:", deviceId);

  if (!req.ecoleId) {
    return res.status(401).json({
      success: false,
      message: "École non identifiée",
    });
  }

  const { data } = req.body;

  if (!Array.isArray(data)) {
    return res.status(400).json({
      success: false,
      message: "Payload invalide (data doit être un tableau)",
    });
  }

  const results = [];

  // 🔥 Tables qui possèdent réellement ecole_id
  const tablesWithEcoleId = [
    "eleves",
    "utilisateurs",
    "notes",
    "presences",
    "devices",
    "sessions",
    "payments",
    "licences",
  ];

  for (const item of data) {
    const logBase = {
      ecole_id: req.ecoleId,
      device_id: deviceId,
      table_name: item?.table_name ?? null,
      action: item?.action ?? null,
      statut: "success",
      message: null,
    };

    try {
      /* ================= VALIDATION ================= */
      if (
        !item ||
        typeof item.queue_id !== "number" ||
        !item.table_name ||
        !item.action ||
        !item.payload?.uuid
      ) {
        throw new Error("Item sync invalide");
      }

      /* ================= SÉCURITÉ ECOLE ================= */
      if (
        item.payload.ecole_id &&
        item.payload.ecole_id !== req.ecoleId
      ) {
        throw new Error("Violation ecole_id");
      }

      /* ================= INJECTION ECOLE_ID ================= */
      if (tablesWithEcoleId.includes(item.table_name)) {
        item.payload.ecole_id = req.ecoleId;
      }

      /* ================= APPLICATION MÉTIER ================= */
      await applySyncItem(item);

      results.push({
        queue_id: item.queue_id,
        statut: "ok",
      });

      await supabaseService.from("sync_logs").insert({
        ...logBase,
        statut: "success",
      });

    } catch (err) {
      console.error("❌ SYNC ITEM ERROR:", err.message);

      results.push({
        queue_id: item?.queue_id ?? null,
        statut: "error",
        message: err.message,
      });

      await supabaseService.from("sync_logs").insert({
        ...logBase,
        statut: "error",
        message: err.message,
      });
    }
  }

  console.log("✅ [SYNC] Batch terminé :", results.length);
  console.log("===================================");

  return res.json({
    success: true,
    processed: data.length,
    results,
    server_time: new Date().toISOString(),
  });
});

export default router;