import csv
import time

import pytest


@pytest.hookimpl(tryfirst=True)
def pytest_configure():
    with open("results.csv", "w") as f:
        writer = csv.DictWriter(f, ["test_name", "duration"])
        writer.writeheader()


@pytest.fixture(autouse=True)
def record(request):
    test_name = request.node.name
    start = time.time()
    yield
    end = time.time()
    with open("results.csv", "a") as f:
        writer = csv.DictWriter(f, ["test_name", "duration"])
        writer.writerow({"test_name": test_name, "duration": round(end - start, 4)})
