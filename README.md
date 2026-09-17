<div align="center">
  <img src="assets/Logo.png" alt="Voleibol Vizcaya" width="120" />
  <h1>Voleibol Vizcaya</h1>
  <p><strong>Todo el vóley de Vizcaya, en una sola app.</strong><br />Competiciones, resultados, clasificaciones, noticias y vóley playa.</p>

  <p>
    <a href="README.en.md">English</a> · <a href="README.eu.md">Euskara</a>
  </p>

  <h2 align="center">Un vistazo a la app</h2>

  <p align="center">
    <img src="assets/screenshots/app-tour.gif" alt="Carrusel animado de pantallas de Voleibol Vizcaya" width="360" />
  </p>

  <p align="center"><sub>El carrusel cambia de pantalla automáticamente cada dos segundos.</sub></p>

  <p>
    <img src="https://img.shields.io/badge/React_Native-0.86-61DAFB?logo=react&logoColor=white" alt="React Native" />
    <img src="https://img.shields.io/badge/Expo-57-000020?logo=expo&logoColor=white" alt="Expo" />
    <img src="https://img.shields.io/badge/Supabase-Auth_%26_Data-3FCF8E?logo=supabase&logoColor=white" alt="Supabase" />
    <img src="https://img.shields.io/badge/JavaScript-ES2025-F7DF1E?logo=javascript&logoColor=111111" alt="JavaScript" />
    <img src="https://img.shields.io/badge/EAS_Build-Mobile-4630EB?logo=expo&logoColor=white" alt="EAS Build" />
    <img src="https://img.shields.io/badge/License-Personal-lightgrey" alt="License" />
  </p>
</div>

> **Aviso importante:** Voleibol Vizcaya **no es una aplicación oficial** de ninguna federación. La app obtiene la información mediante scraping de fuentes públicas, por lo que los datos, la disponibilidad y la estabilidad pueden variar o dejar de funcionar si cambia la web de origen. Se ha intentado contactar con la federación para obtener acceso a una API oficial, pero actualmente no se dispone de ella.

<br />

<p align="center">
  <img src="assets/screenshots/Inicio.png" alt="Pantalla de inicio" width="250" />
  <img src="assets/screenshots/Competiciones.png" alt="Listado de competiciones" width="250" />
  <img src="assets/screenshots/Partido-detalles.png" alt="Detalle de partido" width="250" />
</p>

## Sobre la aplicación

Voleibol Vizcaya es una aplicación móvil para consultar competiciones, partidos, clasificaciones, noticias y vóley playa.

### Lo que puedes hacer

| Área | Funcionalidad |
| --- | --- |
| 🏆 Competiciones | Ligas, equipos, clasificaciones, resultados y cuadros |
| 🏐 Partidos | Marcadores, sets, horarios, pabellones, mapas y galerías |
| 🌊 Vóley playa | Partidos y rankings específicos de playa |
| 📰 Noticias | Lectura, favoritos y contenido relacionado |
| 👤 Cuenta | Autenticación, perfil y preferencias con Supabase |
| ⚡ Rendimiento | Caché local, estados de carga y recuperación de errores |

## Galería

<p align="center">
  <img src="assets/screenshots/Noticias.png" alt="Noticias" width="220" />
  <img src="assets/screenshots/Partido-mapa.png" alt="Mapa del partido" width="220" />
  <img src="assets/screenshots/Partidos-voleyplaya.png" alt="Partidos de vóley playa" width="220" />
  <img src="assets/screenshots/Ranking-voleyplaya.png" alt="Ranking de vóley playa" width="220" />
</p>

## Stack tecnológico

<div align="center">

| Capa | Tecnología |
| --- | --- |
| App | React Native `0.86` + Expo `57` |
| Navegación | React Navigation |
| Datos y autenticación | Supabase |
| Integración | Axios, `htmlparser2`, `fast-xml-parser` |
| Distribución | EAS Build para Android/iOS |
| Persistencia local | AsyncStorage y cachés especializadas |

</div>

## Arquitectura

```text
App.js
├── contexts/       Estado global, sesión y favoritos
├── screens/        Flujos de inicio, ligas, partidos, noticias y perfil
├── components/     UI reutilizable y componentes de dominio
├── hooks/          Peticiones, polling y estados de red
├── services/       Servicios de aplicación
└── utils/          Parseo, caché, imágenes, Supabase y navegación

Fuentes públicas ──> parseo y normalización ──> caché ──> UI React Native
                                      └──────> Supabase / preferencias de usuario
```

## Puesta en marcha

**Requisitos:** Node.js LTS, npm y Expo CLI.

```bash
npm install
Copy-Item .env.example .env
npm start
```

Configura en `.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=your-anon-key
EXPO_PUBLIC_YOUTUBE_API_KEY=your-youtube-api-key
```

La clave de YouTube es opcional y habilita la búsqueda de vídeos de partidos. No subas nunca `.env` ni credenciales reales al repositorio.

### Comandos

```bash
npm run lint       # Comprueba el código
npm run android    # Arranca Android
npm run ios        # Arranca iOS
npm start          # Abre Expo
```

### Builds con EAS

```bash
npx eas-cli build --profile preview
npx eas-cli build --profile production
```

`preview` genera un APK Android para distribución interna. `production` está preparado para la distribución final mediante EAS.

## Identidad visual

<p>
  <img src="https://img.shields.io/badge/Primary-%230F9F7A-0F9F7A" alt="Primary green" />
  <img src="https://img.shields.io/badge/Primary_dark-%2308795E-08795E" alt="Primary dark green" />
  <img src="https://img.shields.io/badge/Background-%23F6F8F7-F6F8F7?style=flat&labelColor=555555" alt="Light background" />
  <img src="https://img.shields.io/badge/Surface-%23FFFFFF-FFFFFF?style=flat&labelColor=555555" alt="White surface" />
</p>

El tema claro usa verde como color principal, verde oscuro para estados activos y navegación, un fondo casi blanco y superficies blancas. También existe un tema oscuro; azul, amarillo y rojo se reservan para estados informativos, avisos y resultados.

## Estructura del repositorio

```text
src/                 Código de la aplicación
assets/              Logo y capturas del producto
db/db.sql            Esquema de datos
patches/             Parches necesarios para la instalación
app.json             Configuración Expo
eas.json             Perfiles EAS de desarrollo, preview y producción
```

## Estado y licencia

Proyecto de uso personal y educativo. Las fuentes de datos pertenecen a sus respectivos proveedores; respeta sus condiciones de uso. Consulta [LICENSE](LICENSE).
