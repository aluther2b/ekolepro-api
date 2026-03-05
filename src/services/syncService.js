// backend/src/services/syncService.js

import { supabaseService } from "../config/supabase.js";

export async function applySyncItem(item) {
  if (!item) {
    throw new Error("Item sync manquant");
  }

  const { table_name, action, payload } = item;

  if (!table_name || typeof table_name !== "string") {
    throw new Error("Table invalide");
  }

  if (!payload || !payload.uuid) {
    throw new Error("Payload invalide : uuid requis");
  }

  if (!["upsert", "delete"].includes(action)) {
    throw new Error(`Action inconnue: ${action}`);
  }

  // 🔥 Supprimer id local SQLite
  delete payload.id;

  // 🔥 NORMALISATION IMPORTANTE
  // Convertir "" en null (évite erreur type date)
  Object.keys(payload).forEach((key) => {
    if (payload[key] === "") {
      payload[key] = null;
    }
  });

  const now = new Date().toISOString();
  payload.updated_at = now;
  payload.created_at ??= now;

  /* ================================
     UPSERT
  ================================= */
  if (action === "upsert") {
    const { error } = await supabaseService
      .from(table_name)
      .upsert(payload, { onConflict: "uuid" });

    if (error) {
      throw new Error(error.message);
    }
  }

  /* ================================
     DELETE
  ================================= */
  if (action === "delete") {
    const { error } = await supabaseService
      .from(table_name)
      .delete()
      .eq("uuid", payload.uuid);

    if (error) {
      throw new Error(error.message);
    }
  }

  return true;
}