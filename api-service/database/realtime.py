from time import sleep
import os

from realtime.connection import Socket

supabase_key = os.environ.get("SUPABASE_SECRET_KEY")


async def get_out():
    result = None

    URL = f"wss://ntjfcwpzsxugrykskdgi.supabase.co/realtime/v1/websocket?apikey={supabase_key}&vsn=1.0.0"
    s = Socket(URL)
    await s._connect()

    async def callback(payload):
        nonlocal result
        result = payload
        print(payload)

    channel = s.set_channel("realtime:*")  # type: ignore
    channel.on("UPDATE", callback)
    await s._listen()  # type: ignore

    for i in range(300):
        print("check")
        if result:
            return result
        sleep(1)

    return result
