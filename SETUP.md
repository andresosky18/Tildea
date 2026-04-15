# 🔧 GUÍA DE CONFIGURACIÓN – Tildea Website

## Paso 1: Crear proyecto en Firebase (5 minutos)

1. Ve a **https://console.firebase.google.com**
2. Haz clic en **"Crear un proyecto"**
3. Nombre del proyecto: `tildea` → Continuar
4. Desactiva Google Analytics (opcional) → **Crear proyecto**

---

## Paso 2: Configurar Authentication

1. En el menú izquierdo → **Authentication** → **Comenzar**
2. Ve a la pestaña **Sign-in providers**
3. Activa **Email/contraseña** → Guardar ✓
4. Activa **Google** → pon tu correo → Guardar ✓

---

## Paso 3: Crear base de datos Firestore

1. En el menú → **Firestore Database** → **Crear base de datos**
2. Elige **"Comenzar en modo de prueba"** → Siguiente
3. Elige la ubicación más cercana (ej: `us-central1`) → Listo

---

## Paso 4: Obtener las credenciales

1. En la pantalla principal del proyecto → haz clic en **"</>"** (Web)
2. Nombre de la app: `tildea-web` → **Registrar app**
3. Copia el objeto `firebaseConfig` que aparece:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "tildea-xxxxx.firebaseapp.com",
  projectId: "tildea-xxxxx",
  storageBucket: "tildea-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

---

## Paso 5: Pegar las credenciales

Abre estos 3 archivos y reemplaza el bloque `firebaseConfig`:

- `login.html` (busca "TU_API_KEY")
- `register.html` (busca "TU_API_KEY")
- `dashboard.html` (busca "TU_API_KEY")

---

## Paso 6: Configurar dominio para Google Sign-In

1. En Firebase → Authentication → **Settings** → **Authorized domains**
2. Agrega tu dominio (ej: `tildea.vercel.app` o `tildea.com`)

---

## Paso 7: Subir a internet (gratis con Vercel)

1. Ve a **https://vercel.com** → Crea cuenta gratis
2. Arrastra la carpeta `tildea-website-v2` a Vercel
3. ¡Listo! Te da una URL tipo `https://tildea.vercel.app`

---

## Paso 8: Conectar la extensión con la web

En el archivo `popup.js` de la extensión, agrega este botón:

```javascript
// Abrir dashboard desde la extensión
document.getElementById("btnProfile").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://TU-DOMINIO.vercel.app/dashboard.html" });
});
```

Y en `popup.html` agrega el botón al footer:
```html
<button id="btnProfile">👤 Mi perfil</button>
```

---

## 📝 Notas importantes

- La base de datos en **modo de prueba** expira en 30 días.
  Para producción, configura las **reglas de Firestore**:
  ```
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /users/{userId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
  ```

- Firebase **plan gratuito** (Spark) incluye:
  - 10,000 autenticaciones/mes
  - 1 GB de Firestore
  - Suficiente para empezar sin pagar nada

---

¿Necesitas ayuda? Escríbeme a andrefelipe303@hotmail.com
