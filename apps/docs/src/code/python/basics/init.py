from e2b import Sandbox


def main():
    # `id` can also be one of:
    # 'Nodejs', 'Bash', 'Python3', 'Java', 'Go', 'Rust', 'PHP', 'Perl', 'DotNET'
    sandbox = Sandbox(id="Nodejs")
    sandbox.close()


main()
