import os
import re
import subprocess
import time
import logging
import requests
import io
import base64
from PIL import Image
from flask import Flask, request, jsonify
from flask_cors import CORS
from faster_whisper import WhisperModel
from werkzeug.utils import secure_filename
import torch
from deep_translator import GoogleTranslator
import warnings
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from db import init_db, save_generation, save_keywords, get_recent_keywords, save_history, get_history, clear_history
from services.aiService import (
    init_ai_pipeline,
    generate_image_from_sketch,
    extract_keywords,
    check_ollama_health,
    process_text_with_mistral,
    increment_session_id,
)

warnings.filterwarnings("ignore")

# ── Logging ─────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("error.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Initialize DB and AI Models
init_db()
init_ai_pipeline()

UPLOAD_FOLDER = 'temp_audio'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Conversation Memory (Subject to 20-minute window)
# Format: {"timestamp": float, "text": str}
conversation_history = []

logger.info("Loading Faster-Whisper model (small) in float32...")
whisper_model = WhisperModel("small", device="cpu", compute_type="float32")
logger.info("Faster-Whisper model loaded successfully.")

# Visual Assist Keywords
SYMBOL_MAP = {
    "hello": "hello", "hi": "hello", "hey": "hello",
    "help": "help", "emergency": "help", "sos": "help",
    "hungry": "hungry", "hunger": "hungry", "food": "food", "eat": "eat",
    "thirsty": "thirsty", "thirst": "thirsty", "water": "water", "drink": "drink",
    "pain": "pain", "hurt": "pain", "aching": "pain", "ouch": "pain",
    "sick": "sick", "ill": "sick", "fever": "sick", "cold": "sick",
    "toilet": "toilet", "bathroom": "toilet", "washroom": "toilet", "pee": "toilet",
    "sleep": "sleep", "tired": "tired", "exhausted": "tired", "bed": "sleep",
    "doctor": "doctor", "nurse": "doctor", "medical": "doctor",
    "hospital": "hospital", "clinic": "hospital",
    "home": "home", "house": "home",
    "happy": "happy", "glad": "happy", "good": "happy",
    "sad": "sad", "unhappy": "sad", "bad": "sad", "cry": "sad",
    "angry": "angry", "mad": "angry", "furious": "angry",
    "body": "body", "come": "come", "comehere": "comehere", "go": "go",
    "head": "head", "how": "how", "i": "i", "medicine": "medicine",
    "scared": "scared", "afraid": "scared", "sit": "sit", "stomach": "stomach",
    "walk": "walk", "where": "where", "why": "why", "you": "you"
}

def extract_symbols(text):
    if not text: return []
    words = re.findall(r'\b\w+\b', text.lower())
    found = []
    seen = set()
    for word in words:
        if word in SYMBOL_MAP:
            symbol = SYMBOL_MAP[word]
            if symbol not in seen:
                found.append(symbol)
                seen.add(symbol)
    return found

def preprocess_audio(input_filepath, output_filepath):
    command = [
        "ffmpeg", "-y", "-i", input_filepath, "-ac", "1", "-ar", "16000", output_filepath
    ]
    subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def filter_history():
    """Keep only chats within the last 20 minutes."""
    global conversation_history
    now = time.time()
    conversation_history = [entry for entry in conversation_history if now - entry['timestamp'] < 1200]

# clean_transcript and translate_text have been removed. Mistral handles these entirely.


# ─────────────────────────────────────────────────────────────────────────────
# Routes — Existing
# ─────────────────────────────────────────────────────────────────────────────

@app.route('/transcribe', methods=['POST'])
def transcribe_audio():
    if 'audio' not in request.files:
        return jsonify({'text': '', 'error': 'No audio file found'}), 400
        
    file = request.files['audio']
    try:
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        processed_filepath = os.path.join(app.config['UPLOAD_FOLDER'], "processed_" + filename + ".wav")
        preprocess_audio(filepath, processed_filepath)
        
        segments, info = whisper_model.transcribe(
            processed_filepath,
            beam_size=5,
            task="translate"
        )
        
        text_parts = [s.text for s in segments]
        transcribed_text = " ".join(text_parts).strip()
        
        for f in [filepath, processed_filepath]:
            if os.path.exists(f): os.remove(f)
                
        return jsonify({'text': transcribed_text})
    except Exception as e:
        logger.error(f"[transcribe] Error: {e}", exc_info=True)
        return jsonify({'text': '', 'error': str(e)}), 500

