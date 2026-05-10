import os
import psycopg2
from contextlib import contextmanager

def _get_connection():
    database_url = os.environ.get("DATABASE_URL")
    if database_url:
        return psycopg2.connect(database_url)
    return psycopg2.connect(
        dbname=os.environ.get("DB_NAME", "mister"),
        user=os.environ.get("DB_USER", "postgres"),
        password=os.environ.get("DB_PASSWORD", ""),
        host=os.environ.get("DB_HOST", "localhost"),
        port=os.environ.get("DB_PORT", "5432"),
    )

@contextmanager
def get_db():
    conn = _get_connection()
    conn.autocommit = False
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def fetch_all(query, params=None):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(query, params)
        rows = cur.fetchall()
        cur.close()
        return rows

def fetch_one(query, params=None):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(query, params)
        row = cur.fetchone()
        cur.close()
        return row

def execute(query, params=None):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(query, params)
        cur.close()

def execute_returning(query, params=None):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(query, params)
        row = cur.fetchone()
        cur.close()
        return row
