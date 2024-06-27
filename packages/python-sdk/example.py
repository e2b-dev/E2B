class A:
    template = 2

    def __init__(self) -> None:
        print(self.template)


class B(A):
    template = 3

    def __init__(self) -> None:
        super().__init__()
        print(self.template)


b = B()
