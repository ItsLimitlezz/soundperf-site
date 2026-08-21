#!/usr/bin/env python3
"""Static file server for local development, with Range request support.

Python's own http.server does not serve byte ranges, so an audio element cannot seek and a
five minute file has to be played from the top every time. Every real static host supports
ranges. This closes the gap between local testing and anywhere the site would actually live.

Usage:  serve.py [--port 8765] [--directory web]
"""

import argparse
import os
import re
from functools import partial
from http.server import HTTPServer, SimpleHTTPRequestHandler

RANGE = re.compile(r"bytes=(\d*)-(\d*)")


class RangeHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        header = self.headers.get("Range")
        if not header:
            self.send_header_accept_ranges = True
            return super().send_head()

        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()
        try:
            handle = open(path, "rb")
        except OSError:
            self.send_error(404, "File not found")
            return None

        size = os.fstat(handle.fileno()).st_size
        match = RANGE.match(header)
        if not match:
            handle.close()
            self.send_error(400, "Malformed Range header")
            return None

        start_text, end_text = match.groups()
        if start_text:
            start = int(start_text)
            end = int(end_text) if end_text else size - 1
        else:
            # Suffix form, bytes=-N means the last N bytes.
            start = max(0, size - int(end_text))
            end = size - 1
        end = min(end, size - 1)
        if start > end:
            handle.close()
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.end_headers()
            return None

        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        handle.seek(start)
        return RangeReader(handle, end - start + 1)

    def end_headers(self):
        if getattr(self, "send_header_accept_ranges", False):
            self.send_header("Accept-Ranges", "bytes")
            self.send_header_accept_ranges = False
        super().end_headers()

    def log_message(self, fmt, *args):
        if "GET" in (args[0] if args else ""):
            return
        super().log_message(fmt, *args)


class RangeReader:
    """File wrapper that stops after a fixed number of bytes."""

    def __init__(self, handle, remaining):
        self.handle = handle
        self.remaining = remaining

    def read(self, amount=-1):
        if self.remaining <= 0:
            return b""
        if amount < 0 or amount > self.remaining:
            amount = self.remaining
        data = self.handle.read(amount)
        self.remaining -= len(data)
        return data

    def close(self):
        self.handle.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--directory", default="web")
    args = parser.parse_args()

    handler = partial(RangeHandler, directory=args.directory)
    print(f"serving {args.directory} on http://localhost:{args.port}")
    HTTPServer(("127.0.0.1", args.port), handler).serve_forever()


if __name__ == "__main__":
    main()
