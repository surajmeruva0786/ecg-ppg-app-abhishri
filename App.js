import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet, Text, View, TouchableOpacity, Image, ActivityIndicator,
  SafeAreaView, Dimensions, Modal, TextInput, KeyboardAvoidingView,
  Platform, ScrollView, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Camera, UploadCloud, HeartPulse, ChevronLeft, AlertCircle, CheckCircle, Settings } from 'lucide-react-native';

const { width } = Dimensions.get('window');
const STORAGE_KEY = '@cardiovision_backend_url';

export default function App() {
  const [image, setImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [backendUrl, setBackendUrl] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [isLoadingUrl, setIsLoadingUrl] = useState(true);

  useEffect(() => {
    loadSavedUrl();
  }, []);

  const loadSavedUrl = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        setBackendUrl(saved);
        setUrlInput(saved);
      } else {
        // No URL saved — open settings immediately on first launch
        setShowSettings(true);
      }
    } catch (e) {
      setShowSettings(true);
    } finally {
      setIsLoadingUrl(false);
    }
  };

  const saveUrl = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      Alert.alert('Invalid URL', 'Please enter the backend server URL.');
      return;
    }
    // Normalize: ensure it ends with /predict
    let url = trimmed;
    if (!url.endsWith('/predict')) {
      url = url.replace(/\/$/, '') + '/predict';
    }
    try {
      await AsyncStorage.setItem(STORAGE_KEY, url);
      setBackendUrl(url);
      setUrlInput(url);
      setShowSettings(false);
    } catch (e) {
      Alert.alert('Error', 'Could not save URL. Please try again.');
    }
  };

  const processImage = async (uri) => {
    if (!backendUrl) {
      setShowSettings(true);
      return;
    }

    setImage(uri);
    setIsProcessing(true);
    setPrediction(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s timeout

    try {
      const formData = new FormData();
      formData.append('file', {
        uri: uri,
        name: 'upload.jpg',
        type: 'image/jpeg',
      });

      const response = await fetch(backendUrl, {
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
      let showSettingsHint = false;

      if (error.name === 'AbortError') {
        msg = 'Request timed out (90s). Server may be overloaded or unreachable.';
        showSettingsHint = true;
      } else if (error.message.startsWith('SERVER_ERROR:')) {
        const parts = error.message.split(':');
        const code = parts[1];
        const detail = parts.slice(2).join(':');
        if (code === '503' || code === '502') {
          msg = `Server unavailable (${code}). The tunnel may have expired. Open Settings and update the URL.`;
          showSettingsHint = true;
        } else {
          msg = `Server error ${code}${detail ? ': ' + detail : ''}`;
        }
      } else if (
        error.message === 'Network request failed' ||
        error.message.includes('Network')
      ) {
        msg = 'Cannot reach server. Check that:\n• Python server is running\n• Tunnel is active\n• URL in Settings is correct';
        showSettingsHint = true;
      } else {
        msg = error.message;
      }

      setPrediction({
        status: 'Error',
        confidence: 'N/A',
        description: msg,
        color: '#FF4B4B',
        isError: true,
        showSettingsHint,
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

  if (isLoadingUrl) {
    return (
      <LinearGradient colors={['#0F172A', '#1E1B4B', '#0F172A']} style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      </LinearGradient>
    );
  }

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
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => { setUrlInput(backendUrl); setShowSettings(true); }}
          >
            <Settings color="#94A3B8" size={22} />
          </TouchableOpacity>
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

            {!backendUrl && (
              <TouchableOpacity
                style={styles.warningBanner}
                onPress={() => setShowSettings(true)}
              >
                <AlertCircle color="#FBBF24" size={18} />
                <Text style={styles.warningText}>Server URL not set — tap to configure</Text>
              </TouchableOpacity>
            )}

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
          <View style={styles.resultContainer}>
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

                {prediction.showSettingsHint && (
                  <TouchableOpacity
                    style={[styles.button, styles.warningButton]}
                    onPress={() => { setUrlInput(backendUrl); setShowSettings(true); }}
                  >
                    <Settings color="#FBBF24" size={18} style={styles.buttonIcon} />
                    <Text style={styles.warningButtonText}>Update Server URL</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={[styles.button, styles.outlineButton]} onPress={resetState}>
                  <Text style={styles.outlineButtonText}>Analyze Another Signal</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </SafeAreaView>

      {/* Settings Modal */}
      <Modal visible={showSettings} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Settings color="#6366F1" size={24} />
              <Text style={styles.modalTitle}>Server Configuration</Text>
            </View>

            <Text style={styles.modalLabel}>Backend URL</Text>
            <Text style={styles.modalHint}>
              Enter the full server address including port.{'\n'}
              Example: {'\n'}
              • Tunnel: https://abc123.lhr.life{'\n'}
              • Local network: http://192.168.1.5:8000{'\n'}
              The /predict path is added automatically.
            </Text>

            <TextInput
              style={styles.urlInput}
              value={urlInput}
              onChangeText={setUrlInput}
              placeholder="https://your-tunnel.lhr.life"
              placeholderTextColor="#475569"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />

            <View style={styles.modalButtons}>
              {backendUrl ? (
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => setShowSettings(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={[styles.button, styles.primaryButton, backendUrl ? { flex: 1 } : {}]}
                onPress={saveUrl}
              >
                <Text style={styles.buttonText}>Save & Connect</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
  settingsButton: {
    position: 'absolute',
    right: 20,
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
    marginBottom: 24,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 24,
  },
  warningText: {
    color: '#FBBF24',
    fontSize: 14,
    fontWeight: '500',
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
  warningButton: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.4)',
    marginBottom: 12,
    paddingVertical: 14,
  },
  warningButtonText: {
    color: '#FBBF24',
    fontSize: 16,
    fontWeight: '600',
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalCard: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  modalTitle: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  modalLabel: { color: '#94A3B8', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  modalHint: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 12,
    borderRadius: 12,
  },
  urlInput: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.4)',
    borderRadius: 14,
    padding: 16,
    color: '#FFF',
    fontSize: 15,
    marginBottom: 20,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  modalButtons: { flexDirection: 'row', gap: 12 },
  cancelButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 16,
  },
  cancelButtonText: { color: '#94A3B8', fontSize: 16, fontWeight: '600' },
});
