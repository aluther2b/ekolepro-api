// src/services/operators/helpers.js
export function extractTransactionRef(operator, payload) {
  switch (operator) {
    case "MTN":
      return payload?.reference || payload?.transaction_id || payload?.externalId || null;
    case "ORANGE":
      return payload?.order_id || payload?.txnid || null;
    case "WAVE":
      return payload?.id || payload?.transaction_id || null;
    default:
      return null;
  }
}

export function extractPaymentStatus(operator, payload) {
  switch (operator) {
    case "MTN":
      return payload?.status === "SUCCESS" || payload?.status === "SUCCESSFUL";
    case "ORANGE":
      return payload?.status === "SUCCESS" || payload?.status === "COMPLETED";
    case "WAVE":
      return payload?.state === "success" || payload?.status === "completed";
    default:
      return false;
  }
}
