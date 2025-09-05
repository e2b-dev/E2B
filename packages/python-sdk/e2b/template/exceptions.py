class BuildException(Exception):
    """
    Raised when a build fails.
    """


class FileUploadException(BuildException):
    """
    Raised when a file upload fails.
    """
