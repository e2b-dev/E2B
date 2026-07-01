from e2b.template.utils import encode_path_param


def test_leaves_simple_names_unchanged():
    assert encode_path_param("my-template") == "my-template"


def test_encodes_slash_in_namespaced_id():
    # Namespaced template IDs / aliases must have their slash percent-encoded
    # so the whole value stays a single path segment.
    assert encode_path_param("namespace/name") == "namespace%2Fname"


def test_encodes_every_slash_in_deeply_namespaced_id():
    assert encode_path_param("a/b/c") == "a%2Fb%2Fc"


def test_keeps_unreserved_characters_unencoded():
    # RFC 3986 unreserved characters must not be encoded.
    assert encode_path_param("a-b_c.d~e") == "a-b_c.d~e"


def test_encodes_other_reserved_characters():
    # Mirrors JS `encodeURIComponent`, which also encodes ":" and spaces.
    assert encode_path_param("name:tag") == "name%3Atag"
    assert encode_path_param("a b") == "a%20b"
