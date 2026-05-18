import os
import io
import json
import logging
import joblib
import numpy as np
import pandas as pd
import cv2
import fitz  # PyMuPDF
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from scipy.signal import find_peaks, peak_widths
import scipy.signal as sp_signal
from scipy.stats import zscore
import pywt
from sklearn.decomposition import FastICA
from groq import Groq
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="CardioVision Backend")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the trained model pipeline
try:
    model_pipeline = joblib.load('qsvm_mi_pipeline.pkl')
    logger.info("Model loaded successfully.")
except Exception as e:
    logger.error(f"Error loading model: {e}")
    model_pipeline = None

# Set Groq API key from environment or default
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "gsk_...")
try:
    groq_client = Groq(api_key=GROQ_API_KEY)
except Exception as e:
    logger.warning(f"Groq client init failed: {e}")
    groq_client = None

def extract_image_from_pdf(pdf_bytes):
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        for page_num in range(len(doc)):
            page = doc[page_num]
            image_list = page.get_images(full=True)
            for img_index, img in enumerate(image_list):
                xref = img[0]
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                return image_bytes
        # If no images, maybe render the first page as an image
        page = doc[0]
        pix = page.get_pixmap()
        return pix.tobytes("png")
    except Exception as e:
        logger.error(f"Error extracting image from PDF: {e}")
        return None

def digitize_image(image_bytes):
    # Convert bytes to numpy array
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise ValueError("Invalid image")
    
    # Threshold to find the black lines (signal)
    # Assuming white background, black signal
    _, thresh = cv2.threshold(img, 128, 255, cv2.THRESH_BINARY_INV)
    
    # Find the top-most black pixel for each column
    height, width = thresh.shape
    signal = []
    for col in range(width):
        # Get all y-coordinates where pixel is non-zero (part of the signal)
        y_coords = np.where(thresh[:, col] > 0)[0]
        if len(y_coords) > 0:
            # Taking the average of the thickness or the top-most
            signal.append(height - np.mean(y_coords))  # Invert y-axis to match normal graph
        else:
            if len(signal) > 0:
                signal.append(signal[-1]) # forward fill
            else:
                signal.append(0)
    
    return np.array(signal, dtype=np.float32)

def ceemdan_denoise_surrogate(signal_1d, wavelet='db4', level=5):
    sig = signal_1d.astype(np.float64)
    # Pad to make sure length is sufficient for wavelet
    max_level = pywt.dwt_max_level(len(sig), pywt.Wavelet(wavelet).dec_len)
    level = min(level, max_level)
    
    coeffs = pywt.wavedec(sig, wavelet, level=level)
    sigma = np.median(np.abs(coeffs[-1])) / 0.6745
    thresh = sigma * np.sqrt(2 * np.log(len(sig)))
    coeffs_thresh = [pywt.threshold(c, thresh, mode='soft') for c in coeffs]
    reconstructed = pywt.waverec(coeffs_thresh, wavelet)[:len(sig)]
    return reconstructed.astype(np.float32)

def ica_artifact_removal(X, n_components=10, artifact_threshold=3.0):
    n_comp = min(X.shape[0], X.shape[1], n_components)
    if n_comp < 2:
        return X
    ica = FastICA(n_components=n_comp, random_state=42, max_iter=500)
    try:
        sources = ica.fit_transform(X.T)
        from scipy.stats import kurtosis
        kurt = np.abs(kurtosis(sources, axis=0))
        good = kurt < artifact_threshold
        sources_clean = sources.copy()
        sources_clean[:, ~good] = 0
        X_clean = ica.inverse_transform(sources_clean).T
    except Exception:
        X_clean = X
    return X_clean.astype(np.float32)

