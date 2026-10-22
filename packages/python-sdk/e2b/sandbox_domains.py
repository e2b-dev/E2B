SUPPORTED_SANDBOX_DOMAINS = (
    "e2b.app",
    "e2b.dev",
    "e2b.pro",
    "e2b-staging.dev",
    "e2b-tango.dev",
    "e2b-juliett.dev",
    "foxtrot-2.e2b.dev",
)


def is_supported_sandbox_domain(sandbox_domain: str) -> bool:
    return sandbox_domain in SUPPORTED_SANDBOX_DOMAINS
