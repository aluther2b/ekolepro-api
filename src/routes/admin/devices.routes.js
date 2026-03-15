// src/routes/admin/devices.routes.js
import express from "express";
import { supabaseService } from "../../config/supabase.js";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { requireAdmin } from "../../middlewares/requireAdmin.js";
import { withScope } from "../../middlewares/scope.middleware.js";
import { logAudit } from "../../services/auditService.js";

const router = express.Router();

/* =====================================================
   HELPER — GET DEVICE + ECOLE + SCOPE VALIDATION
===================================================== */
async function getDeviceWithScopeValidation(id, scope) {
  // 1️⃣ Récupérer le device
  const { data: device, error: deviceError } = await supabaseService
    .from("devices")
    .select("id, ecole_id, blocked")
    .eq("id", id)
    .single();

  if (deviceError || !device) {
    return { error: "device_not_found" };
  }

  // 2️⃣ Récupérer l’école liée
  const { data: ecole, error: ecoleError } = await supabaseService
    .from("ecoles")
    .select("id, iepp, drena")
    .eq("id", device.ecole_id)
    .single();

  if (ecoleError || !ecole) {
    return { error: "ecole_not_found" };
  }

  // 3️⃣ Vérifier le scope
  if (
    (scope.level === "drena" && ecole.drena !== scope.drena_id) ||
    (scope.level === "iepp" && ecole.iepp !== scope.iepp_id)
  ) {
    return { error: "forbidden" };
  }

  return { device, ecole };
}

/* ===============================
   GET ALL DEVICES (avec scope)
================================ */
router.get(
  "/",
  requireAuth,
  requireAdmin,
  withScope(),
  async (req, res) => {
    try {
      const scope = req.scope;
      let query = supabaseService
        .from("devices")
        .select(`
          id,
          device_id,
          ecole_id,
          blocked,
          last_seen
        `)
        .order("created_at", { ascending: false });

      // Appliquer le scope sur les écoles
      if (scope.level === "drena" || scope.level === "iepp") {
        const filterField = scope.level === "drena" ? "drena" : "iepp";
        const { data: ecoles, error: ecolesError } = await supabaseService
          .from("ecoles")
          .select("id")
          .eq(filterField, scope[`${scope.level}_id`]);

        if (ecolesError) {
          return res.status(500).json({ error: "database_error" });
        }

        const ecoleIds = ecoles.map(e => e.id);
        if (ecoleIds.length === 0) {
          return res.json([]);
        }
        query = query.in("ecole_id", ecoleIds);
      }

      const { data, error } = await query;
      if (error) {
        console.error("❌ GET /devices error:", error);
        return res.status(500).json({ error: "server_error" });
      }

      res.json(data);
    } catch (err) {
      console.error("❌ GET /devices exception:", err);
      res.status(500).json({ error: "server_error" });
    }
  }
);

/* ===============================
   GET DEVICE BY ID (avec scope)
================================ */
router.get(
  "/:id",
  requireAuth,
  requireAdmin,
  withScope(),
  async (req, res) => {
    try {
      const { id } = req.params;
      const scope = req.scope;

      const { data: device, error } = await supabaseService
        .from("devices")
        .select(`
          id,
          device_id,
          ecole_id,
          blocked,
          last_seen
        `)
        .eq("id", id)
        .single();

      if (error || !device) {
        return res.status(404).json({ error: "device_not_found" });
      }

      // Vérifier le scope
      const { data: ecole, error: ecoleError } = await supabaseService
        .from("ecoles")
        .select("drena, iepp")
        .eq("id", device.ecole_id)
        .single();

      if (ecoleError || !ecole) {
        return res.status(500).json({ error: "ecole_not_found" });
      }

      if (
        (scope.level === "drena" && ecole.drena !== scope.drena_id) ||
        (scope.level === "iepp" && ecole.iepp !== scope.iepp_id)
      ) {
        return res.status(403).json({ error: "forbidden" });
      }

      res.json(device);
    } catch (err) {
      console.error("❌ GET /devices/:id exception:", err);
      res.status(500).json({ error: "server_error" });
    }
  }
);