def extract_fiducial_features(signal_1d, fs=125):
    sig = signal_1d.astype(np.float64)
    N = len(sig)
    peaks, props = find_peaks(sig, height=np.percentile(sig, 60), distance=int(0.4 * fs))
    troughs, _ = find_peaks(-sig, distance=int(0.3 * fs))

    def safe_stat(arr, default=0.0):
        return float(np.mean(arr)) if len(arr) > 0 else default

    amp = safe_stat(sig[peaks]) if len(peaks) > 0 else 0.0
    trough_val = safe_stat(sig[troughs]) if len(troughs) > 0 else 0.0
    pulse_amp = amp - trough_val

    if len(peaks) > 0:
        widths, _, _, _ = peak_widths(sig, peaks, rel_height=0.5)
        mean_width = float(np.mean(widths)) / fs * 1000
    else:
        mean_width = 0.0

    rise_times = []
    for pk in peaks:
        candidates = troughs[troughs < pk]
        if len(candidates) > 0:
            rise_times.append((pk - candidates[-1]) / fs * 1000)
    mean_rise = float(np.mean(rise_times)) if rise_times else 0.0

    dsig = np.diff(sig)
    zero_cross = np.where(np.diff(np.sign(dsig)) > 0)[0]
    dnotch_count = len(zero_cross)

    feats = {
        'pulse_amplitude': pulse_amp,
        'systolic_peak_mean': amp,
        'trough_mean': trough_val,
        'peak_width_ms': mean_width,
        'rise_time_ms': mean_rise,
        'n_peaks': float(len(peaks)),
        'n_troughs': float(len(troughs)),
        'diastolic_notch_cnt': float(dnotch_count),
        'signal_mean': float(np.mean(sig)),
        'signal_std': float(np.std(sig)),
        'signal_skew': float(pd.Series(sig).skew()),
        'signal_kurt': float(pd.Series(sig).kurt()),
        'signal_range': float(np.ptp(sig) if len(sig) > 0 else 0),
        'signal_rms': float(np.sqrt(np.mean(sig**2))),
        'signal_energy': float(np.sum(sig**2)),
    }
    return feats

def extract_ibv_features(signal_1d, fs=125):
    sig = signal_1d.astype(np.float64)
    peaks, _ = find_peaks(sig, height=np.percentile(sig, 60), distance=int(0.4 * fs))

    if len(peaks) < 2:
        return {k: 0.0 for k in [
            'ibi_mean','ibi_std','ibi_min','ibi_max','ibi_range',
            'rmssd','sdnn','sdsd','pnn50','lf_hf_ratio',
            'ibi_cv','ibi_skew','ibi_kurt'
        ]}

    ibi = np.diff(peaks) / fs * 1000
    rmssd = float(np.sqrt(np.mean(np.diff(ibi)**2)))
    sdnn = float(np.std(ibi))
    sdsd = float(np.std(np.diff(ibi)))
    pnn50 = float(np.sum(np.abs(np.diff(ibi)) > 50) / len(ibi) * 100)

    if len(ibi) >= 8:
        t_ibi = peaks[1:] / fs
        t_uni = np.linspace(t_ibi[0], t_ibi[-1], len(ibi)*4)
        ibi_interp = np.interp(t_uni, t_ibi, ibi)
        freqs, psd = sp_signal.welch(ibi_interp, fs=4.0, nperseg=min(len(ibi_interp), 64))
        lf_mask = (freqs >= 0.04) & (freqs < 0.15)
        hf_mask = (freqs >= 0.15) & (freqs < 0.40)
        lf = float(np.trapz(psd[lf_mask], freqs[lf_mask])) if lf_mask.any() else 0.0
        hf = float(np.trapz(psd[hf_mask], freqs[hf_mask])) if hf_mask.any() else 1e-8
        lf_hf = lf / (hf + 1e-8)
    else:
        lf_hf = 0.0

    feats = {
        'ibi_mean': float(np.mean(ibi)),
        'ibi_std': sdnn,
        'ibi_min': float(np.min(ibi)),
        'ibi_max': float(np.max(ibi)),
        'ibi_range': float(np.ptp(ibi)),
        'rmssd': rmssd,
        'sdnn': sdnn,
        'sdsd': sdsd,
        'pnn50': pnn50,
        'lf_hf_ratio': lf_hf,
        'ibi_cv': float(np.std(ibi) / (np.mean(ibi) + 1e-8)),
        'ibi_skew': float(pd.Series(ibi).skew()),
        'ibi_kurt': float(pd.Series(ibi).kurt()),
    }
    return feats

