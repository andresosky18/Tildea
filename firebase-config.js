// ═══════════════════════════════════════════════════════════
//  TILDEA – Configuración de Firebase
//  
//  INSTRUCCIONES:
//  1. Ve a https://console.firebase.google.com
//  2. Crea un proyecto nuevo llamado "tildea"
//  3. Haz clic en "</>" para agregar una app web
//  4. Copia los valores de firebaseConfig y pégalos aquí
//  5. En Firebase Console activa:
//     - Authentication > Sign-in providers > Email/Password ✓
//     - Authentication > Sign-in providers > Google ✓
//     - Firestore Database > Crear base de datos (modo prueba)
// ═══════════════════════════════════════════════════════════

const firebaseConfig = {
  apiKey:            "TU_API_KEY",           // ← pega aquí
  authDomain:        "TU_PROYECTO.firebaseapp.com",
  projectId:         "TU_PROYECTO_ID",
  storageBucket:     "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId:             "TU_APP_ID"
};

export default firebaseConfig;
