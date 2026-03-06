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
   HEALTH CHECK (optionnel)
==================================== */
router.get("/health", (req, res) => {
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

/* =========================================================
   NOUVELLES ROUTES PUBLIQUES POUR L'INSCRIPTION
   ========================================================= */

/** GET /drenas : liste distincte des DRENA */
router.get("/drenas", async (req, res) => {
  try {
    const { data, error } = await supabaseService
      .from("ecoles")
      .select("drena")
      .not("drena", "is", null)
      .order("drena");

    if (error) throw error;

    const drenas = [...new Set(data.map(item => item.drena))];
    res.json(drenas);
  } catch (err) {
    console.error("❌ Erreur /drenas:", err);
    res.status(500).json({ error: "Erreur interne" });
  }
});

/** GET /iepps?drena=... : liste distincte des IEPP pour une DRENA */
router.get("/iepps", async (req, res) => {
  try {
    const { drena } = req.query;
    if (!drena) return res.status(400).json({ error: "drena requis" });

    const { data, error } = await supabaseService
      .from("ecoles")
      .select("iepp")
      .eq("drena", drena)
      .not("iepp", "is", null)
      .order("iepp");

    if (error) throw error;

    const iepps = [...new Set(data.map(item => item.iepp))];
    res.json(iepps);
  } catch (err) {
    console.error("❌ Erreur /iepps:", err);
    res.status(500).json({ error: "Erreur interne" });
  }
});

/** GET /ecoles?drena=...&iepp=... : écoles filtrées */
router.get("/ecoles", async (req, res) => {
  try {
    const { drena, iepp } = req.query;
    if (!drena || !iepp) {
      return res.status(400).json({ error: "drena et iepp requis" });
    }

    const { data, error } = await supabaseService
      .from("ecoles")
      .select("id, nom")
      .eq("drena", drena)
      .eq("iepp", iepp)
      .order("nom");

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("❌ Erreur /ecoles:", err);
    res.status(500).json({ error: "Erreur interne" });
  }
});

/** GET /director-exists?name=... : vérifie si un directeur existe déjà */
router.get("/director-exists", async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) return res.status(400).json({ error: "name requis" });

    const { data, error } = await supabaseService
      .from("ecoles")
      .select("id")
      .eq("directeur", name)
      .maybeSingle();

    if (error) throw error;
    res.json({ exists: !!data });
  } catch (err) {
    console.error("❌ Erreur /director-exists:", err);
    res.status(500).json({ error: "Erreur interne" });
  }
});

/** GET /check-classe?ecole_id=...&classe=... : vérifie si une classe est déjà prise */
router.get("/check-classe", async (req, res) => {
  try {
    const { ecole_id, classe } = req.query;
    if (!ecole_id || !classe) {
      return res.status(400).json({ error: "ecole_id et classe requis" });
    }

    const { data, error } = await supabaseService
      .from("utilisateurs")
      .select("id")
      .eq("ecole_id", ecole_id)
      .eq("classe", classe)
      .eq("role", "enseignant")
      .maybeSingle();

    if (error) throw error;
    res.json({ disponible: !data }); // disponible = true si aucun enseignant trouvé
  } catch (err) {
    console.error("❌ Erreur /check-classe:", err);
    res.status(500).json({ error: "Erreur interne" });
  }
});

/** POST /ecoles : créer une nouvelle école */
router.post("/ecoles", async (req, res) => {
  try {
    const {
      nom,
      drena,
      iepp,
      secteur,
      directeur,
      annee_scolaire,
      code_ecole,
      date_creation,
    } = req.body;

    if (!nom || !drena || !iepp) {
      return res.status(400).json({ error: "nom, drena, iepp requis" });
    }

    const { data, error } = await supabaseService
      .from("ecoles")
      .insert({
        nom,
        drena,
        iepp,
        secteur,
        directeur,
        annee_scolaire,
        code_ecole,
        date_creation,
      })
      .select("id, uuid")
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error("❌ Erreur création école:", err);
    res.status(500).json({ error: "Erreur interne" });
  }
});

/** POST /users : créer un nouvel utilisateur (directeur ou enseignant) */
router.post("/users", async (req, res) => {
  try {
    const {
      ecole_id,
      nom,
      prenoms,
      sexe,
      classe,
      login,
      mot_de_passe,
      role,
    } = req.body;

    if (!ecole_id || !nom || !login || !mot_de_passe || !role) {
      return res.status(400).json({ error: "Champs requis manquants" });
    }

    // Vérifier si le login existe déjà
    const { data: existing } = await supabaseService
      .from("utilisateurs")
      .select("id")
      .eq("login", login.toLowerCase())
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: "Login déjà utilisé" });
    }

    // Hachage du mot de passe
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(mot_de_passe, saltRounds);

    const { data, error } = await supabaseService
      .from("utilisateurs")
      .insert({
        ecole_id,
        nom,
        prenoms,
        sexe,
        classe: role === "enseignant" ? classe : null,
        login: login.toLowerCase(),
        password_hash,
        role,
        is_active: true,
      })
      .select("id, uuid")
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error("❌ Erreur création utilisateur:", err);
    res.status(500).json({ error: "Erreur interne" });
  }
});

export default router;
