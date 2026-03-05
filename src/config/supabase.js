// src/config/supabase.js
import dotenv from "dotenv";
dotenv.config();

import { createClient } from "@supabase/supabase-js";

if (!process.env.SUPABASE_URL) {
  console.error("❌ SUPABASE_URL =", process.env.SUPABASE_URL);
  throw new Error("SUPABASE_URL manquant dans .env");
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY =", process.env.SUPABASE_SERVICE_ROLE_KEY);
  throw new Error("SUPABASE_SERVICE_ROLE_KEY manquant dans .env");
}

export const supabaseService = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
  }
);

console.log("✅ Supabase connecté");
