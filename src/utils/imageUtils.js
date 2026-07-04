import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';

export async function downloadImage(imageUrl) {
  try {
    if (!imageUrl) return;
    const ext = imageUrl.split('.').pop()?.split('?')[0] || 'jpg';
    const filename = `imagen_${Date.now()}.${ext}`;
    const fileUri = FileSystem.documentDirectory + filename;
    const { uri } = await FileSystem.downloadAsync(imageUrl, fileUri);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: ext === 'png' ? 'image/png' : 'image/jpeg',
        dialogTitle: 'Guardar imagen',
      });
    } else {
      Alert.alert('Descargada', `Imagen guardada en: ${uri}`);
    }
  } catch (error) {
    console.warn('[downloadImage] Error:', error);
    Alert.alert('Error', 'No se pudo descargar la imagen');
  }
}
