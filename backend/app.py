import os
import re
import subprocess
from flask import Flask, request, jsonify
from flask_cors import CORS
from faster_whisper import WhisperModel
from werkzeug.utils import secure_filename
import torch
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
import warnings

warnings.filterwarnings("ignore")

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = 'temp_audio'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

print("Loading Faster-Whisper model (medium)...")
whisper_model = WhisperModel("medium", device="cpu", compute_type="int8")
print("Faster-Whisper model loaded successfully.")

print("Loading NLLB-200 translation model (600M)...")
model_name = "facebook/nllb-200-distilled-600M"
tokenizer = AutoTokenizer.from_pretrained(model_name, src_lang="eng_Latn")
translation_model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
print("NLLB model loaded successfully.")

print("Loading FLAN-T5 (base) for offline grammar correction and structuring...")
t5_name = "google/flan-t5-base"
t5_tokenizer = AutoTokenizer.from_pretrained(t5_name)
t5_model = AutoModelForSeq2SeqLM.from_pretrained(t5_name)
print("FLAN-T5 loaded successfully.")

def preprocess_audio(input_filepath, output_filepath):
    """
    Converts audio to 16kHz, mono channel using ffmpeg.
    """
    command = [
        "ffmpeg", "-y", "-i", input_filepath, "-ac", "1", "-ar", "16000", output_filepath
    ]
    subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def clean_transcript(text):
    """
    Cleans whispered transcript using FLAN-T5:
    - Removes filler words
    - Fixes basic grammar and capitalization
    - Restructures context specifically to make translations easier
    """
    if not text:
        return ""
    
    # Pre-clean obvious massive stutters with regex quickly 
    fillers = [r'\buh\b', r'\bum\b', r'\bah\b', r'\bso yeah\b', r'\blike\b']
    for filler in fillers:
        text = re.sub(filler, '', text, flags=re.IGNORECASE)
    text = re.sub(r'\s+', ' ', text).strip()
    
    if len(text.split()) < 3:
        # Too short to restructure heavily, just capitalize
        return text.capitalize()

    # Use FLAN-T5 ONLY to fix grammar and remove repeated parts.
    # CRITICAL: The prompt must NOT ask for summarization or simplification.
    # It must preserve every single detail from the original text.
    prompt = f"Fix the grammar and remove repeated sentences. Do not remove any details or information. Keep the full meaning: {text}"
    
    inputs = t5_tokenizer(prompt, return_tensors="pt", max_length=512, truncation=True)
    with torch.no_grad():
        outputs = t5_model.generate(**inputs, max_length=512, num_beams=2, early_stopping=True)
    
    cleaned_text = t5_tokenizer.decode(outputs[0], skip_special_tokens=True)
    
    # Fallback if the model outputs nothing or truncates badly
    if not cleaned_text or len(cleaned_text) < 2:
        return text.capitalize()
        
    return cleaned_text

def translate_text(text, target_lang):
    """
    Translates using NLLB-200.
    """
    # Map frontend short codes to NLLB supported BCP-47 / flores-200 codes
    lang_map = {
        "kn": "kan_Knda",
        "ml": "mal_Mlym",
        "ta": "tam_Taml",
        "te": "tel_Telu",
        "hi": "hin_Deva"
    }
    nllb_lang = lang_map.get(target_lang, "hin_Deva")
    
    inputs = tokenizer(text, return_tensors="pt", padding=True)
    with torch.no_grad():
        translated_tokens = translation_model.generate(
            **inputs, 
            forced_bos_token_id=tokenizer.lang_code_to_id[nllb_lang],
            max_length=150
        )
    translated_text = tokenizer.decode(translated_tokens[0], skip_special_tokens=True)
    return translated_text

@app.route('/transcribe', methods=['POST'])
def transcribe_audio():
    if 'audio' not in request.files:
        return jsonify({'text': '', 'error': 'No audio file found'}), 400
        
    file = request.files['audio']
    if file.filename == '':
        return jsonify({'text': '', 'error': 'No selected file'}), 400
        
    try:
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        processed_filepath = os.path.join(app.config['UPLOAD_FOLDER'], "processed_" + filename + ".wav")
        preprocess_audio(filepath, processed_filepath)
        
        # Whisper for STT
        segments, info = whisper_model.transcribe(
            processed_filepath,
            task="translate", # English output
            beam_size=1,
            temperature=0.0,
            condition_on_previous_text=False,
            vad_filter=True
        )
        
        text_parts = [s.text for s in segments if s.no_speech_prob < 0.6]
        transcribed_text = " ".join(text_parts).strip()
        
        # Clean up files
        for f in [filepath, processed_filepath]:
            if os.path.exists(f): 
                os.remove(f)
                
        return jsonify({'text': transcribed_text})
    except Exception as e:
        return jsonify({'text': '', 'error': str(e)}), 500

@app.route('/process', methods=['POST'])
def process_text():
    data = request.json
    if not data or 'text' not in data:
        return jsonify({'error': 'Missing text'}), 400
        
    text = data['text']
    target_lang = data.get('target_lang')
    
    cleaned_text = clean_transcript(text)
    
    response = {
        "cleaned_text": cleaned_text
    }
    
    if target_lang:
        try:
            translated_text = translate_text(cleaned_text, target_lang)
            response["translated_text"] = translated_text
        except Exception as e:
            print(f"Translation error: {str(e)}")
            response["translated_text"] = f"[Translation Error] {str(e)}"
            
    return jsonify(response)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
