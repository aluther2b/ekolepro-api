// src/services/admin/devices.service.js
import { supabaseService } from "../../config/supabase.js";

export async function blockDevice(deviceId) {
  const { error } = await supabaseService
    .from("devices")
    .update({
      blocked: true,
      blocked_at: new Date().toISOString(),
    })
    .eq("id", deviceId);

  if (error) {
    throw new Error("BLOCK_DEVICE_FAILED");
  }
}

export async function unblockDevice(deviceId) {
  const { error } = await supabaseService
    .from("devices")
    .update({
      blocked: false,
      blocked_at: null,
    })
    .eq("id", deviceId);

  if (error) {
    throw new Error("UNBLOCK_DEVICE_FAILED");
  }
}
