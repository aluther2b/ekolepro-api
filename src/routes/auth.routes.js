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
      uuid: user.uuid,
      login: user.login,
      role: user.role,
      ecole_id: user.ecole_id,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { 
      id: user.id,
      uuid: user.uuid 
    }, 
    JWT_SECRET, 
    {
      expiresIn: REFRESH_EXPIRES_IN,
    }
  );
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
   ✅ CORRIGÉ : LEFT JOIN pour admin sans école
==================================== */
router.post("/login", async (req, res) => {
  try {
    const { login, password, device_id } = req.body;

    console.log("📥 [LOGIN] Tentative de connexion:", { login, device_id });

    if (!login || !password) {
      console.log("❌ [LOGIN] login ou password manquant");
      return res.status(400).json({ error: "login_password_required" });
    }

    const normalizedLogin = login.toLowerCase();
    console.log("🔍 [LOGIN] Recherche utilisateur:", normalizedLogin);

    // ✅ CORRECTION PRINCIPALE : Utilisation de !left pour faire un LEFT JOIN
    // Cela permet de récupérer l'admin même s'il n'a pas d'ecole_id
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
        ecoles!left (
          nom,
          drena,
          iepp,
          directeur,
          annee_scolaire
        )
      `)
      .eq("login", normalizedLogin)
      .maybeSingle();

    if (error) {
      console.error("❌ [LOGIN] Erreur Supabase:", error);
      return res.status(500).json({ error: "database_error" });
    }

    if (!user) {
      console.log("❌ [LOGIN] Utilisateur non trouvé:", normalizedLogin);
      return res.status(401).json({ error: "invalid_credentials" });
    }

    console.log("✅ [LOGIN] Utilisateur trouvé:", { 
      id: user.id, 
      login: user.login, 
      role: user.role,
      ecole_id: user.ecole_id,
      has_ecoles: !!user.ecoles
    });

    if (!user.is_active) {
      console.log("❌ [LOGIN] Compte désactivé");
      return res.status(403).json({ error: "account_disabled" });
    }

    // Vérification du mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    console.log("🔐 [LOGIN] Vérification mot de passe:", isPasswordValid ? "OK" : "ÉCHEC");
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: "invalid_credentials" });
    }

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
      ecole_id: user.ecole_id || null,
      device_id: finalDeviceId,
      active: true,
      connected_at: new Date().toISOString(),
    });

    console.log("✅ [LOGIN] Session créée pour device:", finalDeviceId);

    /* ===============================
       RESPONSE
    =============================== */
    const responseUser = {
      id: user.id,
      uuid: user.uuid,
      nom: user.nom || "",
      prenoms: user.prenoms || "",
      login: user.login,
      role: user.role || "",
      classe: user.classe || "",
      // ✅ Gestion du cas où ecoles est null (admin sans école)
      annee_scolaire: user.ecoles?.annee_scolaire || "",
      ecole_id: user.ecole_id || 0,
      ecole_nom: user.ecoles?.nom || "",
      drena: user.ecoles?.drena || "",
      iepp: user.ecoles?.iepp || "",
      directeur: user.ecoles?.directeur || "",
      is_active: user.is_active,
      created_at: user.created_at,
    };

    console.log("✅ [LOGIN] Connexion réussie:", { 
      userId: user.id, 
      role: user.role,
      deviceId: finalDeviceId 
    });

    res.json({
      success: true,
      accessToken,
      refreshToken,
      user: responseUser,
      device_id: finalDeviceId, // Retourner le device_id pour le client
    });
  } catch (err) {
    console.error("❌ [LOGIN] Erreur inattendue:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

/* ====================================
   LOGOUT (désactive session)
==================================== */
router.post("/logout", async (req, res) => {
  try {
    const { device_id } = req.body;

    if (!device_id) {
      return res.status(400).json({ error: "device_id_required" });
    }

    console.log("📤 [LOGOUT] Déconnexion device:", device_id);

    await supabaseService
      .from("sessions")
      .update({
        active: false,
        disconnected_at: new Date().toISOString(),
      })
      .eq("device_id", device_id)
      .eq("active", true);

    console.log("✅ [LOGOUT] Session désactivée");
    res.json({ success: true, message: "Déconnecté" });
  } catch (err) {
    console.error("❌ [LOGOUT] Erreur:", err);
    res.status(500).json({ error: "logout_failed" });
  }
});

/* ====================================
   REFRESH TOKEN
   ✅ CORRIGÉ : Utilisation de l'ID pour la recherche
==================================== */
router.post("/refresh", async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({ error: "refresh_token_required" });
    }

    const payload = verifyToken(refresh_token);
    if (!payload) {
      console.log("❌ [REFRESH] Token invalide");
      return res.status(401).json({ error: "invalid_refresh_token" });
    }

    console.log("🔄 [REFRESH] Pour utilisateur:", payload.id);

    // ✅ CORRECTION : Recherche par id (qui est dans le payload)
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
        ecoles!left (
          nom,
          drena,
          iepp,
          directeur,
          annee_scolaire
        )
      `)
      .eq("id", payload.id)
      .maybeSingle();

    if (error || !user) {
      console.log("❌ [REFRESH] Utilisateur non trouvé");
      return res.status(404).json({ error: "user_not_found" });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: "account_disabled" });
    }

    const accessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    console.log("✅ [REFRESH] Nouveaux tokens générés");

    res.json({
      success: true,
      accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    console.error("❌ [REFRESH] Erreur:", err);
    res.status(500).json({ error: "refresh_failed" });
  }
});

