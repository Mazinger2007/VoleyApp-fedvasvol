Place your app icon here as `Logo.png`.

Recommendations:
- Provide a square PNG, ideally 1024×1024 for best results.
- For Android adaptive icon, also provide a foreground image and a simple background color if needed.

After adding `Logo.png`, rebuild or run:

# Expo Go (dev)
expo start

# From project folder
node_modules/.bin/expo start

# Build APK with EAS or expo build
# e.g. using EAS:
eas build --platform android

The `app.json` is configured to use `./assets/Logo.png` for the app icon and web favicon, and Android adaptive icon foreground.
