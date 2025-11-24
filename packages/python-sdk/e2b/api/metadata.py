import platform

from importlib import metadata

package_version = metadata.version("e2b")

default_headers = {
    "lang": "python",
    "lang_version": platform.python_version(),
    "package_version": metadata.version("e2b"),
    "publisher": "e2b",
    "sdk_runtime": "python",
    "system": platform.system(),
}
