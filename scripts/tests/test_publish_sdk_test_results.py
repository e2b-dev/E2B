import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from scripts import publish_sdk_test_results


class ParseJunitTests(unittest.TestCase):
    def test_parses_test_statuses_without_failure_output(self) -> None:
        report = """\
<testsuites tests="4" failures="1" errors="1" skipped="1" time="1.5">
  <testsuite name="sdk" tests="4">
    <testcase classname="sandbox" name="creates a sandbox" time="0.25" />
    <testcase classname="sandbox" name="reports an API error" time="0.5">
      <failure message="request failed">secret response body</failure>
    </testcase>
    <testcase classname="sandbox" name="handles transport errors" time="0.75">
      <error message="connection reset">secret stack trace</error>
    </testcase>
    <testcase classname="sandbox" name="requires credentials" time="0">
      <skipped />
    </testcase>
  </testsuite>
</testsuites>
"""
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory, "results.xml")
            path.write_text(report)

            results = publish_sdk_test_results.parse_junit(path)

        self.assertEqual(
            [result["test.status"] for result in results],
            ["passed", "failed", "error", "skipped"],
        )
        self.assertEqual(results[0]["test.name"], "creates a sandbox")
        self.assertEqual(results[0]["test.class"], "sandbox")
        self.assertEqual(results[0]["test.duration_seconds"], 0.25)
        serialized = json.dumps(results)
        self.assertNotIn("secret response body", serialized)
        self.assertNotIn("secret stack trace", serialized)


class BuildPayloadTests(unittest.TestCase):
    def test_builds_otlp_log_records_for_individual_tests(self) -> None:
        metadata = publish_sdk_test_results.Metadata(
            repository="e2b-dev/E2B",
            environment="production",
            suite="js-sdk",
            runtime="node",
            operating_system="Linux",
            run_id="123",
            run_attempt="2",
            commit_sha="abc123",
            run_url="https://github.com/e2b-dev/E2B/actions/runs/123",
        )

        payload = publish_sdk_test_results.build_otlp_payload(
            metadata=metadata,
            results=[
                {
                    "test.name": "creates a sandbox",
                    "test.class": "sandbox",
                    "test.status": "failed",
                    "test.duration_seconds": 0.25,
                }
            ],
            test_step_outcome="failure",
            timestamp_ns=1_000,
        )

        resource_logs = payload["resourceLogs"][0]
        resource = self._attributes(resource_logs["resource"]["attributes"])
        self.assertEqual(resource["service.name"], "e2b-sdk-smoke-tests")
        self.assertEqual(resource["test.suite"], "js-sdk")

        record = resource_logs["scopeLogs"][0]["logRecords"][0]
        attributes = self._attributes(record["attributes"])
        self.assertEqual(record["timeUnixNano"], "1000")
        self.assertEqual(record["severityText"], "ERROR")
        self.assertEqual(record["body"]["stringValue"], "sdk_test_result")
        self.assertEqual(attributes["test.name"], "creates a sandbox")
        self.assertEqual(attributes["test.status"], "failed")
        self.assertEqual(attributes["github.run.id"], "123")

    def test_emits_suite_event_when_test_report_is_missing(self) -> None:
        metadata = publish_sdk_test_results.Metadata(
            repository="e2b-dev/E2B",
            environment="production",
            suite="python-sdk",
            runtime="python",
            operating_system="Linux",
            run_id="456",
            run_attempt="1",
            commit_sha="def456",
            run_url="https://github.com/e2b-dev/E2B/actions/runs/456",
        )

        payload = publish_sdk_test_results.build_otlp_payload(
            metadata=metadata,
            results=[],
            test_step_outcome="skipped",
            timestamp_ns=2_000,
        )

        record = payload["resourceLogs"][0]["scopeLogs"][0]["logRecords"][0]
        attributes = self._attributes(record["attributes"])
        self.assertEqual(record["body"]["stringValue"], "sdk_test_suite")
        self.assertEqual(attributes["test.status"], "not_run")
        self.assertEqual(attributes["test.count"], "0")

    @staticmethod
    def _attributes(attributes: list[dict[str, object]]) -> dict[str, object]:
        parsed = {}
        for attribute in attributes:
            value = attribute["value"]
            parsed[attribute["key"]] = next(iter(value.values()))
        return parsed


class PublishTests(unittest.TestCase):
    @mock.patch("scripts.publish_sdk_test_results.request.urlopen")
    def test_posts_otlp_json_with_standard_encoded_headers(
        self, urlopen: mock.Mock
    ) -> None:
        response = mock.MagicMock()
        response.__enter__.return_value.status = 200
        urlopen.return_value = response

        publish_sdk_test_results.publish(
            endpoint="https://otlp.example.com/otlp",
            encoded_headers="Authorization=Basic%20abc123,X-Scope-OrgID=42",
            payload={"resourceLogs": []},
        )

        sent_request = urlopen.call_args.args[0]
        self.assertEqual(sent_request.full_url, "https://otlp.example.com/otlp/v1/logs")
        self.assertEqual(sent_request.headers["Content-type"], "application/json")
        self.assertEqual(sent_request.headers["Authorization"], "Basic abc123")
        self.assertEqual(sent_request.headers["X-scope-orgid"], "42")


if __name__ == "__main__":
    unittest.main()
