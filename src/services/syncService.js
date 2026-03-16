// backend/src/services/syncService.js

import { supabaseService } from "../config/supabase.js";

/**
 * Applique une opération de synchronisation (upsert/delete) sur une table Supabase
 * @param {Object} item - élément de la file d'attente : { table_name, action, payload }
 * @returns {Promise<boolean>}
 */
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

  // Supprimer l'ID local SQLite (auto-incrémenté) pour ne pas interférer
  delete payload.id;

  // Convertir les chaînes vides en null (évite les erreurs de type sur les dates)
  Object.keys(payload).forEach((key) => {
    if (payload[key] === "") {
      payload[key] = null;
    }
  });

  // Gestion des dates de mise à jour
  const now = new Date().toISOString();
  payload.updated_at = now;
  if (!payload.created_at) {
    payload.created_at = now;
  }

  console.log(`🔄 [syncService] ${action} sur ${table_name} (uuid: ${payload.uuid})`);

  try {
    if (action === "upsert") {
      // Tentative d'upsert basé sur la colonne 'uuid'
      const { error } = await supabaseService
        .from(table_name)
        .upsert(payload, { onConflict: "uuid" });

      if (error) {
        console.error(`❌ Erreur upsert sur ${table_name}:`, error);
        throw new Error(error.message);
      }

      console.log(`✅ upsert réussi sur ${table_name} (uuid: ${payload.uuid})`);
    }

    if (action === "delete") {
      const { error } = await supabaseService
        .from(table_name)
        .delete()
        .eq("uuid", payload.uuid);

      if (error) {
        console.error(`❌ Erreur delete sur ${table_name}:`, error);
        throw new Error(error.message);
      }

      console.log(`✅ delete réussi sur ${table_name} (uuid: ${payload.uuid})`);
    }

    return true;
  } catch (err) {
    // On relance l'erreur pour qu'elle soit capturée dans sync.js
    throw err;
  }
}