/* ===============================
   GET DEVICE HISTORY
================================ */
router.get(
  "/:id/history",
  requireAuth,
  requireAdmin,
  withScope(),
  async (req, res) => {
    try {
      const { id } = req.params;
      const scope = req.scope;

      // Vérifier l'accès au device
      const { data: device, error: deviceError } = await supabaseService
        .from("devices")
        .select("ecole_id")
        .eq("id", id)
        .single();

      if (deviceError || !device) {
        return res.status(404).json({ error: "device_not_found" });
      }

      const { data: ecole, error: ecoleError } = await supabaseService
        .from("ecoles")
        .select("drena, iepp")
        .eq("id", device.ecole_id)
        .single();

      if (ecoleError || !ecole) {
        return res.status(500).json({ error: "ecole_not_found" });
      }

      if (
        (scope.level === "drena" && ecole.drena !== scope.drena_id) ||
        (scope.level === "iepp" && ecole.iepp !== scope.iepp_id)
      ) {
        return res.status(403).json({ error: "forbidden" });
      }

      // Récupérer l'historique depuis audit_logs
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
        .eq("entity_id", id)
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

/* ===============================
   BLOCK DEVICE
================================ */
router.post(
  "/:id/block",
  requireAuth,
  requireAdmin,
  withScope(),
  async (req, res) => {
    try {
      const { id } = req.params;
      const scope = req.scope;

      const result = await getDeviceWithScopeValidation(id, scope);

      if (result.error) {
        const status =
          result.error === "device_not_found" ||
          result.error === "ecole_not_found"
            ? 404
            : 403;

        return res.status(status).json({ error: result.error });
      }

      const { device } = result;

      // Si déjà bloqué → on ne fait rien
      if (device.blocked) {
        return res.json({ success: true, message: "already_blocked" });
      }

      // 4️⃣ Bloquer
      const { error: updateError } = await supabaseService
        .from("devices")
        .update({ blocked: true })
        .eq("id", id);

      if (updateError) {
        return res.status(500).json({ error: "update_failed" });
      }

      // 5️⃣ Audit
      await logAudit({
        action: "BLOCK_DEVICE",
        entityType: "device",
        entityId: id,
        user: req.authUser,
        req,
      });

      res.json({ success: true });
    } catch (err) {
      console.error("❌ BLOCK DEVICE ERROR:", err);
      res.status(500).json({ error: "server_error" });
    }
  }
);

/* ===============================
   UNBLOCK DEVICE
================================ */
router.post(
  "/:id/unblock",
  requireAuth,
  requireAdmin,
  withScope(),
  async (req, res) => {
    try {
      const { id } = req.params;
      const scope = req.scope;

      const result = await getDeviceWithScopeValidation(id, scope);

      if (result.error) {
        const status =
          result.error === "device_not_found" ||
          result.error === "ecole_not_found"
            ? 404
            : 403;

        return res.status(status).json({ error: result.error });
      }

      const { device } = result;

      // Si déjà débloqué → on ne fait rien
      if (!device.blocked) {
        return res.json({ success: true, message: "already_unblocked" });
      }

      // Débloquer
      const { error: updateError } = await supabaseService
        .from("devices")
        .update({ blocked: false })
        .eq("id", id);

      if (updateError) {
        return res.status(500).json({ error: "update_failed" });
      }

      // Audit
      await logAudit({
        action: "UNBLOCK_DEVICE",
        entityType: "device",
        entityId: id,
        user: req.authUser,
        req,
      });

      res.json({ success: true });
    } catch (err) {
      console.error("❌ UNBLOCK DEVICE ERROR:", err);
      res.status(500).json({ error: "server_error" });
    }
  }
);

export default router;
