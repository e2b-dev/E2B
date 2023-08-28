import csv
import os
from urllib.parse import urlparse

import psycopg2

database_url = urlparse(os.getenv("SUPABASE_POSTGRES_URL"))

user = database_url.username
password = database_url.password
database = database_url.path[1:]
host = database_url.hostname


# Read the results.csv file
with open("results.csv", "r") as f:
    reader = csv.DictReader(f)
    results = list(reader)

# Connect to the database
conn = psycopg2.connect(
    host=host,
    database=database,
    user=user,
    password=password,
)

# Create a cursor
cur = conn.cursor()

# Insert all results into the database
cur.execute(
    "INSERT INTO tests.test_results (test_name, duration) VALUES (%s, %s)",
    [(result["test_name"], result["duration"]) for result in results],
)

# Commit the changes
conn.commit()

# Close the cursor and connection
cur.close()
conn.close()
