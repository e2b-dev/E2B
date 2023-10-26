from e2b import Session

def main():
    explicit_api_key = Session(id="Nodejs", api_key="YOUR_API_KEY")
    explicit_api_key.close()
main()
