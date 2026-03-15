# 🏐 Voleibol Vizcaya App

App móvil personal (React Native + Expo) que muestra la información pública de la **Federación Vizcaína de Voleibol** con un diseño moderno y limpio, sin usar el CSS original del sitio ni WebView.

> ⚠️ **Uso personal exclusivo.** No se redistribuye ni se hace uso comercial.

---

## 📁 Estructura del proyecto

```
voleibol-app/
├── App.js                        # Punto de entrada + navegación
├── app.json                      # Configuración Expo
├── babel.config.js
├── package.json
└── src/
    ├── screens/
    │   ├── HomeScreen.js          # Portada / noticias
    │   ├── CompetitionsScreen.js  # Clasificaciones y resultados
    │   └── TeamsScreen.js         # Lista de clubes con búsqueda
    ├── components/
    │   ├── Header.js              # Cabecera personalizada
    │   ├── Card.js                # Tarjeta genérica reutilizable
    │   ├── BlockRenderer.js       # Renderiza bloques HTML parseados
    │   ├── CompetitionTable.js    # Tabla de clasificación
    │   ├── MatchList.js           # Lista de partidos
    │   ├── TeamList.js            # Lista de equipos con avatar
    │   ├── LoadingView.js         # Pantalla de carga animada
    │   └── ErrorView.js           # Pantalla de error con reintentar
    ├── hooks/
    │   └── useFetch.js            # Hook: descarga + parseo + estado
    ├── utils/
    │   └── htmlParser.js          # Descarga HTML, limpia CSS, extrae bloques
    └── styles/
        └── theme.js               # Colores, tipografía, espaciado, sombras
```

---

## 🚀 Instalación y arranque

### 1. Crear el proyecto con Expo

```bash
npx create-expo-app voleibol-app --template blank
cd voleibol-app
```

### 2. Instalar dependencias

```bash
npm install \
  axios \
  htmlparser2 \
  domhandler \
  domutils \
  css-select \
  @react-navigation/native \
  @react-navigation/bottom-tabs \
  @react-navigation/native-stack \
  react-native-screens \
  react-native-safe-area-context \
  @expo/vector-icons
```

### 3. Copiar los ficheros de este proyecto

Reemplaza los ficheros de la carpeta `src/` y `App.js` con los de este repositorio.

### 4. Arrancar la app

```bash
npx expo start
```

Escanea el QR con **Expo Go** (Android/iOS) o pulsa `a` para Android emulator / `i` para iOS simulator.

---

## ⚙️ Cómo funciona el parseo de HTML

```
URL pública de fvv.eus
        │
        ▼
 axios.get(url)          ← Descarga el HTML completo
        │
        ▼
 htmlparser2.parseDocument()  ← Construye el DOM en memoria
        │
        ▼
 domToBlocks()           ← Recorre el DOM y genera bloques:
   • heading  (h1–h6)
   • paragraph
   • list (ul/ol)
   • link (a)
   • table
        │
        ▼
 BlockRenderer           ← Renderiza cada bloque con
                            componentes React Native propios
```

**Elementos eliminados automáticamente:**
- `<style>`, `<link rel="stylesheet">` → sin CSS externo
- `<script>`, `<noscript>` → sin JavaScript externo
- `<iframe>`, `<form>` → sin formularios ni iframes
- Comentarios HTML

---

## 🎨 Sistema de diseño (theme.js)

| Token | Valor |
|-------|-------|
| `Colors.primary` | `#1565C0` (azul federación) |
| `Colors.accent` | `#FFC107` (amarillo highlight) |
| `Colors.background` | `#F4F6F9` (fondo claro) |
| `Colors.surface` | `#FFFFFF` (tarjetas) |
| Radius tarjetas | `16px` |
| Sombra tarjetas | `elevation: 4` |

---

## 📱 Pantallas

### 🏠 Inicio
- Descarga `fvv.eus`
- Muestra headings, párrafos y listas del body
- Pull-to-refresh

### 🏆 Competiciones
- Descarga `fvv.eus/competicion`
- **Pestaña Clasificación**: tablas con colores de zona (verde/rojo)
- **Pestaña Resultados**: tarjetas de partido con local vs visitante

### 🏐 Equipos
- Descarga `fvv.eus/club`
- Buscador en tiempo real
- Avatar generado con iniciales del club
- Modal de detalle al pulsar

---

## 🔧 Personalización

### Cambiar URLs
Edita `src/utils/htmlParser.js` → objeto `URLS`.

### Cambiar colores
Edita `src/styles/theme.js` → objeto `Colors`.

### Añadir una pantalla nueva
1. Crea `src/screens/NuevaScreen.js`
2. Añade la pestaña en `App.js` dentro de `Tab.Navigator`
