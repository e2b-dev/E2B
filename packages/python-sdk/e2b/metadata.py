import platform

from importlib import metadata

default_headers = {
    "lang": "python",
    "lang_version": platform.python_version(),
    "machine": platform.machine(),
    "os": platform.platform(),
    "package_version": metadata.version("e2b"),
    "processor": platform.processor(),
    "publisher": "e2b",
    "release": platform.release(),
    "sdk_runtime": "python",
    "system": platform.system(),
}
