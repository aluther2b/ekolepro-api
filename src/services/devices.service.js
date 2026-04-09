// src/services/devices.service.js 
import { supabaseService } from "../config/supabase.js";

/* =====================================================
   RÉCUPÉRER DEVICE
===================================================== */
export async function getDevice(device_id) {
  try {
    const { data, error } = await supabaseService
      .from("devices")
      .select("*")
      .eq("device_id", device_id)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("❌ Erreur getDevice:", error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error("❌ Exception getDevice:", err);
    return { data: null, error: err };
  }
}

/* =====================================================
   COMPTER DEVICES ACTIFS (AUTORISÉS)
===================================================== */
export async function countDevices(ecole_id) {
  try {
    // ✅ CORRECTION : utiliser 'statut' = 'autorise' (pas 'blocked')
    const { count, error } = await supabaseService
      .from("devices")
      .select("*", { count: "exact", head: true })
      .eq("ecole_id", ecole_id)
      .eq("statut", "autorise");  // ✅ CORRIGÉ

    if (error) {
      console.error("❌ Erreur countDevices:", error);
      return { count: 0, error };
    }

    return { count: count || 0, error: null };
  } catch (err) {
    console.error("❌ Exception countDevices:", err);
    return { count: 0, error: err };
  }
}

/* =====================================================
   ENREGISTRER DEVICE
===================================================== */
export async function registerDevice(ecole_id, utilisateur_id, device_id) {
  try {
    // Vérifier si le device existe déjà
    const { data: existingDevice } = await getDevice(device_id);

    if (existingDevice) {
      console.log("📱 Device déjà existant, mise à jour last_seen");
      await touchDevice(device_id);
      return { data: existingDevice, error: null };
    }

    // Compter les devices existants
    const { count } = await countDevices(ecole_id);

    // Récupérer la limite de devices
    const { data: licence } = await supabaseService
      .from("licences")
      .select("max_devices")
      .eq("ecole_id", ecole_id)
      .eq("statut", "active")
      .maybeSingle();

    const maxDevices = licence?.max_devices || 10;

    console.log(`📊 Devices: ${count}/${maxDevices}`);

    if (count >= maxDevices) {
      console.warn("⚠️ Limite de devices atteinte");
      return { data: null, error: "device_limit_reached" };
    }

    // ✅ CORRECTION : utiliser 'statut' = 'autorise' (pas 'blocked')
    const { data, error } = await supabaseService
      .from("devices")
      .insert({
        ecole_id,
        utilisateur_id,
        device_id,
        statut: "autorise",  // ✅ CORRIGÉ
        registered_at: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("❌ Erreur registerDevice:", error);
      return { data: null, error: "registration_failed" };
    }

    // Mettre à jour le compteur dans la licence
    await supabaseService
      .from("licences")
      .update({ 
        current_devices: count + 1,
        updated_at: new Date().toISOString()
      })
      .eq("ecole_id", ecole_id)
      .eq("statut", "active");

    console.log("✅ Device enregistré:", device_id);
    return { data, error: null };
    
  } catch (err) {
    console.error("❌ Exception registerDevice:", err);
    return { data: null, error: err };
  }
}

/* =====================================================
   TOUCH DEVICE (mise à jour last_seen)
===================================================== */
export async function touchDevice(device_id) {
  try {
    const { error } = await supabaseService
      .from("devices")
      .update({
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("device_id", device_id);

    if (error) {
      console.error("❌ Erreur touchDevice:", error);
    }

    return { error };
  } catch (err) {
    console.error("❌ Exception touchDevice:", err);
    return { error: err };
  }
}