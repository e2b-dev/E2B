"""Helpers for testing the SDK's envd version gates."""

from packaging.version import Version


def below_envd_version(version: Version) -> str:
    """The highest envd version below one of the `ENVD_*` thresholds.

    Lets a gate's reject branch be exercised without hardcoding a version that
    stops being below the threshold when it moves — a release candidate of a
    version sorts below the version itself.
    """
    return f"{version}rc1"
