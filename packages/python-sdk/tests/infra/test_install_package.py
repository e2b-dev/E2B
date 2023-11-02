from e2b import Sandbox


def test_python_package():
    sandbox = Sandbox()

    process = sandbox.process.start("pip install pip-install-test")
    process.wait()

    process = sandbox.process.start('python -c "import pip_install_test"')
    process.wait()
    output = process.stdout
    assert "Good job!" in output
    sandbox.close()
