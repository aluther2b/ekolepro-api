// src/services/filters.service.js
import { supabaseService } from "../config/supabase.js";

export async function getFilters(user) {
  try {
    // Base queries
    let drenasQuery = supabaseService
      .from("ecoles")
      .select("drena_id, drena_nom")
      .not("drena_id", "is", null);
    
    let ieppsQuery = supabaseService
      .from("ecoles")
      .select("iepp_id, iepp_nom, drena_id")
      .not("iepp_id", "is", null);

    // Appliquer le scope en fonction du rôle
    if (user.role === "drena") {
      drenasQuery = drenasQuery.eq("drena_id", user.drena_id);
      ieppsQuery = ieppsQuery.eq("drena_id", user.drena_id);
    } else if (user.role === "iepp") {
      drenasQuery = drenasQuery.eq("drena_id", user.drena_id);
      ieppsQuery = ieppsQuery.eq("iepp_id", user.iepp_id);
    }

    const [drenasResult, ieppsResult] = await Promise.all([
      drenasQuery,
      ieppsQuery
    ]);

    // Transformer les résultats
    const drenas = [...new Map(
      drenasResult.data?.map(item => [item.drena_id, {
        id: item.drena_id,
        nom: item.drena_nom
      }]) || []
    ).values()];
    
    const iepps = [...new Map(
      ieppsResult.data?.map(item => [item.iepp_id, {
        id: item.iepp_id,
        nom: item.iepp_nom,
        drena_id: item.drena_id
      }]) || []
    ).values()];

    return { drenas, iepps };
  } catch (error) {
    console.error("❌ Erreur getFilters:", error);
    throw error;
  }
}
