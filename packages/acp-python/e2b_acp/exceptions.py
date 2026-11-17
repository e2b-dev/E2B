class ACPException(Exception):
    """
    Raised when the agent breaks the connection: it sends a message over
    `max_message_bytes` or exits with a non-zero code.
    """
