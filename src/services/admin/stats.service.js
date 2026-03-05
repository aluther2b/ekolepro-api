// src/services/admin/stats.service.js
import { supabaseService } from "../../config/supabase.js";

/* ======================================================
GET ADMIN STATS
====================================================== */

export async function getAdminStats() {
  try {

    /* =============================
       TOTAL ECOLES
    ============================== */

    const { count: totalSchools } = await supabaseService
      .from("ecoles")
      .select("*", { count: "exact", head: true });


    /* =============================
       LICENCES ACTIVES
    ============================== */

    const { count: activeLicenses } = await supabaseService
      .from("licences")
      .select("*", { count: "exact", head: true })
      .eq("statut", "active");


    /* =============================
       LICENCES EXPIREES
    ============================== */

    const { count: expiredLicenses } = await supabaseService
      .from("licences")
      .select("*", { count: "exact", head: true })
      .eq("statut", "expire");


    /* =============================
       LICENCES EXPIRANT BIENTOT
    ============================== */

    const in7days = new Date();
    in7days.setDate(in7days.getDate() + 7);

    const { count: expiringSoon } = await supabaseService
      .from("licences")
      .select("*", { count: "exact", head: true })
      .lte("date_expiration", in7days.toISOString());


    /* =============================
       ECOLES INACTIVES
    ============================== */

    const { count: inactiveSchools } = await supabaseService
      .from("ecoles")
      .select("*", { count: "exact", head: true })
      .eq("statut", "inactive");


    /* =============================
       REVENUS DU MOIS
    ============================== */

    const startMonth = new Date();
    startMonth.setDate(1);

    const { data: payments } = await supabaseService
      .from("paiements")
      .select("montant")
      .gte("date_paiement", startMonth.toISOString());

    let monthlyPayments = 0;

    if (payments) {
      monthlyPayments = payments.reduce(
        (sum, p) => sum + Number(p.montant || 0),
        0
      );
    }


    /* =============================
       ACTIVITE RECENTE
    ============================== */

    const { data: recentActivity } = await supabaseService
      .from("audit_logs")
      .select("action,created_at,entity_type")
      .order("created_at", { ascending: false })
      .limit(5);


    const activity = (recentActivity || []).map((a) => ({
      type: a.entity_type,
      message: a.action,
      date: a.created_at,
    }));


    /* =============================
       CHART REVENUS
    ============================== */

    const { data: chartData } = await supabaseService
      .from("paiements")
      .select("montant,date_paiement")
      .order("date_paiement", { ascending: false })
      .limit(30);

    const chart = (chartData || []).map((p) =>
      Number(p.montant || 0)
    );


    return {
      success: true,

      total: totalSchools || 0,

      active: activeLicenses || 0,

      expired: expiredLicenses || 0,

      monthlyPayments,

      expiringSoon: expiringSoon || 0,

      inactiveSchools: inactiveSchools || 0,

      recentActivity: activity,

      chart,
    };

  } catch (error) {
    console.error("Admin stats error:", error);
    throw error;
  }
}