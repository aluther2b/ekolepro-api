//src/routes/filters.routes.js
import express from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { getFilters } from "../services/filters.service.js";

const router = express.Router();

router.get("/admin/filters", requireAuth, async (req, res) => {
  try {
    const data = await getFilters(req.user);
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erreur filtres" });
  }
});

export default router;
