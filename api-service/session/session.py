import playground_client

from session.api import API


class Session(API):
    def __init__(self, env_id: str):
        super().__init__()
        result = self.api.create_sessions(
            playground_client.CreateSessionsRequest(envID=env_id)
        )
        self.id = result.id
        self.is_closed = False

    def __del__(self):
        self.close()
        super().__del__()

    def close(self):
        if not self.is_closed:
            self.api.delete_session(self.id)
            self.is_closed = True
