"""
test_ollama.py — Automated tests for EchoSense Ollama / Mistral integration.

Run from the backend/ directory:
    python -m pytest tests/test_ollama.py -v

Requirements:
  - Ollama server running: ollama serve
  - Mistral model pulled:  ollama pull mistral:latest
  - Flask backend NOT required for unit tests (mocked where needed).
    For integration tests, start: python app.py
"""

import sys
import os
import json
import time
import sqlite3
import tempfile
import pytest
import requests

# ── Path setup ───────────────────────────────────────────────────────────────
# Allow importing from the backend/ root when running from tests/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
FLASK_BASE_URL  = os.getenv("FLASK_BASE_URL",  "http://localhost:5000")
OLLAMA_MODEL    = os.getenv("OLLAMA_MODEL",    "mistral:latest")


# ─────────────────────────────────────────────────────────────────────────────
# Helper
# ─────────────────────────────────────────────────────────────────────────────

def ollama_is_running() -> bool:
    try:
        r = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        return r.status_code == 200
    except Exception:
        return False

def flask_is_running() -> bool:
    try:
        r = requests.get(f"{FLASK_BASE_URL}/api/health", timeout=5)
        return r.status_code in (200, 503)
    except Exception:
        return False

requires_ollama = pytest.mark.skipif(
    not ollama_is_running(),
    reason="Ollama server not running at " + OLLAMA_BASE_URL
)

requires_flask = pytest.mark.skipif(
    not flask_is_running(),
    reason="Flask backend not running at " + FLASK_BASE_URL
)


# ─────────────────────────────────────────────────────────────────────────────
# 1. Ollama Connection
# ─────────────────────────────────────────────────────────────────────────────

class TestOllamaConnection:
    """Tests that verify the Ollama server is reachable."""

    @requires_ollama
    def test_ollama_tags_endpoint_returns_200(self):
        """GET /api/tags should return HTTP 200."""
        response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        assert response.status_code == 200, (
            f"Expected 200 from Ollama /api/tags, got {response.status_code}"
        )

    @requires_ollama
    def test_ollama_tags_returns_json(self):
        """Response should be valid JSON with a 'models' key."""
        response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        data = response.json()
        assert "models" in data, "Expected 'models' key in /api/tags response"
        assert isinstance(data["models"], list)

    @requires_ollama
    def test_mistral_model_available(self):
        """mistral:latest should appear in the list of installed models."""
        response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        data = response.json()
        model_names = [m.get("name", "") for m in data.get("models", [])]
        assert OLLAMA_MODEL in model_names, (
            f"Model '{OLLAMA_MODEL}' not found in Ollama. "
            f"Available models: {model_names}. "
            f"Run: ollama pull {OLLAMA_MODEL}"
        )


# ─────────────────────────────────────────────────────────────────────────────
# 2. Mistral Response Generation
# ─────────────────────────────────────────────────────────────────────────────

class TestMistralResponse:
    """Tests that the Mistral model generates valid responses."""

    @requires_ollama
    def test_generate_returns_non_empty_response(self):
        """POST /api/generate with a trivial prompt should return a non-empty response."""
        payload = {
            "model": OLLAMA_MODEL,
            "prompt": "Reply with exactly: Hello",
            "stream": False,
            "options": {"temperature": 0.0, "num_predict": 20},
        }
        response = requests.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload, timeout=60)
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert len(data["response"].strip()) > 0

    @requires_ollama
    def test_generate_returns_done_true(self):
        """Completed generation should have done=True."""
        payload = {
            "model": OLLAMA_MODEL,
            "prompt": "Say yes.",
            "stream": False,
            "options": {"num_predict": 10},
        }
        response = requests.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload, timeout=60)
        data = response.json()
        assert data.get("done") is True


# ─────────────────────────────────────────────────────────────────────────────
# 3. Keyword Extraction Accuracy
# ─────────────────────────────────────────────────────────────────────────────

