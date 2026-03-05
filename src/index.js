// src/index.js
import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import morgan from "morgan";

/* ===== ROUTES PUBLIQUES ===== */
import callbackRoutes from "./routes/callbacks.routes.js";

/* ===== ROUTES AUTH ===== */
import authRoutes from "./routes/auth.routes.js";

/* ===== ROUTES PROTÉGÉES ===== */
import paymentRoutes from "./routes/payments.routes.js";
import licenceRoutes from "./routes/licence.routes.js";
import syncRoutes from "./routes/sync.js";
import recoveryRoutes from "./routes/recovery.js";

/* ===== ROUTES ADMIN ===== */
import adminRoutes from "./routes/admin/index.routes.js";
import adminEcolesRoutes from "./routes/admin/ecoles.routes.js";
import adminDevicesRoutes from "./routes/admin/devices.routes.js";
import adminSessionsRoutes from "./routes/admin/sessions.routes.js";
import adminAuditRoutes from "./routes/admin/audit.routes.js";
import adminHistoryRoutes from "./routes/admin/history.routes.js";
import filtersRoutes from "./routes/filters.routes.js";
import adminStatsRoutes from "./routes/admin/stats.routes.js";

import { requireAuth } from "./middlewares/auth.middleware.js";
import { requireAdmin } from "./middlewares/requireAdmin.js";


const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  credentials: true
}));

app.use(express.json({ limit: "10mb" })); // JSON
app.use(express.urlencoded({ extended: true })); // FORM-URLENCODED (PAYDUNYA)

app.use(morgan("dev"));

/* ================= HEALTHCHECK ================= */
app.get("/api/health", (req, res) => {
  res.json({
    name: "EKOLEPRO Backend",
    status: "OK",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

/* ================= ROUTES PUBLIQUES ================= */
app.use("/api/callbacks", callbackRoutes);
app.use("/api/auth", authRoutes);

/* ================= ROUTES PROTÉGÉES ================= */
app.use("/api/payments", requireAuth, paymentRoutes);
app.use("/api/licence", requireAuth, licenceRoutes);
app.use("/api/sync", requireAuth, syncRoutes);
app.use("/api/recovery", requireAuth, recoveryRoutes);

/* ================= ROUTES ADMIN ================= */
app.use("/api/admin", requireAuth, requireAdmin, adminRoutes);
app.use("/api/admin/ecoles", requireAuth, requireAdmin, adminEcolesRoutes);
app.use("/api/admin/devices", requireAuth, requireAdmin, adminDevicesRoutes);
app.use("/api/admin/sessions", requireAuth, requireAdmin, adminSessionsRoutes);
app.use("/api/admin/audit", requireAuth, requireAdmin, adminAuditRoutes);
app.use("/api/admin/history", requireAuth, requireAdmin, adminHistoryRoutes);
app.use("/api/admin/filters", requireAuth, requireAdmin, filtersRoutes);
app.use("/api/admin/stats", requireAuth, requireAdmin, adminStatsRoutes);

/* ================= 404 HANDLER ================= */
app.use((req, res) => {
  res.status(404).json({
    error: "Route non trouvée",
    path: req.originalUrl,
  });
});

/* ================= ERROR HANDLER ================= */
app.use((err, req, res, next) => {
  console.error("❌ Backend error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Erreur serveur interne",
  });
});

/* ================= SERVER ================= */
const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Backend Ekolepro lancé sur http://0.0.0.0:${PORT}`);
});
