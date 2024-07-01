import requests



#TODO: Upload and check if the file is uploaded
def test_upload_file_via_url(sandbox):
    url = sandbox.upload_url()
    res = requests.get(url)
    assert res.status_code == 200


def test_upload_file_via_url_to_specific_path(sandbox):
    url = sandbox.upload_url("/test/test.txt")
    assert "test.txt" in url

    res = requests.get(url)
    assert res.status_code == 200
