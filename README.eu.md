<div align="center">
  <img src="assets/Logo.png" alt="Voleibol Euskadi" width="120" />
  <h1>Voleibol Euskadi</h1>
  <p><strong>Euskadiko boleibol guztia, aplikazio bakarrean.</strong><br />Lehiaketak, emaitzak, sailkapenak, albisteak eta hondartza-boleibola.</p>

  <p>
    <a href="README.md">Español</a> · <a href="README.en.md">English</a>
  </p>

  <h2 align="center">Aplikazioari begirada bat</h2>

  <p align="center">
    <img src="assets/screenshots/app-tour.gif" alt="Voleibol Euskadi aplikazioaren pantaila-karrusel animatua" width="360" />
  </p>

  <p align="center"><sub>Karruselak pantaila aldatzen du automatikoki bi segundoz behin.</sub></p>

  <p>
    <img src="https://img.shields.io/badge/React_Native-0.86-61DAFB?logo=react&logoColor=white" alt="React Native" />
    <img src="https://img.shields.io/badge/Expo-57-000020?logo=expo&logoColor=white" alt="Expo" />
    <img src="https://img.shields.io/badge/Supabase-Auth_%26_Data-3FCF8E?logo=supabase&logoColor=white" alt="Supabase" />
    <img src="https://img.shields.io/badge/JavaScript-ES2025-F7DF1E?logo=javascript&logoColor=111111" alt="JavaScript" />
    <img src="https://img.shields.io/badge/EAS_Build-Mobile-4630EB?logo=expo&logoColor=white" alt="EAS Build" />
    <img src="https://img.shields.io/badge/License-Personal-lightgrey" alt="License" />
  </p>
</div>

> **Ohar garrantzitsua:** Voleibol Euskadi **ez da inongo federazioren aplikazio ofiziala**. Aplikazioak iturri publikoen scraping-a erabiltzen du; beraz, datuak, erabilgarritasuna eta egonkortasuna aldatu daitezke edo funtzionatzeari utz diezaiokete jatorrizko webgunea aldatzen bada. Federazioarekin harremanetan jartzen saiatu naiz API ofizial baterako sarbidea eskatzeko, baina une honetan ez dago API ofizialik eskuragarri.

<br />

<p align="center">
  <img src="assets/screenshots/Inicio.png" alt="Hasierako pantaila" width="250" />
  <img src="assets/screenshots/Competiciones.png" alt="Lehiaketen pantaila" width="250" />
  <img src="assets/screenshots/Partido-detalles.png" alt="Partidaren xehetasunak" width="250" />
</p>

## Aplikazioari buruz

Voleibol Euskadi lehiaketak, partidak, sailkapenak, albisteak eta hondartza-boleibola kontsultatzeko mugikorretarako aplikazioa da.

### Zer egin dezakezu?

| Atala | Funtzioak |
| --- | --- |
| 🏆 Lehiaketak | Ligak, taldeak, sailkapenak, emaitzak eta kanporaketak |
| 🏐 Partidak | Puntuazioak, set-ak, ordutegiak, kokapenak, mapak eta galeriak |
| 🌊 Hondartza-boleibola | Hondartzako partida eta sailkapen bereziak |
| 📰 Albisteak | Irakurketa, gogokoak eta lotutako edukiak |
| 👤 Kontua | Supabase bidezko autentifikazioa, profilak eta lehentasunak |
| ⚡ Errendimendua | Tokiko cachea, karga-egoerak eta erroreen kudeaketa |

## Galeria

<p align="center">
  <img src="assets/screenshots/Noticias.png" alt="Albisteak" width="220" />
  <img src="assets/screenshots/Partido-mapa.png" alt="Partidaren mapa" width="220" />
  <img src="assets/screenshots/Partidos-voleyplaya.png" alt="Hondartza-boleiboleko partidak" width="220" />
  <img src="assets/screenshots/Ranking-voleyplaya.png" alt="Hondartza-boleiboleko sailkapena" width="220" />
</p>

## Teknologia

| Geruza | Teknologia |
| --- | --- |
| Aplikazioa | React Native `0.86` + Expo `57` |
| Nabigazioa | React Navigation |
| Datuak eta autentifikazioa | Supabase |
| Integrazioa | Axios, `htmlparser2`, `fast-xml-parser` |
| Banaketa | EAS Build Android/iOS-erako |
| Tokiko iraunkortasuna | AsyncStorage eta cache espezializatuak |

## Arkitektura

```text
Iturri publikoak ──> parseatu eta normalizatu ──> React Native UI
                              ├──> Tokiko cacheak
                              └──> Supabase autentifikazioa eta lehentasunak

src/
├── contexts/       Egoera globala, saioa eta gogokoak
├── screens/        Hasiera, ligak, partidak, albisteak eta profila
├── components/     UI eta domeinuko osagai berrerabilgarriak
├── hooks/          Eskaerak, polling-a eta sareko egoera
├── services/       Aplikazio-zerbitzuak
└── utils/          Parseatzea, cachea, irudiak eta nabigazioa
```

## Hasiera azkarra

**Beharrezkoa:** Node.js LTS, npm eta Expo CLI.

```bash
npm install
Copy-Item .env.example .env
npm start
```

Konfiguratu `.env` fitxategia:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=your-anon-key
EXPO_PUBLIC_YOUTUBE_API_KEY=your-youtube-api-key
```

YouTube gakoa aukerakoa da eta partiden bideoen bilaketa gaitzen du. Ez igo inoiz `.env` edo benetako kredentzialik.

### Komandoak

```bash
npm run lint       # Kodea egiaztatu
npm run android    # Android exekutatu
npm run ios        # iOS exekutatu
npm start          # Expo ireki
```

### EAS build-ak

```bash
npx eas-cli build --profile preview
npx eas-cli build --profile production
```

`preview` profilak Android APK bat sortzen du barne-banaketarako. `production` EAS bidezko azken banaketarako prestatuta dago.

## Ikusizko identitatea

<p>
  <img src="https://img.shields.io/badge/Primary-%230F9F7A-0F9F7A" alt="Primary green" />
  <img src="https://img.shields.io/badge/Primary_dark-%2308795E-08795E" alt="Primary dark green" />
  <img src="https://img.shields.io/badge/Background-%23F6F8F7-F6F8F7?style=flat&labelColor=555555" alt="Light background" />
  <img src="https://img.shields.io/badge/Surface-%23FFFFFF-FFFFFF?style=flat&labelColor=555555" alt="White surface" />
</p>

Gai argiak berdea erabiltzen du kolore nagusi gisa, berde iluna egoera aktiboetan eta nabigazioan, ia zuri den atzeko planoa eta gainazal zuriak. Gai iluna ere badago; urdina, horia eta gorria informazioa, oharrak eta partida-egoerak adierazteko erabiltzen dira.

## Biltegiaren egitura

```text
src/                 Aplikazioaren iturburua
assets/              Logoa eta produktuaren pantaila-irudiak
db/db.sql            Datu-basearen eskema
patches/             Instalaziorako beharrezko adabakiak
app.json             Expo konfigurazioa
eas.json             EAS garapen, preview eta production profilak
```

## Egoera eta lizentzia

Erabilera pertsonal eta hezigarriko proiektua. Datuen iturriak dagozkien hornitzaileenak dira; errespetatu erabilera-baldintzak. Ikusi [LICENSE](LICENSE).
