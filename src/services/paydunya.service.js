// src/services/paydunya.service.js

const BASE_URL = process.env.PAYDUNYA_BASE_URL;

function headers() {
  return {
    "Content-Type": "application/json",
    "PAYDUNYA-MASTER-KEY": process.env.PAYDUNYA_MASTER_KEY,
    "PAYDUNYA-PRIVATE-KEY": process.env.PAYDUNYA_PRIVATE_KEY,
    "PAYDUNYA-TOKEN": process.env.PAYDUNYA_TOKEN,
  };
}

export async function createPaydunyaInvoice({
  amount,
  reference,
  callback_url,
}) {
  const response = await fetch(`${BASE_URL}/checkout-invoice/create`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      invoice: {
        total_amount: amount,
        description: "Licence annuelle EKOLEPRO",
      },
      store: {
        name: "EKOLEPRO",
      },
      actions: {
        callback_url,
      },
      custom_data: {
        transaction_ref: reference,
      },
    }),
  });

  const data = await response.json();

  if (!data.response_code || data.response_code !== "00") {
    throw new Error("Erreur création facture PayDunya");
  }

  return {
    payment_url: data.response_text,
  };
}
