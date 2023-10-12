from os import path
from e2b import Session

async def test_file_upload():
    file_name = "video.webm"
    local_dir = "tests/assets"
    filepath = path.join(local_dir, file_name)

    session = await Session.create("Nodejs")
    session.upload_file(
        file=open(filepath, "rb")
    )

    files = await session.filesystem.list("/root")
    for file_item in files:
        print(file_item.name)
    assert file_name in [x.name for x in files]

    await session.close()
