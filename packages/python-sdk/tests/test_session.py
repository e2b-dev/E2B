from e2b import Session


def test_create_session():
    session = Session("Bash")
    session.close()


def test_create_multiple_sessions():
    session = Session("Bash")
    session2 = Session("Bash")
    session.close()
    session2.close()
