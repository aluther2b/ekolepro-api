// src/routes/admin/stats2.routes.js
import express from "express";
import { supabaseService } from "../../config/supabase.js";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { requireAdmin } from "../../middlewares/requireAdmin.js";

const router = express.Router();

/**
 * GET /api/admin/stats2
 * Statistiques générales des écoles avec pagination, recherche et filtre par statut de licence.
 */
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || "";
    const status = req.query.status || "all";

    const offset = (page - 1) * limit;

    let query = supabaseService
      .from("ecoles")
      .select(
        `
        id,
        nom,
        code_ecole,
        licences (
          statut,
          date_debut,
          date_fin
        ),
        payments (
          amount,
          validated_at,
          statut
        )
      `,
        { count: "exact" }
      )
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.ilike("nom", `%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("❌ stats2 error:", error);
      return res.status(500).json({ error: "Erreur récupération écoles" });
    }

    const schools = data.map((school) => {
      const licence = school.licences?.[0] || null;
      const payment = school.payments?.find((p) => p.statut === "success") || null;

      return {
        id: school.id,
        nom: school.nom,
        code_ecole: school.code_ecole,
        licence_statut: licence?.statut || null,
        date_debut: licence?.date_debut || null,
        date_fin: licence?.date_fin || null,
        montant: payment?.amount || null,
        date_paiement: payment?.validated_at || null,
      };
    });

    let filteredSchools = schools;
    if (status !== "all") {
      filteredSchools = schools.filter((s) => s.licence_statut === status);
    }

    const total = count;
    const active = schools.filter((s) => s.licence_statut === "active").length;
    const expired = schools.filter((s) => s.licence_statut === "expired").length;
    const none = schools.filter((s) => !s.licence_statut).length;

    res.json({
      stats: { total, active, expired, none },
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
