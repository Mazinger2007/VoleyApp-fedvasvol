import React from 'react';
import { Image, StyleSheet } from 'react-native';

export default function VenueMap({ query }) {
  // Web implementation: strictly use Image to avoid native-only markers/WebView issues
  return (
    <Image 
      source={{ uri: `https://images.unsplash.com/photo-1569336415962-a4bd9f69c07a?auto=format&fit=crop&q=80&w=800&sig=${query}` }} 
      style={StyleSheet.absoluteFill} 
    />
  );
}
