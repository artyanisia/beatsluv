import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row

BACKEND_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_ROOT / ".env", encoding="utf-8-sig")

DATABASE_URL = os.getenv("DATABASE_URL")

def get_connection():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not set. Create a .env file first.")

    return psycopg.connect(DATABASE_URL, row_factory=dict_row, connect_timeout=5)


def get_db_connection():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not set. Create a .env file first.")

    return psycopg.connect(DATABASE_URL, connect_timeout=5)
