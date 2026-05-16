import os

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row


load_dotenv()


DATABASE_URL = os.getenv("DATABASE_URL")


def get_connection():
    """
    Create a new PostgreSQL connection.

    row_factory=dict_row makes SELECT results look like dictionaries:
    {"id": 1, "title": "Song"} instead of tuples like (1, "Song").
    """
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not set. Create a .env file first.")

    return psycopg.connect(DATABASE_URL, row_factory=dict_row)
