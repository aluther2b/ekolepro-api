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

  // 🔥 TRAITEMENT SPÉCIAL POUR LES NOTES - ASSURER QUE MGA EST PRÉSENT
  if (table === "notes") {
    console.log("   📝 Traitement spécial notes");
    
    // Si c'est un enregistrement MGA
    if (payload.compo === 'MGA' && payload.matiere === 'MGA') {
      console.log("   🎯 Enregistrement MGA détecté");
      
      // S'assurer que MGA est défini
      if (payload.MGA === undefined || payload.MGA === null || payload.MGA === 0) {
        // Essayer de récupérer la valeur depuis note, total ou moyenne
        payload.MGA = Number(payload.note || payload.total || payload.moyenne || 0);
        console.log(`   🔧 MGA corrigé à partir de note: ${payload.MGA}`);
      }
      
      // S'assurer que les champs sont cohérents
      payload.note = payload.MGA;
      payload.total = payload.MGA;
      payload.moyenne = payload.MGA;
      payload.coefficient = 1;
      
      console.log("   📊 Valeurs MGA finales:", {
        MGA: payload.MGA,
        note: payload.note,
        total: payload.total,
        moyenne: payload.moyenne
      });
    }
    
    // S'assurer que tous les champs numériques sont bien des nombres
    if (payload.note !== undefined && payload.note !== null) payload.note = Number(payload.note);
    if (payload.total !== undefined && payload.total !== null) payload.total = Number(payload.total);
    if (payload.moyenne !== undefined && payload.moyenne !== null) payload.moyenne = Number(payload.moyenne);
    if (payload.coefficient !== undefined && payload.coefficient !== null) payload.coefficient = Number(payload.coefficient);
    if (payload.MGA !== undefined && payload.MGA !== null) payload.MGA = Number(payload.MGA);
    if (payload.rang !== undefined && payload.rang !== null) payload.rang = Number(payload.rang);
    
    // S'assurer que absent est un boolean
    if (payload.absent !== undefined) {
      payload.absent = payload.absent === true || payload.absent === 1 || payload.absent === 'true';
    }
    
    console.log("   📤 Payload final pour Supabase:", JSON.stringify({
      uuid: payload.uuid,
      compo: payload.compo,
      matiere: payload.matiere,
      MGA: payload.MGA,
      note: payload.note,
      total: payload.total,
      moyenne: payload.moyenne
    }));
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
      console.log("   ✏️ UPDATE");
      
      // Pour les notes, log détaillé
      if (table === "notes") {
        console.log("   📊 Données UPDATE:", {
          MGA: payload.MGA,
          note: payload.note,
          total: payload.total,
          moyenne: payload.moyenne
        });
      }

      const { error, data: updateResult } = await supabaseService
        .from(table)
        .update(payload)
        .eq("uuid", payload.uuid)
        .select();

      if (error) {
        console.error(`❌ Erreur update sur ${table}:`, error);
        throw new Error(error.message);
      }

      console.log(`   ✅ update réussi sur ${table}`);
      
      // Vérifier que les données ont bien été enregistrées
      if (table === "notes" && updateResult && updateResult.length > 0) {
        console.log("   🔍 Vérification après UPDATE:", {
          MGA: updateResult[0].MGA,
          note: updateResult[0].note,
          total: updateResult[0].total,
          moyenne: updateResult[0].moyenne
        });
      }
      
      return true;
    }

    /* ================= INSERT ================= */
    console.log("   🆕 INSERT");

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

    // Pour les notes, log détaillé avant insertion
    if (table === "notes") {
      console.log("   📊 Données INSERT:", {
        MGA: payload.MGA,
        note: payload.note,
        total: payload.total,
        moyenne: payload.moyenne
      });
    }

    const { error, data: insertResult } = await supabaseService
      .from(table)
      .insert(payload)
      .select();

    if (error) {
      console.error(`❌ Erreur insert sur ${table}:`, error);
      throw new Error(error.message);
    }

    console.log(`   ✅ insert réussi sur ${table}`);
    
    // Vérifier que les données ont bien été enregistrées
    if (table === "notes" && insertResult && insertResult.length > 0) {
      console.log("   🔍 Vérification après INSERT:", {
        MGA: insertResult[0].MGA,
        note: insertResult[0].note,
        total: insertResult[0].total,
        moyenne: insertResult[0].moyenne
      });
    }
    
    return true;

  } catch (err) {
    throw err;
  }
}