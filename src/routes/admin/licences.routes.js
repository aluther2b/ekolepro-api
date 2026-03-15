// src/routes/admin/licences.routes.js
import express from "express";
import { supabaseService } from "../../config/supabase.js";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { requireAdmin } from "../../middlewares/requireAdmin.js";

const router = express.Router();

/**
 * PUT /api/admin/licences/:id
 * Met à jour le statut d'une licence (active/suspended)
 */
router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const licenceId = req.params.id;
    const { statut } = req.body;

    if (!licenceId) {
      return res.status(400).json({ error: "id_licence_requis" });
    }

    if (!["active", "suspended"].includes(statut)) {
      return res.status(400).json({ error: "statut_invalide" });
    }

    const { data: existing, error: fetchError } = await supabaseService
      .from("licences")
      .select("id")
      .eq("id", licenceId)
      .maybeSingle();

    if (fetchError || !existing) {
      return res.status(404).json({ error: "licence_non_trouvée" });
    }

    const { error: updateError } = await supabaseService
      .from("licences")
      .update({ statut, updated_at: new Date().toISOString() })
      .eq("id", licenceId);

    if (updateError) {
      console.error("❌ update licence error:", updateError);
      return res.status(500).json({ error: "erreur_mise_à_jour" });
    }

    res.json({ success: true, message: "Statut mis à jour" });
  } catch (err) {
    console.error("❌ licence update crash:", err);
    res.status(500).json({ error: "erreur_serveur" });
  }
});

export default router;
