// ═══════════════════════════════════════════════════════
//  TILDEA — Vercel Function: Generar factura PDF básica
//  GET /api/generate-invoice?uid=xxx&paymentId=xxx
//  Returns: HTML invoice (printable as PDF)
// ═══════════════════════════════════════════════════════

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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
  if (req.method !== "GET") return res.status(405).end();

  const { uid, paymentId } = req.query;
  if (!uid) return res.status(400).json({ error: "uid requerido" });

  let userData = {};
  let paymentData = {};

  try {
    const db = getFirebaseAdmin();
    const userSnap = await db.collection("users").doc(uid).get();
    if (userSnap.exists) userData = userSnap.data();
  } catch(e) {
    console.error("Firebase error:", e);
  }

  const invoiceNumber = `TLD-${Date.now().toString().slice(-8)}`;
  const date = new Date().toLocaleDateString("es-CO", {
    year: "numeric", month: "long", day: "numeric"
  });
  const plan = userData.plan === "teams" ? "Plan Equipos" : "Plan Pro";
  const amount = userData.plan === "teams" ? "8.00" : "3.00";
  const name = userData.displayName || userData.email || "Cliente";
  const email = userData.email || "";

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Factura ${invoiceNumber} — Tildea</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #0D1B2A; background: white; padding: 40px; }
  .invoice-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #E1EEF8; padding-bottom: 24px; }
  .logo { font-size: 28px; font-weight: 900; color: #2196F3; letter-spacing: -1px; }
  .logo span { color: #FF7043; }
  .invoice-meta { text-align: right; }
  .invoice-meta h2 { font-size: 22px; color: #0D1B2A; margin-bottom: 8px; }
  .invoice-meta p { font-size: 13px; color: #546E7A; line-height: 1.7; }
  .section { margin-bottom: 32px; }
  .section-title { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #B0BEC5; margin-bottom: 10px; font-weight: 700; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  .info-box { background: #F0F8FF; border-radius: 10px; padding: 16px; }
  .info-box h4 { font-size: 13px; color: #546E7A; margin-bottom: 4px; }
  .info-box p { font-size: 14px; font-weight: 600; color: #0D1B2A; }
  table { width: 100%; border-collapse: collapse; }
  thead th { background: #F0F8FF; padding: 12px 16px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: #546E7A; }
  tbody td { padding: 14px 16px; border-bottom: 1px solid #E1EEF8; font-size: 14px; }
  .total-row { background: #F0F8FF; }
  .total-row td { font-weight: 700; font-size: 16px; color: #0D1B2A; }
  .amount { text-align: right; font-weight: 700; }
  .status-badge { display: inline-block; background: #E8FFF5; color: #059669; border-radius: 8px; padding: 3px 10px; font-size: 12px; font-weight: 700; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #E1EEF8; text-align: center; font-size: 12px; color: #B0BEC5; line-height: 1.8; }
  @media print { body { padding: 20px; } button { display: none; } }
  .print-btn { display: inline-flex; align-items: center; gap: 8px; margin-top: 24px; padding: 12px 24px; background: #2196F3; color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer; }
  .print-btn:hover { background: #1565C0; }
</style>
</head>
<body>
  <div class="invoice-header">
    <div>
      <div class="logo">tildea<span>.</span></div>
      <div style="font-size:12px;color:#546E7A;margin-top:4px;">tildea.vercel.app</div>
      <div style="font-size:12px;color:#546E7A;">Bogotá, Colombia</div>
      <div style="font-size:12px;color:#546E7A;">andrefelipe303@hotmail.com</div>
    </div>
    <div class="invoice-meta">
      <h2>RECIBO DE PAGO</h2>
      <p>Número: <strong>${invoiceNumber}</strong><br>
      Fecha: ${date}<br>
      Estado: <span class="status-badge">✓ Pagado</span></p>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Información del cliente</div>
    <div class="info-grid">
      <div class="info-box">
        <h4>Nombre</h4>
        <p>${name}</p>
      </div>
      <div class="info-box">
        <h4>Correo electrónico</h4>
        <p>${email}</p>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Detalle del servicio</div>
    <table>
      <thead>
        <tr>
          <th>Descripción</th>
          <th>Período</th>
          <th>Cantidad</th>
          <th class="amount">Valor</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>Tildea ${plan}</strong><br>
            <span style="font-size:12px;color:#546E7A;">Corrector ortográfico y gramatical inteligente</span>
          </td>
          <td>Mensual</td>
          <td>1</td>
          <td class="amount">USD $${amount}</td>
        </tr>
        <tr class="total-row">
          <td colspan="3"><strong>Total pagado</strong></td>
          <td class="amount">USD $${amount}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Método de pago</div>
    <div class="info-box" style="display:inline-block;">
      <h4>Procesado por</h4>
      <p>MercadoPago${paymentId ? ` · ID: ${paymentId}` : ''}</p>
    </div>
  </div>

  <div style="text-align:center;">
    <button class="print-btn" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
  </div>

  <div class="footer">
    <strong>Tildea</strong> · Bogotá, Colombia · Operado por Andrés Aragón<br>
    Este documento es un comprobante de pago. Para soporte: andrefelipe303@hotmail.com<br>
    © ${new Date().getFullYear()} Tildea — Todos los derechos reservados
  </div>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.status(200).send(html);
}
