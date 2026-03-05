// src/routes/admin/history.routes.js
import express from "express";
import { supabaseService } from "../../config/supabase.js";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { requireAdmin } from "../../middlewares/requireAdmin.js";
import { withScope } from "../../middlewares/scope.middleware.js";

const router = express.Router();

/* =======================================================
   📱 HISTORIQUE D’UN DEVICE
   GET /api/admin/history/devices/:deviceId/history
======================================================= */
router.get(
  "/devices/:deviceId/history",
  requireAuth,
  requireAdmin,
  withScope(),
  async (req, res) => {
    try {
      const { deviceId } = req.params;

      const { data, error } = await supabaseService
        .from("audit_logs")
        .select(`
          id,
          action,
          user_id,
          user_role,
          entity_type,
          entity_id,
          metadata,
          created_at
        `)
        .eq("entity_type", "device")
        .eq("entity_id", deviceId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("❌ Device history error:", error);
        return res.status(500).json({ error: "server_error" });
      }

      res.json(data || []);
    } catch (err) {
      console.error("❌ Device history exception:", err);
      res.status(500).json({ error: "server_error" });
    }
  }
);

/* =======================================================
   🏫 HISTORIQUE D’UNE ÉCOLE
   GET /api/admin/history/ecoles/:id/history
======================================================= */
router.get(
  "/ecoles/:id/history",
  requireAuth,
  requireAdmin,
  withScope(),
  async (req, res) => {
    try {
      const { id } = req.params;
      const scope = req.scope;

      /* 1️⃣ Récupérer école */
      const { data: school, error: schoolError } = await supabaseService
        .from("ecoles")
        .select("id, nom, drena, iepp")
        .eq("id", id)
        .single();

      if (schoolError || !school) {
        return res.status(404).json({ error: "ecole_not_found" });
      }

      /* 2️⃣ Vérification scope */
      if (
  (scope.level === "drena" &&
    school.drena !== scope.drena_id) ||
  (scope.level === "iepp" &&
    school.iepp !== scope.iepp_id)
) {
        return res.status(403).json({ error: "forbidden" });
      }

      /* 3️⃣ Récupérer devices de l’école */
      const { data: devices } = await supabaseService
        .from("devices")
        .select("id")
        .eq("ecole_id", school.id);

      const deviceIds = devices?.map(d => d.id) || [];

      /* 4️⃣ Récupérer logs école */
      const { data: schoolLogs, error: schoolLogsError } =
        await supabaseService
          .from("audit_logs")
          .select(`
            id,
            action,
            user_id,
            user_role,
            entity_type,
            entity_id,
            metadata,
            created_at
          `)
          .eq("entity_type", "ecole")
          .eq("entity_id", school.id);

      if (schoolLogsError) {
        console.error("❌ School logs error:", schoolLogsError);
        return res.status(500).json({ error: "server_error" });
      }

      /* 5️⃣ Récupérer logs devices */
      let deviceLogs = [];

      if (deviceIds.length > 0) {
        const { data, error } = await supabaseService
          .from("audit_logs")
          .select(`
            id,
            action,
            user_id,
            user_role,
            entity_type,
            entity_id,
            metadata,
            created_at
          `)
          .eq("entity_type", "device")
          .in("entity_id", deviceIds);

        if (error) {
          console.error("❌ Device logs error:", error);
          return res.status(500).json({ error: "server_error" });
        }

        deviceLogs = data || [];
      }

      /* 6️⃣ Fusion + tri */
      const allLogs = [...(schoolLogs || []), ...deviceLogs]
        .sort(
          (a, b) =>
            new Date(b.created_at) - new Date(a.created_at)
        );

      res.json(allLogs);
    } catch (err) {
      console.error("❌ School history exception:", err);
      res.status(500).json({ error: "server_error" });
    }
  }
);

export default router;