// src/services/licence.service.js
import { supabaseService } from "../config/supabase.js";

export async function getLicenceByEcole(ecole_id) {
  try {
    // ✅ Utiliser maybeSingle() au lieu de single() pour éviter l'erreur PGRST116
    const { data, error } = await supabaseService
      .from("licences")
      .select("*")
      .eq("ecole_id", ecole_id)
      .eq("statut", "active")  // ✅ Filtrer directement sur active
      .maybeSingle();

    if (error) {
      console.error("❌ Erreur getLicenceByEcole:", error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error("❌ Exception getLicenceByEcole:", err);
    return { data: null, error: err };
  }
}

export function isLicenceValid(licence) {
  if (!licence) return false;

  if (licence.statut !== "active") {
    return false;
  }

  if (licence.date_fin) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const fin = new Date(licence.date_fin);
    fin.setHours(0, 0, 0, 0);

    if (fin < today) {
      return false;
    }
  }

  return true;
}

export async function updateLicenceDevicesCount(ecole_id) {
  try {
    // ✅ CORRECTION : utiliser 'statut' = 'autorise'
    const { count, error: countError } = await supabaseService
      .from("devices")
      .select("*", { count: "exact", head: true })
      .eq("ecole_id", ecole_id)
      .eq("statut", "autorise");

    if (countError) {
      console.error("❌ Erreur comptage devices:", countError);
      return false;
    }

    const { error } = await supabaseService
      .from("licences")
      .update({ 
        current_devices: count || 0,
        updated_at: new Date().toISOString()
      })
      .eq("ecole_id", ecole_id)
      .eq("statut", "active");

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