# https://vercel.com/docs/concepts/functions/serverless-functions/runtimes/python

import simplejson
from http.server import BaseHTTPRequestHandler

from code_generator.base import generate_req_handler


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        # Extract 'prompt' from the json body
        self.data_string = self.rfile.read(int(self.headers['Content-Length']))

        data = simplejson.loads(self.data_string)

        blocks = data['blocks']
        method = data['method']

        final_prompt, js_code = generate_req_handler(blocks, method)

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(
            simplejson.dumps(
                {
                    'code': js_code.strip('`').strip(),
                    'prompt': final_prompt,
                }
            ).encode()
        )
        return
