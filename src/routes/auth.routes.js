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
   FONCTION HELPER POUR FORMER L'UTILISATEUR
   ✅ Utilise utilisateur_annees pour la classe
==================================== */
function formatUserResponse(user) {
  // ✅ Récupérer la classe depuis utilisateur_annees (filtre est_active)
  const activeAnnee = user.utilisateur_annees?.find(ua => ua.est_active === true);
  const classe = activeAnnee?.classe || "";
  const annee_scolaire = activeAnnee?.annees_scolaires_globales?.libelle || "";

  return {
    id: user.id,
    uuid: user.uuid,
    nom: user.nom || "",
    prenoms: user.prenoms || "",
    login: user.login,
    role: user.role || "",
    classe: classe,
    annee_scolaire: annee_scolaire,
    ecole_id: user.ecole_id || 0,
    ecole_uuid: user.ecoles?.uuid || "",
    ecole_nom: user.ecoles?.nom || "",
    drena: user.ecoles?.drena || "",
    iepp: user.ecoles?.iepp || "",
    secteur: user.ecoles?.secteur || "",
    directeur: user.ecoles?.directeur || "",
    code_ecole: user.ecoles?.code_ecole || "",
    date_creation: user.ecoles?.date_creation || "",
    is_active: user.is_active,
    created_at: user.created_at,
  };
}

/* ====================================
   FONCTION HELPER : Créer utilisateur_annees
   ✅ Centralise la création de l'entrée dans utilisateur_annees
==================================== */
async function createUtilisateurAnnees(utilisateurId, ecoleId, classe, anneeGlobaleId = null) {
  try {
    // Si une année spécifique est fournie, l'utiliser
    let anneeId = anneeGlobaleId;
    
    // Sinon, récupérer l'année active
    if (!anneeId) {
      const { data: anneeActive } = await supabaseService
        .from("annees_scolaires_globales")
        .select("id")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      
      if (anneeActive) {
        anneeId = anneeActive.id;
      }
    }
    
    if (!anneeId) {
      console.warn("⚠️ Aucune année scolaire active trouvée pour utilisateur_annees");
      return null;
    }
    
    // Vérifier si l'entrée existe déjà
    const { data: existing } = await supabaseService
      .from("utilisateur_annees")
      .select("id")
      .eq("utilisateur_id", utilisateurId)
      .eq("annee_scolaire_globale_id", anneeId)
      .maybeSingle();
    
    if (existing) {
      // Mettre à jour la classe si elle a changé
      if (classe) {
        await supabaseService
          .from("utilisateur_annees")
          .update({ classe: classe.trim(), est_active: true })
          .eq("id", existing.id);
      }
      console.log("✅ utilisateur_annees mis à jour:", { utilisateurId, anneeId, classe });
      return existing;
    }
    
    // Créer la nouvelle entrée
    const { data: newUA, error } = await supabaseService
      .from("utilisateur_annees")
      .insert({
        utilisateur_id: utilisateurId,
        annee_scolaire_globale_id: anneeId,
        ecole_id: Number(ecoleId),
        classe: classe ? classe.trim() : null,
        est_active: true,
      })
      .select("id, uuid, classe")
      .single();
    
    if (error) {
      console.error("❌ Erreur création utilisateur_annees:", error);
      return null;
    }
    
    console.log("✅ utilisateur_annees créé:", { utilisateurId, anneeId, classe, uaId: newUA.id });
    return newUA;
  } catch (error) {
    console.error("❌ Erreur dans createUtilisateurAnnees:", error);
    return null;
  }
}

