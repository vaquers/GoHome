"""Import members from members.csv into the members table."""
import os
import csv
import psycopg2


def run():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL not set, skipping members import")
        return

    csv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "members.csv")
    if not os.path.exists(csv_path):
        print(f"members.csv not found at {csv_path}, skipping")
        return

    conn = psycopg2.connect(database_url)
    conn.autocommit = True
    cur = conn.cursor()

    count = 0
    with open(csv_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip().strip('"')
            if not line:
                continue
            parts = line.split()
            if len(parts) < 2:
                continue
            last_name = parts[0].strip()
            first_name = parts[1].strip() if len(parts) > 1 else ""
            middle_name = parts[2].strip() if len(parts) > 2 else ""
            full_name = f"{last_name} {first_name} {middle_name}".strip()

            cur.execute(
                "INSERT INTO members (last_name, first_name, middle_name, full_name) "
                "VALUES (%s, %s, %s, %s) ON CONFLICT (last_name, first_name, middle_name) DO NOTHING",
                (last_name, first_name, middle_name, full_name),
            )
            count += 1

    cur.close()
    conn.close()
    print(f"Members import complete: {count} rows processed.")


if __name__ == "__main__":
    run()
