import os
import sys

import yaml

# Get directory of this script
directory = os.path.dirname(os.path.abspath(__file__))
path = os.path.join(directory, "openapi.yml")

# Load OpenAPI spec
with open(path, "r") as file:
    spec = yaml.safe_load(file)

tags_to_keep = sys.argv[1:] if len(sys.argv) > 1 else None
filtered_paths = {}

for path, methods in spec.get("paths", {}).items():
    for method, operation in methods.items():
        if "tags" in operation:
            for tag in tags_to_keep:
                if tag in operation["tags"]:
                    if path in filtered_paths:
                        filtered_paths[path][method] = operation
                    else:
                        filtered_paths[path] = {method: operation}
                    break


# Create a new spec with only the filtered paths
filtered_spec = spec.copy()
filtered_spec["paths"] = filtered_paths

# Save the filtered spec
with open(os.path.join(directory, "openapi_generated.yml"), "w") as file:
    yaml.dump(filtered_spec, file)
