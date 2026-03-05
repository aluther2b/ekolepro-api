//src/services/auditService.js
import { supabaseService } from "../config/supabase.js";

export async function logAudit({
  action,
  entityType,
  entityId = null,
  user,
  metadata = {},
  req = null,
}) {
  const payload = {
    action,
    entity_type: entityType,
    entity_id: entityId,

    user_id: user?.id ?? null,
    user_role: user?.role ?? null,

    metadata,

    ip_address: req?.ip ?? null,
    user_agent: req?.headers["user-agent"] ?? null,
  };

  const { error } = await supabaseService
    .from("audit_logs")
    .insert(payload);

  if (error) {
    console.error("❌ Audit error:", error.message);
  }
}
