# Configuration file for jupyter-server.

c = get_config()  # noqa

c.ServerApp.sock = "/run/e2b-jupyter/server.sock"
c.ServerApp.sock_mode = "0600"


# Pin the contents root directory.
#
#         Sessions are created with a relative path (a bare uuid, see
#         server/contexts.py). Without an explicit root_dir, jupyter-server
#         inherits the process working directory as its root — which is "/"
#         under systemd (jupyter.service has no WorkingDirectory). Since
#         jupyter-server 2.18.0 (CVE-2026-35397 path-traversal hardening), a
#         root_dir of "/" makes every POST /api/sessions fail with
#         "<uuid> is outside root contents directory", so the server never
#         starts. Pinning it to /home/user matches the execution cwd.
c.ServerApp.root_dir = "/home/user"


# Set the Access-Control-Allow-Origin header
#
#          Use '*' to allow any origin to access your server.
#
#          Takes precedence over allow_origin_pat.
#  Default: ''
c.ServerApp.allow_origin = ""


# Allow requests where the Host header doesn't point to a local server
#
#         By default, requests get a 403 forbidden response if the 'Host' header
#         shows that the browser thinks it's on a non-local domain.
#         Setting this option to True disables this check.
#
#         This protects against 'DNS rebinding' attacks, where a remote web server
#         serves you a page and then changes its DNS to send later requests to a
#         local IP, bypassing same-origin checks.
#
#         Local IP addresses (such as 127.0.0.1 and ::1) are allowed as local,
#         along with hostnames configured in local_hostnames.
#  Default: False
c.ServerApp.allow_remote_access = False

# Disable cross-site-request-forgery protection
#
#          Jupyter server includes protection from cross-site request forgeries,
#          requiring API requests to either:
#
#          - originate from pages served by this server (validated with XSRF cookie and token), or
#          - authenticate with a token
#
#          Some anonymous compute resources still desire the ability to run code,
#          completely without authentication.
#          These services can disable all authentication and security checks,
#          with the full knowledge of what that implies.
#  Default: False
c.ServerApp.disable_check_xsrf = True

# Whether to allow the user to run the server as root.
#  Default: False
c.ServerApp.allow_root = True

# (bytes/sec) Maximum rate at which messages can be sent on iopub before they are limited.
#  Default: 1000000
c.ServerApp.iopub_data_rate_limit = 1000000000
