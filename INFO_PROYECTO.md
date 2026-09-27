# ⚡ INFO_PROYECTO: Flowmind (By Toni)

> **Ubicación Google Drive:** `Google Drive > Mi unidad > 1-Proyectos > Apps-Desarrollo > Flowmind`  
> **Slug / Código:** `mia_flowmind`  
> **Categoría:** Suite Toni (Propio / I+D)  
> **Estado:** En Producción (Vercel)  
> **URL Producción:** [https://flowmindpro.vercel.app](https://flowmindpro.vercel.app)  
> **Base de Datos:** Supabase PostgreSQL (`mia_flowmind`)  
> **Directrices Maestras Drive:** [Carpeta de Directrices](https://drive.google.com/drive/folders/1lWPlfQ3KtLijHklYE0O993J-HwQInjZW)

---

## 🎯 1. Propuesta de Valor y Objetivo

**Flowmind** es una aplicación de bienestar mental, mindfulness, gestión del estado emocional, meditaciones guiadas personalizadas y música vital adaptada al estado de ánimo.

### 💡 Problema Principal que Resuelve
Facilitar check-ins emocionales rápidos, rutinas matutinas y nocturnas con generación dinámica de meditaciones con IA adaptadas a la situación del usuario.

### 👥 Público Objetivo
- Toni y usuarios que buscan optimizar su enfoque, energía, estado anímico y gratitud diaria.

---

## 🛠️ 2. Arquitectura y Stack Tecnológico

- **Frontend:** React + Vite + TypeScript + Tailwind CSS + Lucide Icons.
- **Estilos:** Dark Glassmorphism sereno y minimalista con micro-animaciones relajantes.
- **Persistencia:** Supabase PostgreSQL esquema aislado `mia_flowmind` con RLS estricto.

---

## 📜 3. Cumplimiento de las 5 Directrices Maestras de Google Drive

| # | Directriz | Estado en Flowmind |
|---|---|---|
| **1** | **🗄️ Supabase PostgreSQL** | Esquema aislado `mia_flowmind` con tablas `profiles`, `check_ins`, `saved_meditations`, `vital_soundtrack` y RLS activo. |
| **2** | **🛡️ Seguridad & Auth** | Supabase Auth y Route Guards. |
| **3** | **🤖 IA & Meditaciones** | Generación de guiones de meditación con streaming SSE y síntesis de voz. |
| **4** | **⚖️ RGPD & Branding** | Titular Antonio Javier García García (DNI 34799350M, Madrid) y sello "By Toni". |
| **5** | **📂 Registro Drive** | Ficha `INFO_PROYECTO.md` registrada. |

---

## 🚀 4. Comandos de Ejecución Local

```bash
cd /Users/toni/Proyectos/Flowmind
npm install
npm run dev
```

---
*Ficha generada automáticamente según la Directriz de Registro y Control de Google Drive (By Toni).*
