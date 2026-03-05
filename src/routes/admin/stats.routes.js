// src/routes/admin/stats.routes.js
import express from "express";

import { requireAuth } from "../../middlewares/auth.middleware.js";
import { requireAdmin } from "../../middlewares/requireAdmin.js";

import { getAdminStats } from "../../services/admin/stats.service.js";

const router = express.Router();

/* =====================================
   GET /api/admin/stats
===================================== */

router.get(
  "/",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {

      const stats = await getAdminStats();

      res.json(stats);

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error: "stats_fetch_failed",
      });

    }
  }
);

export default router;