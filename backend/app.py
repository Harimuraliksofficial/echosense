import os
import re
import subprocess
from flask import Flask, request, jsonify
from flask_cors import CORS
from faster_whisper import WhisperModel
from werkzeug.utils import secure_filename
import torch
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer, pipeline
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

print("Loading DistilBART-CNN summarization model...")
summarizer = pipeline("summarization", model="sshleifer/distilbart-cnn-12-6", device=-1)
print("Summarization model loaded successfully.")

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
    Aggressively cleans raw Whisper transcript:
    - Removes ALL filler words, stutters, and false starts
    - Fixes grammar and punctuation using FLAN-T5
    - Removes repeated phrases/sentences
    - Preserves ALL factual information and meaning
    """
    if not text:
        return ""
    
    # Step 1: Aggressive regex pre-cleaning
    fillers = [
        r'\buh+\b', r'\bum+\b', r'\bah+\b', r'\bmm+\b', r'\bhmm+\b',
        r'\bso yeah\b', r'\byou know\b', r'\bi mean\b', r'\bbasically\b',
        r'\bactually\b', r'\blike\b(?!\s+(this|that|a|the|it))',  # Keep "like" when used as comparison
        r'\bokay so\b', r'\bso basically\b', r'\bno\?\s*$',  # trailing "no?"
        r'\bright\?\s*$', r'\byeah\?\s*$',
    ]
    for filler in fillers:
        text = re.sub(filler, '', text, flags=re.IGNORECASE)
    
    # Remove duplicate consecutive words (e.g., "the the", "we we")
    text = re.sub(r'\b(\w+)(\s+\1)+\b', r'\1', text, flags=re.IGNORECASE)
    # Collapse whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    # Remove orphaned punctuation
    text = re.sub(r'\s+([.,!?])', r'\1', text)
    
    if len(text.split()) < 3:
        return text.capitalize()

    # Step 2: Use FLAN-T5 for grammar correction - preserving ALL details
    prompt = (
        f"Rewrite the following spoken text with correct grammar, proper punctuation, "
        f"and clear sentence structure. Remove any repeated sentences or phrases. "
        f"Keep every fact, name, number, and detail intact. Do not summarize or shorten: "
        f"{text}"
    )
    
    inputs = t5_tokenizer(prompt, return_tensors="pt", max_length=512, truncation=True)
    with torch.no_grad():
        outputs = t5_model.generate(
            **inputs, max_length=512, num_beams=4, 
            length_penalty=1.0, early_stopping=True,
            no_repeat_ngram_size=3
        )
    
    cleaned_text = t5_tokenizer.decode(outputs[0], skip_special_tokens=True)
    
    # Fallback if the model outputs nothing or truncates badly
    if not cleaned_text or len(cleaned_text) < 5:
        return text.capitalize()
        
    return cleaned_text

def summarize_text(text):
    """
    Uses a dedicated summarization model (DistilBART-CNN) to generate
    genuinely condensed, meaningful summaries — NOT just echo the input.
    Captures the core meaning of the conversation in 1-2 crisp sentences.
    """
    if not text or len(text.split()) < 8:
        return text
    
    word_count = len(text.split())
    
    # Dynamic length limits based on input size
    # Summary should be roughly 30-50% of the original, but never too short
    max_len = max(30, min(word_count // 2, 100))
    min_len = max(10, word_count // 5)
    
    try:
        result = summarizer(
            text, 
            max_length=max_len, 
            min_length=min_len,
            do_sample=False,
            num_beams=4,
            no_repeat_ngram_size=3
        )
        summary = result[0]['summary_text'].strip()
        
        if not summary or len(summary) < 5:
            return text
        
        return summary
    except Exception as e:
        print(f"Summarization error: {e}")
        return text

def translate_text(text, target_lang):
    """
    Translates using NLLB-200.
    """
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
            max_length=300
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
    
    # Step 1: Clean the raw transcript (grammar, fillers, repeats)
    cleaned_text = clean_transcript(text)
    
    # Step 2: Generate a crisp AI summary
    summary = summarize_text(cleaned_text)
    
    response = {
        "cleaned_text": cleaned_text,
        "summary": summary
    }
    
    # Step 3: Translate the summary (not the full transcript) for crisp output
    if target_lang:
        try:
            translated_text = translate_text(summary, target_lang)
            response["translated_text"] = translated_text
        except Exception as e:
            print(f"Translation error: {str(e)}")
            response["translated_text"] = f"[Translation Error] {str(e)}"
            
    return jsonify(response)

@app.route('/listen', methods=['POST'])
def listen_for_name():
    """
    Ultra-fast endpoint for name detection.
    Skips ffmpeg preprocessing, cleaning, and translation.
    Just raw Whisper tiny transcription for maximum speed.
    """
    if 'audio' not in request.files:
        return jsonify({'text': '', 'error': 'No audio file found'}), 400
        
    file = request.files['audio']
    if file.filename == '':
        return jsonify({'text': '', 'error': 'No selected file'}), 400

    try:
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        # Direct transcription — NO ffmpeg preprocessing for speed
        segments, _ = whisper_model.transcribe(
            filepath,
            language="en",
            beam_size=1, # Greedy search for speed
            best_of=1,
            temperature=0,
            condition_on_previous_text=False,
            vad_filter=False 
        )

        text_parts = [s.text for s in segments]
        transcribed_text = " ".join(text_parts).strip()

        # Cleanup
        if os.path.exists(filepath):
            os.remove(filepath)

        return jsonify({'text': transcribed_text})
    except Exception as e:
        # Cleanup on error
        if os.path.exists(filepath):
            os.remove(filepath)
        return jsonify({'text': '', 'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
