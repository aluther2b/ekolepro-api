// backend/src/services/syncService.js
import { supabaseService } from "../config/supabase.js";

/**
 * Applique une opération de synchronisation (upsert/delete)
 */
export async function applySyncItem(item) {
  if (!item) {
    throw new Error("Item sync manquant");
  }

  const { table_name, action } = item;

  if (!table_name || typeof table_name !== "string") {
    throw new Error("Table invalide");
  }

  if (!["upsert", "delete"].includes(action)) {
    throw new Error(`Action inconnue: ${action}`);
  }

  // 🔥 Normalisation
  const table = table_name.trim().toLowerCase();
  let payload = { ...item.payload };

  if (!payload || !payload.uuid) {
    throw new Error("Payload invalide : uuid requis");
  }

  /* =====================================================
     🔥 NETTOYAGE GLOBAL
  ===================================================== */

  // ❌ Supprimer champs locaux
  delete payload.id;

  // ❌ Sécurité utilisateurs (jamais de password)
  if (table === "utilisateurs") {
    delete payload.password_hash;
    delete payload.password_salt;
  }

  // 🔄 "" → null
  Object.keys(payload).forEach((key) => {
    if (payload[key] === "") {
      payload[key] = null;
    }
  });

  const now = new Date().toISOString();
  payload.updated_at = now;

  console.log(
    `🔄 [syncService] ${action} sur ${table} (uuid: ${payload.uuid})`
  );

  if (table === "utilisateurs") {
    console.log("   📦 Champs:", Object.keys(payload).join(", "));
  }

  try {
    /* =====================================================
       DELETE
    ===================================================== */
    if (action === "delete") {
      const { error } = await supabaseService
        .from(table)
        .delete()
        .eq("uuid", payload.uuid);

      if (error) {
        console.error(`❌ Erreur delete sur ${table}:`, error);
        throw new Error(error.message);
      }

      console.log(`✅ delete réussi sur ${table}`);
      return true;
    }

    /* =====================================================
       UPSERT INTELLIGENT
    ===================================================== */

    // 🔍 Vérifier existence
    const { data: existing, error: findError } = await supabaseService
      .from(table)
      .select("uuid")
      .eq("uuid", payload.uuid)
      .maybeSingle();

    if (findError) {
      console.error("❌ Erreur recherche:", findError);
      throw new Error(findError.message);
    }

    /* ================= UPDATE ================= */
    if (existing) {
      console.log("✏️ UPDATE");

      const { error } = await supabaseService
        .from(table)
        .update(payload)
        .eq("uuid", payload.uuid);

      if (error) {
        console.error(`❌ Erreur update sur ${table}:`, error);
        throw new Error(error.message);
      }

      console.log(`✅ update réussi sur ${table}`);
      return true;
    }

    /* ================= INSERT ================= */
    console.log("🆕 INSERT");

    // 🔥 Cas utilisateurs (SANS password)
    if (table === "utilisateurs") {
      const requiredFields = ["nom", "login"];

      for (const field of requiredFields) {
        if (!payload[field]) {
          throw new Error(
            `Insertion utilisateur refusée : champ '${field}' manquant`
          );
        }
      }
    }

    payload.created_at = now;

    const { error } = await supabaseService
      .from(table)
      .insert(payload);

    if (error) {
      console.error(`❌ Erreur insert sur ${table}:`, error);
      throw new Error(error.message);
    }

    console.log(`✅ insert réussi sur ${table}`);
    return true;

  } catch (err) {
    throw err;
  }
}