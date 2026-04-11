// src/middlewares/auth.middleware.js
import jwt from "jsonwebtoken";
import { supabaseService } from "../config/supabase.js";

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "A0z/jLO/H2ONXrs86u+Au3aOuPfBZWBZIoVsPTkSsSk=";

export async function requireAuth(req, res, next) {
  try {
    // 1️⃣ Vérifier présence header Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("❌ [Auth] Token manquant dans headers");
      return res.status(401).json({
        success: false,
        message: "Token manquant",
      });
    }

    const token = authHeader.split(" ")[1];
    console.log("🔑 [Auth] Token reçu:", token.substring(0, 30) + "...");

    // 2️⃣ Vérification du JWT
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
      console.log("✅ [Auth] Token vérifié, payload:", {
        id: payload.id,
        login: payload.login,
        role: payload.role
      });
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        console.log("⏰ [Auth] Token expiré");
        return res.status(401).json({
          success: false,
          message: "Token expiré",
        });
      }
      console.log("❌ [Auth] Token invalide:", err.message);
      return res.status(401).json({
        success: false,
        message: "Token invalide",
      });
    }

    // 3️⃣ Vérifier que le payload contient un ID
    if (!payload || !payload.id) {
      console.log("❌ [Auth] Payload sans ID");
      return res.status(401).json({
        success: false,
        message: "Payload invalide",
      });
    }

    // 4️⃣ Charger utilisateur depuis Supabase
    console.log("🔍 [Auth] Recherche utilisateur ID:", payload.id);
    
    const { data: userRow, error } = await supabaseService
      .from("utilisateurs")
      .select("id, uuid, ecole_id, role, nom, login, is_active")
      .eq("id", payload.id)
      .single();

    if (error) {
      console.error("❌ [Auth] Erreur Supabase:", error);
      return res.status(404).json({
        success: false,
        message: "Utilisateur introuvable",
      });
    }

    if (!userRow) {
      console.log("❌ [Auth] Utilisateur non trouvé");
      return res.status(404).json({
        success: false,
        message: "Utilisateur introuvable",
      });
    }

    // 5️⃣ Vérifier que le compte est actif
    if (!userRow.is_active) {
      console.log("❌ [Auth] Compte désactivé");
      return res.status(403).json({
        success: false,
        message: "Compte désactivé",
      });
    }

    // 6️⃣ ✅ INJECTER LES DONNÉES DANS req
    req.user = userRow;
    req.userId = userRow.id;
    req.ecoleId = userRow.ecole_id;
    req.userRole = userRow.role;

    console.log("✅ [Auth] Utilisateur authentifié:", {
      id: userRow.id,
      login: userRow.login,
      ecole_id: userRow.ecole_id,
      role: userRow.role
    });

    // ⚠️ AVERTISSEMENT SI ecole_id EST NULL
    if (!userRow.ecole_id) {
      console.warn("⚠️ [Auth] ATTENTION: Utilisateur sans ecole_id !");
      console.warn(`   Login: ${userRow.login}, ID: ${userRow.id}`);
    }

    next();
  } catch (err) {
    console.error("❌ [Auth] Erreur middleware:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur interne d'authentification",
    });
  }
}