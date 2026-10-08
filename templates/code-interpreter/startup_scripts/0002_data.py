import sys

import IPython
from IPython.core.formatters import BaseFormatter, JSONFormatter
from traitlets.traitlets import Unicode, ObjectName


class E2BDataFormatter(BaseFormatter):
    format_type = Unicode("e2b/data")

    print_method = ObjectName("_repr_e2b_data_")
    _return_type = (dict, str)

    def __call__(self, obj):
        # IPython invokes every registered formatter for every displayed
        # object. Gate on sys.modules so a non-DataFrame output (e.g. an
        # int from `1 + 1`) doesn't pay the pandas import cost — a
        # pandas.DataFrame can only exist if the user already imported
        # pandas.
        pandas = sys.modules.get("pandas")
        if pandas is None or not isinstance(obj, pandas.DataFrame):
            return super().__call__(obj)

        result = obj.to_dict(orient="list")
        for key, value in result.items():
            # Check each column's values
            result[key] = [
                v.isoformat() if isinstance(v, pandas.Timestamp) else v for v in value
            ]
        return result


class E2BChartFormatter(BaseFormatter):
    format_type = Unicode("e2b/chart")

    print_method = ObjectName("_repr_e2b_chart_")
    _return_type = (dict, str)

    def __call__(self, obj):
        # Same sys.modules gate as E2BDataFormatter: a matplotlib Figure
        # can only exist if the user already imported matplotlib.
        if sys.modules.get("matplotlib") is None:
            return super().__call__(obj)

        from matplotlib.pyplot import Figure

        if not isinstance(obj, Figure):
            return super().__call__(obj)

        from e2b_charts import chart_figure_to_dict

        try:
            return chart_figure_to_dict(obj)
        except:  # noqa: E722
            return {}


class E2BJSONFormatter(JSONFormatter):
    def __call__(self, obj):
        if isinstance(obj, (list, dict)):
            try:
                import orjson

                return orjson.loads(
                    orjson.dumps(
                        obj, option=orjson.OPT_SERIALIZE_NUMPY | orjson.OPT_NON_STR_KEYS
                    )
                ), {"expanded": True}
            except TypeError:
                pass

        return super().__call__(obj)


ip = IPython.get_ipython()
ip.display_formatter.formatters["e2b/data"] = E2BDataFormatter(
    parent=ip.display_formatter
)
ip.display_formatter.formatters["e2b/chart"] = E2BChartFormatter(
    parent=ip.display_formatter
)

ip.display_formatter.formatters["application/json"] = E2BJSONFormatter(
    parent=ip.display_formatter
)
