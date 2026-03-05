// src/services/devices.service.js
import { supabaseService } from "../config/supabase.js";

/* =====================================================
   RÉCUPÉRER DEVICE (SAFE VERSION)
===================================================== */
export async function getDevice(device_id) {
  const { data, error } = await supabaseService
    .from("devices")
    .select("*")
    .eq("device_id", device_id)
    .maybeSingle(); // 🔥 IMPORTANT

  if (error && error.code !== "PGRST116") {
    console.error("❌ Erreur getDevice:", error);
    return { data: null, error };
  }

  return { data, error: null };
}

/* =====================================================
   COMPTER DEVICES ACTIFS
===================================================== */
export async function countDevices(ecole_id) {
  const { count, error } = await supabaseService
    .from("devices")
    .select("*", { count: "exact", head: true })
    .eq("ecole_id", ecole_id)
    .eq("blocked", false);

  if (error) {
    console.error("❌ Erreur countDevices:", error);
    return { count: 0, error };
  }

  return { count: count || 0, error: null };
}

/* =====================================================
   ENREGISTRER DEVICE
===================================================== */
export async function registerDevice(ecole_id, utilisateur_id, device_id) {
  const { data: existingDevice } = await getDevice(device_id);

  if (existingDevice) {
    await touchDevice(device_id);
    return { data: existingDevice, error: null };
  }

  const { count } = await countDevices(ecole_id);

  const { data: licence } = await supabaseService
    .from("licences")
    .select("max_devices")
    .eq("ecole_id", ecole_id)
    .maybeSingle(); // 🔥 SAFE

  const maxDevices = licence?.max_devices || 10;

  if (count >= maxDevices) {
    return { error: "device_limit_reached" };
  }

  const { data, error } = await supabaseService
    .from("devices")
    .insert({
      ecole_id,
      utilisateur_id,
      device_id,
      blocked: false,
      statut: "autorise",
      last_seen: new Date().toISOString(),
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("❌ Erreur registerDevice:", error);
    return { error: "registration_failed" };
  }

  return { data, error: null };
}

/* =====================================================
   TOUCH DEVICE
===================================================== */
export async function touchDevice(device_id) {
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
}