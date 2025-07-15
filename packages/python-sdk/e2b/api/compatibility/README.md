# Compatibility

Python OpenAPI generated client does not support `explode: false` for query parameters. This means the state parameter won't be in the `q=state1,state2` format.
In this directory there is a workaround to support this.

In the `modified_get_v2_sandboxes.py` file, we manually add handling for the `state` parameter.
When you regenerate the client we move the file from the `client/api/sandboxes` directory to this directory and rename it to `unused_get_v2_sandboxes.py` to have a reference to the changed file.

When you change the `/v2/sandboxes` endpoint, you need to update the `modified_get_v2_sandboxes.py` file here.
