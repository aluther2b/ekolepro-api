// src/services/licence.service.js
import { supabaseService } from "../config/supabase.js";

export async function getLicenceByEcole(ecole_id) {
  const { data, error } = await supabaseService
    .from("licences")
    .select("*")
    .eq("ecole_id", ecole_id)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error("❌ Erreur getLicenceByEcole:", error);
  }

  return { data, error };
}

export function isLicenceValid(licence) {
  if (!licence) return false;

  if (licence.statut !== "active") {
    return false;
  }

  if (licence.date_fin) {
    const today = new Date();
    const fin = new Date(licence.date_fin);

    if (fin < today) {
      return false;
    }
  }

  return true;
}

export async function updateLicenceDevicesCount(ecole_id) {
  try {
    // Compter les devices actifs
    const { count } = await supabaseService
      .from("devices")
      .select("*", { count: "exact", head: true })
      .eq("ecole_id", ecole_id)
      .eq("blocked", false);

    // Mettre à jour le compteur dans la licence
    const { error } = await supabaseService
      .from("licences")
      .update({ 
        current_devices: count || 0,
        updated_at: new Date().toISOString()
      })
      .eq("ecole_id", ecole_id);

    if (error) {
      console.error("❌ Erreur updateLicenceDevicesCount:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("❌ Exception updateLicenceDevicesCount:", error);
    return false;
  }
}
