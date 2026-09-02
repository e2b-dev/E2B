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
            [result["status"] for result in results],
            ["passed", "failed", "error", "skipped"],
        )
        self.assertEqual(results[0]["test"], "creates a sandbox")
        self.assertEqual(results[0]["class"], "sandbox")
        self.assertEqual(results[0]["duration_seconds"], 0.25)
        serialized = json.dumps(results)
        self.assertNotIn("secret response body", serialized)
        self.assertNotIn("secret stack trace", serialized)


class BuildPayloadTests(unittest.TestCase):
    def test_keeps_test_names_in_log_body_instead_of_loki_labels(self) -> None:
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

        payload = publish_sdk_test_results.build_loki_payload(
            metadata=metadata,
            results=[
                {
                    "test": "creates a sandbox",
                    "class": "sandbox",
                    "status": "failed",
                    "duration_seconds": 0.25,
                }
            ],
            test_step_outcome="failure",
            timestamp_ns=1_000,
        )

        self.assertEqual(len(payload["streams"]), 1)
        stream = payload["streams"][0]
        self.assertEqual(stream["stream"]["suite"], "js-sdk")
        self.assertNotIn("test", stream["stream"])
        timestamp, line = stream["values"][0]
        self.assertEqual(timestamp, "1000")
        event = json.loads(line)
        self.assertEqual(event["test"], "creates a sandbox")
        self.assertEqual(event["status"], "failed")
        self.assertEqual(event["github_run_id"], "123")

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

        payload = publish_sdk_test_results.build_loki_payload(
            metadata=metadata,
            results=[],
            test_step_outcome="skipped",
            timestamp_ns=2_000,
        )

        event = json.loads(payload["streams"][0]["values"][0][1])
        self.assertEqual(event["event"], "sdk_test_suite")
        self.assertEqual(event["status"], "not_run")
        self.assertEqual(event["test_count"], 0)


class PublishTests(unittest.TestCase):
    @mock.patch("scripts.publish_sdk_test_results.request.urlopen")
    def test_posts_loki_json_with_basic_auth(self, urlopen: mock.Mock) -> None:
        response = mock.MagicMock()
        response.__enter__.return_value.status = 204
        urlopen.return_value = response

        publish_sdk_test_results.publish(
            endpoint="https://logs.example.com/loki/api/v1/push",
            username="12345",
            api_key="token",
            payload={"streams": []},
        )

        sent_request = urlopen.call_args.args[0]
        self.assertEqual(
            sent_request.full_url, "https://logs.example.com/loki/api/v1/push"
        )
        self.assertEqual(sent_request.headers["Content-type"], "application/json")
        self.assertTrue(sent_request.headers["Authorization"].startswith("Basic "))


if __name__ == "__main__":
    unittest.main()
