import os
import threading
import asyncio

from realtime.connection import Socket

supabase_key = os.environ.get("SUPABASE_SECRET_KEY")


def get_out():
    loop = asyncio.new_event_loop()
    event = threading.Event()

    result = None



    URL = f"wss://ntjfcwpzsxugrykskdgi.supabase.co/realtime/v1/websocket?apikey={supabase_key}&vsn=1.0.0"
    s = Socket(URL)
    s.connect()

    async def callback(payload):
        nonlocal result
        result = payload
        print(payload)
        event.set()

    channel = s.set_channel(s, "realtime:*")
    channel.join().on("UPDATE", callback)
    s.listen(s)

    event.wait()
    channel.off("UPDATE")

    return result
