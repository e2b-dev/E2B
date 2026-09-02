#!/usr/bin/env python3

import argparse
import base64
import json
import os
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable
from urllib import request


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
            "test": testcase.attrib.get("name", "unknown"),
            "class": testcase.attrib.get("classname", ""),
            "status": status,
            "duration_seconds": _duration(testcase.attrib.get("time")),
        }
        if testcase.attrib.get("file"):
            result["file"] = testcase.attrib["file"]
        results.append(result)

    return results


def _labels(metadata: Metadata) -> dict[str, str]:
    return {
        "service_name": "e2b-sdk-tests",
        "repository": metadata.repository,
        "environment": metadata.environment,
        "suite": metadata.suite,
        "runtime": metadata.runtime,
        "os": metadata.operating_system,
    }


def _common_event(metadata: Metadata) -> dict[str, Any]:
    return {
        "github_run_id": metadata.run_id,
        "github_run_attempt": metadata.run_attempt,
        "commit_sha": metadata.commit_sha,
        "run_url": metadata.run_url,
    }


def _missing_report_status(test_step_outcome: str) -> str:
    if test_step_outcome == "skipped" or not test_step_outcome:
        return "not_run"
    if test_step_outcome == "failure":
        return "failed_before_results"
    if test_step_outcome == "cancelled":
        return "cancelled"
    return "missing_results"


def build_loki_payload(
    metadata: Metadata,
    results: Iterable[dict[str, Any]],
    test_step_outcome: str,
    timestamp_ns: int | None = None,
) -> dict[str, Any]:
    parsed_results = list(results)
    common = _common_event(metadata)

    if parsed_results:
        events = [
            {
                "event": "sdk_test_result",
                **common,
                **result,
            }
            for result in parsed_results
        ]
    else:
        events = [
            {
                "event": "sdk_test_suite",
                **common,
                "status": _missing_report_status(test_step_outcome),
                "test_count": 0,
            }
        ]

    first_timestamp = timestamp_ns if timestamp_ns is not None else time.time_ns()
    values = [
        [str(first_timestamp + index), json.dumps(event, separators=(",", ":"))]
        for index, event in enumerate(events)
    ]
    return {"streams": [{"stream": _labels(metadata), "values": values}]}


def publish(
    endpoint: str,
    username: str,
    api_key: str,
    payload: dict[str, Any],
) -> None:
    credentials = base64.b64encode(f"{username}:{api_key}".encode()).decode()
    outgoing = request.Request(
        endpoint,
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with request.urlopen(outgoing, timeout=30) as response:
        if response.status < 200 or response.status >= 300:
            raise RuntimeError(f"Grafana Loki returned HTTP {response.status}")


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
    payload = build_loki_payload(
        metadata=metadata,
        results=results,
        test_step_outcome=args.test_step_outcome,
    )
    publish(
        endpoint=_required_environment("GRAFANA_LOKI_URL"),
        username=_required_environment("GRAFANA_LOKI_USER"),
        api_key=_required_environment("GRAFANA_CLOUD_API_KEY"),
        payload=payload,
    )
    print(f"Published {len(payload['streams'][0]['values'])} SDK test result events")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
