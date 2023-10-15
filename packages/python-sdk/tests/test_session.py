from e2b import Session


def test_create_session():
    session = Session.create("Nodejs")
    session.close()


def test_create_multiple_sessions():
    session = Session.create("Nodejs")
    session2 = Session.create("Nodejs")
    session.close()
    session2.close()
