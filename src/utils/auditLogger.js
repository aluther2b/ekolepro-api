// src/utils/auditLogger.js
import { supabaseService } from "../config/supabase.js";

export async function logAdminAction({
  action,
  entityType,
  entityId,
  details = {},
}) {
  try {
    const { error } = await supabaseService
      .from("audit_logs")
      .insert([
        {
          action,
          entity_type: entityType,
          entity_id: String(entityId),
          metadata: details, // 🔥 FIX ICI
        },
      ]);

    if (error) {
      console.error("❌ Audit log error:", error);
    }
  } catch (err) {
    console.error("❌ Audit log exception:", err);
  }
}