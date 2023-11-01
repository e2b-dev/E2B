from os import getenv
from e2b import Sandbox


def main():
  # `id` can also be one of:
  # 'Nodejs', 'Bash', 'Python3', 'Java', 'Go', 'Rust', 'PHP', 'Perl', 'DotNET'
  session = Sandbox(id="Nodejs")
  session.close()

main()