// src/services/paydunya.callbacks.service.js
import { supabaseService } from "../config/supabase.js";
import { markPaymentSuccess, markPaymentFailed } from "./payments.service.js";

/**
 * Gère le callback de PayDunya
 */
export async function handlePaydunyaCallback(body) {
  console.log("📩 [PayDunya] Callback reçu:");
  console.log(JSON.stringify(body, null, 2));

  /* ===============================
     EXTRACTION CORRECTE FORMAT PAYDUNYA
  ================================ */

  const reference =
    body?.data?.custom_data?.transaction_ref ||   // ✅ FORMAT PAYDUNYA RÉEL
    body?.custom_data?.transaction_ref ||
    body?.invoice?.custom_data?.transaction_ref ||
    body?.invoice?.reference ||
    body?.data?.reference ||
    body?.reference ||
    null;

  const status =
    body?.data?.status ||
    body?.invoice?.status ||
    body?.status ||
    null;

  const transaction_id =
    body?.data?.invoice?.token ||        // Token PayDunya
    body?.data?.transaction_id ||
    body?.invoice?.transaction_id ||
    body?.transaction_id ||
    null;

  if (!reference) {
    console.error("❌ Référence introuvable dans callback");
    throw new Error("Référence manquante PayDunya");
  }

  console.log("🔎 Référence détectée:", reference);
  console.log("🔎 Status détecté:", status);

  /* ===============================
     RECHERCHE PAIEMENT EN BASE
  ================================ */

  const { data: payment, error } = await supabaseService
    .from("payments")
    .select("*")
    .eq("transaction_ref", reference)
    .single();

  if (error || !payment) {
    console.error("❌ Paiement introuvable:", reference, error);
    throw new Error("Paiement introuvable");
  }

  console.log("✅ Paiement trouvé:", payment.id);

  // Sécurité anti double traitement (idempotence)
  if (payment.statut !== "pending") {
    console.warn("⚠️ Paiement déjà traité:", payment.statut);
    return true;
  }

  /* ===============================
     TRAITEMENT SELON STATUT
  ================================ */

  const statusLower = (status || "").toLowerCase();

  if (statusLower === "success" || statusLower === "completed") {
    console.log("🎉 Paiement confirmé par PayDunya");

    await markPaymentSuccess({
      payment,
      transaction_id,
      source: "paydunya_callback",
    });

  } else if (statusLower === "failed" || statusLower === "cancelled") {
    console.log("❌ Paiement échoué");

    await markPaymentFailed(payment);

  } else {
    console.warn("⚠️ Statut inconnu reçu:", status);
  }

  return true;
}