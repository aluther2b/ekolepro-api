// src/routes/recovery.js
import express from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { supabaseService } from "../config/supabase.js";

const router = express.Router();

/**
 * GET /api/recovery/full
 * Récupère toutes les données de l'école de l'utilisateur connecté.
 * Nécessite un token JWT valide (middleware requireAuth).
 */
router.get("/full", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id || req.authUser?.id;
    if (!userId) {
      return res.status(401).json({ error: "Utilisateur non identifié" });
    }

    // Récupérer l'école de l'utilisateur
    const { data: user, error: userError } = await supabaseService
      .from("utilisateurs")
      .select("ecole_id")
      .eq("id", userId)
      .maybeSingle();

    if (userError) {
      console.error("❌ Erreur récupération utilisateur:", userError);
      return res.status(500).json({ error: "Erreur interne" });
    }

    if (!user?.ecole_id) {
      return res.status(400).json({ error: "Aucune école associée à cet utilisateur" });
    }

    const ecoleId = user.ecole_id;

    // ---- École ----
    const { data: ecoles } = await supabaseService
      .from("ecoles")
      .select("*")
      .eq("id", ecoleId);
    const ecolesData = ecoles || [];

    // ---- Utilisateurs ----
    const { data: utilisateurs } = await supabaseService
      .from("utilisateurs")
      .select("*")
      .eq("ecole_id", ecoleId);
    const utilisateursData = utilisateurs || [];

    // ---- Élèves ----
    const { data: eleves } = await supabaseService
      .from("eleves")
      .select("*")
      .eq("ecole_id", ecoleId);
    const elevesData = eleves || [];
    const eleveIds = elevesData.map(e => e.id);

    // ---- Notes (avec école_id ajouté) ----
    let notesData = [];
    if (eleveIds.length > 0) {
      const { data: notes } = await supabaseService
        .from("notes")
        .select("*")
        .in("eleve_id", eleveIds);
      notesData = (notes || []).map(n => ({ ...n, ecole_id: ecoleId }));
    }

    // ---- Présences (avec école_id ajouté) ----
    let presencesData = [];
    if (eleveIds.length > 0) {
      const { data: presences } = await supabaseService
        .from("presences")
        .select("*")
        .in("eleve_id", eleveIds);
      presencesData = (presences || []).map(p => ({ ...p, ecole_id: ecoleId }));
    }

    // ---- Coefficients (avec école_id ajouté) ----
    let coeffsData = [];
    if (elevesData.length > 0) {
      const classes = [...new Set(elevesData.map(e => e.classe))];
      if (classes.length > 0) {
        const { data: coeffs } = await supabaseService
          .from("coeffs")
          .select("*")
          .in("classe", classes);
        coeffsData = (coeffs || []).map(c => ({ ...c, ecole_id: ecoleId }));
      }
    }

    // ---- Licences ----
    const { data: licences } = await supabaseService
      .from("licences")
      .select("*")
      .eq("ecole_id", ecoleId);
    const licencesData = licences || [];

    const results = {
      ecoles: ecolesData,
      utilisateurs: utilisateursData,
      eleves: elevesData,
      notes: notesData,
      presences: presencesData,
      coeffs: coeffsData,
      licences: licencesData,
    };

    return res.json(results);
  } catch (err) {
    console.error("❌ Erreur inattendue dans /full:", err);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

export default router;
