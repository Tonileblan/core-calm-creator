# Mindful Flow

Aplicación Integral de Bienestar Mental, Autorregulación e IA Generativa

1. Visión General del Producto

Objetivo: Crear una plataforma integral de bienestar mental y optimización cognitiva que unifique herramientas de autorregulación emocional rápida (respiración y sonido), un sistema de gestión del tiempo y foco, registro de estados de ánimo y un motor de inteligencia artificial para la generación de meditaciones ultrapersonalizadas en tiempo real.

Público Objetivo: Usuarios que buscan herramientas avanzadas de autorregulación diaria, reducción del estrés, mejora del sueño, gestión de estados emocionales intensos y optimización del enfoque mental.

2. Stack Tecnológico

Frontend / UI: Lovable (React / Vite, Tailwind CSS, Shadcn UI).

Backend & Base de Datos: Supabase (PostgreSQL para almacenamiento de datos, autenticación de usuarios y Row Level Security).

Control de Versiones y Despliegue: GitHub con despliegue continuo en Vercel/Netlify.

Lógica Serverless: Supabase Edge Functions (para consumo seguro de APIs externas).

Motores de Inteligencia Artificial:

Generación de Guiones / Texto: API de OpenAI (GPT-4o) o Anthropic (Claude 3.5 Sonnet).

Síntesis de Voz (Text-to-Speech): API de ElevenLabs u OpenAI TTS.

3. Arquitectura de Funcionalidades (Core Features)

3.1. Dashboard Contextual y Sistema de "Check-in" Dinámico

Descripción: Interfaz principal adaptativa basada en la necesidad inmediata del usuario.

Modalidad Reactiva (Emergencia):

Botones de estado inmediato: Estresado, Bloqueado, Necesito Foco, Celebración, Reequilibrio.

Ejecución en un solo clic de protocolos directos (ej. sesión de respiración anti-tilt o reproducción de ruido marrón).

Modalidad Proactiva (Rutina):

Morning Intention: Registro rápido al despertar (energía, foco del día).

Evening Reflection: Registro nocturno (descarga mental, gratitud).

Analítica e Historial: Gráficas de evolución emocional y mapas de calor (heatmaps) almacenados en Supabase.

3.2. Laboratorio de Respiración Guiada (Visual)

Descripción: Módulo de autorregulación fisiológica mediante animación CSS fluida (círculo expansivo/contractivo) y guía rítmica.

Protocolos Integrados:

Respiración Triangular: Recuperación rápida de la calma (Inhala - Retén - Exhala).

Ciclo "Anti-tilt": Diseñado para interrumpir momentos de frustración, pánico o sesgo emocional reactivo.

Método 4-7-8: Inductor del sueño y relajación profunda.

UI/UX: Temporizador integrado, opción de guía sonora y respuesta háptica.

3.3. Ecosistema Sonoro y Frecuencias

Descripción: Reproductor de audio orientado al control del estado neurofisiológico.

Biblioteca:

Frecuencias Binaurales: Ondas Alpha (foco/creatividad) y Theta (meditación profunda).

Ruidos de Fondo: Ruido Blanco y Ruido Marrón (aislamiento acústico y reducción de la hiperactividad mental).

Reproductor: Control continuo en segundo plano, bucle infinito e integración con temporizadores.

3.4. Banda Sonora Vital (Módulo de Música Personal)

Descripción: Espacio de anclaje emocional donde el usuario vincula canciones específicas a momentos clave.

Categorías: Celebrar, Despertar, Relajación, Dormir.

Funcionalidad: Permite organizar enlaces y metadatos de plataformas externas (Spotify, YouTube) para crear un diario musical de estados de ánimo.

3.5. Laboratorio de Creación IA (Meditaciones a la Carta)

Descripción: Generador dinámico de meditaciones personalizadas mediante prompts estructurados y conversión de texto a audio.

Parámetros de Selección (Formulario):

Objetivo / Foco: Gestión de ansiedad, preparación mental, soltar pensamientos en bucle, gratitud.

Metodología:

Estilo Joe Dispenza: Campo cuántico, concienciación del espacio corporal, sintonización emocional con la intención.

Mindfulness Clásico: Escáner corporal (body scan), observación thoughts-free, anclaje en la respiración.

