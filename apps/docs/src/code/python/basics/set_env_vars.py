from e2b import Session

session = Session.create(
    id="Nodejs",
    env_vars={"FOO": "Hello"}  # $HighlightLine
)

session.close()