/* ====================================
   HEALTH CHECK
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
   ✅ Utilise utilisateur_annees pour récupérer la classe
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

    // ✅ REQUÊTE : utiliser utilisateur_annees pour la classe
    // Note: on ne filtre PAS sur est_active dans la jointure pour éviter de perdre l'utilisateur
    const { data: user, error } = await supabaseService
      .from("utilisateurs")
      .select(`
        id,
        uuid,
        nom,
        prenoms,
        login,
        role,
        ecole_id,
        is_active,
        created_at,
        password_hash,
        ecoles!left (
          id,
          uuid,
          nom,
          drena,
          iepp,
          secteur,
          directeur,
          code_ecole,
          date_creation
        ),
        utilisateur_annees!left (
          classe,
          est_active,
          annees_scolaires_globales!left (
            libelle
          )
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
      has_ecoles: !!user.ecoles,
      nb_utilisateur_annees: user.utilisateur_annees?.length || 0,
      classe: user.utilisateur_annees?.find(ua => ua.est_active)?.classe || "N/A"
    });

    if (!user.is_active) {
      console.log("❌ [LOGIN] Compte désactivé");
      return res.status(403).json({ error: "account_disabled" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    console.log("🔐 [LOGIN] Vérification mot de passe:", isPasswordValid ? "OK" : "ÉCHEC");
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: "invalid_credentials" });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    const finalDeviceId = device_id || crypto.randomUUID();

    // Désactiver les sessions précédentes pour ce device
    await supabaseService
      .from("sessions")
      .update({
        active: false,
        disconnected_at: new Date().toISOString(),
      })
      .eq("device_id", finalDeviceId)
      .eq("active", true);

    // Créer une nouvelle session
    await supabaseService.from("sessions").insert({
      utilisateur_id: user.id,
      ecole_id: user.ecole_id || null,
      device_id: finalDeviceId,
      active: true,
      connected_at: new Date().toISOString(),
    });

    console.log("✅ [LOGIN] Session créée pour device:", finalDeviceId);

    const responseUser = formatUserResponse(user);

    console.log("✅ [LOGIN] Connexion réussie:", { 
      userId: user.id, 
      role: user.role,
      classe: responseUser.classe,
      deviceId: finalDeviceId 
    });

    res.json({
      success: true,
      accessToken,
      refreshToken,
      user: responseUser,
      device_id: finalDeviceId,
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

    const { data: user, error } = await supabaseService
      .from("utilisateurs")
      .select(`
        id,
        uuid,
        nom,
        prenoms,
        login,
        role,
        ecole_id,
        is_active,
        created_at,
        ecoles!left (
          id,
          uuid,
          nom,
          drena,
          iepp,
          secteur,
          directeur,
          code_ecole,
          date_creation
        ),
        utilisateur_annees!left (
          classe,
          est_active,
          annees_scolaires_globales!left (
            libelle
          )
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
        ecole_id,
        is_active,
        created_at,
        ecoles!left (
          id,
          uuid,
          nom,
          drena,
          iepp,
          secteur,
          directeur,
          code_ecole,
          date_creation
        ),
        utilisateur_annees!left (
          classe,
          est_active,
          annees_scolaires_globales!left (
            libelle
          )
        )
      `)
      .eq("id", payload.id)
      .maybeSingle();

    if (error || !user) {
      return res.status(404).json({ error: "user_not_found" });
    }

    res.json({
      success: true,
      user: formatUserResponse(user),
    });
  } catch (err) {
    console.error("❌ [ME] Erreur:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

/* =========================================================
   ROUTE POUR RÉCUPÉRER L'ANNÉE SCOLAIRE ACTIVE
   ========================================================= */
router.get("/ecole/:ecoleId/annee-active", async (req, res) => {
  try {
    const { ecoleId } = req.params;
    
    const { data, error } = await supabaseService
      .from("annees_scolaires_globales")
      .select("*")
      .eq("is_active", true)
      .order("date_debut", { ascending: false })
      .limit(1)
      .maybeSingle();
      
    if (error) throw error;
    
    res.json({ 
      success: true, 
      annee_active: data || null 
    });
  } catch (err) {
    console.error("❌ Erreur récupération année active:", err);
    res.status(500).json({ error: "Erreur interne" });
  }
});

