import React from 'react';
import { StyleSheet } from 'react-native';

export default function VenueMap({ venue, colors, isDark, latitude, longitude }) {
  const hasCoords = typeof latitude === 'number' && typeof longitude === 'number' &&
                    Number.isFinite(latitude) && Number.isFinite(longitude) &&
                    (Math.abs(latitude) > 0.0001 || Math.abs(longitude) > 0.0001);

  if (!hasCoords) return null;

  return (
    <iframe
      title={venue || 'Mapa'}
      src={`https://maps.google.com/maps?q=${latitude},${longitude}&hl=es&z=17&t=p&output=embed`}
      style={{ border: 0, width: '100%', height: '100%' }}
      allowFullScreen
    />
  );
}
