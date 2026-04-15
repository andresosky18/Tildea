// ═══════════════════════════════════════════════════════
//  TILDEA — Vercel Function: Crear preferencia de pago
//  POST /api/create-preference
//  Body: { plan, userId, userEmail, userName, billingCycle }
//  Returns: { preferenceId, initPoint }
// ═══════════════════════════════════════════════════════

import { MercadoPagoConfig, Preference } from "mercadopago";

const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

// Planes disponibles
const PLANS = {
  pro_monthly: {
    title: "Tildea Pro — Mensual",
    description: "Corrector ortográfico avanzado con IA. Cancela cuando quieras.",
    unit_price: 3.00,
    currency_id: "USD",
  },
  pro_annual: {
    title: "Tildea Pro — Anual",
    description: "Tildea Pro por 12 meses. Ahorra 33% vs mensual.",
    unit_price: 24.00,
    currency_id: "USD",
  },
  teams: {
    title: "Tildea Equipos",
    description: "Plan para equipos. Incluye panel de administración.",
    unit_price: 8.00,
    currency_id: "USD",
  },
};

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", process.env.SITE_URL || "https://tildea.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { plan = "pro_monthly", userId, userEmail, userName, billingCycle = "monthly" } = req.body;

    // Validate
    if (!userId || !userEmail) {
      return res.status(400).json({ error: "userId y userEmail son requeridos" });
    }

    const planKey = plan === "pro" ? `pro_${billingCycle}` : plan;
    const selectedPlan = PLANS[planKey];
    if (!selectedPlan) {
      return res.status(400).json({ error: `Plan inválido: ${planKey}` });
    }

    const preference = new Preference(mp);
    const baseUrl = process.env.SITE_URL || "https://tildea.vercel.app";

    const response = await preference.create({
      body: {
        items: [
          {
            id: planKey,
            title: selectedPlan.title,
            description: selectedPlan.description,
            quantity: 1,
            unit_price: selectedPlan.unit_price,
            currency_id: selectedPlan.currency_id,
          },
        ],
        payer: {
          name: userName || "",
          email: userEmail,
        },
        back_urls: {
          success: `${baseUrl}/payment-success.html?plan=${planKey}&uid=${userId}`,
          failure: `${baseUrl}/payment-failure.html`,
          pending: `${baseUrl}/payment-pending.html`,
        },
        auto_return: "approved",
        notification_url: `${baseUrl}/api/webhook`,
        external_reference: JSON.stringify({ userId, plan: planKey, email: userEmail }),
        expires: false,
        metadata: { userId, plan: planKey, userEmail },
        statement_descriptor: "TILDEA",
      },
    });

    return res.status(200).json({
      preferenceId: response.id,
      initPoint: response.init_point,       // redirect URL
      sandboxUrl: response.sandbox_init_point,
    });

  } catch (error) {
    console.error("MP preference error:", error);
    return res.status(500).json({ error: "Error creando preferencia de pago", detail: error.message });
  }
}
