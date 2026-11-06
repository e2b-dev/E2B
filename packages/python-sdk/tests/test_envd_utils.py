"""Tests for e2b.envd.utils.timeout_to_ms."""

from e2b.envd.utils import timeout_to_ms


class TestTimeoutToMs:
    def test_none(self):
        assert timeout_to_ms(None) is None

    def test_zero(self):
        assert timeout_to_ms(0) is None

    def test_positive(self):
        assert timeout_to_ms(1.0) == 1000

    def test_half_second(self):
        assert timeout_to_ms(0.5) == 500

    def test_sub_millisecond(self):
        """Sub-millisecond timeouts should map to at least 1ms."""
        assert timeout_to_ms(0.0001) == 1

    def test_negative_returns_none(self):
        """Negative timeouts should be treated as disabled (None), not 1ms."""
        assert timeout_to_ms(-1.0) is None

    def test_small_negative_returns_none(self):
        assert timeout_to_ms(-0.001) is None

    def test_large_positive(self):
        assert timeout_to_ms(30.0) == 30000