/* =========================================================
   ROUTES PUBLIQUES POUR L'INSCRIPTION
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
      .select("id, uuid, nom, drena, iepp, secteur, directeur, code_ecole")
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

    // ✅ Utiliser utilisateur_annees (nouvelle structure)
    const { data, error } = await supabaseService
      .from("utilisateur_annees")
      .select("id")
      .eq("ecole_id", ecole_id)
      .eq("classe", classe)
      .eq("est_active", true)
      .maybeSingle();

    if (error) throw error;
    
    res.json({ disponible: !data });
  } catch (err) {
    console.error("❌ Erreur /check-classe:", err);
    res.status(500).json({ error: "Erreur interne" });
  }
});

/** POST /ecoles : créer une nouvelle école */
router.post("/ecoles", async (req, res) => {
  try {
    console.log("📥 [POST /ecoles] Body reçu:", JSON.stringify(req.body, null, 2));
    
    const {
      nom,
      drena,
      iepp,
      secteur,
      directeur,
      code_ecole,
      date_creation,
    } = req.body;

    const missingFields = [];
    if (!nom) missingFields.push("nom");
    if (!drena) missingFields.push("drena");
    if (!iepp) missingFields.push("iepp");
    
    if (missingFields.length > 0) {
      console.log("❌ Champs manquants:", missingFields);
      return res.status(400).json({ 
        error: "nom, drena, iepp requis",
        missing: missingFields 
      });
    }

    const finalCodeEcole = code_ecole || `ECO-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    const { data, error } = await supabaseService
      .from("ecoles")
      .insert({
        nom: nom.trim(),
        drena: drena.trim(),
        iepp: iepp.trim(),
        secteur: secteur?.trim() || null,
        directeur: directeur?.trim() || null,
        code_ecole: finalCodeEcole,
        date_creation: date_creation || new Date().toISOString().split('T')[0],
      })
      .select("id, uuid, nom, code_ecole")
      .single();

    if (error) {
      console.error("❌ Erreur Supabase insertion école:", error);
      
      if (error.code === "23505") {
        return res.status(409).json({ error: "Code école déjà utilisé" });
      }
      
      throw error;
    }
    
    console.log("✅ École créée:", data);
    
    res.status(201).json(data);
  } catch (err) {
    console.error("❌ Erreur création école:", err);
    res.status(500).json({ error: "Erreur interne", details: err.message });
  }
});

/** POST /users : créer un nouvel utilisateur (directeur ou enseignant) */
router.post("/users", async (req, res) => {
  try {
    console.log("📥 [POST /users] Body reçu:", JSON.stringify(req.body, null, 2));
    
    const {
      ecole_id,
      nom,
      prenoms,
      sexe,
      classe,
      login,
      mot_de_passe,
      role,
      annee_scolaire_globale_id,  // ✅ Nouveau paramètre
    } = req.body;

    const missingFields = [];
    if (!ecole_id) missingFields.push("ecole_id");
    if (!nom) missingFields.push("nom");
    if (!login) missingFields.push("login");
    if (!mot_de_passe) missingFields.push("mot_de_passe");
    if (!role) missingFields.push("role");
    
    if (missingFields.length > 0) {
      console.log("❌ Champs manquants:", missingFields);
      return res.status(400).json({ 
        error: "Champs requis manquants",
        missing: missingFields 
      });
    }

    // Vérifier si le login existe déjà
    const { data: existing } = await supabaseService
      .from("utilisateurs")
      .select("id")
      .eq("login", login.toLowerCase().trim())
      .maybeSingle();

    if (existing) {
      console.log("❌ Login déjà utilisé:", login);
      return res.status(409).json({ error: "Login déjà utilisé" });
    }

    const saltRounds = 10;
    const password_hash = await bcrypt.hash(mot_de_passe, saltRounds);

    // ✅ Créer l'utilisateur SANS la colonne classe
    const { data: newUser, error } = await supabaseService
      .from("utilisateurs")
      .insert({
        ecole_id: Number(ecole_id),
        nom: nom.trim(),
        prenoms: prenoms?.trim() || null,
        sexe: sexe || null,
        login: login.toLowerCase().trim(),
        password_hash,
        role: role.toLowerCase(),
        is_active: true,
      })
      .select("id, uuid, nom, prenoms, login, role, ecole_id")
      .single();

    if (error) {
      console.error("❌ Erreur Supabase insertion utilisateur:", error);
      
      if (error.code === "23505") {
        return res.status(409).json({ error: "Login déjà utilisé" });
      }
      if (error.code === "23503") {
        return res.status(400).json({ error: "École non trouvée" });
      }
      
      throw error;
    }

    // ✅ Créer l'entrée dans utilisateur_annees avec la classe
    if (classe) {
      await createUtilisateurAnnees(
        newUser.id, 
        Number(ecole_id), 
        classe, 
        annee_scolaire_globale_id || null
      );
    }
    
    console.log("✅ Utilisateur créé:", newUser);
    
    res.status(201).json({
      success: true,
      user: newUser
    });
  } catch (err) {
    console.error("❌ Erreur création utilisateur:", err);
    res.status(500).json({ error: "Erreur interne", details: err.message });
  }
});

/* =========================================================
   SYNCHRONISATION UTILISATEUR POST-CONNEXION
   ✅ Utilise createUtilisateurAnnees pour la classe
========================================================= */
router.post("/sync-user", async (req, res) => {
  try {
    const { login, password, nom, prenoms, role, classe, ecole, annee_scolaire_globale_id } = req.body;

    console.log("📥 [sync-user] Requête reçue:", {
      login,
      passwordLength: password?.length,
      ecole_uuid: ecole?.uuid,
      classe,
      annee_scolaire_globale_id,
    });

    if (!login || !password || !nom || !role || !ecole) {
      return res.status(400).json({ error: "Champs requis manquants" });
    }

    const normalizedLogin = login.toLowerCase();

    // Vérifier si l'utilisateur existe déjà
    const { data: existingUser, error: userError } = await supabaseService
      .from("utilisateurs")
      .select(`
        id, 
        password_hash,
        ecoles!left(id, uuid, nom, drena, iepp, directeur)
      `)
      .eq("login", normalizedLogin)
      .maybeSingle();

    if (userError) throw userError;

    if (existingUser) {
      // Utilisateur existant → vérifier le mot de passe
      const isPasswordValid = await bcrypt.compare(password, existingUser.password_hash);
      console.log(`🔐 [sync-user] Vérification mot de passe pour ${login}: ${isPasswordValid ? "OK" : "ÉCHEC"}`);
      
      if (!isPasswordValid) {
        return res.status(401).json({ error: "Mot de passe incorrect" });
      }

      // ✅ Mettre à jour utilisateur_annees si une classe est fournie
      if (classe) {
        await createUtilisateurAnnees(
          existingUser.id,
          existingUser.ecoles?.id || existingUser.ecole_id,
          classe,
          annee_scolaire_globale_id || null
        );
      }

      // Récupérer l'utilisateur complet
      const { data: user, error: fetchError } = await supabaseService
        .from("utilisateurs")
        .select(`
          id,
          uuid,
          nom,
          prenoms,
          login,
          role,
          ecole_id,
          is_active,
          created_at,
          ecoles!left (
            id,
            uuid,
            nom,
            drena,
            iepp,
            secteur,
            directeur,
            code_ecole,
            date_creation
          ),
          utilisateur_annees!left (
            classe,
            est_active,
            annees_scolaires_globales!left (
              libelle
            )
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
        user: formatUserResponse(user),
      });
    }

    // Nouvel utilisateur → création complète
    console.log("📝 [sync-user] Création nouvel utilisateur");

    let ecoleId = null;
    let ecoleUuid = null;
    
    // Chercher ou créer l'école
    if (ecole.uuid) {
      const { data: existingEcole } = await supabaseService
        .from("ecoles")
        .select("id, uuid")
        .eq("uuid", ecole.uuid)
        .maybeSingle();

      if (existingEcole) {
        ecoleId = existingEcole.id;
        ecoleUuid = existingEcole.uuid;
      }
    }

    if (!ecoleId) {
      const finalCodeEcole = ecole.code_ecole || `ECO-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      
      const { data: newEcole, error: ecoleError } = await supabaseService
        .from("ecoles")
        .insert({
          uuid: ecole.uuid || crypto.randomUUID(),
          nom: ecole.nom,
          drena: ecole.drena,
          iepp: ecole.iepp,
          secteur: ecole.secteur || null,
          directeur: ecole.directeur || null,
          code_ecole: finalCodeEcole,
          date_creation: ecole.date_creation || new Date().toISOString().split('T')[0],
        })
        .select("id, uuid")
        .single();

      if (ecoleError) {
        console.error("❌ [sync-user] Erreur création école:", ecoleError);
        throw ecoleError;
      }
      
      ecoleId = newEcole.id;
      ecoleUuid = newEcole.uuid;
    }

    // Créer l'utilisateur
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const { data: newUser, error: createError } = await supabaseService
      .from("utilisateurs")
      .insert({
        ecole_id: ecoleId,
        ecole_uuid: ecoleUuid,
        nom,
        prenoms: prenoms || null,
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
        ecole_id,
        is_active,
        created_at
      `)
      .single();

    if (createError) {
      console.error("❌ [sync-user] Erreur création utilisateur:", createError);
      throw createError;
    }

    // ✅ Créer l'entrée dans utilisateur_annees avec la classe
    if (classe) {
      await createUtilisateurAnnees(
        newUser.id, 
        ecoleId, 
        classe, 
        annee_scolaire_globale_id || null
      );
    }

    // Récupérer l'école pour la réponse
    const { data: ecoleData } = await supabaseService
      .from("ecoles")
      .select("uuid, nom, drena, iepp, secteur, directeur, code_ecole, date_creation")
      .eq("id", ecoleId)
      .single();

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
        classe: classe || "",
        annee_scolaire: "",
        ecole_id: newUser.ecole_id || 0,
        ecole_uuid: ecoleData?.uuid || "",
        ecole_nom: ecoleData?.nom || "",
        drena: ecoleData?.drena || "",
        iepp: ecoleData?.iepp || "",
        secteur: ecoleData?.secteur || "",
        directeur: ecoleData?.directeur || "",
        code_ecole: ecoleData?.code_ecole || "",
        date_creation: ecoleData?.date_creation || "",
      },
    });
  } catch (err) {
    console.error("❌ [sync-user] Erreur:", err);
    res.status(500).json({ error: "Erreur interne" });
  }
});

export default router;