// Script de build — genera firebase-config.js desde variables de entorno de Vercel
// Se ejecuta automáticamente antes de cada deploy

const fs = require('fs');

const config = {
  apiKey:            process.env.FIREBASE_API_KEY,
  authDomain:        process.env.FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.FIREBASE_PROJECT_ID,
  storageBucket:     process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.FIREBASE_APP_ID,
};

const missing = Object.entries(config).filter(([, v]) => !v).map(([k]) => k);
if (missing.length > 0) {
  console.error('❌ Faltan variables de entorno de Firebase:', missing.join(', '));
  process.exit(1);
}

const output = `// Generado automáticamente por build.js — NO editar manualmente\nwindow.FIREBASE_CONFIG = ${JSON.stringify(config, null, 2)};\n`;

fs.writeFileSync('firebase-config.js', output);
console.log('✅ firebase-config.js generado correctamente');
