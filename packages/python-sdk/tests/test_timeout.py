import pytest

from e2b import Session
from e2b.session.exception import TimeoutException


def test_create_session_timeout():
    with pytest.raises(TimeoutException):
        Session("Bash", timeout=0.01)


def test_process_timeout():
    session: Session | None = None

    with pytest.raises(TimeoutException):
        session = Session("Bash")
        session.process.start(
            "sleep 1",
            timeout=0.01,
        )

    if session:
        session.close()


def test_filesystem_timeout():
    session: Session | None = None

    with pytest.raises(TimeoutException):
        session = Session("Bash")
        session.filesystem.write(
            "test.txt",
            "Hello World",
            timeout=0.01,
        )

    if session:
        session.close()
