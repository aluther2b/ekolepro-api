// src/services/admin/sessions.service.js
import { supabaseService } from "../../config/supabase.js";

/* =====================================================
   GET ACTIVE SESSIONS
===================================================== */
export async function getActiveSessions() {
  try {
    const { data: sessions, error } = await supabaseService
      .from("sessions")
      .select(`
        id,
        connected_at,
        device_id,
        active,
        utilisateurs (
          id,
          nom,
          role,
          ecole_id
        )
      `)
      .eq("active", true)
      .order("connected_at", { ascending: false });

    if (error) {
      console.error("❌ Supabase getActiveSessions error:", error);
      throw error;
    }

    if (!sessions || sessions.length === 0) {
      return [];
    }

    /* ===============================
       Récupération des écoles
    =============================== */

    const ecolesIds = [
      ...new Set(
        sessions
          .map((s) => s.utilisateurs?.ecole_id)
          .filter((id) => id !== null && id !== undefined)
      ),
    ];

    let ecolesMap = {};

    if (ecolesIds.length > 0) {
      const { data: ecoles, error: ecolesError } = await supabaseService
        .from("ecoles")
        .select("id, nom")
        .in("id", ecolesIds);

      if (ecolesError) {
        console.error("❌ Supabase ecoles fetch error:", ecolesError);
      } else if (ecoles) {
        ecolesMap = ecoles.reduce((acc, ecole) => {
          acc[ecole.id] = ecole.nom;
          return acc;
        }, {});
      }
    }

    /* ===============================
       Format pour le frontend
    =============================== */

    return sessions.map((s) => ({
      id: s.id,
      user_name: s.utilisateurs?.nom ?? "Utilisateur inconnu",
      role: s.utilisateurs?.role ?? "—",
      device_id: s.device_id ?? "—",
      connected_at: s.connected_at ?? null,
      ecole: ecolesMap[s.utilisateurs?.ecole_id] ?? "—",
    }));
  } catch (error) {
    console.error("❌ getActiveSessions crash:", error);
    throw error;
  }
}

/* =====================================================
   FORCE LOGOUT SESSION
===================================================== */
export async function forceLogoutSession(sessionId) {
  try {
    if (!sessionId) {
      throw new Error("session_id_required");
    }

    /* ===============================
       Vérifier que la session existe
    =============================== */

    const { data: session, error: fetchError } = await supabaseService
      .from("sessions")
      .select("id, device_id, active")
      .eq("id", sessionId)
      .maybeSingle();

    if (fetchError) {
      console.error("❌ Fetch session error:", fetchError);
      throw fetchError;
    }

    if (!session) {
      throw new Error("session_not_found");
    }

    if (!session.active) {
      console.warn("⚠️ Session déjà inactive:", sessionId);
      return session;
    }

    /* ===============================
       Désactiver la session
    =============================== */

    const { error: updateError } = await supabaseService
      .from("sessions")
      .update({
        active: false,
        disconnected_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    if (updateError) {
      console.error("❌ Logout update error:", updateError);
      throw updateError;
    }

    return session;
  } catch (error) {
    console.error("❌ forceLogoutSession crash:", error);
    throw error;
  }
}