// src/routes/admin/ecoles.routes.js
import express from "express";
import { supabaseService } from "../../config/supabase.js";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { requireAdmin } from "../../middlewares/requireAdmin.js";
import { logAdminAction } from "../../utils/auditLogger.js";

const router = express.Router();

/* =======================================================
   📋 LISTE DES ÉCOLES
   GET /api/admin/ecoles
======================================================= */
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { data: schools, error } = await supabaseService
      .from("ecoles")
      .select("id, nom, drena, iepp")
      .order("nom", { ascending: true });

    if (error) {
      console.error("❌ Liste écoles error:", error);
      return res.status(500).json({ error: "server_error" });
    }

    const results = [];

    for (const school of schools || []) {
      const { data: licence } = await supabaseService
        .from("licences")
        .select("statut")
        .eq("ecole_id", school.id)
        .maybeSingle();

      results.push({
        id: school.id,
        nom: school.nom,
        drena: school.drena,
        iepp: school.iepp,
        licence_statut: licence?.statut ?? "expired",
      });
    }

    res.json(results);
  } catch (err) {
    console.error("❌ Liste écoles exception:", err);
    res.status(500).json({ error: "server_error" });
  }
});

/* =======================================================
   📊 STATS GLOBALES
   GET /api/admin/ecoles/stats
======================================================= */
router.get("/stats", requireAuth, requireAdmin, async (req, res) => {
  try {
    const [
      { count: total },
      { count: active },
      { count: expired },
      { count: suspended },
      { data: payments }
    ] = await Promise.all([
      supabaseService
        .from("ecoles")
        .select("*", { count: "exact", head: true }),

      supabaseService
        .from("licences")
        .select("*", { count: "exact", head: true })
        .eq("statut", "active"),

      supabaseService
        .from("licences")
        .select("*", { count: "exact", head: true })
        .eq("statut", "expired"),

      supabaseService
        .from("licences")
        .select("*", { count: "exact", head: true })
        .eq("statut", "suspended"),

      supabaseService
        .from("payments")
        .select("amount, created_at")
        .eq("statut", "success")
    ]);

    const now = new Date();
    const monthlyPayments =
      payments?.filter((p) => {
        const d = new Date(p.created_at);
        return (
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      }).reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

    res.json({
      total: total || 0,
      active: active || 0,
      expired: expired || 0,
      suspended: suspended || 0,
      monthlyPayments,
    });
  } catch (error) {
    console.error("❌ Stats error:", error);
    res.status(500).json({ error: "server_error" });
  }
});

/* =======================================================
   🏫 DÉTAIL D’UNE ÉCOLE
   GET /api/admin/ecoles/:id
======================================================= */
router.get("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    /* 1️⃣ École */
    const { data: school, error: schoolError } = await supabaseService
      .from("ecoles")
      .select(`
        id,
        nom,
        drena,
        iepp,
        secteur,
        directeur,
        annee_scolaire,
        code_ecole,
        created_at
      `)
      .eq("id", id)
      .single();

    if (schoolError || !school) {
      console.error("❌ Détail école error:", schoolError);
      return res.status(404).json({ error: "ecole_not_found" });
    }

    /* 2️⃣ Licence */
    const { data: licence } = await supabaseService
      .from("licences")
      .select(`
        id,
        licence_key,
        statut,
        date_debut,
        date_fin,
        max_devices,
        current_devices
      `)
      .eq("ecole_id", school.id)
      .maybeSingle();

    /* 3️⃣ Devices */
    const { data: devices } = await supabaseService
      .from("devices")
      .select(`
        id,
        device_id,
        modele,
        marque,
        os_version,
        statut,
        blocked,
        last_seen,
        registered_at
      `)
      .eq("ecole_id", school.id);

    res.json({
      ...school,
      licences: licence ? [licence] : [],
      devices: devices || [],
    });
  } catch (err) {
    console.error("❌ Détail école exception:", err);
    res.status(500).json({ error: "server_error" });
  }
});

/* =======================================================
   ⏸ SUSPENDRE UNE ÉCOLE
   POST /api/admin/ecoles/:id/suspend
======================================================= */
router.post("/:id/suspend", async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseService
      .from("licences")
      .update({ statut: "suspended" })
      .eq("ecole_id", id);

    if (error) {
      console.error("❌ Suspend error:", error);
      return res.status(500).json({ error: "server_error" });
    }

    await logAdminAction({
      action: "suspend_school",
      entityType: "ecole",
      entityId: id,
      details: { new_status: "suspended" },
    });

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Suspend exception:", err);
    res.status(500).json({ error: "server_error" });
  }
});

/* =======================================================
   🚫 BLOQUER DÉFINITIVEMENT
   POST /api/admin/ecoles/:id/block
======================================================= */
router.post("/:id/block", async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseService
      .from("licences")
      .update({ statut: "expired" })
      .eq("ecole_id", id);

    if (error) {
      console.error("❌ Block error:", error);
      return res.status(500).json({ error: "server_error" });
    }

    await logAdminAction({
      action: "block_school",
      entityType: "ecole",
      entityId: id,
      details: { new_status: "expired" },
    });

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Block exception:", err);
    res.status(500).json({ error: "server_error" });
  }
});

/* =======================================================
   ▶ RÉACTIVER UNE ÉCOLE
   POST /api/admin/ecoles/:id/reactivate
======================================================= */
router.post("/:id/reactivate", async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseService
      .from("licences")
      .update({ statut: "active" })
      .eq("ecole_id", id);

    if (error) {
      console.error("❌ Reactivate error:", error);
      return res.status(500).json({ error: "server_error" });
    }

    await logAdminAction({
      action: "reactivate_school",
      entityType: "ecole",
      entityId: id,
      details: { new_status: "active" },
    });

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Reactivate exception:", err);
    res.status(500).json({ error: "server_error" });
  }
});

export default router;