import csv
import pytest


@pytest.hookimpl(tryfirst=True)
def pytest_configure():
    with open("results.csv", "w") as f:
        writer = csv.DictWriter(f, ["test_name", "duration", "outcome"])
        writer.writeheader()


def pytest_report_teststatus(report):
    if report.when == "call":  # <-- Added this line
        with open("results.csv", "a") as f:
            writer = csv.DictWriter(f, ["test_name", "duration", "outcome"])
            writer.writerow(
                {
                    "test_name": report.nodeid,
                    "duration": round(report.duration, 4),
                    "outcome": report.outcome,
                }
            )