class TestKeywordExtraction:
    """Tests the keyword extraction function directly."""

    @requires_ollama
    def test_extract_keywords_returns_list(self):
        """extract_keywords() should return a non-empty list."""
        from services.aiService import extract_keywords
        result = extract_keywords("I visited Mangalore and worked on an AI-powered plant identification project.")
        assert isinstance(result, list), f"Expected list, got {type(result)}"
        assert len(result) > 0, "Expected at least one keyword"

    @requires_ollama
    def test_extract_keywords_are_strings(self):
        """All keywords should be non-empty strings."""
        from services.aiService import extract_keywords
        result = extract_keywords("I need a doctor urgently because I have a headache.")
        assert all(isinstance(k, str) and k.strip() for k in result)

    @requires_ollama
    def test_extract_keywords_excludes_stopwords(self):
        """Common stop words should not appear as sole keywords."""
        from services.aiService import extract_keywords
        stop_words = {"i", "a", "the", "and", "is", "to", "on", "for", "of", "in"}
        result = extract_keywords("I am thirsty and need water.")
        kw_lower = {k.lower() for k in result}
        unexpected = kw_lower & stop_words
        assert len(unexpected) == 0, f"Stop words found in keywords: {unexpected}"

    @requires_ollama
    def test_extract_keywords_includes_relevant_terms(self):
        """Relevant nouns/entities should appear in the keyword output."""
        from services.aiService import extract_keywords
        result = extract_keywords("I visited Mangalore and worked on an AI-powered plant identification project.")
        result_lower = [k.lower() for k in result]
        # At least one of the key concepts should be present
        relevant = {"mangalore", "ai", "plant", "project", "plant identification"}
        assert any(r in relevant for r in result_lower), (
            f"None of {relevant} found in keywords: {result}"
        )

    def test_extract_keywords_empty_input(self):
        """Empty input should return an empty list without raising."""
        from services.aiService import extract_keywords
        result = extract_keywords("")
        assert result == []

    def test_parse_keywords_valid_json(self):
        """_parse_keywords_from_response should handle clean JSON."""
        from services.aiService import _parse_keywords_from_response
        raw = '{"keywords": ["Mangalore", "AI", "project"]}'
        result = _parse_keywords_from_response(raw)
        assert result == ["Mangalore", "AI", "project"]

    def test_parse_keywords_markdown_fence(self):
        """_parse_keywords_from_response should strip markdown code fences."""
        from services.aiService import _parse_keywords_from_response
        raw = '```json\n{"keywords": ["water", "thirsty"]}\n```'
        result = _parse_keywords_from_response(raw)
        assert result == ["water", "thirsty"]

    def test_parse_keywords_invalid_returns_empty(self):
        """Completely unparseable response should return empty list, not raise."""
        from services.aiService import _parse_keywords_from_response
        result = _parse_keywords_from_response("I cannot help with that.")
        assert isinstance(result, list)


# ─────────────────────────────────────────────────────────────────────────────
# 4. Database Insertion
# ─────────────────────────────────────────────────────────────────────────────

class TestDatabaseInsert:
    """Tests keyword persistence to SQLite."""

    def setup_method(self):
        """Use a temp database for each test."""
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        # Patch DB_PATH in db module
        import db as db_module
        self._orig_db_path = db_module.DB_PATH
        db_module.DB_PATH = self.tmp.name
        db_module.init_db()

    def teardown_method(self):
        import db as db_module
        db_module.DB_PATH = self._orig_db_path
        os.unlink(self.tmp.name)

    def test_save_keywords_returns_int(self):
        """save_keywords should return an integer primary key."""
        from db import save_keywords
        row_id = save_keywords("test sentence", ["keyword1", "keyword2"])
        assert isinstance(row_id, int)
        assert row_id > 0

    def test_save_keywords_persists_to_db(self):
        """Inserted keywords should be retrievable via raw SQL."""
        import db as db_module
        from db import save_keywords
        kw_list = ["Mangalore", "AI", "project"]
        row_id = save_keywords("I visited Mangalore", kw_list)
        conn = sqlite3.connect(db_module.DB_PATH)
        row = conn.execute("SELECT keywords_json FROM keywords WHERE id=?", (row_id,)).fetchone()
        conn.close()
        assert row is not None
        assert json.loads(row[0]) == kw_list

    def test_save_keywords_with_empty_list(self):
        """Saving an empty keyword list should not raise."""
        from db import save_keywords
        row_id = save_keywords("nothing extracted", [])
        assert isinstance(row_id, int)


# ─────────────────────────────────────────────────────────────────────────────
# 5. Database Retrieval
# ─────────────────────────────────────────────────────────────────────────────

