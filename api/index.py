
from urllib.parse import urlparse, parse_qs

from web_api import Handler


class handler(Handler):

    def _restore_original_path(self):
        params = parse_qs(urlparse(self.path).query)
        original_path = params.get("__path", [None])[0]

        if not original_path or not original_path.startswith("/"):
            self._send(400, {"error": "Invalid API route."})
            return False

        self.path = "/api" + original_path
        return True

    def _dispatch(self, method):
        if not self._restore_original_path():
            return

        return getattr(super(), method)()

    def do_GET(self):
        return self._dispatch("do_GET")

    def do_POST(self):
        return self._dispatch("do_POST")

    def do_DELETE(self):
        return self._dispatch("do_DELETE")

    def do_OPTIONS(self):
        return self._dispatch("do_OPTIONS")
