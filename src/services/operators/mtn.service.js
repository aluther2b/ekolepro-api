// src/services/operators/mtn.service.js
import { PAYMENT_CONFIG } from "../../config/payments.config.js";

export async function initiateMtnPayment({ phone, amount, reference, callback_url }) {
  console.log("📲 MTN INIT", { phone, amount, reference, callback_url });

  // En production, utiliser l'API réelle MTN
  const apiKey = PAYMENT_CONFIG.API_KEYS.MTN;
  
  if (!apiKey) {
    console.warn("⚠️ MTN_API_KEY non configurée, mode simulation");
    // Mode simulation pour le développement
    return {
      operator: "MTN",
      status: "PENDING",
      reference,
      payment_url: `https://sandbox.mtn.cm/pay?amount=${amount}&phone=${phone}&ref=${reference}`,
      message: "Simulation MTN - En développement"
    };
  }

  try {
    // Implémentation réelle avec l'API MTN
    const response = await fetch('https://api.mtn.cm/payments/initiate', {
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
      operator: "MTN",
      status: data.status || "PENDING",
      reference,
      payment_url: data.paymentUrl || null,
      message: data.message || "Paiement MTN initialisé"
    };
  } catch (error) {
    console.error("❌ Erreur API MTN:", error);
    throw new Error("Erreur lors de l'initialisation du paiement MTN");
  }
}
