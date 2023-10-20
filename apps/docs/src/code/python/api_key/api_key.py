from os import getenv

from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")


def main():
    # You can pass an API key explicitly
    explicit_api_key = Session.create(id="Nodejs", api_key=E2B_API_KEY)
    explicit_api_key.close()

    # If you don't pass an API key, the SDK will look for it in the E2B_API_KEY environment variable
    api_key_from_env_variable = Session.create(id="Nodejs")
    api_key_from_env_variable.close()


main()
