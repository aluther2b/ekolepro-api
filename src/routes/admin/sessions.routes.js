// src/routes/admin/sessions.routes.js
import express from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { requireAdmin } from "../../middlewares/requireAdmin.js";
import { logAudit } from "../../services/auditService.js";
import {
  getActiveSessions,
  forceLogoutSession,
} from "../../services/admin/sessions.service.js";

const router = express.Router();

/* =====================================================
   GET /api/admin/sessions
   Liste des sessions actives
===================================================== */
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const sessions = await getActiveSessions();

    return res.json({
      success: true,
      sessions: sessions || [],
    });
  } catch (error) {
    console.error("❌ Sessions fetch error:", error);

    return res.status(500).json({
      success: false,
      error: "sessions_fetch_failed",
    });
  }
});

/* =====================================================
   POST /api/admin/sessions/:id/logout
   Déconnexion forcée d'une session
===================================================== */
router.post("/:id/logout", requireAuth, requireAdmin, async (req, res) => {
  try {
    const sessionId = req.params.id;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: "session_id_required",
      });
    }

    const session = await forceLogoutSession(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: "session_not_found",
      });
    }

    /* ===== AUDIT LOG ===== */
    await logAudit({
      action: "FORCE_LOGOUT",
      entityType: "device",
      entityId: session.device_id,
      user: req.authUser,
      req,
      metadata: {
        session_id: session.id,
        forced_by: req.authUser?.login || "admin",
      },
    });

    return res.json({
      success: true,
      message: "Session déconnectée",
    });
  } catch (error) {
    console.error("❌ Force logout error:", error);

    return res.status(500).json({
      success: false,
      error: "logout_failed",
    });
  }
});

export default router;