# E2B's domains. Each serves the stable `sandbox.<domain>` host, and the SDK
# follows the control plane E2B's API proxy names only to one of them (see
# e2b.plane_routing).
SUPPORTED_SANDBOX_DOMAINS = (
    "e2b.app",
    "e2b.dev",
    "e2b.pro",
    "e2b-staging.dev",
    "e2b-foxtrot.dev",
    "e2b-tango.dev",
    "e2b-juliett.dev",
    "foxtrot-2.e2b.dev",
    "foxtrot-3.e2b.dev",
)


def is_supported_sandbox_domain(sandbox_domain: str) -> bool:
    return sandbox_domain in SUPPORTED_SANDBOX_DOMAINS
