from __future__ import print_function

import logging

import grpc.experimental
import filesystem_pb2
import filesystem_pb2_grpc


def call_grpc():
    print("Will try to greet world ...")
    with grpc.insecure_channel("localhost:50051") as channel:

        filesystem_pb2_grpc.Filesystem.ReadFile()
        stub = filesystem_pb2_grpc.FilesystemStub(channel)
        response = stub.ReadFile(filesystem_pb2.ReadFileRequest(path="/"))
    print("Greeter client received: " + response.message)


if __name__ == "__main__":
    logging.basicConfig()
