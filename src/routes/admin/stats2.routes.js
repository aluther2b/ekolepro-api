// src/routes/admin/stats2.routes.js
import express from "express";
import { supabaseService } from "../../config/supabase.js";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { requireAdmin } from "../../middlewares/requireAdmin.js";

const router = express.Router();

router.get("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || "";
    const status = req.query.status || "all";

    const offset = (page - 1) * limit;

    // Récupérer les écoles avec pagination
    let query = supabaseService
      .from("ecoles")
      .select("id, nom, code_ecole", { count: "exact" })
      .range(offset, offset + limit - 1)
      .order("id", { ascending: true });

    if (search) {
      query = query.ilike("nom", `%${search}%`);
    }

    const { data: ecoles, error, count } = await query;

    if (error) {
      console.error("❌ stats2 error:", error);
      return res.status(500).json({ error: "Erreur récupération écoles" });
    }

    // Pour chaque école, récupérer la dernière licence et le dernier paiement
    const schools = await Promise.all(
      ecoles.map(async (ecole) => {
        // Dernière licence
        const { data: licences } = await supabaseService
          .from("licences")
          .select("id, statut, date_debut, date_fin")
          .eq("ecole_id", ecole.id)
          .order("date_fin", { ascending: false })
          .limit(1);

        const licence = licences?.[0] || null;

        // Dernier paiement réussi
        const { data: payments } = await supabaseService
          .from("payments")
          .select("amount, validated_at")
          .eq("ecole_id", ecole.id)
          .eq("statut", "success")
          .order("validated_at", { ascending: false })
          .limit(1);

        const payment = payments?.[0] || null;

        return {
          id: ecole.id,
          licence_id: licence?.id || null, // important pour l'action
          nom: ecole.nom,
          code_ecole: ecole.code_ecole,
          licence_statut: licence?.statut || null,
          date_debut: licence?.date_debut || null,
          date_fin: licence?.date_fin || null,
          montant: payment?.amount || null,
          date_paiement: payment?.validated_at || null,
        };
      })
    );

    // Filtrer par statut (après récupération)
    let filteredSchools = schools;
    if (status !== "all") {
      filteredSchools = schools.filter((s) => s.licence_statut === status);
    }

    // Statistiques globales (indépendantes de la page)
    const { count: total } = await supabaseService
      .from("ecoles")
      .select("*", { count: "exact", head: true });

    const { count: active } = await supabaseService
      .from("licences")
      .select("ecole_id", { count: "exact", head: true })
      .eq("statut", "active");

    const { count: expired } = await supabaseService
      .from("licences")
      .select("ecole_id", { count: "exact", head: true })
      .eq("statut", "expired");

    const { count: suspended } = await supabaseService
      .from("licences")
      .select("ecole_id", { count: "exact", head: true })
      .eq("statut", "suspended");

    const withLicence = active + expired + suspended;
    const none = total - withLicence;

    res.json({
      stats: {
        total,
        active,
        expired,
        none,
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      schools: filteredSchools,
    });
  } catch (err) {
    console.error("❌ stats2 crash:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
