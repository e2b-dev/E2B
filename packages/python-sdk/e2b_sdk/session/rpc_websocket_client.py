from tinyrpc.protocols.jsonrpc import JSONRPCProtocol
from tinyrpc.transports.http import HttpPostClientTransport
from tinyrpc.transports.websocketclient import HttpWebSocketClientTransport
from tinyrpc import RPCClient


remote_server = rpc_client.get_proxy()

# call a method called 'reverse_string' with a single string argument
result = remote_server.reverse_string('Hello, World!')

print("Server answered:", result)


class RpcWebsocketClient:
    def __init__(self, ):
        self.session = session
        self.rpc_client = RPCClient(
            JSONRPCProtocol(),
            HttpWebSocketClientTransport(),
        )
