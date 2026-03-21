# EchoSense Backend

This is the Python Flask backend for EchoSense. It handles local speech-to-text (using Faster-Whisper), text cleanup, and local text translation (using NLLB-200).

## Tech Stack
- **Flask** for the REST API
- **Faster-Whisper** for offline English transcription of multi-lingual speech
- **google/flan-t5-base** for offline semantic reconstruction and grammatical structuring of raw STT text
- **facebook/nllb-200-distilled-600M** for fully offline high-quality conversational translation to Indian languages.

## Setup
1. Ensure you have Python >= 3.9 installed.
2. Activate the virtual environment:
   ```bash
   .\venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Running the Server
Start the server using:
```bash
python app.py
```
*Note: The first time you run the server, it will download the Whisper and MarianMT model weights.*

## API Endpoints

### 1. `/transcribe` (POST)
Upload an audio file `.wav` or `.m4a` to be transcribed.
- **Request form-data**: `audio`: File
- **Returns**: `{"text": "Transcribed text"}`

### 2. `/process` (POST)
Clean and (optionally) translate English text to a supported Indic language.
- **Request Body (JSON)**:
  ```json
  {
      "text": "Hello uh how are you actually I was telling like we should go tomorrow no?",
      "target_lang": "kn"
  }
  ```
  *Supported target_lang codes: `kn`, `ml`, `ta`, `te`, `hi`.*
  *(Omit `target_lang` to get just the cleaned English text)*
- **Returns**: 
  ```json
  {
      "cleaned_text": "Hello, how are you? I was telling, we should go tomorrow no?",
      "translated_text": "ಹಲೋ, ನೀವು ಹೇಗಿದ್ದೀರಿ? ನಾವು ನಾಳೆ ಹೋಗಬೇಕು ಎಂದು ನಾನು ಹೇಳುತ್ತಿದ್ದೆ."
  }
  ```

### Testing the Process Endpoint
You can test the endpoint using `curl.exe` (if using PowerShell) or `curl`:
```bash
curl.exe -X POST http://localhost:5000/process -H "Content-Type: application/json" -d "{\\"text\\": \\"Hello uh how are you actually I was telling like we should go tomorrow no?\\", \\"target_lang\\": \\"hi\\"}"
```
