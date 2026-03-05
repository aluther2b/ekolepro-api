// src/services/licence.activation.service.js
import { supabaseService } from "../config/supabase.js";
import crypto from "crypto";

/**
 * Active ou prolonge une licence pour une école
 */
export async function activateLicenceForSchool({
  ecole_id,
  duration_days,
  payment_id = null,
}) {
  console.log("🔄 Activation licence pour école:", ecole_id);

  if (!ecole_id) {
    throw new Error("ecole_id est requis pour activer une licence");
  }

  if (!duration_days || duration_days <= 0) {
    throw new Error("duration_days invalide");
  }

  const now = new Date();

  /* ===============================
     1️⃣ Vérifier licence existante
  ================================ */

  const { data: existingLicence, error: fetchError } =
    await supabaseService
      .from("licences")
      .select("*")
      .eq("ecole_id", ecole_id)
      .eq("statut", "active")
      .maybeSingle();

  if (fetchError) {
    console.error("❌ Erreur récupération licence existante:", fetchError);
    throw fetchError;
  }

  let startDate;
  let endDate;

  if (existingLicence) {
    console.log("ℹ️ Licence active existante trouvée, prolongation...");

    const currentEnd = new Date(existingLicence.date_fin);

    // Si encore valide → on prolonge à partir de la date actuelle de fin
    if (currentEnd > now) {
      startDate = new Date(existingLicence.date_debut);
      endDate = new Date(currentEnd);
      endDate.setDate(endDate.getDate() + duration_days);
    } else {
      // Si expirée → on repart d'aujourd'hui
      startDate = now;
      endDate = new Date();
      endDate.setDate(now.getDate() + duration_days);
    }

    const { error: updateError } = await supabaseService
      .from("licences")
      .update({
        date_fin: endDate.toISOString().split("T")[0],
        payment_id: payment_id ?? existingLicence.payment_id,
      })
      .eq("id", existingLicence.id);

    if (updateError) {
      console.error("❌ Erreur prolongation licence:", updateError);
      throw updateError;
    }

    console.log(
      `✅ Licence prolongée jusqu'au ${endDate.toISOString().split("T")[0]}`
    );

    return {
      ...existingLicence,
      date_fin: endDate.toISOString().split("T")[0],
    };
  }

  /* ===============================
     2️⃣ Création nouvelle licence
  ================================ */

  console.log("🆕 Aucune licence active, création...");

  startDate = now;
  endDate = new Date();
  endDate.setDate(now.getDate() + duration_days);

  const licence_key = `LIC-${ecole_id}-${Date.now()}-${crypto
    .randomUUID()
    .slice(0, 8)}`;

  const insertData = {
    ecole_id,
    licence_key,
    statut: "active",
    date_debut: startDate.toISOString().split("T")[0],
    date_fin: endDate.toISOString().split("T")[0],
    created_at: new Date().toISOString(),
  };

  if (payment_id) {
    insertData.payment_id = payment_id;
  }

  const { data: newLicence, error: insertError } =
    await supabaseService
      .from("licences")
      .insert(insertData)
      .select()
      .single();

  if (insertError) {
    console.error("❌ Erreur création licence:", insertError);
    throw insertError;
  }

  console.log(
    `🎉 Nouvelle licence créée pour école ${ecole_id} jusqu'au ${insertData.date_fin}`
  );

  return newLicence;
}