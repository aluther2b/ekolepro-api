// src/routes/admin/index.routes.js
import express from "express";
import { supabaseService } from "../../config/supabase.js";

const router = express.Router();

// Dashboard stats
router.get("/", async (req, res) => {
  try {
    const [
      { count: totalSchools },
      { count: activeLicences },
      { count: expiredLicences },
      { data: monthlyPayments }
    ] = await Promise.all([
      supabaseService.from("ecoles").select("*", { count: "exact", head: true }),
      supabaseService.from("licences").select("*", { count: "exact", head: true })
        .eq("statut", "active"),
      supabaseService.from("licences").select("*", { count: "exact", head: true })
        .neq("statut", "active"),
      supabaseService.from("payments").select("mount")
        .gte("created_at", new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString())
    ]);

    const monthlyTotal = monthlyPayments?.reduce((sum, p) => sum + (p.montant || 0), 0) || 0;

    res.json({
      success: true,
      total: totalSchools || 0,
      active: activeLicences || 0,
      expired: expiredLicences || 0,
      monthlyPayments: monthlyTotal
    });
  } catch (error) {
    console.error("❌ Admin stats error:", error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

export default router;