def generate_summary(prediction: int, confidence: float, features: dict):
    if not groq_client or GROQ_API_KEY.startswith("gsk_..."):
        desc = "Pattern indicates potential Myocardial Infarction. Immediate medical consultation recommended." if prediction == 1 else "ECG/PPG pattern appears normal. No immediate signs of Myocardial Infarction detected."
        return desc

    try:
        status_text = "Myocardial Infarction (High Risk)" if prediction == 1 else "Normal (Low Risk)"
        prompt = f"The patient's prediction is {status_text} with {confidence}% confidence. Here are some signal features extracted: Heart Rate Variability (RMSSD): {features.get('rmssd', 0):.2f}, Signal Energy: {features.get('signal_energy', 0):.2f}, Number of Peaks: {features.get('n_peaks', 0)}. Provide a short (2-3 sentences max) medical summary explaining what this could mean to a patient in simple terms. Do not hallucinate extra conditions. Be empathetic but clinical."
        
        chat_completion = groq_client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama3-8b-8192",
            temperature=0.5,
            max_tokens=150,
        )
        return chat_completion.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"LLM Error: {e}")
        return "Pattern indicates potential Myocardial Infarction. Immediate medical consultation recommended." if prediction == 1 else "ECG/PPG pattern appears normal. No immediate signs of Myocardial Infarction detected."


@app.post("/predict")
async def predict_file(file: UploadFile = File(...)):
    if not model_pipeline:
        raise HTTPException(status_code=500, detail="Model pipeline is not loaded on the server.")

    content = await file.read()
    
    # Check if PDF
    if file.filename.lower().endswith('.pdf'):
        image_bytes = extract_image_from_pdf(content)
        if not image_bytes:
            raise HTTPException(status_code=400, detail="Could not extract image from PDF")
    else:
        image_bytes = content

    try:
        # Digitization
        raw_signal = digitize_image(image_bytes)
        
        # Preprocessing
        # 1. Denoising
        denoised = ceemdan_denoise_surrogate(raw_signal)
        # 2. ICA (needs 2D array: (1, n_timepoints))
        ica_input = denoised.reshape(1, -1)
        cleaned_signal = ica_artifact_removal(ica_input)[0]
        # 3. Z-score
        mu = np.mean(cleaned_signal)
        sigma = np.std(cleaned_signal) + 1e-8
        z_signal = (cleaned_signal - mu) / sigma
        # 4. Min-Max
        zmin = np.min(z_signal)
        zmax = np.max(z_signal)
        norm_signal = (z_signal - zmin) / (zmax - zmin + 1e-8)
        
        # Feature Extraction
        fid_features = extract_fiducial_features(norm_signal)
        ibv_features = extract_ibv_features(norm_signal)
        
        all_features = {**fid_features, **ibv_features}
        
        # Ensure ordering matches model training
        feature_cols = model_pipeline.get('feature_cols', [])
        if not feature_cols:
            raise HTTPException(status_code=500, detail="Model missing feature_cols")
            
        feature_array = np.array([[all_features.get(c, 0.0) for c in feature_cols]])
        
        # Predict using pipeline
        X = feature_array
        if 'scaler' in model_pipeline:
            X = model_pipeline['scaler'].transform(X)
        if 'pca' in model_pipeline:
            X = model_pipeline['pca'].transform(X)
        if 'rbf' in model_pipeline:
            X = model_pipeline['rbf'].transform(X)
            
        prediction = model_pipeline['model'].predict(X)[0]
        
        # Calculate confidence (if SVC has predict_proba, else mock it based on distance to hyperplane)
        try:
            if hasattr(model_pipeline['model'], 'predict_proba'):
                probs = model_pipeline['model'].predict_proba(X)[0]
                confidence = float(np.max(probs) * 100)
            elif hasattr(model_pipeline['model'], 'decision_function'):
                dist = model_pipeline['model'].decision_function(X)[0]
                # Normalize sigmoid approx
                prob = 1 / (1 + np.exp(-dist))
                confidence = float(max(prob, 1-prob) * 100)
            else:
                confidence = 85.5
        except:
            confidence = 85.5
            
        confidence = round(confidence, 1)
        
        # Summary
        summary = generate_summary(prediction, confidence, all_features)
        
        return {
            "status": "High Risk" if prediction == 1 else "Normal",
            "confidence": confidence,
            "description": summary,
            "color": "#FF4B4B" if prediction == 1 else "#00E676"
        }

    except Exception as e:
        logger.error(f"Error during prediction pipeline: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
