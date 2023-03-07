# https://vercel.com/docs/concepts/functions/serverless-functions/runtimes/python

import simplejson
from http.server import BaseHTTPRequestHandler

from code_generator.base import generate_req_handler


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        self.data_string = self.rfile.read(int(self.headers['Content-Length']))

        data = simplejson.loads(self.data_string)

        project_id = data['projectId']
        blocks = data['blocks']
        method = data['method']

        final_prompt, js_code = generate_req_handler(
            project_id=project_id, blocks=blocks, method=method)

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
