import logging

logger = logging.getLogger(__name__)


class SandboxFiles:
    def __init__(self, file_server_url: str) -> None:
        pass

    def file_url(self) -> str:
        """
        Return a URL that can be used to upload files to the sandbox via a multipart/form-data POST request.
        This is useful if you're uploading files directly from the browser.
        The file will be uploaded to the user's home directory with the same name.
        If a file with the same name already exists, it will be overwritten.
        """
        hostname = self.get_hostname(self._debug_port or ENVD_PORT)
        protocol = self.get_protocol(secure=self._debug_dev_env != "local")

        file_url = f"{protocol}://{hostname}{FILE_ROUTE}"

        return file_url

    def upload_file(self, file: IO, timeout: Optional[float] = TIMEOUT) -> str:
        """
        Upload a file to the sandbox.
        The file will be uploaded to the user's home (`/home/user`) directory with the same name.
        If a file with the same name already exists, it will be overwritten.

        :param file: The file to upload
        :param timeout: Specify the duration, in seconds to give the method to finish its execution before it times out (default is 60 seconds). If set to None, the method will continue to wait until it completes, regardless of time
        """
        files = {"file": file}
        r = requests.post(self.file_url(), files=files, timeout=timeout)
        if r.status_code != 200:
            raise Exception(f"Failed to upload file: {r.reason} {r.text}")

        filename = path.basename(file.name)
        return f"/home/user/{filename}"

    def download_file(
        self, remote_path: str, timeout: Optional[float] = TIMEOUT
    ) -> bytes:
        """
        Download a file from the sandbox and returns it's content as bytes.

        :param remote_path: The path of the file to download
        :param timeout: Specify the duration, in seconds to give the method to finish its execution before it times out (default is 60 seconds). If set to None, the method will continue to wait until it completes, regardless of time
        """
        encoded_path = urllib.parse.quote(remote_path)
        url = f"{self.file_url()}?path={encoded_path}"
        r = requests.get(url, timeout=timeout)

        if r.status_code != 200:
            raise Exception(
                f"Failed to download file '{remote_path}'. {r.reason} {r.text}"
            )
        return r.content
