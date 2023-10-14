import platform
from importlib import metadata

default_headers = {
    "package_version": metadata.version("e2b"),
    "lang": "python",
    "lang_version": platform.python_version(),
    "system": platform.system(),
    "os": platform.platform(),
    "publisher": "e2b",
    "release": platform.release(),
    "machine": platform.machine(),
    "processor": platform.processor(),
}
