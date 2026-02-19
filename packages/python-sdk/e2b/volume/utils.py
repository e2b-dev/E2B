class DualMethod:
    """Descriptor enabling the same name for a static (class-level) and instance method.

    When accessed on the class (e.g. ``Volume.get_info``), the static function
    is returned.  When accessed on an instance (e.g. ``vol.get_info``), the
    instance method is returned as a bound method.
    """

    def __init__(self, static_fn, instance_fn):
        self._static_fn = static_fn
        self._instance_fn = instance_fn

    def __get__(self, obj, objtype=None):
        if obj is None:
            return self._static_fn
        return self._instance_fn.__get__(obj, objtype)
