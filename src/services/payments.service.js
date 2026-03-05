// src/services/payments.service.js
import { supabaseService } from "../config/supabase.js";
import { PAYMENT_CONFIG } from "../config/payments.config.js";
import { activateLicenceForSchool } from "./licence.activation.service.js";

/* ===============================
   GÉNÉRATION RÉFÉRENCE UNIQUE
================================ */

function generateReference() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `PAY-${timestamp}-${random}`;
}

/* ===============================
   CRÉATION DU PAIEMENT
================================ */

export async function createPayment({
  ecole_id,
  amount,
  operator,
  phone,
  duration_days,
}) {
  const reference = generateReference();

  const insertData = {
    ecole_id,
    amount,
    transaction_ref: reference,
    statut: "pending",
    duration_days: duration_days ?? PAYMENT_CONFIG.DURATION_YEARLY,
    created_at: new Date().toISOString(),
  };

  if (operator) insertData.operator = operator;
  if (phone) insertData.phone = phone;

  const { data: payment, error } = await supabaseService
    .from("payments")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error("❌ Erreur création paiement:", error);
    throw new Error("Impossible de créer le paiement");
  }

  console.log("✅ Paiement créé:", payment.id, "Référence:", reference);

  return payment;
}

/* ===============================
   VALIDATION SUCCÈS
================================ */

export async function markPaymentSuccess({
  payment,
  transaction_id = null,
  source = "unknown",
}) {
  console.log("🔄 Tentative validation paiement:", payment.id);

  // Idempotence
  if (payment.statut === "success") {
    console.warn("⚠️ Paiement déjà validé:", payment.id);
    return payment;
  }

  const { error: updateError } = await supabaseService
    .from("payments")
    .update({
      statut: "success",
      transaction_id,
      validated_at: new Date().toISOString(),
      validated_from: source,
    })
    .eq("id", payment.id);

  if (updateError) {
    console.error("❌ Erreur markPaymentSuccess:", updateError);
    throw updateError;
  }

  console.log("✅ Paiement marqué SUCCESS:", payment.id);

  // 🔥 Activation licence (IMPORTANT)
  try {
    const licence = await activateLicenceForSchool({
      ecole_id: payment.ecole_id,
      duration_days:
        payment.duration_days ?? PAYMENT_CONFIG.DURATION_YEARLY,
      payment_id: payment.id,
    });

    console.log("🎉 Licence activée:", licence?.id);
  } catch (licenceError) {
    console.error("❌ Activation licence échouée:", licenceError);
    throw licenceError; // important → ne plus masquer l'erreur
  }

  return payment;
}

/* ===============================
   VALIDATION ÉCHEC
================================ */

export async function markPaymentFailed(payment) {
  if (payment.statut !== "pending") return payment;

  const { error } = await supabaseService
    .from("payments")
    .update({
      statut: "failed",
      validated_at: new Date().toISOString(),
    })
    .eq("id", payment.id);

  if (error) {
    console.error("❌ Erreur markPaymentFailed:", error);
    throw error;
  }

  console.log("❌ Paiement marqué FAILED:", payment.id);

  return payment;
}

/* ===============================
   GETTERS
================================ */

export async function getPaymentById(payment_id) {
  const { data, error } = await supabaseService
    .from("payments")
    .select("*")
    .eq("id", payment_id)
    .single();

  if (error) throw error;
  return data;
}

export async function getPaymentByReference(reference) {
  const { data, error } = await supabaseService
    .from("payments")
    .select("*")
    .eq("transaction_ref", reference)
    .single();

  if (error) throw error;
  return data;
}