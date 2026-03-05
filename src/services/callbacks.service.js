// src/services/callbacks.service.js
import { getPaymentByReference, markPaymentSuccess, markPaymentFailed } 
from "./payments.service.js";

/**
 * Gestion centralisée des callbacks opérateurs
 * MTN / ORANGE / WAVE
 */
export async function handlePaymentCallback(operator, payload) {
  try {
    console.log(`📩 Callback reçu de ${operator}`, payload);

    /**
     * ⚠️ IMPORTANT :
     * Chaque opérateur envoie un format différent.
     * Ici on normalise les données.
     */

    const reference =
      payload.reference ||
      payload.transaction_ref ||
      payload.order_id;

    const status =
      payload.status ||
      payload.payment_status ||
      payload.state;

    const transaction_id =
      payload.transaction_id ||
      payload.external_id ||
      null;

    if (!reference) {
      throw new Error("Reference manquante dans callback");
    }

    const payment = await getPaymentByReference(reference);

    if (!payment) {
      throw new Error("Paiement introuvable");
    }

    // 🔁 Idempotence
    if (payment.statut !== "pending") {
      console.log("⚠️ Paiement déjà traité :", payment.id);
      return;
    }

    if (
      status === "success" ||
      status === "SUCCESS" ||
      status === "completed"
    ) {
      await markPaymentSuccess({
        payment,
        transaction_id,
        source: `${operator}_callback`,
      });
    } else {
      await markPaymentFailed(payment);
    }

    console.log("✅ Callback traité avec succès");
  } catch (error) {
    console.error("❌ Erreur handlePaymentCallback:", error);
    throw error;
  }
}
