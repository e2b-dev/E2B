from e2b.template.readycmd import (
    wait_for_file,
    wait_for_port,
    wait_for_process,
    wait_for_timeout,
    wait_for_url,
)


def test_wait_for_port_matches_the_exact_listening_port():
    cmd = wait_for_port(80).get_cmd()
    assert cmd == '[ -n "$(ss -Htuln sport = :80)" ]'


def test_wait_for_url_quotes_the_url():
    cmd = wait_for_url("http://localhost:3000/health?ready=1&x=y").get_cmd()
    assert cmd == (
        'curl -s -o /dev/null -w "%{http_code}" '
        "'http://localhost:3000/health?ready=1&x=y' | grep -q \"200\""
    )


def test_wait_for_url_keeps_simple_urls_unquoted():
    cmd = wait_for_url("http://localhost:3000/health").get_cmd()
    assert cmd == (
        'curl -s -o /dev/null -w "%{http_code}" '
        'http://localhost:3000/health | grep -q "200"'
    )


def test_wait_for_process_quotes_the_process_name():
    cmd = wait_for_process("my daemon").get_cmd()
    assert cmd == "pgrep 'my daemon' > /dev/null"


def test_wait_for_file_quotes_the_filename():
    cmd = wait_for_file("/tmp/ready file").get_cmd()
    assert cmd == "[ -f '/tmp/ready file' ]"


def test_wait_for_file_keeps_simple_paths_unquoted():
    cmd = wait_for_file("/tmp/ready").get_cmd()
    assert cmd == "[ -f /tmp/ready ]"


def test_wait_for_timeout_converts_milliseconds_to_seconds():
    assert wait_for_timeout(5000).get_cmd() == "sleep 5"
    assert wait_for_timeout(100).get_cmd() == "sleep 1"
