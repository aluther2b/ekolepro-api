// src/services/paydunya.service.js

const BASE_URL = process.env.PAYDUNYA_BASE_URL || "https://app.paydunya.com/sandbox-api/v1";

function headers() {
  const masterKey = process.env.PAYDUNYA_MASTER_KEY;
  const privateKey = process.env.PAYDUNYA_PRIVATE_KEY;
  const token = process.env.PAYDUNYA_TOKEN;

  console.log("🔑 [PayDunya] Headers configurés:", {
    hasMasterKey: !!masterKey,
    hasPrivateKey: !!privateKey,
    hasToken: !!token,
    masterKey: masterKey ? masterKey.substring(0, 10) + "..." : "MANQUANT",
    privateKey: privateKey ? privateKey.substring(0, 10) + "..." : "MANQUANT",
    token: token ? token.substring(0, 10) + "..." : "MANQUANT"
  });

  return {
    "Content-Type": "application/json",
    "PAYDUNYA-MASTER-KEY": masterKey,
    "PAYDUNYA-PRIVATE-KEY": privateKey,
    "PAYDUNYA-TOKEN": token,
  };
}

export async function createPaydunyaInvoice({
  amount,
  reference,
  callback_url,
}) {
  const url = `${BASE_URL}/checkout-invoice/create`;
  
  const payload = {
    invoice: {
      total_amount: amount,
      description: "Licence annuelle EKOLEPRO",
    },
    store: {
      name: "EKOLEPRO",
    },
    actions: {
      callback_url: callback_url,
    },
    custom_data: {
      transaction_ref: reference,
    },
  };

  console.log("📤 [PayDunya] ========== REQUÊTE ==========");
  console.log("📤 URL:", url);
  console.log("📤 Headers:", {
    "Content-Type": "application/json",
    "PAYDUNYA-MASTER-KEY": process.env.PAYDUNYA_MASTER_KEY ? "***" : "MANQUANT",
    "PAYDUNYA-PRIVATE-KEY": process.env.PAYDUNYA_PRIVATE_KEY ? "***" : "MANQUANT",
    "PAYDUNYA-TOKEN": process.env.PAYDUNYA_TOKEN ? "***" : "MANQUANT",
  });
  console.log("📤 Body:", JSON.stringify(payload, null, 2));

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 secondes timeout

    const response = await fetch(url, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log("📥 [PayDunya] Statut HTTP:", response.status, response.statusText);
    
    const responseText = await response.text();
    console.log("📥 [PayDunya] Réponse brute:", responseText);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("❌ [PayDunya] Réponse non-JSON:", responseText);
      throw new Error(`Réponse PayDunya invalide (non-JSON): ${responseText.substring(0, 200)}`);
    }

    console.log("📊 [PayDunya] Réponse complète:", JSON.stringify(data, null, 2));

    // Vérifier différents formats de réponse PayDunya
    const responseCode = data.response_code || data.code;
    const responseText2 = data.response_text || data.message;
    const success = data.success;
    const status = data.status;

    console.log("📊 [PayDunya] Analyse:", {
      responseCode,
      responseText: responseText2,
      success,
      status,
      hasPaymentUrl: !!(data.response_text || data.payment_url || data.invoice_url || data.url)
    });

    // ✅ CODES DE SUCCÈS POSSIBLES
    const successCodes = ["00", "200", 200, 0, "0"];
    const isSuccess = successCodes.includes(responseCode) || 
                      success === true || 
                      status === "success" ||
                      status === "completed";

    if (!isSuccess) {
      const errorMessage = responseText2 || "Erreur création facture PayDunya";
      console.error("❌ [PayDunya] ÉCHEC - Code:", responseCode, "Message:", errorMessage);
      throw new Error(`PayDunya: ${errorMessage} (Code: ${responseCode})`);
    }

    // Extraire l'URL de paiement (peut être à différents endroits)
    const paymentUrl = data.response_text || 
                       data.payment_url || 
                       data.invoice_url || 
                       data.url ||
                       data.data?.payment_url;

    if (!paymentUrl) {
      console.error("❌ [PayDunya] Aucune URL de paiement trouvée dans:", Object.keys(data));
      throw new Error("URL de paiement manquante dans la réponse PayDunya");
    }

    console.log("✅ [PayDunya] SUCCÈS - Payment URL:", paymentUrl);

    return {
      payment_url: paymentUrl,
      invoice_token: data.invoice_token || data.token || data.data?.token,
    };
  } catch (error) {
    if (error.name === "AbortError") {
      console.error("❌ [PayDunya] Timeout - La requête a pris trop de temps");
      throw new Error("Timeout lors de la connexion à PayDunya");
    }
    console.error("❌ [PayDunya] Exception:", error.message);
    throw error;
  }
}