Reestructuración Emocional: Visualización guiada y anclajes.

Parámetros de Voz: Selección de voz (tono, velocidad, género).

Duración: 5, 10 o 20 minutos.

Flujo Técnico:

Captura de inputs en la UI de Lovable.

Envío a Supabase Edge Function con el System Prompt según la metodología elegida.

Generación del guion con el LLM.

Envío del texto a la API de TTS (ElevenLabs / OpenAI TTS) para generar el archivo MP3.

Almacenamiento de la URL del audio en la base de datos y reproducción inmediata en la app.

3.6. Sistema de Alarmas y Recordatorios (Gestor de Compromiso)

Descripción: Alertas programadas orientadas a la disciplina y el mantenimiento de hábitos de bienestar.

Tipos de Alarma:

Despertar Progresivo: Transición suave mediante reproducción incremental de ruido marrón o frecuencias binaurales.

Recordatorios de Pausa y Compromiso: Alertas configurables a lo largo del día para ejecutar un check-in rápido o pausa de respiración.

Implementación: Notificaciones Push / Service Workers locales sincronizados con Supabase.

3.7. Gimnasio Mental (Ejercicios Cognitivos y Foco)

Descripción: Módulo enfocado en la neuroplasticidad, el trabajo profundo y la reestructuración del pensamiento.

Herramientas:

Bloques de Foco: Temporizadores estilo Pomodoro integrados automáticamente con pistas de audio para trabajo profundo (ondas Alpha/ruido blanco).

Reestructuración Cognitiva: Formulario de journaling asistido por IA para desglosar y reencuadrar pensamientos limitantes o momentos de estrés.

Gamificación Basada en Consistencia: Sistema de rachas (streaks) diarias por bloques completados y check-ins realizados.

4. Requisitos de Experiencia de Usuario (UI/UX)

Estética: Interfaz minimalista, limpia, con soporte nativo para Modo Oscuro y paleta de colores relajantes (tonos profundos, azogados o neutros).

Navegación Móvil: Barra inferior (Bottom Navigation) con 5 secciones principales:

Inicio / Check-in

Respiración

Audio & Música

Laboratorio IA

Perfil & Ajustes

Criterio de Fricción Cero: Acceso a una herramienta de alivio inmediato (respiración o sonido de emergencia) en un máximo de 2 clics desde la apertura de la aplicación.

5. Esquema Inicial de la Base de Datos (Supabase / PostgreSQL)
-- Usuarios

users (

  id uuid primary key default auth.uid(),

  email text not null,

  created_at timestamp with time zone default now()

);

-- Check-ins emocionales

check_ins (

  id uuid primary key default gen_random_uuid(),

  user_id uuid references users(id) on delete cascade,

  estado_emocional text not null,

  tipo_checkin text check (tipo_checkin in ('emergencia', 'rutina_manana', 'rutina_noche')),

  notas text,

  created_at timestamp with time zone default now()

);

-- Meditaciones generadas por IA

saved_meditations (

  id uuid primary key default gen_random_uuid(),

  user_id uuid references users(id) on delete cascade,

  titulo text not null,

  metodologia text not null,

  duracion_minutos integer not null,

  audio_url text not null,

  guion_texto text,

  created_at timestamp with time zone default now()

);

-- Banda sonora vital

vital_soundtrack (

  id uuid primary key default gen_random_uuid(),

  user_id uuid references users(id) on delete cascade,

  nombre_cancion text not null,

  categoria_momento text not null,

  url_enlace text not null,

  created_at timestamp with time zone default now()

);

-- Alarmas y recordatorios

alarms_settings (

  id uuid primary key default gen_random_uuid(),

  user_id uuid references users(id) on delete cascade,

  tipo_alarma text not null,

  hora_programada time not null,

  dias_semana text[] not null,

  accion_vinculada text,

  activa boolean default true,

  created_at timestamp with time zone default now()

);

-- Métricas del Gimnasio Mental

mental_gym_stats (

  id uuid primary key default gen_random_uuid(),

  user_id uuid references users(id) on delete cascade,

  tipo_ejercicio text not null,

  duracion_minutos integer not null,

  completado boolean default true,

  created_at timestamp with time zone default now()

);

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/529d5c38-80f6-4951-b03d-7db951e0a89a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
