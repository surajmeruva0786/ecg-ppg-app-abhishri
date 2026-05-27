# CardioVision — User Manual

**Version 1.0 | ECG & PPG Myocardial Infarction Detection App**

---

## Table of Contents

1. [What is CardioVision?](#1-what-is-cardiovision)
2. [How It Works](#2-how-it-works)
3. [Before You Begin — Prerequisites](#3-before-you-begin--prerequisites)
4. [Getting the Code](#4-getting-the-code)
5. [Setting Up the Backend Server](#5-setting-up-the-backend-server)
6. [Setting Up the Mobile App](#6-setting-up-the-mobile-app)
7. [Connecting the App to the Server](#7-connecting-the-app-to-the-server)
8. [Using the App — Step by Step](#8-using-the-app--step-by-step)
9. [Understanding Your Results](#9-understanding-your-results)
10. [Testing on a Real Phone](#10-testing-on-a-real-phone)
11. [Troubleshooting](#11-troubleshooting)
12. [Frequently Asked Questions](#12-frequently-asked-questions)
13. [Important Medical Disclaimer](#13-important-medical-disclaimer)

---

## 1. What is CardioVision?

CardioVision is a mobile application that analyzes **ECG (Electrocardiogram)** and **PPG (Photoplethysmogram)** signal images to screen for signs of **Myocardial Infarction (MI)** — commonly known as a heart attack.

You take a photo or upload an image of a cardiac signal printout, and the app:
- Processes the image to extract the signal waveform
- Runs it through a trained machine learning model
- Returns a result: **Normal** or **High Risk**
- Provides a confidence percentage and an AI-generated medical explanation

> **This app is intended for educational and research purposes. It is NOT a substitute for professional medical diagnosis. Always consult a licensed cardiologist for medical decisions.**

---

## 2. How It Works

```
Your Image  →  Backend Server  →  Signal Processing  →  ML Model  →  Result + AI Explanation
```

1. You capture or upload an ECG/PPG image from the mobile app.
2. The image is sent to a Python backend server running on your machine (or a server you host).
3. The server digitizes the waveform from the image, cleans it, and extracts 28 clinical features.
4. A trained **Quantum SVM (QSVM)** model predicts whether the signal pattern indicates **Normal** cardiac activity or **High Risk** (potential MI).
5. A Groq LLM generates a plain-English medical explanation of the result.
6. The app displays the result with color-coded feedback and the explanation.

---

## 3. Before You Begin — Prerequisites

You need to install the following software before setting up the project.

### On Your Computer (for the Backend Server)

| Software | Version | Download |
|----------|---------|----------|
| Python | 3.9 or newer | https://www.python.org/downloads/ |
| pip | (comes with Python) | — |
| Git | Any recent version | https://git-scm.com/downloads |

**To verify Python is installed**, open a terminal and run:
```
python --version
```
You should see something like `Python 3.11.4`.

### On Your Computer (for the Mobile App Development)

| Software | Version | Download |
|----------|---------|----------|
| Node.js | 18 or newer (LTS recommended) | https://nodejs.org/ |
| npm | (comes with Node.js) | — |

**To verify Node.js is installed**, open a terminal and run:
```
node --version
npm --version
```

### On Your Phone (to run the app)

- **Android phone:** Install the **Expo Go** app from the [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)
- **iPhone:** Install the **Expo Go** app from the [App Store](https://apps.apple.com/app/expo-go/id982107779)

> **Your phone and computer must be on the same Wi-Fi network** for local testing to work.

---

## 4. Getting the Code

### Step 1 — Clone the Repository

Open a terminal (Command Prompt, PowerShell, or Terminal) and run:

```bash
git clone https://github.com/surajmeruva0786/ecg-ppg-app-abhishri.git
```

### Step 2 — Enter the Project Folder

```bash
cd ecg-ppg-app-abhishri
```

You should now see files like `App.js`, `server.py`, `package.json`, and `qsvm_mi_pipeline.pkl` in your directory.

---

## 5. Setting Up the Backend Server

The backend is a Python server that does all the heavy lifting — image processing, signal analysis, and ML prediction.

### Step 1 — Install Python Dependencies

In your terminal (inside the project folder), run:

```bash
pip install fastapi uvicorn opencv-python numpy scipy pandas scikit-learn PyWavelets joblib pydantic PyMuPDF groq python-dotenv
```

This may take a few minutes. All these packages are needed for signal processing and running the ML model.

> **Tip:** If you have multiple Python versions installed, you may need to use `pip3` instead of `pip`.

### Step 2 — Set Up Your Groq API Key

The app uses Groq's AI to generate the medical explanation text. You need a free API key.

1. Go to [https://console.groq.com](https://console.groq.com) and create a free account.
2. Generate an API key from your dashboard.
3. In the project folder, create a file named **`.env`** (note the dot at the start).
4. Add this line to the file, replacing the placeholder with your actual key:

```
GROQ_API_KEY=your_groq_api_key_here
```

**Example:**
```
GROQ_API_KEY=gsk_abc123def456...
```

> **No Groq key?** The app still works — it will show a default medical explanation instead of an AI-generated one. You can skip this step and come back to it later.

### Step 3 — Verify the ML Model File is Present

The trained model file `qsvm_mi_pipeline.pkl` must be in the project root. If you cloned the repository correctly, it should already be there.

Check with:
```bash
# Windows
dir qsvm_mi_pipeline.pkl

# Mac/Linux
ls qsvm_mi_pipeline.pkl
```

You should see the file listed (it is about 438 KB).

### Step 4 — Start the Backend Server

Run:

```bash
python server.py
```

You should see output similar to:

```
INFO:     Started server process [12345]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

**The server is now running on port 8000.** Keep this terminal open — the server must stay running while you use the app.

> **To stop the server**, press `Ctrl + C` in the terminal.

---

## 6. Setting Up the Mobile App

Open a **second terminal** window (keep the first one running the server).

### Step 1 — Install Node.js Dependencies

```bash
cd ecg-ppg-app-abhishri
npm install
```

This downloads all the mobile app's JavaScript libraries. It may take a minute or two.

### Step 2 — Start the Expo Development Server

```bash
npm start
```

You will see output like:

```
Starting project at /path/to/ecg-ppg-app-abhishri

› Metro waiting on exp://192.168.1.5:8081
› Scan the QR code above with Expo Go (Android) or the Camera app (iOS)

› Press a │ open Android
› Press i │ open iOS simulator
› Press w │ open web

› Press r │ reload app
› Press m │ toggle menu
```

A **QR code** will appear in the terminal.

### Step 3 — Open the App on Your Phone

**On Android:**
1. Open the **Expo Go** app on your phone.
2. Tap **"Scan QR Code"**.
3. Point your camera at the QR code in the terminal.
4. The app will load on your phone in a few seconds.

**On iPhone:**
1. Open the default **Camera** app (not Expo Go directly).
2. Point your camera at the QR code.
3. Tap the banner that appears at the top of the screen.
4. The app will open in Expo Go automatically.

> **Tip:** If the QR code scan doesn't work, make sure your phone and computer are on the same Wi-Fi network.

---

## 7. Connecting the App to the Server

The first time you open CardioVision, a **Settings screen** will appear asking for the backend server URL. This tells the app where your Python server is running.

### Finding Your Computer's IP Address

You need to find the local IP address of the computer running `server.py`.

**On Windows:**
```bash
ipconfig
```
Look for **IPv4 Address** under your Wi-Fi adapter. It looks like `192.168.x.x`.

**On Mac:**
```bash
ifconfig | grep "inet "
```
Look for an address starting with `192.168.` or `10.`.

**On Linux:**
```bash
ip addr show
```

### Entering the Server URL in the App

In the Settings screen that appears on first launch:

1. Type your server URL in the input field.
2. Use the format: `http://YOUR_IP_ADDRESS:8000`

   **Example:** `http://192.168.1.5:8000`

3. Tap **"Save & Connect"**.

The app saves this URL and will use it for all future analyses.

> **Note:** Do not add `/predict` at the end — the app handles that automatically.

### Changing the Server URL Later

If you need to update the URL (e.g., your IP address changed):

1. Tap the **settings icon** (gear icon) in the top-right corner of the home screen.
2. Update the URL in the input field.
3. Tap **"Save & Connect"**.

---

## 8. Using the App — Step by Step

### The Home Screen

When you open the app, you will see:

- The **CardioVision** title at the top
- A **heart pulse icon** in the center
- Two buttons:
  - **Take a Photo** — opens your phone's camera
  - **Upload Image** — opens your phone's photo gallery
- A settings icon in the top-right corner

> **If you see a yellow warning banner** saying the backend URL is not configured, tap it or go to Settings to set up the server URL first.

---

### Option A: Capture a New Image with Your Camera

1. Tap **"Take a Photo"**.
2. The app will ask for camera permission — tap **Allow**.
3. Point your camera at an ECG or PPG signal printout or screen display.
4. Capture the image.

**Tips for a good photo:**
- Hold the camera steady to avoid blur.
- Ensure good, even lighting — no harsh shadows or glare.
- Fill the frame with the signal graph as much as possible.
- Make sure the waveform lines are clearly visible.

---

### Option B: Upload an Existing Image from Your Gallery

1. Tap **"Upload Image"**.
2. The app will ask for photo library permission — tap **Allow**.
3. Browse your photos and select an ECG or PPG image.
4. The image will be loaded into the app.

**Supported image types:** JPEG, PNG, and PDF files.

---

### Viewing the Analysis

After selecting your image:

1. The **Analysis screen** opens, showing a preview of your image.
2. A **"Analyzing Signal Patterns..."** spinner appears while the server processes the image.
3. This typically takes **5 to 30 seconds** depending on your network and server speed.
4. Once complete, the result is displayed below the image preview.

---

### Analyzing Another Signal

After viewing a result, tap the **"Analyze Another Signal"** button at the bottom to return to the home screen and start over.

---

## 9. Understanding Your Results

### Result: Normal

```
Status:     Normal
Confidence: e.g., 91.3%
Color:      Green
```

The machine learning model found that the signal patterns in the image are consistent with **normal cardiac activity**. No indicators of Myocardial Infarction were detected.

### Result: High Risk

```
Status:     High Risk
Confidence: e.g., 87.6%
Color:      Red
```

The model detected signal patterns that are **associated with Myocardial Infarction (heart attack)**. This does not mean a heart attack is definitively occurring — it means the pattern warrants further medical attention.

### Confidence Percentage

This number tells you how certain the model is about its prediction.

| Confidence | What it means |
|------------|---------------|
| 90% – 100% | Very high certainty |
| 75% – 89%  | High certainty |
| 60% – 74%  | Moderate certainty |
| Below 60%  | Lower certainty — image quality may be affecting results |

### AI Medical Explanation

Below the confidence score, you will see a plain-English explanation generated by an AI assistant. This text explains what patterns were likely detected and what they may indicate clinically.

> **Remember:** This explanation is AI-generated and is for educational reference only. It is not a medical diagnosis.

---

## 10. Testing on a Real Phone

### Using a Tunnel (for testing when server and phone are on different networks)

If your phone cannot reach your computer directly (e.g., different networks, VPN), you can expose the server via a tunnel.

1. Install `cloudflared` or use `ngrok`:

   **Using ngrok:**
   - Download from https://ngrok.com/download
   - Run: `ngrok http 8000`
   - Copy the `https://xxxx.ngrok.io` URL shown

2. In the CardioVision app settings, enter the tunnel URL:
   ```
   https://xxxx.ngrok.io
   ```

3. The app will route requests through the tunnel to your local server.

### Running on an Android Emulator

If you have Android Studio installed with an emulator:

```bash
npm run android
```

The app will build and launch in the emulator automatically. Use `http://10.0.2.2:8000` as the server URL (the emulator's alias for localhost).

### Running on an iOS Simulator (Mac only)

```bash
npm run ios
```

Use `http://localhost:8000` as the server URL in the simulator.

---

## 11. Troubleshooting

### "Backend URL not configured" warning

**Cause:** The app has not been given a server URL yet.

**Fix:** Tap the settings icon (top-right corner) and enter your server URL in the format `http://YOUR_IP:8000`.

---

### "Unable to connect to server" error

**Possible causes and fixes:**

| Cause | Fix |
|-------|-----|
| Server not running | Open a terminal and run `python server.py` |
| Wrong IP address in settings | Run `ipconfig` (Windows) or `ifconfig` (Mac) to find your current IP |
| Phone on different Wi-Fi | Connect both phone and computer to the same Wi-Fi network |
| Firewall blocking port 8000 | Allow port 8000 through your firewall settings |

---

### "Request timed out" error

**Cause:** The server took longer than 90 seconds to respond.

**Possible fixes:**
- Try a clearer, higher-contrast image of the signal.
- Ensure the server computer is not overloaded.
- Restart the server with `python server.py`.

---

### App shows a blank/white screen

**Fix:** Shake your phone to open the Expo developer menu, then tap "Reload". Alternatively, press `r` in the terminal where `npm start` is running.

---

### QR code won't scan / app won't load on phone

**Possible fixes:**
- Make sure your phone and computer are on **the same Wi-Fi network**.
- Try pressing `tunnel` in the Expo terminal (press `t`) to get a tunnel URL instead.
- Manually enter the URL shown in the terminal into the Expo Go app.

---

### "Module not found" error when starting the server

**Fix:** One or more Python packages may not be installed. Re-run:
```bash
pip install fastapi uvicorn opencv-python numpy scipy pandas scikit-learn PyWavelets joblib pydantic PyMuPDF groq python-dotenv
```

---

### Server starts but no result / empty response

**Possible causes:**
- The uploaded image does not contain a clear ECG/PPG signal.
- The GROQ_API_KEY in `.env` is missing or invalid (only affects the description text, not the prediction itself).

**Fix:** Try with a clearer image. Ensure the `.env` file is in the project root and the API key is valid.

---

### pip not found / Python not recognized

**Fix:** Ensure Python is added to your system PATH during installation. Re-install Python from https://www.python.org/downloads/ and check **"Add Python to PATH"** during setup.

---

## 12. Frequently Asked Questions

**Q: Does the app work offline?**

No. The app requires a connection to the backend Python server to process images and return results. The server must be running on a reachable machine.

---

**Q: Can I use any ECG or PPG image?**

The model was trained on standard ECG and PPG signal datasets. Best results come from clear, high-contrast images of signal waveforms — like printouts or screenshots from medical monitors. Blurry, low-light, or heavily cropped images will give less reliable results.

---

**Q: What does "QSVM" mean?**

QSVM stands for Quantum Support Vector Machine. It is a machine learning classifier that uses quantum-inspired kernel transformations (specifically RBF kernels with PCA dimensionality reduction) to classify cardiac signal patterns as Normal or High Risk.

---

**Q: Is my medical data stored anywhere?**

No. Images are sent to the backend server only for processing and are not saved to disk. The server processes the image in memory and returns only the prediction result. No data is transmitted to any third-party service except for the text description, which is generated by Groq's API.

---

**Q: The confidence is low (below 60%). What should I do?**

A low confidence score usually means the image quality was not ideal for the model. Try:
- Re-capturing the image with better lighting
- Ensuring the full signal trace is visible and in focus
- Using a higher-resolution image

---

**Q: Can I retrain the model with my own data?**

Yes. The Jupyter notebook `NIT_Raipur_MI_Detection.ipynb` in the repository contains the full training pipeline. You can modify the training data, retrain the model, and replace `qsvm_mi_pipeline.pkl` with the new model file.

---

**Q: The app crashes when I try to open it.**

Try the following:
1. Stop the Expo server (`Ctrl+C`) and restart it with `npm start`.
2. Clear the Expo cache: `npm start -- --clear`
3. Delete `node_modules` and reinstall: `rmdir /s /q node_modules && npm install` (Windows) or `rm -rf node_modules && npm install` (Mac/Linux).

---

## 13. Important Medical Disclaimer

> **CardioVision is a research and educational tool. It is NOT a certified medical device and should NOT be used to make clinical decisions.**
>
> - Results provided by this app have **not been validated in clinical settings**.
> - A "Normal" result does NOT rule out cardiac disease.
> - A "High Risk" result does NOT confirm a heart attack.
> - **Always seek immediate professional medical attention** if you suspect a cardiac emergency.
> - This software is provided as-is, without warranty of any kind.

---

*CardioVision | Developed at NIT Raipur | For research and educational use only*