/* ====================================
   GET /me
   ✅ CORRIGÉ : LEFT JOIN pour admin
==================================== */
router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "token_required" });
    }

    const token = authHeader.split(" ")[1];
    const payload = verifyToken(token);

    if (!payload) {
      return res.status(401).json({ error: "invalid_token" });
    }

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
        ecoles!left (
          nom,
          drena,
          iepp,
          directeur,
          annee_scolaire
        )
      `)
      .eq("id", payload.id)
      .maybeSingle();

    if (error || !user) {
      return res.status(404).json({ error: "user_not_found" });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        uuid: user.uuid,
        nom: user.nom || "",
        prenoms: user.prenoms || "",
        login: user.login,
        role: user.role || "",
        classe: user.classe || "",
        annee_scolaire: user.ecoles?.annee_scolaire || "",
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
    console.error("❌ [ME] Erreur:", err);
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

    const drenas = [
      ...new Set(
        data
          .map(item => item.drena?.trim())
          .filter(Boolean)
      ),
    ];

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
    if (!drena) {
      return res.status(400).json({ error: "drena requis" });
    }

    const { data, error } = await supabaseService
      .from("ecoles")
      .select("iepp")
      .ilike("drena", `%${drena.trim()}%`)
      .not("iepp", "is", null)
      .order("iepp");

    if (error) throw error;

    const iepps = [
      ...new Set(
        data
          .map(item => item.iepp?.trim())
          .filter(Boolean)
      ),
    ];

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
      .ilike("drena", `%${drena.trim()}%`)
      .ilike("iepp", `%${iepp.trim()}%`)
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

    if (!name) {
      return res.status(400).json({ error: "name requis" });
    }

    const { data } = await supabaseService
      .from("ecoles")
      .select("id")
      .ilike("directeur", name.trim())
      .maybeSingle();

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
    
    // disponible = true si aucun enseignant trouvé
    res.json({ disponible: !data });
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
        classe: classe || null,
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

/* =========================================================
   SYNCHRONISATION UTILISATEUR POST-CONNEXION
   ✅ CORRIGÉ : LEFT JOIN pour la recherche utilisateur
   ========================================================= */
router.post("/sync-user", async (req, res) => {
  try {
    const { login, password, nom, prenoms, role, classe, ecole } = req.body;

    console.log("📥 [sync-user] Requête reçue:", {
      login,
      passwordLength: password?.length,
      ecole_uuid: ecole?.uuid,
    });

    if (!login || !password || !nom || !role || !ecole) {
      return res.status(400).json({ error: "Champs requis manquants" });
    }

    const normalizedLogin = login.toLowerCase();

    // 1. Vérifier si l'utilisateur existe déjà
    // ✅ CORRECTION : LEFT JOIN pour ne pas filtrer les utilisateurs sans école
    const { data: existingUser, error: userError } = await supabaseService
      .from("utilisateurs")
      .select(`
        id, 
        password_hash,
        ecoles!left(nom, drena, iepp, directeur, annee_scolaire)
      `)
      .eq("login", normalizedLogin)
      .maybeSingle();

    if (userError) throw userError;

    // 2. Si l'utilisateur existe, vérifier le mot de passe et retourner les tokens
    if (existingUser) {
      const isPasswordValid = await bcrypt.compare(password, existingUser.password_hash);
      console.log(`🔐 [sync-user] Vérification mot de passe pour ${login}: ${isPasswordValid ? "OK" : "ÉCHEC"}`);
      
      if (!isPasswordValid) {
        return res.status(401).json({ error: "Mot de passe incorrect" });
      }

      // ✅ CORRECTION : LEFT JOIN pour récupérer toutes les infos
      const { data: user, error: fetchError } = await supabaseService
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
          ecoles!left (
            nom,
            drena,
            iepp,
            directeur,
            annee_scolaire
          )
        `)
        .eq("id", existingUser.id)
        .single();

      if (fetchError) throw fetchError;

      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      return res.json({
        success: true,
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          uuid: user.uuid,
          nom: user.nom,
          prenoms: user.prenoms,
          login: user.login,
          role: user.role,
          classe: user.classe || "",
          annee_scolaire: user.ecoles?.annee_scolaire || "",
          ecole_id: user.ecole_id || 0,
          ecole_nom: user.ecoles?.nom || "",
          drena: user.ecoles?.drena || "",
          iepp: user.ecoles?.iepp || "",
          directeur: user.ecoles?.directeur || "",
        },
      });
    }

    // 3. L'utilisateur n'existe pas → créer l'école et l'utilisateur
    console.log("📝 [sync-user] Création nouvel utilisateur");

    let ecoleId = null;
    if (ecole.uuid) {
      const { data: existingEcole } = await supabaseService
        .from("ecoles")
        .select("id")
        .eq("uuid", ecole.uuid)
        .maybeSingle();

      if (existingEcole) {
        ecoleId = existingEcole.id;
      }
    }

    if (!ecoleId) {
      const { data: newEcole, error: ecoleError } = await supabaseService
        .from("ecoles")
        .insert({
          uuid: ecole.uuid || crypto.randomUUID(),
          nom: ecole.nom,
          drena: ecole.drena,
          iepp: ecole.iepp,
          secteur: ecole.secteur || null,
          directeur: ecole.directeur || null,
          annee_scolaire: ecole.annee_scolaire || null,
          code_ecole: ecole.code_ecole || null,
          date_creation: ecole.date_creation || null,
        })
        .select("id")
        .single();

      if (ecoleError) throw ecoleError;
      ecoleId = newEcole.id;
    }

    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const { data: newUser, error: createError } = await supabaseService
      .from("utilisateurs")
      .insert({
        ecole_id: ecoleId,
        nom,
        prenoms: prenoms || null,
        sexe: null,
        classe: classe || null,
        login: normalizedLogin,
        password_hash,
        role,
        is_active: true,
      })
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
        ecoles!left (
          nom,
          drena,
          iepp,
          directeur,
          annee_scolaire
        )
      `)
      .single();

    if (createError) throw createError;

    const accessToken = generateAccessToken(newUser);
    const refreshToken = generateRefreshToken(newUser);

    console.log("✅ [sync-user] Utilisateur créé:", newUser.id);

    res.json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: newUser.id,
        uuid: newUser.uuid,
        nom: newUser.nom,
        prenoms: newUser.prenoms,
        login: newUser.login,
        role: newUser.role,
        classe: newUser.classe || "",
        annee_scolaire: newUser.ecoles?.annee_scolaire || "",
        ecole_id: newUser.ecole_id || 0,
        ecole_nom: newUser.ecoles?.nom || "",
        drena: newUser.ecoles?.drena || "",
        iepp: newUser.ecoles?.iepp || "",
        directeur: newUser.ecoles?.directeur || "",
      },
    });
  } catch (err) {
    console.error("❌ [sync-user] Erreur:", err);
    res.status(500).json({ error: "Erreur interne" });
  }
});

export default router;