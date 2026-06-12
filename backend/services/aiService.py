"""
aiService.py — AI Service Layer for EchoSense

Contains two distinct pipelines:
  1. Ollama / Mistral — local keyword extraction (replaces Gemini).
  2. Segmind SDXL ControlNet — cloud image generation from sketches (unchanged).

Ollama Config:
  Base URL : http://localhost:11434  (override via OLLAMA_BASE_URL env var)
  Model    : mistral:latest          (override via OLLAMA_MODEL env var)
  Endpoint : POST /api/generate
  Health   : GET  /api/tags
"""

import os
import json
import re
import requests
import sys
from dotenv import load_dotenv

def _safe_print(msg: str):
    try:
        print(msg.encode('ascii', errors='backslashreplace').decode('ascii'))
    except Exception:
        pass

# Load .env from the backend directory
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

# ── Ollama Configuration ────────────────────────────────────────────────────

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL    = os.getenv("OLLAMA_MODEL", "mistral:latest")

# ── Segmind Configuration (kept for Canvas sketch→image) ───────────────────

SEGMIND_API_KEY  = os.getenv("SEGMIND_API_KEY", "")
SEGMIND_ENDPOINT = "https://api.segmind.com/v1/sdxl-controlnet"

# Keyword extraction prompt template
_KEYWORD_PROMPT = """\
Extract the most important keywords from the following text.

Rules:
- Return ONLY a valid JSON object with a single key "keywords" whose value is a JSON array of strings.
- Include 1–8 keywords.
- Prioritize: nouns, named entities, locations, actions, and important concepts.
- Exclude common stop words (e.g. "the", "is", "a", "and", "I", "to", "on", "for").
- Exclude filler words and generic verbs (e.g. "visited", "worked", "went", "did").
- Prefer multi-word phrases when they form a meaningful concept (e.g. "plant identification").
- Output MUST be valid JSON. No explanations, no markdown, no extra text.

Examples:
Input: "I visited Mangalore and worked on an AI-powered plant identification project."
Output: {"keywords": ["Mangalore", "AI", "plant identification", "project"]}

Input: "I am thirsty and need water"
Output: {"keywords": ["water", "thirsty"]}

Input: "I need a doctor urgently because I have a headache"
Output: {"keywords": ["doctor", "headache", "urgent"]}

Now process this input:
Input: "{text}"
Output:"""


# ─────────────────────────────────────────────────────────────────────────────
# Initialisation
# ─────────────────────────────────────────────────────────────────────────────

def init_ai_pipeline():
    """
    Validate both the Ollama and Segmind configurations at startup.
    No model downloads — Ollama runs locally, Segmind runs in the cloud.
    """
    # Check Ollama
    health = check_ollama_health()
    if health["status"] == "ok":
        print(f"[OK] Ollama AI pipeline ready  (model: {OLLAMA_MODEL})")
    else:
        print(f"[WARNING] Ollama not reachable: {health.get('message', 'unknown error')}")
        print(f"[WARNING] Keyword extraction will fail until Ollama is running.")

    # Check Segmind (kept for Canvas)
    if not SEGMIND_API_KEY:
        print("[WARNING] SEGMIND_API_KEY is not set. Sketch→image generation will fail.")
    else:
        key_preview = SEGMIND_API_KEY[:6] + "..." + SEGMIND_API_KEY[-4:]
        print(f"[OK] Segmind AI pipeline ready  (key: {key_preview})")


# ─────────────────────────────────────────────────────────────────────────────
# Ollama / Mistral — Keyword Extraction
# ─────────────────────────────────────────────────────────────────────────────

def check_ollama_health() -> dict:
    """
    Check whether the Ollama server is running and the Mistral model is available.

    Returns
    -------
    dict
        {"status": "ok", "model_available": True, "models": [...]}  on success
        {"status": "error", "message": "...", "model_available": False}  on failure
    """
    try:
        response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        if response.status_code != 200:
            return {
                "status": "error",
                "message": f"Ollama returned HTTP {response.status_code}",
                "model_available": False,
            }
        data = response.json()
        models = [m.get("name", "") for m in data.get("models", [])]
        model_available = OLLAMA_MODEL in models
        return {
            "status": "ok",
            "model_available": model_available,
            "models": models,
        }
    except requests.exceptions.ConnectionError:
        return {
            "status": "error",
            "message": "Ollama server is not reachable at " + OLLAMA_BASE_URL,
            "model_available": False,
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
            "model_available": False,
        }