class TestDatabaseRetrieval:
    """Tests keyword retrieval from SQLite."""

    def setup_method(self):
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        import db as db_module
        self._orig_db_path = db_module.DB_PATH
        db_module.DB_PATH = self.tmp.name
        db_module.init_db()

    def teardown_method(self):
        import db as db_module
        db_module.DB_PATH = self._orig_db_path
        os.unlink(self.tmp.name)

    def test_get_recent_keywords_returns_list(self):
        """get_recent_keywords should return a list."""
        from db import get_recent_keywords
        result = get_recent_keywords()
        assert isinstance(result, list)

    def test_get_recent_keywords_returns_saved_records(self):
        """Saved keywords should appear in get_recent_keywords() results."""
        from db import save_keywords, get_recent_keywords
        save_keywords("sentence one", ["alpha", "beta"])
        save_keywords("sentence two", ["gamma"])
        results = get_recent_keywords()
        assert len(results) == 2
        all_kw = [kw for r in results for kw in r["keywords"]]
        assert "alpha" in all_kw
        assert "gamma" in all_kw

    def test_get_recent_keywords_respects_limit(self):
        """Limit parameter should cap the number of returned records."""
        from db import save_keywords, get_recent_keywords
        for i in range(10):
            save_keywords(f"sentence {i}", [f"kw{i}"])
        results = get_recent_keywords(limit=3)
        assert len(results) == 3

    def test_get_recent_keywords_ordered_by_latest(self):
        """Most recent records should come first."""
        from db import save_keywords, get_recent_keywords
        save_keywords("first", ["first_kw"])
        time.sleep(0.01)
        save_keywords("last", ["last_kw"])
        results = get_recent_keywords(limit=2)
        assert results[0]["keywords"] == ["last_kw"]

    def test_get_keywords_by_id(self):
        """get_keywords_by_id should return the correct record."""
        from db import save_keywords, get_keywords_by_id
        row_id = save_keywords("hello world", ["hello", "world"])
        record = get_keywords_by_id(row_id)
        assert record is not None
        assert record["id"] == row_id
        assert record["keywords"] == ["hello", "world"]

    def test_get_keywords_by_id_missing(self):
        """get_keywords_by_id should return None for a missing ID."""
        from db import get_keywords_by_id
        assert get_keywords_by_id(99999) is None


# ─────────────────────────────────────────────────────────────────────────────
# 6. Visualization Data Generation
# ─────────────────────────────────────────────────────────────────────────────

class TestVisualizationData:
    """Tests the /api/extract-keywords endpoint that feeds the visualization."""

    @requires_flask
    def test_extract_keywords_endpoint_returns_200(self):
        """POST /api/extract-keywords should return HTTP 200."""
        response = requests.post(
            f"{FLASK_BASE_URL}/api/extract-keywords",
            json={"text": "I need water and food."},
            timeout=90,
        )
        assert response.status_code == 200

    @requires_flask
    def test_extract_keywords_endpoint_has_keywords_field(self):
        """Response should contain 'keywords' as a list."""
        response = requests.post(
            f"{FLASK_BASE_URL}/api/extract-keywords",
            json={"text": "I need a doctor urgently."},
            timeout=90,
        )
        data = response.json()
        assert "keywords" in data
        assert isinstance(data["keywords"], list)

    @requires_flask
    def test_extract_keywords_endpoint_has_db_id(self):
        """Response should include a positive integer DB row ID."""
        response = requests.post(
            f"{FLASK_BASE_URL}/api/extract-keywords",
            json={"text": "I visited Mangalore."},
            timeout=90,
        )
        data = response.json()
        assert "id" in data
        assert isinstance(data["id"], int)
        assert data["id"] > 0

    @requires_flask
    def test_extract_keywords_missing_text_returns_400(self):
        """Missing 'text' field should return HTTP 400."""
        response = requests.post(
            f"{FLASK_BASE_URL}/api/extract-keywords",
            json={},
            timeout=10,
        )
        assert response.status_code == 400

    @requires_flask
    def test_get_keywords_endpoint_returns_list(self):
        """GET /api/keywords should return a list of records."""
        response = requests.get(f"{FLASK_BASE_URL}/api/keywords", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert "keywords" in data
        assert isinstance(data["keywords"], list)


# ─────────────────────────────────────────────────────────────────────────────
# 7. API Health Indicator
# ─────────────────────────────────────────────────────────────────────────────

class TestApiHealthIndicator:
    """Tests the /api/health endpoint that drives the green/red status dot."""

    @requires_flask
    def test_health_endpoint_reachable(self):
        """GET /api/health should always respond (200 or 503)."""
        response = requests.get(f"{FLASK_BASE_URL}/api/health", timeout=10)
        assert response.status_code in (200, 503)

    @requires_flask
    def test_health_response_has_status_field(self):
        """Health response must contain 'status' key."""
        response = requests.get(f"{FLASK_BASE_URL}/api/health", timeout=10)
        data = response.json()
        assert "status" in data
        assert data["status"] in ("ok", "error")

    @requires_flask
    def test_health_response_has_model_available_field(self):
        """Health response must contain 'model_available' boolean."""
        response = requests.get(f"{FLASK_BASE_URL}/api/health", timeout=10)
        data = response.json()
        assert "model_available" in data
        assert isinstance(data["model_available"], bool)

    @requires_ollama
    def test_health_check_function_ok(self):
        """check_ollama_health() should return ok when Ollama is running."""
        from services.aiService import check_ollama_health
        result = check_ollama_health()
        assert result["status"] == "ok"

    def test_health_check_function_structure(self):
        """check_ollama_health() result must always have status + model_available."""
        from services.aiService import check_ollama_health
        result = check_ollama_health()
        assert "status" in result
        assert "model_available" in result
        assert result["status"] in ("ok", "error")
