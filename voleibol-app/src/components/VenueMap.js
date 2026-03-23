import React, { useState, useEffect, useMemo } from 'react';
import { View, Image, Platform, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { WebView } from 'react-native-webview';
import axios from 'axios';
import { MaterialIcons } from '@expo/vector-icons';

export default function VenueMap({ venue, searchVenue, query, colors, isDark, Spacing }) {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(false);
  const mapKey = useMemo(() => `${venue}_${isDark}`, [venue, isDark]);

  useEffect(() => {
    let mounted = true;
    const geocode = async () => {
      if (!venue || venue.length < 3) return;
      try {
        // More specific query for Vizcaya/Euskadi
        const cleanQuery = searchVenue.replace(/polideportivo polideportivo/gi, 'polideportivo');
        const res = await axios.get(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanQuery + ', Vizcaya, Spain')}&format=json&limit=1`, {
          headers: { 'User-Agent': 'VoleibolApp/1.1' },
          timeout: 5000
        });
        
        if (mounted) {
          if (res.data?.[0]) {
            const { lat, lon } = res.data[0];
            setLocation({
              latitude: parseFloat(lat),
              longitude: parseFloat(lon),
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            });
          } else {
            setError(true);
          }
        }
      } catch (err) {
        if (mounted) setError(true);
      }
    };
    geocode();
    return () => { mounted = false; };
  }, [searchVenue]);

  if (location) {
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

  // Fallback to WebView (Google Maps embed)
  return (
    <View key={`wv_${mapKey}`} style={{ flex: 1, height: '100%', width: '100%', backgroundColor: colors.surfaceAlt }}>
      <WebView
        style={StyleSheet.absoluteFill}
        source={{ 
          uri: `https://maps.google.com/maps?q=${query}&hl=es&z=14&t=p&output=embed`,
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
