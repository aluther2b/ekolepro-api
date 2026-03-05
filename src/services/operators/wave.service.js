// src/services/operators/wave.service.js
import { PAYMENT_CONFIG } from "../../config/payments.config.js";

export async function initiateWavePayment({ phone, amount, reference, callback_url }) {
  console.log("📲 WAVE INIT", { phone, amount, reference, callback_url });

  // En production, utiliser l'API réelle WAVE
  const apiKey = PAYMENT_CONFIG.API_KEYS.WAVE;
  
  if (!apiKey) {
    console.warn("⚠️ WAVE_API_KEY non configurée, mode simulation");
    // Mode simulation pour le développement
    return {
      operator: "WAVE",
      status: "PENDING",
      reference,
      payment_url: `https://sandbox.wave.cm/pay?amount=${amount}&phone=${phone}&ref=${reference}`,
      message: "Simulation WAVE - En développement"
    };
  }

  try {
    // Implémentation réelle avec l'API MTN
    const response = await fetch('https://api.wave.cm/payments/initiate', {
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
      operator: "WAVE",
      status: data.status || "PENDING",
      reference,
      payment_url: data.paymentUrl || null,
      message: data.message || "Paiement WAVE initialisé"
    };
  } catch (error) {
    console.error("❌ Erreur API WAVE:", error);
    throw new Error("Erreur lors de l'initialisation du paiement WAVE");
  }
}
