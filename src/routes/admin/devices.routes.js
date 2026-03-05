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