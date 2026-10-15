import json

from e2b_code_interpreter.models import Execution, Result, parse_output


def _result_from(message: dict) -> Result:
    execution = Execution()
    parse_output(
        execution, json.dumps({"type": "result", "is_main_result": True, **message})
    )
    return execution.results[0]


def test_collects_non_standard_mime_types_into_extra():
    # The IPython kernel sends non-standard MIME types (e.g. plotly/bokeh) that
    # aren't among the known representations. They should land in `extra`, like
    # the JS SDK's Result constructor does — not be silently dropped.
    result = _result_from(
        {"text": "hello", "application/vnd.plotly.v1+json": {"data": [{"x": [1, 2]}]}}
    )

    assert result.extra == {"application/vnd.plotly.v1+json": {"data": [{"x": [1, 2]}]}}


def test_formats_lists_non_standard_mime_types():
    result = _result_from(
        {"text": "hello", "application/vnd.plotly.v1+json": {"data": [{"x": [1, 2]}]}}
    )

    assert "application/vnd.plotly.v1+json" in list(result.formats())


def test_to_json_preserves_non_standard_mime_types():
    execution = Execution()
    parse_output(
        execution,
        json.dumps(
            {
                "type": "result",
                "is_main_result": True,
                "text": "hello",
                "application/vnd.plotly.v1+json": {"data": [{"x": [1, 2]}]},
            }
        ),
    )

    assert json.loads(execution.to_json())["results"] == [
        {
            "text": "hello",
            "application/vnd.plotly.v1+json": {"data": [{"x": [1, 2]}]},
        }
    ]


def test_result_without_extra_fields_has_no_extra():
    result = _result_from({"text": "hello"})

    assert result.extra is None
    assert list(result.formats()) == ["text"]


def test_explicit_extra_and_unknown_kwargs_are_merged():
    # A non-standard MIME type arriving via the parsed message and an explicit
    # `extra` passed to the constructor should both be retained.
    result = Result(
        text="hello",
        extra={"application/vnd.custom+json": {"y": 2}},
        **{"application/vnd.plotly.v1+json": {"data": [{"x": [1, 2]}]}},
    )

    assert result.extra == {
        "application/vnd.custom+json": {"y": 2},
        "application/vnd.plotly.v1+json": {"data": [{"x": [1, 2]}]},
    }
