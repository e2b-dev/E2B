from e2b.envd.utils import timeout_to_ms


def test_timeout_to_ms():
    assert timeout_to_ms(60) == 60_000
    assert timeout_to_ms(0.5) == 500
    assert timeout_to_ms(0.1) == 100
    # A positive sub-millisecond timeout must stay a deadline — a 0 would be
    # discarded by connectrpc's `timeout_ms or default` fallback, disabling
    # the deadline entirely.
    assert timeout_to_ms(0.0005) == 1
    # Disabled timeouts must map to None — connectrpc treats a non-positive
    # deadline as already expired.
    assert timeout_to_ms(0) is None
    assert timeout_to_ms(None) is None
