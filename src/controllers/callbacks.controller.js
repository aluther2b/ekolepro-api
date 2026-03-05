// src/ controllers/callbacks.controller.js
import { handlePaydunyaCallback } from "../services/paydunya.callbacks.service.js";

/**
 * Callback PayDunya – reçoit la notification de paiement
 * PayDunya envoie un POST avec les données de la transaction
 */
export async function paydunyaCallback(req, res) {
  console.log("📩 [PayDunya] Callback reçu, body:", JSON.stringify(req.body, null, 2));

  try {
    // Vérifier que le body n'est pas vide
    if (!req.body || Object.keys(req.body).length === 0) {
      console.error("❌ [PayDunya] Body vide");
      return res.status(400).json({ message: "Body vide" });
    }

    // Traiter le callback
    await handlePaydunyaCallback(req.body);

    // Répondre immédiatement à PayDunya pour accuser réception
    res.json({ received: true });
  } catch (err) {
    console.error("❌ [PayDunya] Erreur lors du traitement du callback:", err);
    res.status(500).json({ message: "Erreur interne", error: err.message });
  }
}
