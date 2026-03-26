import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { WebView } from 'react-native-webview';

export default function VenueMap({ venue, colors, isDark, latitude, longitude }) {
  // Solo renderizamos si tenemos coordenadas válidas
  const hasCoords = latitude && longitude && Number.isFinite(latitude) && Number.isFinite(longitude);

  if (!hasCoords) return null;

  const location = {
    latitude: latitude,
    longitude: longitude,
    latitudeDelta: 0.005,
    longitudeDelta: 0.005,
  };

  const mapKey = `map_${latitude}_${longitude}_${isDark}`;

  // En Android el MapView nativo suele ser preferible por rendimiento
  // En Web o como fallback, el WebView con Google Maps embed
  if (Platform.OS !== 'web') {
    return (
      <View key={mapKey} style={{ flex: 1, height: '100%', width: '100%' }}>
        <MapView
          style={StyleSheet.absoluteFill}
          initialRegion={location}
          region={location}
          mapType="terrain"
          liteMode={true}
          scrollEnabled={false}
          zoomEnabled={false}
          pitchEnabled={false}
          rotateEnabled={false}
        >
          <Marker coordinate={location} pinColor={colors.primary} />
        </MapView>
      </View>
    );
  }

  // Fallback a WebView para Web o si no hay MapView disponible
  return (
    <View key={`wv_${mapKey}`} style={{ flex: 1, height: '100%', width: '100%', backgroundColor: colors.surfaceAlt }}>
      <WebView
        style={StyleSheet.absoluteFill}
        source={{ 
          uri: `https://maps.google.com/maps?q=${latitude},${longitude}&hl=es&z=17&t=p&output=embed`,
          headers: { 'Referer': 'https://maps.google.com' }
        }}
        scrollEnabled={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowsInlineMediaPlayback={true}
        userAgent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
      />
    </View>
  );
}
