import os
import subprocess
from flask import Flask, request, jsonify
from flask_cors import CORS
from faster_whisper import WhisperModel
import warnings
from werkzeug.utils import secure_filename

warnings.filterwarnings("ignore")

app = Flask(__name__)
CORS(app)

print("Loading Faster-Whisper model (medium)...")
# Using 'medium' for accuracy, but we will reduce beam_size to 1 (Greedy Search) so it processes fast enough on CPU to avoid 60s timeout.
model = WhisperModel("medium", device="cpu", compute_type="int8")
print("Faster-Whisper model loaded successfully.")

UPLOAD_FOLDER = 'temp_audio'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

def preprocess_audio(input_filepath, output_filepath):
    """
    Converts audio to 16kHz, mono channel using ffmpeg.
    """
    command = [
        "ffmpeg",
        "-y", # overwrite
        "-i", input_filepath,
        "-ac", "1", # mono
        "-ar", "16000", # 16kHz
        output_filepath
    ]
    subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

@app.route('/transcribe', methods=['POST'])
def transcribe_audio():
    if 'audio' not in request.files:
        return jsonify({'text': '', 'error': 'No audio file found in request'}), 400
        
    file = request.files['audio']
    if file.filename == '':
        return jsonify({'text': '', 'error': 'No selected file'}), 400
        
    try:
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        print(f"File saved to {filepath}. Processing...")
        processed_filepath = os.path.join(app.config['UPLOAD_FOLDER'], "processed_" + filename + ".wav")
        preprocess_audio(filepath, processed_filepath)
        
        print(f"Transcribing {processed_filepath}...")
        
        # Run faster-whisper with task="translate" for English translation
        segments, info = model.transcribe(
            processed_filepath,
            task="translate",
            beam_size=1, # Greedy decoding makes 'medium' exponentially faster on CPU, avoiding timeouts!
            temperature=0.0,
            initial_prompt="A clear English translation of Malayalam and Kannada speech. Context: 'hattu gantege' means 'at 10 o'clock'.",
            condition_on_previous_text=False,
            vad_filter=True # Faster-whisper has built in Silero VAD to skip silent parts
        )
        
        text_parts = []
        for segment in segments:
            # Drop very low confidence segments to avoid hallucination
            if segment.no_speech_prob < 0.6: 
                text_parts.append(segment.text)
                
        transcribed_text = " ".join(text_parts).strip()
        print(f"Transcription complete: {transcribed_text}")
        
        # Clean up temporary files
        for f in [filepath, processed_filepath]:
            try:
                if os.path.exists(f):
                    os.remove(f)
            except Exception as e:
                print(f"Warning: Could not remove temp file {f}: {e}")
        
        return jsonify({'text': transcribed_text})
        
    except Exception as e:
        print(f"Error during transcription: {str(e)}")
        return jsonify({'text': '', 'error': 'transcription failed'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
