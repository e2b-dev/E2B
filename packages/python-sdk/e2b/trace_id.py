import re

from typing import Mapping, Optional

_AWS_ROOT_PATTERN = re.compile(r"\A1-([0-9a-f]{8})-([0-9a-f]{24})\Z", re.IGNORECASE)


def extract_trace_id(headers: Optional[Mapping[str, str]] = None) -> Optional[str]:
    """Extract a trace ID from the HTTP response headers of a failed request,
    so it can be reported to E2B and correlated with server-side traces.

    The SDK does this for the exceptions it raises — reach for it when you
    handle an E2B response yourself.

    Headers are checked in order:

    1. ``X-Trace-ID`` — used verbatim when present.
    2. ``X-Cloud-Trace-Context`` (GCP edge) — ``TRACE_ID/SPAN_ID;o=OPTIONS``,
       the part before ``/`` is the trace ID.
    3. ``X-Amzn-Trace-Id`` (AWS edge) — ``Root=1-<8 hex>-<24 hex>;...``, the
       two hex parts joined are the 32-hex trace ID the server logs.

    :param headers: Response headers of the failed request.
    :return: The trace ID, or ``None`` when no trace header is present.
    """
    if headers is None:
        return None

    # httpx.Headers is case-insensitive, but plain dicts are not
    lowered = {key.lower(): value for key, value in headers.items()}

    direct = (lowered.get("x-trace-id") or "").strip()
    if direct:
        return direct

    gcp = (lowered.get("x-cloud-trace-context") or "").split("/")[0].strip()
    if gcp:
        return gcp

    aws = lowered.get("x-amzn-trace-id") or ""
    for field in aws.split(";"):
        key, _, value = field.strip().partition("=")
        if key.lower() != "root" or not value:
            continue

        match = _AWS_ROOT_PATTERN.match(value)
        return match.group(1) + match.group(2) if match else value

    return None
