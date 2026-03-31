// src/routes/sync.js
import express from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { applySyncItem } from "../services/syncService.js";
import { supabaseService } from "../config/supabase.js";

const router = express.Router();

router.post("/push", requireAuth, async (req, res) => {
  const startedAt = new Date().toISOString();
  const deviceId = req.headers["x-device-id"] || null;

  console.log("===================================");
  console.log("📥 [SYNC PUSH]");
  console.log("🕒", startedAt);
  console.log("🏫 École:", req.ecoleId);
  console.log("📱 Device:", deviceId);

  if (!req.ecoleId) {
    return res.status(401).json({
      success: false,
      message: "École non identifiée",
    });
  }

  const { data } = req.body;

  if (!Array.isArray(data)) {
    return res.status(400).json({
      success: false,
      message: "Payload invalide",
    });
  }

  const results = [];

  const tablesWithEcoleId = [
    "eleves",
    "utilisateurs",
    "notes",
    "presences",
    "licences",
  ];

  for (const item of data) {
    const logBase = {
      ecole_id: req.ecoleId,
      device_id: deviceId,
      table_name: item?.table_name ?? null,
      action: item?.action ?? null,
      statut: "success",
      message: null,
    };

    console.log(`\n🔄 Item #${item?.queue_id} (${item?.table_name})`);

    try {
      /* ================= VALIDATION ================= */

      if (
        !item ||
        typeof item.queue_id !== "number" ||
        !item.table_name ||
        !item.action
      ) {
        throw new Error("Item invalide");
      }

      if (!item.payload) {
        throw new Error("Payload manquant");
      }

      const table = item.table_name.trim().toLowerCase();
      const payload = { ...item.payload };

      /* ================= SÉCURITÉ ECOLE ================= */

      if (payload.ecole_id && payload.ecole_id !== req.ecoleId) {
        throw new Error("Violation ecole_id");
      }

      /* ================= INJECTION ECOLE ================= */

      if (tablesWithEcoleId.includes(table)) {
        payload.ecole_id = req.ecoleId;
      }

      /* =====================================================
         🔥 TRAITEMENT SPÉCIAL UTILISATEURS (PROPRE)
      ===================================================== */
      if (table === "utilisateurs") {
        if (!payload.uuid) {
          throw new Error("uuid requis pour utilisateur");
        }

        // 🔥 whitelist stricte (sécurité maximale)
        const cleanData = {
          uuid: payload.uuid,
          nom: payload.nom,
          prenoms: payload.prenoms,
          sexe: payload.sexe,
          classe: payload.classe,
          contact: payload.contact,
          email: payload.email,
          matricule: payload.matricule,
          login: payload.login,
          fonction: payload.fonction,
          emploi: payload.emploi,
          grade: payload.grade,
          cafop: payload.cafop,
          date_naissance: payload.date_naissance,
          lieu_naissance: payload.lieu_naissance,
          date_service: payload.date_service,
          date_drena: payload.date_drena,
          date_iepp: payload.date_iepp,
          date_ecole: payload.date_ecole,
          role: payload.role,
          ecole_id: req.ecoleId,
          updated_at: new Date().toISOString(),
        };

        // 🔥 suppression des champs null/undefined
        Object.keys(cleanData).forEach((key) => {
          if (cleanData[key] === undefined || cleanData[key] === null) {
            delete cleanData[key];
          }
        });

        // 🔥 sécurité absolue
        delete cleanData.password_hash;
        delete cleanData.password_salt;
        delete cleanData.id;

        console.log("   👤 Sync utilisateur");
        console.log("   📦 Champs:", Object.keys(cleanData).join(", "));

        // 🔍 Vérifier existence
        const { data: existingUser, error: findError } =
          await supabaseService
            .from("utilisateurs")
            .select("uuid")
            .eq("uuid", payload.uuid)
            .maybeSingle();

        if (findError) throw findError;

        if (existingUser) {
          // ✅ UPDATE
          const { error } = await supabaseService
            .from("utilisateurs")
            .update(cleanData)
            .eq("uuid", payload.uuid);

          if (error) throw error;

          console.log("   ✏️ Utilisateur mis à jour");
        } else {
          // ✅ INSERT (SANS password)
          const insertData = {
            ...cleanData,
            created_at: new Date().toISOString(),
          };

          const { error } = await supabaseService
            .from("utilisateurs")
            .insert(insertData);

          if (error) throw error;

          console.log("   🆕 Utilisateur créé");
        }

        results.push({
          queue_id: item.queue_id,
          statut: "ok",
        });

        await supabaseService.from("sync_logs").insert({
          ...logBase,
          statut: "success",
        });

        continue;
      }

      /* ================= AUTRES TABLES ================= */

      await applySyncItem({
        ...item,
        payload,
      });

      results.push({
        queue_id: item.queue_id,
        statut: "ok",
      });

      await supabaseService.from("sync_logs").insert({
        ...logBase,
        statut: "success",
      });

    } catch (err) {
      console.error("   ❌", err.message);

      results.push({
        queue_id: item?.queue_id ?? null,
        statut: "error",
        message: err.message,
      });

      await supabaseService.from("sync_logs").insert({
        ...logBase,
        statut: "error",
        message: err.message,
      });
    }
  }

  console.log("\n✅ Batch terminé :", results.length);
  console.log("===================================\n");

  return res.json({
    success: true,
    processed: data.length,
    results,
    server_time: new Date().toISOString(),
  });
});

export default router;