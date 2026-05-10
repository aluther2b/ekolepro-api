// src/routes/recovery.js
import express from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { supabaseService } from "../config/supabase.js";

const router = express.Router();

router.get("/full", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id || req.authUser?.id;

    if (!userId) {
      return res.status(401).json({ error: "Utilisateur non identifié" });
    }

    // 🔹 Récupérer école utilisateur
    const { data: user, error } = await supabaseService
      .from("utilisateurs")
      .select("ecole_id")
      .eq("id", userId)
      .maybeSingle();

    if (error || !user?.ecole_id) {
      return res.status(400).json({ error: "École introuvable" });
    }

    const ecoleId = user.ecole_id;

    // ---- Écoles ----
    const { data: ecoles } = await supabaseService
      .from("ecoles")
      .select("*")
      .eq("id", ecoleId);

    // ---- Élèves ----
    const { data: eleves } = await supabaseService
      .from("eleves")
      .select("*")
      .eq("ecole_id", ecoleId);

    const eleveIds = (eleves || []).map(e => e.id);

    // ---- Notes ----
    const { data: notes } = await supabaseService
      .from("notes")
      .select("*")
      .in("eleve_id", eleveIds);

    // ---- Présences ----
    const { data: presences } = await supabaseService
      .from("presences")
      .select("*")
      .in("eleve_id", eleveIds);

    // ---- Coeffs ----
    const classes = [...new Set((eleves || []).map(e => e.classe))];

    const { data: coeffs } = await supabaseService
      .from("coeffs")
      .select("*")
      .in("classe", classes);

    // ---- Licences ----
    const { data: licences } = await supabaseService
      .from("licences")
      .select("*")
      .eq("ecole_id", ecoleId);

    return res.json({
      ecoles: ecoles || [],
      eleves: eleves || [],
      notes: notes || [],
      presences: presences || [],
      coeffs: coeffs || [],
      licences: licences || [],
    });

  } catch (err) {
    console.error("❌ Recovery API:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;