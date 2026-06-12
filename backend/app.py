import os
import re
import subprocess
import time
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
from faster_whisper import WhisperModel
from werkzeug.utils import secure_filename
import torch
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
import warnings
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from db import init_db, save_generation, save_keywords, get_recent_keywords
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

logger.info("Loading Faster-Whisper model (medium)...")
whisper_model = WhisperModel("medium", device="cpu", compute_type="int8")
logger.info("Faster-Whisper model loaded successfully.")

# Models NLLB-200 and FLAN-T5 have been removed to simplify the architecture for the demo.

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
        
        segments, _ = whisper_model.transcribe(
            processed_filepath,
            task="transcribe",
            beam_size=5,
            temperature=0.0,
            condition_on_previous_text=False,
            vad_filter=True
        )
        
        text_parts = [s.text for s in segments if s.no_speech_prob < 0.6]
        transcribed_text = " ".join(text_parts).strip()
        
        for f in [filepath, processed_filepath]:
            if os.path.exists(f): os.remove(f)
                
        return jsonify({'text': transcribed_text})
    except Exception as e:
        logger.error(f"[transcribe] Error: {e}", exc_info=True)
        return jsonify({'text': '', 'error': str(e)}), 500

@app.route('/process', methods=['POST'])
def process_text():
    data = request.json
    if not data or 'text' not in data:
        return jsonify({'error': 'Missing text'}), 400
        
    text = data['text']
    target_lang = data.get('target_lang')  # e.g. "hi", "kn", "ml", "ta", "te", "ur", or None
    session_id = data.get('session_id', 0)

    # ── Primary pipeline: Mistral (grammar + translation + keywords in one call) ──
    try:
        mistral_lang = target_lang if target_lang else "english"
        mistral_result = process_text_with_mistral(text, mistral_lang, session_id)

        cleaned_text = mistral_result.get("english_text", text)
        translated_text = mistral_result.get("translated_text", "")
        mistral_keywords = mistral_result.get("keywords", [])

        # Merge Mistral keywords with static symbol map for robustness
        static_symbols = extract_symbols(cleaned_text)
        all_symbols = list(dict.fromkeys(mistral_keywords + static_symbols))  # deduplicated, order preserved

        # Update conversation history with the cleaned English text
        conversation_history.append({"timestamp": time.time(), "text": cleaned_text})
        filter_history()

        response = {
            "cleaned_text": cleaned_text,
            "summary": cleaned_text,
            "symbols": all_symbols,
        }

        if target_lang and translated_text and translated_text != cleaned_text:
            response["translated_text"] = translated_text
        elif target_lang and translated_text:
            response["translated_text"] = translated_text

        logger.info(f"[process] Mistral pipeline OK: lang={mistral_lang}, keywords={all_symbols}")
        return jsonify(response)

    except Exception as mistral_err:
        logger.warning(f"[process] Mistral pipeline failed: {mistral_err}", exc_info=True)
        
        # Simple fallback to English text and basic static keywords
        cleaned_text = text.strip()
        symbols = extract_symbols(cleaned_text)

        response = {
            "cleaned_text": cleaned_text,
            "summary": cleaned_text,
            "symbols": symbols,
        }

        if target_lang:
            response["translated_text"] = f"[Translation Error] Could not connect to local Mistral."

        return jsonify(response)

@app.route('/api/clear-history', methods=['POST'])
def clear_history_route():
    global conversation_history
    conversation_history = []
    return jsonify({"status": "cleared"})

@app.route('/api/cancel-session', methods=['POST'])
def cancel_session_route():
    new_id = increment_session_id()
    return jsonify({"status": "cancelled", "session_id": new_id})


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
# Routes — New (Ollama / Mistral)
# ─────────────────────────────────────────────────────────────────────────────

@app.route('/api/extract-keywords', methods=['POST'])
def api_extract_keywords():
    """
    Extract meaningful keywords from the provided text using local Mistral.

    Request JSON : { "text": "..." }
    Response JSON: { "keywords": [...], "id": <db_row_id> }
    """
    data = request.json
    if not data or 'text' not in data:
        return jsonify({'error': 'Missing "text" field in request body'}), 400

    text = data['text'].strip()
    if not text:
        return jsonify({'error': 'Text cannot be empty'}), 400

    try:
        keywords = extract_symbols(text)
        row_id = save_keywords(text, keywords)
        logger.info(f"[extract-keywords] text={text[:60]!r} → keywords={keywords} (fast extraction)")
        return jsonify({
            "keywords": keywords,
            "id": row_id,
            "source_text": text,
        })
    except Exception as e:
        logger.error(f"[extract-keywords] Unexpected error: {e}", exc_info=True)
        return jsonify({"error": f"Keyword extraction failed: {str(e)}"}), 500


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
