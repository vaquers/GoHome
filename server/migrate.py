"""Run schema + seed migrations. Safe to run multiple times (idempotent)."""
import os
import psycopg2


def run():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL not set, skipping migrations")
        return

    base = os.path.dirname(__file__)
    files = [
        os.path.join(base, "db", "schema.sql"),
        os.path.join(base, "db", "seed.sql"),
    ]

    conn = psycopg2.connect(database_url)
    conn.autocommit = True
    cur = conn.cursor()

    for path in files:
        print(f"Running {path}...")
        with open(path, "r", encoding="utf-8") as f:
            sql = f.read()
        cur.execute(sql)
        print(f"  done.")

    cur.close()
    conn.close()
    print("Migrations complete.")

    # Import members from CSV
    from server.import_members import run as import_members
    import_members()


if __name__ == "__main__":
    run()
