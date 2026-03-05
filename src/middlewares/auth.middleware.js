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
      return res.status(401).json({
        success: false,
        message: "Token manquant",
      });
    }

    const token = authHeader.split(" ")[1];

    // 2️⃣ Vérification du JWT custom
    let payload;

    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Token expiré",
        });
      }

      return res.status(401).json({
        success: false,
        message: "Token invalide",
      });
    }

    // 3️⃣ Vérifier que le payload contient un ID
    if (!payload || !payload.id) {
      return res.status(401).json({
        success: false,
        message: "Payload invalide",
      });
    }

    // 4️⃣ Charger utilisateur depuis Supabase (table utilisateurs)
    const { data: userRow, error } = await supabaseService
      .from("utilisateurs")
      .select("*")
      .eq("id", payload.id)
      .single();

    if (error || !userRow) {
      return res.status(404).json({
        success: false,
        message: "Utilisateur introuvable",
      });
    }

    // 5️⃣ Vérifier que le compte est actif
    if (!userRow.is_active) {
      return res.status(403).json({
        success: false,
        message: "Compte désactivé",
      });
    }

    // 6️⃣ Injecter données utilisateur dans req
    req.user = userRow;
    req.ecoleId = userRow.ecole_id;
    req.userRole = userRow.role;

    next();
  } catch (err) {
    console.error("❌ Auth middleware error:", err);

    return res.status(500).json({
      success: false,
      message: "Erreur interne d'authentification",
    });
  }
}