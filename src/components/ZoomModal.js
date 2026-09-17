import React from 'react';
import { View, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { downloadImage } from '../utils/imageUtils';
import ZoomableImage from './ZoomableImage';

export default function ZoomModal({ uri, visible, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <MaterialIcons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.downloadBtn} onPress={() => downloadImage(uri)} activeOpacity={0.7}>
            <MaterialIcons name="file-download" size={24} color="#fff" />
          </TouchableOpacity>
          <ZoomableImage uri={uri} />
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  downloadBtn: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    padding: 8,
  },
});
