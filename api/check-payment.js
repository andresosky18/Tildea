// ═══════════════════════════════════════════════════════
//  TILDEA — Vercel Function: Verificar estado de pago
//  GET /api/check-payment?payment_id=xxx&uid=xxx
//  Usado por payment-success.html para confirmar
// ═══════════════════════════════════════════════════════

import { MercadoPagoConfig, Payment } from "mercadopago";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

function getFirebaseAdmin() {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  }
  return getFirestore();
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.SITE_URL || "https://tildea.vercel.app");

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { payment_id, uid } = req.query;

  if (!payment_id || !uid) {
    return res.status(400).json({ error: "payment_id y uid son requeridos" });
  }

  try {
    // Verify payment status with MP
    const payment = new Payment(mp);
    const paymentData = await payment.get({ id: payment_id });

    if (paymentData.status === "approved") {
      // Double check Firebase was updated
      const db = getFirebaseAdmin();
      const userDoc = await db.collection("users").doc(uid).get();
      const userData = userDoc.data() || {};

      return res.status(200).json({
        status: "approved",
        plan: userData.plan || "pro",
        planActive: userData.planActive || false,
        amount: paymentData.transaction_amount,
        currency: paymentData.currency_id,
      });
    }

    return res.status(200).json({
      status: paymentData.status,
      plan: null,
    });

  } catch (error) {
    console.error("check-payment error:", error);
    return res.status(500).json({ error: error.message });
  }
}
