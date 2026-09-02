#!/usr/bin/env python3

import argparse
import json
import os
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable
from urllib import parse, request


@dataclass(frozen=True)
class Metadata:
    repository: str
    environment: str
    suite: str
    runtime: str
    operating_system: str
    run_id: str
    run_attempt: str
    commit_sha: str
    run_url: str


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _duration(value: str | None) -> float:
    try:
        return float(value or 0)
    except ValueError:
        return 0


def parse_junit(path: Path) -> list[dict[str, Any]]:
    root = ET.parse(path).getroot()
    results: list[dict[str, Any]] = []

    for testcase in root.iter():
        if _local_name(testcase.tag) != "testcase":
            continue

        status = "passed"
        for child in testcase:
            child_name = _local_name(child.tag)
            if child_name in {"failure", "error", "skipped"}:
                status = "failed" if child_name == "failure" else child_name
                break

        result: dict[str, Any] = {
            "test.name": testcase.attrib.get("name", "unknown"),
            "test.class": testcase.attrib.get("classname", ""),
            "test.status": status,
            "test.duration_seconds": _duration(testcase.attrib.get("time")),
        }
        if testcase.attrib.get("file"):
            result["code.file.path"] = testcase.attrib["file"]
        results.append(result)

    return results


def _otel_value(value: Any) -> dict[str, Any]:
    if isinstance(value, bool):
        return {"boolValue": value}
    if isinstance(value, int):
        return {"intValue": str(value)}
    if isinstance(value, float):
        return {"doubleValue": value}
    return {"stringValue": str(value)}


def _otel_attributes(values: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        {"key": key, "value": _otel_value(value)}
        for key, value in values.items()
        if value != ""
    ]


def _resource_attributes(metadata: Metadata) -> dict[str, Any]:
    return {
        "service.name": "e2b-sdk-smoke-tests",
        "deployment.environment.name": metadata.environment,
        "test.suite": metadata.suite,
        "test.runtime": metadata.runtime,
        "os.type": metadata.operating_system,
        "vcs.repository.name": metadata.repository,
        "vcs.repository.ref.revision": metadata.commit_sha,
    }


def _common_record_attributes(metadata: Metadata) -> dict[str, Any]:
    return {
        "github.run.id": metadata.run_id,
        "github.run.attempt": metadata.run_attempt,
        "github.run.url": metadata.run_url,
    }


def _missing_report_status(test_step_outcome: str) -> str:
    if test_step_outcome == "skipped" or not test_step_outcome:
        return "not_run"
    if test_step_outcome == "failure":
        return "failed_before_results"
    if test_step_outcome == "cancelled":
        return "cancelled"
    return "missing_results"


def build_otlp_payload(
    metadata: Metadata,
    results: Iterable[dict[str, Any]],
    test_step_outcome: str,
    timestamp_ns: int | None = None,
) -> dict[str, Any]:
    parsed_results = list(results)
    common = _common_record_attributes(metadata)

    if parsed_results:
        events = [
            {"event.name": "sdk_test_result", **common, **result}
            for result in parsed_results
        ]
    else:
        events = [
            {
                "event.name": "sdk_test_suite",
                **common,
                "test.status": _missing_report_status(test_step_outcome),
                "test.count": 0,
            }
        ]

    first_timestamp = timestamp_ns if timestamp_ns is not None else time.time_ns()
    records = []
    for index, event in enumerate(events):
        failed = event["test.status"] in {
            "failed",
            "error",
            "failed_before_results",
        }
        records.append(
            {
                "timeUnixNano": str(first_timestamp + index),
                "observedTimeUnixNano": str(first_timestamp + index),
                "severityNumber": 17 if failed else 9,
                "severityText": "ERROR" if failed else "INFO",
                "body": {"stringValue": str(event["event.name"])},
                "attributes": _otel_attributes(event),
            }
        )

    return {
        "resourceLogs": [
            {
                "resource": {
                    "attributes": _otel_attributes(_resource_attributes(metadata))
                },
                "scopeLogs": [
                    {
                        "scope": {
                            "name": "github.com/e2b-dev/E2B/scripts/sdk-test-results"
                        },
                        "logRecords": records,
                    }
                ],
            }
        ]
    }


def _logs_endpoint(endpoint: str) -> str:
    return f"{endpoint.rstrip('/')}/v1/logs"


def _headers(encoded_headers: str) -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    for item in encoded_headers.split(","):
        if not item:
            continue
        key, separator, value = item.partition("=")
        if not separator or not key:
            raise ValueError("OTEL_EXPORTER_OTLP_HEADERS must contain key=value pairs")
        headers[parse.unquote(key.strip())] = parse.unquote(value.strip())
    return headers


def publish(endpoint: str, encoded_headers: str, payload: dict[str, Any]) -> None:
    outgoing = request.Request(
        _logs_endpoint(endpoint),
        data=json.dumps(payload).encode(),
        headers=_headers(encoded_headers),
        method="POST",
    )
    with request.urlopen(outgoing, timeout=30) as response:
        if response.status < 200 or response.status >= 300:
            raise RuntimeError(f"OTLP endpoint returned HTTP {response.status}")


def _required_environment(name: str) -> str:
    value = os.environ.get(name, "")
    if not value:
        raise ValueError(f"{name} is required")
    return value


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument("--results", type=Path, required=True)
    parser.add_argument("--environment", required=True)
    parser.add_argument("--suite", required=True)
    parser.add_argument("--runtime", required=True)
    parser.add_argument("--os", dest="operating_system", required=True)
    parser.add_argument("--test-step-outcome", default="")
    return parser


def main() -> int:
    args = _parser().parse_args()
    results = parse_junit(args.results) if args.results.exists() else []
    repository = _required_environment("GITHUB_REPOSITORY")
    server_url = _required_environment("GITHUB_SERVER_URL")
    run_id = _required_environment("GITHUB_RUN_ID")
    metadata = Metadata(
        repository=repository,
        environment=args.environment,
        suite=args.suite,
        runtime=args.runtime,
        operating_system=args.operating_system,
        run_id=run_id,
        run_attempt=os.environ.get("GITHUB_RUN_ATTEMPT", "1"),
        commit_sha=_required_environment("GITHUB_SHA"),
        run_url=f"{server_url}/{repository}/actions/runs/{run_id}",
    )
    payload = build_otlp_payload(
        metadata=metadata,
        results=results,
        test_step_outcome=args.test_step_outcome,
    )
    publish(
        endpoint=_required_environment("OTEL_EXPORTER_OTLP_ENDPOINT"),
        encoded_headers=_required_environment("OTEL_EXPORTER_OTLP_HEADERS"),
        payload=payload,
    )
    records = payload["resourceLogs"][0]["scopeLogs"][0]["logRecords"]
    print(f"Published {len(records)} SDK test result events over OTLP")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
