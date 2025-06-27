import base64
import hashlib
import time

from typing import Optional, TypedDict, Literal

Operation = Literal["read", "write"]

class Signature(TypedDict):
    signature: str
    expiration: Optional[int]  # Unix timestamp or None


def get_signature(
    path: str,
    operation: Operation,
    user: str,
    envd_access_token: Optional[str],
    expiration_in_seconds: Optional[int] = None,
) -> Signature:
    """
    Generate a v1 signature for sandbox file URLs.
    """
    if not envd_access_token:
        raise ValueError("Access token is not set and signature cannot be generated!")

    expiration = (
        int(time.time()) + expiration_in_seconds if expiration_in_seconds else None
    )

    raw = (
        f"{path}:{operation}:{user}:{envd_access_token}"
        if expiration is None
        else f"{path}:{operation}:{user}:{envd_access_token}:{expiration}"
    )

    digest = hashlib.sha256(raw.encode("utf-8")).digest()
    encoded = base64.b64encode(digest).rstrip(b"=").decode("ascii")

    return {"signature": f"v1_{encoded}", "expiration": expiration}
