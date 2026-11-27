#!/usr/bin/env python3
# Static server for public/ that makes browsers revalidate every file
import http.server, os, sys

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()
    def log_message(self, *a): pass

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public'))
http.server.ThreadingHTTPServer((sys.argv[1], int(sys.argv[2])), Handler).serve_forever()