def extract_keywords(text: str) -> list:
    """
    Send text to the local Mistral model via Ollama and extract meaningful keywords.

    Parameters
    ----------
    text : str
        The user sentence or paragraph to analyse.

    Returns
    -------
    list of str
        E.g. ["Mangalore", "AI", "plant identification", "project"]

    Raises
    ------
    RuntimeError
        If the Ollama server is unreachable or returns an unexpected response.
    """
    if not text or not text.strip():
        return []

    prompt = _KEYWORD_PROMPT.replace("{text}", text.strip())

    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.2,
            "num_predict": 256,
        },
    }

    try:
        response = requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json=payload,
            timeout=60,
        )
    except requests.exceptions.ConnectionError as exc:
        raise RuntimeError(f"Ollama server not reachable: {exc}") from exc

    if response.status_code != 200:
        raise RuntimeError(
            f"Ollama API error ({response.status_code}): {response.text[:300]}"
        )

    data = response.json()
    raw_response = data.get("response", "").strip()

    _safe_print(f"[Ollama] Raw response: {raw_response[:200]!r}")

    keywords = _parse_keywords_from_response(raw_response)
    _safe_print(f"[Ollama] Extracted keywords: {keywords}")
    return keywords


def _parse_keywords_from_response(raw: str) -> list:
    """
    Robustly parse the keywords list from the model's text response.
    Handles: clean JSON, JSON embedded in markdown fences, partial responses.
    """
    # Strip markdown fences if present
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```[a-z]*\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned)
        cleaned = cleaned.strip()

    # Try parsing as full JSON object
    try:
        obj = json.loads(cleaned)
        if isinstance(obj, dict) and "keywords" in obj:
            kw = obj["keywords"]
            if isinstance(kw, list):
                return [str(k).strip() for k in kw if str(k).strip()]
    except json.JSONDecodeError:
        pass

    # Try finding a JSON object anywhere in the string
    match = re.search(r'\{[^{}]*"keywords"\s*:\s*\[[^\]]*\][^{}]*\}', cleaned, re.DOTALL)
    if match:
        try:
            obj = json.loads(match.group())
            kw = obj.get("keywords", [])
            if isinstance(kw, list):
                return [str(k).strip() for k in kw if str(k).strip()]
        except json.JSONDecodeError:
            pass

    # Last resort: extract quoted strings from a JSON array pattern
    array_match = re.search(r'\[([^\]]+)\]', cleaned)
    if array_match:
        items = re.findall(r'"([^"]+)"', array_match.group())
        if items:
            return [item.strip() for item in items if item.strip()]

    _safe_print(f"[Ollama][WARNING] Could not parse keywords from response: {raw[:200]!r}")
    return []


# ─────────────────────────────────────────────────────────────────────────────
# Ollama / Mistral — Unified Translation + Keyword Extraction
# ─────────────────────────────────────────────────────────────────────────────

# Supported target languages and their display names
SUPPORTED_LANGUAGES = {
    "english", "hindi", "kannada", "malayalam", "tamil", "telugu", "konkani", "urdu",
}

# Language code → full name mapping (for the prompt)
_LANG_CODE_TO_NAME = {
    "en": "english",
    "hi": "hindi",
    "kn": "kannada",
    "ml": "malayalam",
    "ta": "tamil",
    "te": "telugu",
    "kok": "konkani",
    "ur": "urdu",
}

_TRANSLATION_PROMPT = """\
You are an expert multilingual translator and grammar corrector.

Task: Process the following text and return a JSON response.

Steps:
1. Detect the language of the input text (it may be English, Hindi, Kannada, Malayalam, Tamil, Telugu, Konkani, Urdu, or mixed).
2. Produce a grammatically correct English version of the text. If the input is already correct English, keep it as-is.
3. Translate the corrected English text into {target_language}. If the target language is English, the translation should be the same as the corrected English text.
4. Extract 1-8 important English keywords from the text for image search. Keywords MUST be in English only. Focus on nouns, emotions, actions, and concrete concepts. Exclude stop words.

Rules:
- Preserve the original meaning completely. Do not invent or add extra information.
- Do not remove important information.
- Keywords MUST ALWAYS be in English, regardless of the input or target language.
- Return ONLY a valid JSON object. No explanations, no markdown fences, no extra text.

Required JSON format:
{{"english_text": "...", "translated_text": "...", "keywords": ["keyword1", "keyword2"]}}

Examples:
Input: "I am hungry. Can you give me some food?" (target: hindi)
Output: {{"english_text": "I am hungry. Can you give me some food?", "translated_text": "मुझे भूख लगी है। क्या आप मुझे कुछ खाना दे सकते हैं?", "keywords": ["hungry", "food"]}}

Input: "Mujhe food chahiye" (target: english)
Output: {{"english_text": "I need food.", "translated_text": "I need food.", "keywords": ["food"]}}

Input: "ನನಗೆ ಹಸಿವು ಇದೆ" (target: kannada)
Output: {{"english_text": "I am hungry.", "translated_text": "ನನಗೆ ಹಸಿವು ಇದೆ.", "keywords": ["hungry"]}}

Input: "I have severe headache" (target: telugu)
Output: {{"english_text": "I have a severe headache.", "translated_text": "నాకు తీవ్రమైన తలనొప్పి ఉంది.", "keywords": ["headache", "pain", "severe"]}}

Now process this:
Input: "{text}" (target: {target_language})
Output:"""


def process_text_with_mistral(text: str, target_lang: str = "english") -> dict:
    """
    Use the local Mistral model (via Ollama) to perform grammar correction,
    translation, and English keyword extraction in a single request.

    Parameters
    ----------
    text : str
        The raw transcribed text (may be any supported language or mixed).
    target_lang : str
        Target language name (e.g. "hindi", "kannada") or code (e.g. "hi", "kn").
        Defaults to "english".

    Returns
    -------
    dict
        {
            "english_text": str,       # grammar-corrected English
            "translated_text": str,    # translated text (same as english_text if target is English)
            "keywords": list[str]      # always English keywords
        }

    Raises
    ------
    RuntimeError
        If the Ollama server is unreachable or returns an unexpected response.
    """
    if not text or not text.strip():
        return {"english_text": "", "translated_text": "", "keywords": []}

    # Resolve language code to name if needed
    lang_name = target_lang.lower().strip() if target_lang else "english"
    if lang_name in _LANG_CODE_TO_NAME:
        lang_name = _LANG_CODE_TO_NAME[lang_name]
    if lang_name not in SUPPORTED_LANGUAGES:
        lang_name = "english"

    prompt = _TRANSLATION_PROMPT.replace("{text}", text.strip()).replace(
        "{target_language}", lang_name
    )

    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.3,
            "num_predict": 1024,
        },
    }

    try:
        response = requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json=payload,
            timeout=90,
        )
    except requests.exceptions.ConnectionError as exc:
        raise RuntimeError(f"Ollama server not reachable: {exc}") from exc

    if response.status_code != 200:
        raise RuntimeError(
            f"Ollama API error ({response.status_code}): {response.text[:300]}"
        )

    data = response.json()
    raw_response = data.get("response", "").strip()

    _safe_print(f"[Ollama/translate] Raw response: {raw_response[:300]!r}")

    result = _parse_translation_response(raw_response, text, lang_name)
    _safe_print(f"[Ollama/translate] Parsed: english={result['english_text'][:80]!r}, "
                f"translated={result['translated_text'][:80]!r}, "
                f"keywords={result['keywords']}")
    return result


def _parse_translation_response(raw: str, original_text: str, target_lang: str) -> dict:
    """
    Robustly parse the Mistral response for translation + keywords.
    Falls back to original text if parsing fails.
    """
    fallback = {
        "english_text": original_text,
        "translated_text": original_text,
        "keywords": [],
    }

    if not raw:
        return fallback

    # Strip markdown fences if present
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```[a-z]*\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned)
        cleaned = cleaned.strip()

    # Try parsing as full JSON object
    parsed = _try_parse_json(cleaned)
    if parsed:
        return _validate_translation_result(parsed, original_text, target_lang)

    # Try finding a JSON object anywhere in the string
    match = re.search(r'\{[^{}]*"english_text"[^{}]*\}', cleaned, re.DOTALL)
    if match:
        parsed = _try_parse_json(match.group())
        if parsed:
            return _validate_translation_result(parsed, original_text, target_lang)

    # Broader search: find any JSON-like object
    match = re.search(r'\{.*\}', cleaned, re.DOTALL)
    if match:
        parsed = _try_parse_json(match.group())
        if parsed:
            return _validate_translation_result(parsed, original_text, target_lang)

    _safe_print(f"[Ollama/translate][WARNING] Could not parse response: {raw[:200]!r}")
    return fallback


