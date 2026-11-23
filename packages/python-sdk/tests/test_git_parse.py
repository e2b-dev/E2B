from e2b.sandbox._git.parse import parse_git_status


def test_quoted_paths_are_decoded_to_the_names_on_disk():
    output = (
        '## main\n?? "with space.txt"\n'
        '?? "caf\\303\\251.txt"\n'
        'R  "old\\303\\251.txt" -> "new name.txt"\n'
    )

    file_status = parse_git_status(output).file_status

    names = [entry.name for entry in file_status]
    assert names == ["with space.txt", "café.txt", "new name.txt"]
    assert file_status[-1].renamed_from == "oldé.txt"
