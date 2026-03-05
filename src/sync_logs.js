// src/routes/admin/sync_logs.js

import express from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { supabaseService } from "../config/supabase.js";

const router = express.Router();

/**
 * GET /api/admin/ecoles/:id/history
 * Historique des synchronisations d'une école
 */
router.get(
  "/ecoles/:id/history",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const { id } = req.params;

    if (!id || isNaN(Number(id))) {
      return res.status(400).json({
        error: "ID école invalide",
      });
    }

    try {
      const { data, error } = await supabaseService
        .from("sync_logs")
        .select(`
          id,
          action,
          device_id,
          table_name,
          statut,
          message,
          created_at
        `)
        .eq("ecole_id", id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        throw error;
      }

      return res.json({
        success: true,
        count: data.length,
        data,
      });
    } catch (err) {
      console.error("❌ /history", err);
      return res.status(500).json({
        success: false,
        error: "Erreur chargement historique",
      });
    }
  }
);

export default router;