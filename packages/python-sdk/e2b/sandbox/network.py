"""
Network configuration helpers for E2B sandboxes.
"""


def all_traffic() -> str:
    """
    Returns the CIDR range that represents all traffic.

    :return: CIDR notation for all IPv4 addresses (0.0.0.0/0)
    """
    return "0.0.0.0/0"
