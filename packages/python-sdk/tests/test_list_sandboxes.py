from e2b import Sandbox


def test_list_running_sandboxes():
    sandboxes = []
    for i in range(3):
        sandboxes.append(Sandbox(metadata={"n": str(i)}))

    running_sandboxes = Sandbox.list()
    assert len(running_sandboxes) == 3
    assert set(map(lambda x: x.metadata['n'], running_sandboxes)) == {'0', '1', '2'}

    for sandbox in sandboxes:
        sandbox.close()