@app.route('/api/translate', methods=['POST'])
def translate_api():
    data = request.json
    text = data.get('text', '')
    target_lang = data.get('target_lang')
    
    if not target_lang or target_lang.lower() in ["english", "en"]:
        return jsonify({"translated_text": text})
        
    try:
        logger.info(f"[translate] Translating to {target_lang} using GoogleTranslator...")
        translated_text = GoogleTranslator(source='en', target=target_lang).translate(text)
        return jsonify({"translated_text": translated_text})
    except Exception as e:
        logger.error(f"[translate] Translation failed: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/clear-history', methods=['POST'])
def clear_history_route():
    global conversation_history
    conversation_history = []
    return jsonify({"status": "cleared"})

@app.route('/api/cancel-session', methods=['POST'])
def cancel_session_route():
    new_id = increment_session_id()
    return jsonify({"status": "cancelled", "session_id": new_id})

# ── Conversation History ────────────────────────────────────────────────────

@app.route('/api/history', methods=['GET'])
def fetch_history():
    try:
        history = get_history()
        return jsonify({"history": history})
    except Exception as e:
        logger.error(f"[get_history] Error: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route('/api/history', methods=['POST'])
def add_history():
    data = request.json
    if not data or 'message' not in data:
        return jsonify({'error': 'Missing message'}), 400
        
    try:
        message_text = data['message']
        keywords = data.get('keywords', [])
        row_id = save_history(message_text, keywords)
        return jsonify({"status": "success", "id": row_id})
    except Exception as e:
        logger.error(f"[save_history] Error: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route('/api/history', methods=['DELETE'])
def remove_history():
    try:
        clear_history()
        return jsonify({"status": "cleared"})
    except Exception as e:
        logger.error(f"[clear_history] Error: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route('/api/generate-image', methods=['POST'])
def generate_image():
    data = request.json
    if not data or 'sketch_b64' not in data:
        return jsonify({'error': 'Missing sketch_b64 input'}), 400
        
    sketch_b64 = data['sketch_b64']
    user_prompt = data.get('prompt', '')
    
    try:
        output_b64 = generate_image_from_sketch(sketch_b64, user_prompt)
        save_generation(sketch_b64, output_b64, user_prompt)
        return jsonify({"image": output_b64})
    except RuntimeError as e:
        logger.error(f"[Segmind] Generation failed: {e}")
        return jsonify({"error": str(e)}), 502
    except Exception as e:
        logger.error(f"[generate-image] Unexpected error: {e}", exc_info=True)
        return jsonify({"error": f"Image generation failed: {str(e)}"}), 500


# ─────────────────────────────────────────────────────────────────────────────
# Routes — New (Ollama / Mistral & Qwen)
# ─────────────────────────────────────────────────────────────────────────────

@app.route('/api/recognize-canvas', methods=['POST'])
def recognize_canvas():
    data = request.json
    if not data or 'sketch_b64' not in data:
        return jsonify({'error': 'Missing sketch_b64 input'}), 400
        
    sketch_b64 = data['sketch_b64']
    
    # Strip data URI header if present
    if "," in sketch_b64:
        sketch_b64 = sketch_b64.split(",", 1)[1]
        
    try:
        # Decode and optimize image with PIL
        img_data = base64.b64decode(sketch_b64)
        image = Image.open(io.BytesIO(img_data))
        
        # Drop alpha channel and convert to RGB
        if image.mode in ("RGBA", "P"):
            image = image.convert("RGB")
            
        # Resize to max 384x384 while maintaining aspect ratio
        image.thumbnail((384, 384), Image.Resampling.LANCZOS)
        
        # Save as optimized JPEG
        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=85)
        optimized_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
        
    except Exception as e:
        logger.error(f"[recognize-canvas] Image optimization failed: {e}", exc_info=True)
        return jsonify({"error": f"Image processing failed: {str(e)}"}), 400

    ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
    
    prompt = "Identify the main object in this drawing. Return only a single English keyword from this list: hospital, bus, car, food, water, house, phone, person, toilet, medicine, school, help, family, doctor, emergency. If you are not sure, pick the closest one or just say 'unknown'."
    
    payload = {
        "model": "qwen2.5vl:3b",
        "prompt": prompt,
        "stream": False,
        "images": [optimized_b64]
    }
    
    try:
        # Increased timeout to 180 seconds for slower setups
        response = requests.post(f"{ollama_url}/api/generate", json=payload, timeout=180)
        if response.status_code != 200:
            return jsonify({'error': f'Ollama error: {response.text}'}), 502
            
        result = response.json()
        raw_keyword = result.get('response', '').strip().lower()
        
        # Clean up punctuation and pick the first word just in case
        clean_keyword = re.sub(r'[^a-z]', '', raw_keyword)
        
        if not clean_keyword or clean_keyword == "unknown":
            return jsonify({'error': 'Drawing not recognized. Please draw more clearly.'}), 404
            
        return jsonify({'keyword': clean_keyword})
        
    except Exception as e:
        logger.error(f"[recognize-canvas] Unexpected error: {e}", exc_info=True)
        return jsonify({"error": f"Recognition failed: {str(e)}"}), 500


@app.route('/api/extract-keywords', methods=['POST'])
def extract_keywords():
    data = request.json
    text = data.get('text', '')
    session_id = data.get('session_id', 0)
    
    try:
        mistral_result = process_text_with_mistral(text, session_id)
        cleaned_text = mistral_result.get("cleaned_text", text)
        mistral_keywords = mistral_result.get("keywords", [])
        
        # Merge Mistral keywords with static symbol map for robustness
        static_symbols = extract_symbols(cleaned_text)
        all_symbols = list(dict.fromkeys(mistral_keywords + static_symbols))

        # Update conversation history with the cleaned English text
        conversation_history.append({"timestamp": time.time(), "text": cleaned_text})
        filter_history()

        logger.info(f"[extract-keywords] text={text!r} -> keywords={all_symbols}")
        return jsonify({
            "cleaned_text": cleaned_text,
            "keywords": all_symbols
        })
    except Exception as e:
        logger.warning(f"[extract-keywords] Mistral failed: {e}")
        cleaned_text = text
        keywords = extract_symbols(text)
        return jsonify({
            "cleaned_text": cleaned_text,
            "keywords": keywords
        })


@app.route('/api/keywords', methods=['GET'])
def api_get_keywords():
    """
    Retrieve recently extracted keyword records from the database.

    Query params:
      limit (int, default 50) — maximum number of records to return.

    Response JSON: { "keywords": [ { id, source_text, keywords, created_at }, ... ] }
    """
    try:
        limit = int(request.args.get('limit', 50))
        limit = max(1, min(limit, 500))  # clamp to [1, 500]
        records = get_recent_keywords(limit=limit)
        return jsonify({"keywords": records, "count": len(records)})
    except Exception as e:
        logger.error(f"[api/keywords] Error: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route('/api/health', methods=['GET'])
def api_health():
    """
    Check Ollama server reachability and Mistral model availability.

    Response JSON (healthy):
      { "status": "ok", "model_available": true, "model": "mistral:latest", "models": [...] }

    Response JSON (unhealthy):
      { "status": "error", "model_available": false, "message": "..." }
    """
    try:
        health = check_ollama_health()
        http_status = 200 if health["status"] == "ok" else 503
        health["model"] = "mistral:latest"
        models = health.get("models", [])
        health["qwen_available"] = any("qwen2.5vl" in str(m).lower() for m in models)
        return jsonify(health), http_status
    except Exception as e:
        logger.error(f"[api/health] Error: {e}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": str(e),
            "model_available": False,
        }), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