def _try_parse_json(text: str) -> dict | None:
    """Attempt JSON parsing, return None on failure."""
    try:
        obj = json.loads(text)
        if isinstance(obj, dict):
            return obj
    except (json.JSONDecodeError, ValueError):
        pass
    return None


def _validate_translation_result(parsed: dict, original_text: str, target_lang: str) -> dict:
    """Validate and sanitize the parsed translation result."""
    english_text = parsed.get("english_text", "").strip()
    translated_text = parsed.get("translated_text", "").strip()
    keywords = parsed.get("keywords", [])

    # Ensure english_text is present
    if not english_text:
        english_text = original_text

    # Ensure translated_text is present
    if not translated_text:
        translated_text = english_text if target_lang == "english" else original_text

    # Ensure keywords is a list of strings
    if not isinstance(keywords, list):
        keywords = []
    keywords = [str(k).strip() for k in keywords if str(k).strip()]

    return {
        "english_text": english_text,
        "translated_text": translated_text,
        "keywords": keywords,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Segmind SDXL ControlNet — Sketch-to-Image Generation (unchanged)
# ─────────────────────────────────────────────────────────────────────────────

import base64  # noqa: E402 (kept here to avoid top-level import order issues)


def _strip_base64_header(b64_string: str) -> str:
    """Remove the data:image/...;base64, prefix if present."""
    if "," in b64_string:
        return b64_string.split(",", 1)[1]
    return b64_string


def generate_image_from_sketch(sketch_b64: str, user_prompt: str = "") -> str:
    """
    Send a sketch (base64) to Segmind SDXL ControlNet Scribble and return
    the generated image as a data-URI base64 string.

    Parameters
    ----------
    sketch_b64 : str
        The raw sketch from the Expo canvas including ``data:image/png;base64,...`` header.
    user_prompt : str, optional
        Extra text describing what the user wants.

    Returns
    -------
    str
        ``data:image/png;base64,<b64data>`` ready for the frontend to display.
    """
    if not SEGMIND_API_KEY:
        raise RuntimeError("SEGMIND_API_KEY is not configured on the server.")

    base_prompt = (
        "Convert this rough sketch into a clean, minimal, professional image. "
        "Preserve the structure and intent of the sketch. "
        "Use realistic lighting, soft shadows, and a minimal aesthetic. "
        "High quality, 4k, clean background."
    )
    if user_prompt and user_prompt.strip():
        base_prompt = f"{user_prompt.strip()}, {base_prompt}"

    raw_b64 = _strip_base64_header(sketch_b64)

    payload = {
        "image": raw_b64,
        "prompt": base_prompt,
        "negative_prompt": "blurry, low quality, distorted, ugly, disfigured, watermark, text",
        "samples": 1,
        "scheduler": "UniPC",
        "cn_model": "sdxl_scribble",
        "num_inference_steps": 30,
        "guidance_scale": 7,
        "controlnet_scale": 0.9,
        "seed": 42,
        "base64": True,
    }

    headers = {
        "x-api-key": SEGMIND_API_KEY,
        "Content-Type": "application/json",
    }

    print(f"[Segmind] Generating image (prompt length: {len(base_prompt)} chars) ...")

    response = requests.post(
        SEGMIND_ENDPOINT,
        json=payload,
        headers=headers,
        timeout=90,
    )

    if response.status_code != 200:
        error_detail = ""
        try:
            error_detail = response.json().get("error", response.text[:300])
        except Exception:
            error_detail = response.text[:300]
        raise RuntimeError(f"Segmind API error ({response.status_code}): {error_detail}")

    content_type = response.headers.get("Content-Type", "")

    if "application/json" in content_type:
        data = response.json()
        if "image" in data:
            img_b64 = data["image"]
        elif "images" in data and len(data["images"]) > 0:
            img_b64 = data["images"][0]
        else:
            raise RuntimeError("Segmind returned JSON but no image field found.")
        if not img_b64.startswith("data:"):
            img_b64 = f"data:image/png;base64,{img_b64}"
        print("[Segmind] [OK] Image generated successfully (JSON response)")
        return img_b64
    else:
        img_bytes = response.content
        img_b64 = base64.b64encode(img_bytes).decode("utf-8")
        print(f"[Segmind] [OK] Image generated successfully ({len(img_bytes)} bytes)")
        return f"data:image/png;base64,{img_b64}"
