//src/routes/admin/audit.routes.js
import express from "express";
import { supabaseService } from "../../config/supabase.js";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { requireAdmin } from "../../middlewares/requireAdmin.js";

const router = express.Router();

/**
 * GET /admin/audit
 * filtres: action, user, ecole, device, date_from, date_to
 */
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  const { action, user, ecole, entityType } = req.query;

  let query = supabaseService
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false });

  if (action) query = query.eq("action", action);
  if (entityType) query = query.eq("entity_type", entityType);
  if (user) query = query.eq("user_id", user);
  if (ecole) query = query.eq("entity_id", ecole);

  const { data, error } = await query;

  if (error) return res.status(500).json({ error: error.message });

  res.json(data);
});

export default router;
