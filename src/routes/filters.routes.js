// src/routes/filters.routes.js
import express from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { getFilters } from "../services/filters.service.js";

const router = express.Router();

/* =======================================================
   ROUTE : Récupération des filtres pour l'administration
   GET /api/admin/filters
======================================================= */
router.get("/", requireAuth, async (req, res) => {
  try {
    // req.user est injecté par requireAuth
    const data = await getFilters(req.user);

    // data doit contenir { drenas: [...], iepps: [...] }
    res.json(data);
  } catch (e) {
    console.error("❌ Erreur chargement filtres :", e);
    res.status(500).json({ message: "Erreur chargement filtres" });
  }
});

export default router;