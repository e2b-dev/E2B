from e2b import Session


async def test_python_package():
    session = await Session.create("Python3")

    process = await session.process.start("pip install pip-install-test")
    await process

    process = await session.process.start('python -c "import pip_install_test"')
    await process
    output = process.stdout
    assert "Good job!" in output
    await session.close()
