"""
Special step name for the finalization phase of template building.
This is the last step that runs after all user-defined instructions.
"""

FINALIZE_STEP_NAME = "finalize"

"""
Special step name for the base image phase of template building.
This is the first step that sets up the base image.
"""
BASE_STEP_NAME = "base"

"""
Stack trace depth for capturing caller information.

Depth levels:
1. TemplateClass
2. Caller method (e.g., copy(), from_image(), etc.)

This depth is used to determine the original caller's location
for stack traces.
"""
STACK_TRACE_DEPTH = 2

"""
Default setting for whether to resolve symbolic links when copying files.
When False, symlinks are copied as symlinks rather than following them.
"""
RESOLVE_SYMLINKS = False

"""
Default timeout (in seconds) for uploading the build-context archive to the
S3 presigned URL. Uploads of large archives can take far longer than the 60s
general API request timeout, so the upload uses a 1-hour default unless the
caller passes an explicit ``request_timeout``. This matches the JS SDK's
``FILE_UPLOAD_TIMEOUT_MS``.
"""
FILE_UPLOAD_TIMEOUT_SECONDS = 3600
