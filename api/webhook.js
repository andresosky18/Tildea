// ═══════════════════════════════════════════════════════
//  TILDEA — Vercel Function: Webhook de MercadoPago
//  POST /api/webhook
//  Procesa notificaciones IPN/webhook de MP
//  Actualiza Firebase cuando el pago es aprobado
// ═══════════════════════════════════════════════════════

import { MercadoPagoConfig, Payment } from "mercadopago";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// Init MercadoPago
const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

// Init Firebase Admin (solo una vez)
function getFirebaseAdmin() {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId:    process.env.FIREBASE_PROJECT_ID,
        clientEmail:  process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:   process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  }
  return getFirestore();
}

// Calcular fecha de expiración del plan
function getPlanExpiry(planKey) {
  const now = new Date();
  if (planKey.includes("annual")) {
    now.setFullYear(now.getFullYear() + 1);
  } else {
    now.setMonth(now.getMonth() + 1);
  }
  return now;
}

export default async function handler(req, res) {
  // MercadoPago espera 200 rápido
  if (req.method !== "POST") return res.status(200).end();

  try {
    const { type, data } = req.body;

    // Solo procesar pagos
    if (type !== "payment") {
      return res.status(200).json({ received: true, skipped: true });
    }

    const paymentId = data?.id;
    if (!paymentId) return res.status(200).json({ received: true });

    // Obtener detalles del pago
    const payment = new Payment(mp);
    const paymentData = await payment.get({ id: paymentId });

    console.log(`Payment ${paymentId}: status=${paymentData.status}`);

    // Solo procesar pagos aprobados
    if (paymentData.status !== "approved") {
      return res.status(200).json({ received: true, status: paymentData.status });
    }

    // Parsear external_reference para obtener datos del usuario
    let metadata;
    try {
      metadata = JSON.parse(paymentData.external_reference || "{}");
    } catch {
      metadata = paymentData.metadata || {};
    }

    const { userId, plan, email } = metadata;
    if (!userId) {
      console.error("No userId in payment metadata");
      return res.status(200).json({ received: true, error: "no userId" });
    }

    // Actualizar Firebase
    const db = getFirebaseAdmin();
    const userRef = db.collection("users").doc(userId);
    const expiry = getPlanExpiry(plan || "pro_monthly");

    await userRef.set({
      plan: plan?.includes("teams") ? "teams" : "pro",
      planActive: true,
      planExpiry: expiry,
      planStarted: new Date(),
      lastPaymentId: paymentId,
      lastPaymentAmount: paymentData.transaction_amount,
      lastPaymentDate: new Date(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`✅ User ${userId} upgraded to ${plan}`);
    return res.status(200).json({ received: true, upgraded: true, userId, plan });

  } catch (error) {
    console.error("Webhook error:", error);
    // Siempre devolver 200 para que MP no reintente
    return res.status(200).json({ received: true, error: error.message });
  }
}
