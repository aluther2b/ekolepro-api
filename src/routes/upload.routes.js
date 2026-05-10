// src/routes/upload.routes.js
import express from "express";
import multer from "multer";
import { supabaseService } from "../config/supabase.js";
import jwt from "jsonwebtoken";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "A0z/jLO/H2ONXrs86u+Au3aOuPfBZWBZIoVsPTkSsSk=";

// Configurer multer pour stocker temporairement le fichier en mémoire
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Type de fichier non autorisé. Utilisez JPG, PNG ou WebP."), false);
    }
  },
});

// Middleware pour vérifier le token JWT
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token requis" });
  }
  
  const token = authHeader.split(" ")[1];
  const payload = verifyToken(token);
  
  if (!payload) {
    return res.status(401).json({ error: "Token invalide" });
  }
  
  req.user = payload;
  next();
}

/**
 * POST /api/upload/photo
 * Upload une photo vers Supabase Storage
 */
router.post("/photo", authMiddleware, upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    const eleveId = req.body.eleve_id;

    console.log("📸 Upload photo reçu:", {
      fileName: file?.originalname,
      fileSize: file?.size,
      fileType: file?.mimetype,
      eleveId: eleveId,
      userId: req.user.id,
    });

    if (!file) {
      return res.status(400).json({ error: "Aucun fichier fourni" });
    }

    // Générer un nom de fichier unique
    const timestamp = Date.now();
    const extension = file.originalname.split('.').pop();
    const fileName = eleveId 
      ? `eleve-${eleveId}-${timestamp}.${extension}`
      : `photo-${timestamp}.${extension}`;

    console.log("📤 Upload vers Supabase Storage:", fileName);

    // Upload vers Supabase Storage (le fichier est dans file.buffer)
    const { data: uploadData, error: uploadError } = await supabaseService
      .storage
      .from("eleves-photos")
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      console.error("❌ Erreur upload Supabase:", uploadError);
      return res.status(500).json({ error: uploadError.message || "Erreur lors de l'upload" });
    }

    // Récupérer l'URL publique
    const { data: { publicUrl } } = supabaseService
      .storage
      .from("eleves-photos")
      .getPublicUrl(fileName);

    console.log("✅ URL publique générée:", publicUrl);

    // Mettre à jour le champ photo_uri dans la table eleves si eleveId est fourni
    if (eleveId) {
      const { error: updateError } = await supabaseService
        .from("eleves")
        .update({ photo_uri: publicUrl })
        .eq("id", parseInt(eleveId));

      if (updateError) {
        console.error("❌ Erreur mise à jour élève:", updateError);
      } else {
        console.log("✅ photo_uri mis à jour pour l'élève", eleveId);
      }
    }

    res.json({
      success: true,
      url: publicUrl,
      message: "Photo uploadée avec succès",
    });

  } catch (error) {
    console.error("❌ Erreur upload:", error);
    res.status(500).json({ error: error.message || "Erreur lors de l'upload" });
  }
});

export default router;