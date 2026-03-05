// src/routes/auth.routes.js
import express from "express";
import { supabaseService } from "../config/supabase.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";

const router = express.Router();

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "A0z/jLO/H2ONXrs86u+Au3aOuPfBZWBZIoVsPTkSsSk=";

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const REFRESH_EXPIRES_IN = "30d";

/* ====================================
   JWT UTILITIES
==================================== */
function generateAccessToken(user) {
  return jwt.sign(
    {
      id: user.id,
      login: user.login,
      role: user.role,
      ecole_id: user.ecole_id,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function generateRefreshToken(user) {
  return jwt.sign({ id: user.id }, JWT_SECRET, {
    expiresIn: REFRESH_EXPIRES_IN,
  });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

/* ====================================
   HEALTH CHECK
==================================== */
router.get("/api/health", (req, res) => {
  res.json({
    name: "EKOLEPRO Backend",
    status: "OK",
    timestamp: new Date().toISOString(),
  });
});

/* ====================================
   LOGIN (avec création session)
==================================== */
router.post("/login", async (req, res) => {
  try {
    const { login, password, device_id } = req.body;

    if (!login || !password)
      return res.status(400).json({ error: "login_password_required" });

    const normalizedLogin = login.toLowerCase();

    const { data: user, error } = await supabaseService
      .from("utilisateurs")
      .select(`
        id,
        uuid,
        nom,
        prenoms,
        login,
        role,
        classe,
        ecole_id,
        is_active,
        created_at,
        password_hash,
        ecoles (
          nom,
          drena,
          iepp,
          directeur,
          annee_scolaire
        )
      `)
      .eq("login", normalizedLogin)
      .maybeSingle();

    if (error || !user)
      return res.status(401).json({ error: "invalid_credentials" });

    if (!user.is_active)
      return res.status(403).json({ error: "account_disabled" });

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid)
      return res.status(401).json({ error: "invalid_credentials" });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    /* ===============================
       SESSION MANAGEMENT
    =============================== */

    const finalDeviceId = device_id || crypto.randomUUID();

    // Désactiver ancienne session active sur le même appareil
    await supabaseService
      .from("sessions")
      .update({
        active: false,
        disconnected_at: new Date().toISOString(),
      })
      .eq("device_id", finalDeviceId)
      .eq("active", true);

    // Créer nouvelle session
    await supabaseService.from("sessions").insert({
      utilisateur_id: user.id,
      ecole_id: user.ecole_id,
      device_id: finalDeviceId,
      active: true,
      connected_at: new Date().toISOString(),
    });

    /* ===============================
       RESPONSE
    =============================== */

    res.json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        uuid: user.uuid,
        nom: user.nom || "",
        prenoms: user.prenoms || "",
        login: user.login,
        role: user.role || "",
        classe: user.classe || "",
        annee_scolaire:
          user.annee_scolaire || user.ecoles?.annee_scolaire || "",
        ecole_id: user.ecole_id || 0,
        ecole_nom: user.ecoles?.nom || "",
        drena: user.ecoles?.drena || "",
        iepp: user.ecoles?.iepp || "",
        directeur: user.ecoles?.directeur || "",
        is_active: user.is_active,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

/* ====================================
   LOGOUT (désactive session)
==================================== */
router.post("/logout", async (req, res) => {
  try {
    const { device_id } = req.body;

    if (!device_id)
      return res.status(400).json({ error: "device_id_required" });

    await supabaseService
      .from("sessions")
      .update({
        active: false,
        disconnected_at: new Date().toISOString(),
      })
      .eq("device_id", device_id)
      .eq("active", true);

    res.json({ success: true, message: "Déconnecté" });
  } catch (err) {
    console.error("❌ Logout error:", err);
    res.status(500).json({ error: "logout_failed" });
  }
});

/* ====================================
   REFRESH TOKEN
==================================== */
router.post("/refresh", async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token)
      return res.status(400).json({ error: "refresh_token_required" });

    const payload = verifyToken(refresh_token);
    if (!payload)
      return res.status(401).json({ error: "invalid_refresh_token" });

    const { data: user, error } = await supabaseService
      .from("utilisateurs")
      .select("*")
      .eq("id", payload.id)
      .maybeSingle();

    if (error || !user)
      return res.status(404).json({ error: "user_not_found" });

    const accessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    res.json({
      success: true,
      accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    console.error("❌ Refresh error:", err);
    res.status(500).json({ error: "refresh_failed" });
  }
});

/* ====================================
   GET /me
==================================== */
router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer "))
      return res.status(401).json({ error: "token_required" });

    const token = authHeader.split(" ")[1];
    const payload = verifyToken(token);

    if (!payload)
      return res.status(401).json({ error: "invalid_token" });

    const { data: user, error } = await supabaseService
      .from("utilisateurs")
      .select("*, ecoles(nom, drena, iepp, directeur, annee_scolaire)")
      .eq("id", payload.id)
      .maybeSingle();

    if (error || !user)
      return res.status(404).json({ error: "user_not_found" });

    res.json({
      success: true,
      user: {
        id: user.id,
        nom: user.nom,
        prenoms: user.prenoms,
        login: user.login,
        role: user.role,
        classe: user.classe || "",
        annee_scolaire:
          user.annee_scolaire || user.ecoles?.annee_scolaire || "",
        ecole_id: user.ecole_id,
        ecole_nom: user.ecoles?.nom || null,
        drena: user.ecoles?.drena || null,
        iepp: user.ecoles?.iepp || null,
        directeur: user.ecoles?.directeur || null,
        is_active: user.is_active,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    console.error("❌ Me error:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

export default router;