from e2b import FileNotFoundException, NotFoundException
from e2b.envd.api import format_envd_api_exception
from e2b.envd.rpc import handle_filesystem_rpc_exception, handle_rpc_exception
from e2b_connect.client import Code, ConnectException


def test_file_not_found_exception_is_a_not_found_exception():
    err = FileNotFoundException("missing path")

    assert isinstance(err, NotFoundException)


def test_handle_rpc_exception_defaults_to_not_found_exception():
    err = handle_rpc_exception(ConnectException(Code.not_found, "missing sandbox"))

    assert type(err) is NotFoundException


def test_handle_filesystem_rpc_exception_uses_file_not_found_exception():
    err = handle_filesystem_rpc_exception(
        ConnectException(Code.not_found, "missing file")
    )

    assert type(err) is FileNotFoundException


def test_format_envd_api_exception_defaults_to_not_found_exception():
    err = format_envd_api_exception(404, "missing sandbox")

    assert type(err) is NotFoundException


def test_format_envd_api_exception_supports_file_not_found_exception():
    err = format_envd_api_exception(
        404,
        "missing file",
        not_found_exception=FileNotFoundException,
    )

    assert type(err) is FileNotFoundException
