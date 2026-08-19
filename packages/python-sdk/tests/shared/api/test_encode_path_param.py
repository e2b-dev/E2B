from e2b.api import encode_path_param


def test_leaves_simple_names_unchanged():
    assert encode_path_param("my-template") == "my-template"


def test_encodes_slash_in_namespaced_alias():
    assert encode_path_param("namespace/name") == "namespace%2Fname"


def test_encodes_every_slash_in_deeply_namespaced_alias():
    assert encode_path_param("a/b/c") == "a%2Fb%2Fc"


def test_keeps_unreserved_characters_unencoded():
    assert encode_path_param("a-b_c.d~e") == "a-b_c.d~e"


def test_encodes_other_reserved_characters():
    assert encode_path_param("name:tag") == "name%3Atag"
    assert encode_path_param("a b") == "a%20b"
