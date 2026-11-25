import os
import sqlite3
from pathlib import Path
import config


def get_connection(db_name=None):
    use_default = db_name is None

    if db_name is None:
        db_name = config.DB_NAME

    if use_default and os.environ.get("VERCEL") == "1":
        db_path = Path(__file__).resolve().parent / db_name
        db_uri = db_path.as_uri() + "?mode=ro"
        conn = sqlite3.connect(db_uri, uri=True)
    else:
        conn = sqlite3.connect(db_name, uri=db_name.startswith("file:"))

    conn.execute("PRAGMA foreign_keys = ON")
    conn.row_factory = sqlite3.Row
    return conn
