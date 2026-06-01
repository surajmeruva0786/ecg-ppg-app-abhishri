import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet, Text, View, TouchableOpacity, Image, ActivityIndicator,
  SafeAreaView, Dimensions, ScrollView, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Camera, UploadCloud, HeartPulse, ChevronLeft, AlertCircle, CheckCircle } from 'lucide-react-native';

const { width } = Dimensions.get('window');
const BACKEND_URL = 'https://ecg-ppg-app-abhishri.onrender.com/predict';

export default function App() {
  const [image, setImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [prediction, setPrediction] = useState(null);

  const processImage = async (uri) => {
    setImage(uri);
    setIsProcessing(true);
    setPrediction(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    try {
      const formData = new FormData();
      formData.append('file', {
        uri: uri,
        name: 'upload.jpg',
        type: 'image/jpeg',
      });

      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        body: formData,
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const statusCode = response.status;
        let detail = '';
        try { detail = (await response.json()).detail || ''; } catch (_) {}
        throw new Error(`SERVER_ERROR:${statusCode}:${detail}`);
      }

      const result = await response.json();
      setPrediction({
        status: result.status,
        confidence: result.confidence.toString(),
        description: result.description,
        color: result.color,
        isError: false,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Error in processImage:', error);

      let msg = '';

      if (error.name === 'AbortError') {
        msg = 'Request timed out (90s). The server may be waking up — please try again in 30 seconds.';
      } else if (error.message.startsWith('SERVER_ERROR:')) {
        const parts = error.message.split(':');
        const code = parts[1];
        const detail = parts.slice(2).join(':');
        msg = `Server error ${code}${detail ? ': ' + detail : ''}`;
      } else if (error.message === 'Network request failed' || error.message.includes('Network')) {
        msg = 'Cannot reach server. Check your internet connection and try again.';
      } else {
        msg = error.message;
      }

      setPrediction({
        status: 'Error',
        confidence: 'N/A',
        description: msg,
        color: '#FF4B4B',
        isError: true,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });
    if (!result.canceled) processImage(result.assets[0].uri);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Media library permission is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });
    if (!result.canceled) processImage(result.assets[0].uri);
  };

  const resetState = () => {
    setImage(null);
    setPrediction(null);
    setIsProcessing(false);
  };

  return (
    <LinearGradient colors={['#0F172A', '#1E1B4B', '#0F172A']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          {image && !isProcessing && (
            <TouchableOpacity style={styles.backButton} onPress={resetState}>
              <ChevronLeft color="#FFF" size={24} />
            </TouchableOpacity>
          )}
          <View style={styles.headerTitleContainer}>
            <HeartPulse color="#FF4B4B" size={28} />
            <Text style={styles.headerTitle}>CardioVision</Text>
          </View>
        </View>

        {!image ? (
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <HeartPulse color="#6366F1" size={80} strokeWidth={1} />
            </View>
            <Text style={styles.title}>Analyze ECG & PPG</Text>
            <Text style={styles.subtitle}>
              Upload or capture a signal image to instantly detect potential Myocardial Infarction.
            </Text>

            <View style={styles.buttonContainer}>
              <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={takePhoto}>
                <Camera color="#FFF" size={24} style={styles.buttonIcon} />
                <Text style={styles.buttonText}>Take a Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={pickImage}>
                <UploadCloud color="#FFF" size={24} style={styles.buttonIcon} />
                <Text style={styles.buttonText}>Upload Image</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <ScrollView style={styles.resultContainer} showsVerticalScrollIndicator={false}>
            <View style={styles.imageCard}>
              <Image source={{ uri: image }} style={styles.previewImage} resizeMode="cover" />
              {isProcessing && (
                <View style={styles.processingOverlay}>
                  <ActivityIndicator size="large" color="#6366F1" />
                  <Text style={styles.processingText}>Analyzing Signal Patterns...</Text>
                </View>
              )}
            </View>

            {prediction && (
              <View style={styles.predictionCard}>
                <View style={styles.predictionHeader}>
                  {prediction.status === 'Normal' ? (
                    <CheckCircle color={prediction.color} size={32} />
                  ) : (
                    <AlertCircle color={prediction.color} size={32} />
                  )}
                  <View style={styles.predictionTitleContainer}>
                    <Text style={styles.predictionLabel}>Prediction Result</Text>
                    <Text style={[styles.predictionStatus, { color: prediction.color }]}>
                      {prediction.status}
                    </Text>
                  </View>
                  {prediction.status !== 'Error' && (
                    <View style={styles.confidenceBadge}>
                      <Text style={styles.confidenceText}>{prediction.confidence}%</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.predictionDescription}>{prediction.description}</Text>

                <TouchableOpacity style={[styles.button, styles.outlineButton]} onPress={resetState}>
                  <Text style={styles.outlineButtonText}>Analyze Another Signal</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      <StatusBar style="light" />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: 50 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 20,
    zIndex: 10,
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  title: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  buttonContainer: { width: '100%', gap: 16 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    width: '100%',
  },
  primaryButton: {
    backgroundColor: '#6366F1',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  buttonIcon: { marginRight: 12 },
  buttonText: { color: '#FFF', fontSize: 18, fontWeight: '600' },
  resultContainer: { flex: 1, paddingHorizontal: 20, paddingTop: 10 },
  imageCard: {
    width: '100%',
    height: width * 0.7,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  previewImage: { width: '100%', height: '100%' },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: '#FFF',
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  predictionCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 32,
  },
  predictionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  predictionTitleContainer: { flex: 1, marginLeft: 16 },
  predictionLabel: { color: '#94A3B8', fontSize: 14, fontWeight: '500', marginBottom: 4 },
  predictionStatus: { fontSize: 22, fontWeight: '800' },
  confidenceBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  confidenceText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  predictionDescription: {
    color: '#CBD5E1',
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 24,
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.5)',
    backgroundColor: 'transparent',
    paddingVertical: 16,
  },
  outlineButtonText: { color: '#818CF8', fontSize: 16, fontWeight: '600' },
});
