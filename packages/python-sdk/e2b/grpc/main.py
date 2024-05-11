from __future__ import print_function

import logging

import grpc.experimental
import filesystem_pb2
import filesystem_pb2_grpc


def call_grpc(url: str):
    print("Will try to greet world ...")
    with grpc.insecure_channel(url) as channel:
        stub = filesystem_pb2_grpc.FilesystemStub(channel)
        responses = stub.ReadFile(filesystem_pb2.ReadFileRequest(path="/usr/bin/envd"))
        for response in responses:
            print("Received message", response)


if __name__ == "__main__":
    logging.basicConfig()
