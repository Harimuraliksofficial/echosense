import sqlite3
import os
import json
import contextlib

DB_PATH = 'ecosense.db'

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    if not os.path.exists(DB_PATH):
        print("Initializing new SQLite database at", DB_PATH)
    
    with contextlib.closing(get_db_connection()) as conn:
        with conn:
            # Existing table – kept for Canvas / Segmind image generation
            conn.execute('''
                CREATE TABLE IF NOT EXISTS generations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sketch_text TEXT,
                    sketch_b64 TEXT NOT NULL,
                    output_b64 TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            # New table for Ollama-extracted keywords
            conn.execute('''
                CREATE TABLE IF NOT EXISTS keywords (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source_text TEXT NOT NULL,
                    keywords_json TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            # New table for Conversation History
            conn.execute('''
                CREATE TABLE IF NOT EXISTS history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    message_text TEXT NOT NULL,
                    keywords_json TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
    print("[DB] Database initialized (generations + keywords tables ready).")

# ── Generations (Segmind image generation) ─────────────────────────────────

def save_generation(sketch_b64, output_b64, sketch_text=""):
    with contextlib.closing(get_db_connection()) as conn:
        with conn:
            cursor = conn.execute(
                'INSERT INTO generations (sketch_b64, output_b64, sketch_text) VALUES (?, ?, ?)',
                (sketch_b64, output_b64, sketch_text)
            )
            return cursor.lastrowid

# ── Keywords (Ollama Mistral extraction) ────────────────────────────────────

def save_keywords(source_text: str, keywords_list: list) -> int:
    """
    Persist an extracted keyword list to the database.

    Parameters
    ----------
    source_text : str
        The original sentence / paragraph the keywords were extracted from.
    keywords_list : list
        A Python list of keyword strings, e.g. ["Mangalore", "AI", "project"].

    Returns
    -------
    int
        The primary key of the newly inserted row.
    """
    keywords_json = json.dumps(keywords_list, ensure_ascii=False)
    with contextlib.closing(get_db_connection()) as conn:
        with conn:
            cursor = conn.execute(
                'INSERT INTO keywords (source_text, keywords_json) VALUES (?, ?)',
                (source_text, keywords_json)
            )
            row_id = cursor.lastrowid
            print(f"[DB] Saved keywords (id={row_id}): {keywords_list}")
            return row_id

def get_recent_keywords(limit: int = 50) -> list:
    """
    Retrieve the most recent keyword extraction records.

    Returns
    -------
    list of dict
        Each dict has keys: id, source_text, keywords (list), created_at.
    """
    with contextlib.closing(get_db_connection()) as conn:
        rows = conn.execute(
            'SELECT id, source_text, keywords_json, created_at '
            'FROM keywords ORDER BY created_at DESC LIMIT ?',
            (limit,)
        ).fetchall()
    
    result = []
    for row in rows:
        try:
            kw = json.loads(row['keywords_json'])
        except (json.JSONDecodeError, TypeError):
            kw = []
        result.append({
            'id': row['id'],
            'source_text': row['source_text'],
            'keywords': kw,
            'created_at': row['created_at'],
        })
    return result

def get_keywords_by_id(record_id: int) -> dict | None:
    """Fetch a single keyword record by its primary key."""
    with contextlib.closing(get_db_connection()) as conn:
        row = conn.execute(
            'SELECT id, source_text, keywords_json, created_at FROM keywords WHERE id = ?',
            (record_id,)
        ).fetchone()
    
    if row is None:
        return None
    
    try:
        kw = json.loads(row['keywords_json'])
    except (json.JSONDecodeError, TypeError):
        kw = []
    
    return {
        'id': row['id'],
        'source_text': row['source_text'],
        'keywords': kw,
        'created_at': row['created_at'],
    }

# ── Conversation History ────────────────────────────────────────────────────

def save_history(message_text: str, keywords_list: list) -> int:
    keywords_json = json.dumps(keywords_list, ensure_ascii=False)
    with contextlib.closing(get_db_connection()) as conn:
        with conn:
            cursor = conn.execute(
                'INSERT INTO history (message_text, keywords_json) VALUES (?, ?)',
                (message_text, keywords_json)
            )
            return cursor.lastrowid

def get_history() -> list:
    """Retrieve history from the last 24 hours."""
    with contextlib.closing(get_db_connection()) as conn:
        rows = conn.execute(
            "SELECT id, message_text, keywords_json, created_at "
            "FROM history WHERE created_at >= datetime('now', '-1 day') "
            "ORDER BY created_at DESC"
        ).fetchall()
    
    result = []
    for row in rows:
        try:
            kw = json.loads(row['keywords_json'])
        except (json.JSONDecodeError, TypeError):
            kw = []
        result.append({
            'id': row['id'],
            'message_text': row['message_text'],
            'keywords': kw,
            'created_at': row['created_at'],
        })
    return result

def clear_history():
    """Clear all records from the history table."""
    with contextlib.closing(get_db_connection()) as conn:
        with conn:
            conn.execute('DELETE FROM history')
