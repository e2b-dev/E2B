import random
import string

characters = string.ascii_letters + string.digits


def create_id(length: int):
    return "".join(random.choices(characters, k=length))
