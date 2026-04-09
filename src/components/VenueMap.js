import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

export default function VenueMap({ venue, colors, isDark, latitude, longitude }) {
  const [loading, setLoading] = useState(true);

  // Solo renderizamos si tenemos coordenadas válidas
  const hasCoords = typeof latitude === 'number' && typeof longitude === 'number' && 
                    Number.isFinite(latitude) && Number.isFinite(longitude) &&
                    (Math.abs(latitude) > 0.0001 || Math.abs(longitude) > 0.0001);

  if (!hasCoords) return null;

  const mapKey = `map_${latitude}_${longitude}_${isDark}`;

  const mapHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <style>
          body, html { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; background-color: ${colors.surfaceAlt}; }
          iframe { border: 0; width: 100%; height: 100%; }
        </style>
      </head>
      <body>
        <iframe 
          src="https://maps.google.com/maps?q=${latitude},${longitude}&hl=es&z=17&t=p&output=embed"
          allowfullscreen>
        </iframe>
      </body>
    </html>
  `;

  return (
    <View key={`wv_${mapKey}`} style={{ flex: 1, height: '100%', width: '100%', backgroundColor: colors.surfaceAlt }}>
      <WebView
        style={StyleSheet.absoluteFill}
        originWhitelist={['*']}
        source={{ html: mapHtml }}
        scrollEnabled={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        allowsInlineMediaPlayback={true}
      />
      {loading && (
        <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surfaceAlt }]}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}
    </View>
  );
}
