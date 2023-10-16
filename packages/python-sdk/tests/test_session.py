from e2b import Session


def test_create_session():
    session = Session("Nodejs")
    session.close()


def test_create_multiple_sessions():
    session = Session("Nodejs")
    session2 = Session("Nodejs")
    session.close()
    session2.close()
