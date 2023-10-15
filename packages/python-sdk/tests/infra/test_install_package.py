from e2b import Session


def test_python_package():
    session = Session("Python3")

    process = session.process.start("pip install pip-install-test")
    process.wait()

    process = session.process.start('python -c "import pip_install_test"')
    process.wait()
    output = process.stdout
    assert "Good job!" in output
    session.close()
