"""`e2b/sandbox/mcp.py` is generated from Docker's MCP catalog, and reads as
fully covered only because TypedDict class bodies run on import — nothing
asserts the shape it generates. These fixtures are annotated so that `ty check`
(which covers this directory) fails when a catalog refresh drops or renames a
server, or changes what one takes, instead of the option quietly reshaping.

The TypedDicts are generated `closed=True`, which is what makes an unknown
server an error rather than an ignored key.
"""

from e2b import McpServer
from e2b.sandbox.mcp import McpServer as CatalogServers

# One server of each shape the catalog produces: no options at all, a single
# credential, an array parameter, and a nested parameter object flattened into
# one name.
SERVERS: McpServer = {
    "docker": {},
    "exa": {"apiKey": "exa-key"},
    "filesystem": {"paths": ["/home/user"]},
    "githubOfficial": {"githubPersonalAccessToken": "gh-token"},
    "atlassian": {
        "confluenceUrl": "https://acme.atlassian.net/wiki",
        "jiraUrl": "https://acme.atlassian.net",
        "jiraApiToken": "jira-token",
    },
}


def test_every_configured_server_is_in_the_generated_type():
    assert set(SERVERS) <= set(CatalogServers.__annotations__)


def test_servers_the_catalog_dropped_are_gone():
    for dropped in ("postgres", "tembo", "flexprice", "root", "triplewhale"):
        assert dropped not in CatalogServers.__annotations__
