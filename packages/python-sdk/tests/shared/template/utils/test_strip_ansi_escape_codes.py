from e2b.template.utils import strip_ansi_escape_codes


def test_strips_basic_sgr_color():
    assert strip_ansi_escape_codes("\x1b[31mred\x1b[0m") == "red"


def test_strips_semicolon_separated_params():
    assert strip_ansi_escape_codes("\x1b[1;31;42mhi\x1b[0m") == "hi"


def test_strips_semicolon_256_color():
    assert strip_ansi_escape_codes("\x1b[38;5;82mX\x1b[0m") == "X"


def test_strips_colon_256_color():
    assert strip_ansi_escape_codes("\x1b[38:5:82mX\x1b[0m") == "X"


def test_strips_colon_truecolor():
    assert strip_ansi_escape_codes("\x1b[38:2::255:0:0mRED\x1b[0m") == "RED"


def test_strips_colon_curly_underline():
    assert strip_ansi_escape_codes("\x1b[4:3mX\x1b[0m") == "X"


def test_leaves_plain_text_unchanged():
    assert strip_ansi_escape_codes("no escape codes here") == "no escape codes here"


def test_strips_osc_hyperlink():
    assert (
        strip_ansi_escape_codes("\x1b]8;;https://e2b.dev\x07E2B\x1b]8;;\x07") == "E2B"
    )


def test_strips_osc_window_title_bel_terminated():
    assert strip_ansi_escape_codes("\x1b]0;my title\x07text") == "text"


def test_strips_osc_esc_backslash_terminated():
    assert strip_ansi_escape_codes("\x1b]0;my title\x1b\\text") == "text"


def test_strips_osc_spanning_newlines():
    assert strip_ansi_escape_codes("\x1b]0;line1\nline2\x07after") == "after"


def test_strips_only_first_osc_terminator():
    assert (
        strip_ansi_escape_codes("\x1b]0;title\x07middle\x1b]0;other\x07end")
        == "middleend"
    )


def test_strips_cursor_movement():
    assert strip_ansi_escape_codes("\x1b[2Ax\x1b[1000Dy") == "xy"


def test_strips_erase_line():
    assert strip_ansi_escape_codes("\x1b[2Kdone") == "done"
