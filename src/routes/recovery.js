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
    // req.authUser est défini par le middleware requireAuth
    // On suppose qu'il contient l'id de l'utilisateur (de la table utilisateurs)
    const userId = req.authUser.id;

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

    // Liste des tables à exporter (doit correspondre à celles attendues par le client)
    const tables = [
      "ecoles",
      "utilisateurs",
      "eleves",
      "notes",
      "presences",
      "coeffs",
      "licences",
    ];

    const results = {};

    // Pour chaque table, récupérer les lignes correspondant à l'école
    for (const table of tables) {
      let query = supabaseService.from(table).select("*");

      // La table 'ecoles' n'a pas de colonne ecole_id, on filtre par id
      if (table === "ecoles") {
        query = query.eq("id", ecoleId);
      } else {
        query = query.eq("ecole_id", ecoleId);
      }

      const { data, error } = await query;

      if (error) {
        console.error(`❌ Erreur récupération table ${table}:`, error);
        // On continue pour les autres tables, mais on met un tableau vide
        results[table] = [];
      } else {
        results[table] = data || [];
      }
    }

    return res.json(results);
  } catch (err) {
    console.error("❌ Erreur inattendue dans /full:", err);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

export default router;
