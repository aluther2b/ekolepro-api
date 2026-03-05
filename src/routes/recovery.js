// src/routes/recovery.js
import express from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { supabaseService } from "../config/supabase.js";

const router = express.Router();

router.get("/full", requireAuth, async (req, res) => {
  const authUserId = req.authUser.id;

  const { data: userRow } = await supabaseService
    .from("utilisateurs")
    .select("ecole_id")
    .eq("auth_user_id", authUserId)
    .single();

  if (!userRow?.ecole_id) {
    return res.status(400).json({ error: "École non trouvée" });
  }

  const ecoleId = userRow.ecole_id;

  const tables = [
    "ecoles",
    "utilisateurs",
    "eleves",
    "notes",
    "presences",
    "coeffs",
    "licences",
  ];

  const results = {};

  for (const table of tables) {
    const { data } = await supabaseService
      .from(table)
      .select("*")
      .eq("ecole_id", ecoleId);

    results[table] = data ?? [];
  }

  return res.json(results);
});

export default router;
