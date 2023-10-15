from os import path

from e2b import Session


def test_file_upload():
    file_name = "video.webm"
    local_dir = "tests/assets"
    filepath = path.join(local_dir, file_name)

    session = Session("Nodejs")
    with open(filepath, "rb") as f:
        session.upload_file(file=f)

    files = session.filesystem.list("/home/user")
    assert file_name in [x.name for x in files]

    session.close()
