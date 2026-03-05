//src/controllers/admin/devices.controller.js
import {
  blockDevice,
  unblockDevice,
} from "../../services/admin/devices.admin.service.js";
import { supabaseService } from "../../config/supabase.js";
import { logAudit } from "../../services/auditService.js";

export async function blockDeviceController(req, res) {
  try {
    const { id } = req.params;

    await blockDevice(id);

    const { data: device, error } = await supabaseService
      .from("devices")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;

    await logAudit({
      action: "BLOCK_DEVICE",
      entityType: "device",
      entityId: id,
      user: req.authUser,
      req,
    });

    res.json({ success: true, device });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "unable_to_block_device" });
  }
}

export async function unblockDeviceController(req, res) {
  try {
    const { id } = req.params;

    await unblockDevice(id);

    const { data: device, error } = await supabaseService
      .from("devices")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;

    await logAudit({
      action: "UNBLOCK_DEVICE",
      entityType: "device",
      entityId: id,
      user: req.authUser,
      req,
    });

    res.json({ success: true, device });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "unable_to_unblock_device" });
  }
}

