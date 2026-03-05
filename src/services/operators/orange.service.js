// src/services/operators/orange.service.js
import { PAYMENT_CONFIG } from "../../config/payments.config.js";

export async function initiateOrangePayment({ phone, amount, reference, callback_url }) {
  console.log("📲 ORANGE INIT", { phone, amount, reference, callback_url });

  // En production, utiliser l'API réelle ORANGE
  const apiKey = PAYMENT_CONFIG.API_KEYS.ORANGE;
  
  if (!apiKey) {
    console.warn("⚠️ ORANGE_API_KEY non configurée, mode simulation");
    // Mode simulation pour le développement
    return {
      operator: "ORANGE",
      status: "PENDING",
      reference,
      payment_url: `https://sandbox.orange.ci/pay?amount=${amount}&phone=${phone}&ref=${reference}`,
      message: "Simulation ORANGE - En développement"
    };
  }

  try {
    // Implémentation réelle avec l'API ORANGE
    const response = await fetch('https://api.orange.ci/payments/initiate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
        phone,
        externalId: reference,
        callbackUrl: callback_url
      })
    });

    const data = await response.json();
    
    return {
      operator: "ORANGE",
      status: data.status || "PENDING",
      reference,
      payment_url: data.paymentUrl || null,
      message: data.message || "Paiement MTN initialisé"
    };
  } catch (error) {
    console.error("❌ Erreur API ORANGE:", error);
    throw new Error("Erreur lors de l'initialisation du paiement ORANGE");
  }
}
