from __future__ import annotations

import gzip
import io
from typing import Iterable

from starlette.datastructures import Headers, MutableHeaders
from starlette.middleware.gzip import GZipMiddleware
from starlette.types import ASGIApp, Message, Receive, Scope, Send


class SelectiveGZipMiddleware(GZipMiddleware):
    def __init__(
        self,
        app: ASGIApp,
        minimum_size: int = 500,
        compresslevel: int = 9,
        excluded_paths: Iterable[str] | None = None,
    ) -> None:
        super().__init__(app, minimum_size=minimum_size, compresslevel=compresslevel)
        self.excluded_paths = {str(path).strip() for path in (excluded_paths or []) if str(path).strip()}

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = str(scope.get("path") or "").strip()
        if path in self.excluded_paths:
            await self.app(scope, receive, send)
            return

        headers = Headers(scope=scope)
        if "gzip" not in headers.get("Accept-Encoding", ""):
            await self.app(scope, receive, send)
            return

        responder = SelectiveGZipResponder(self.app, self.minimum_size, compresslevel=self.compresslevel)
        await responder(scope, receive, send)


class SelectiveGZipResponder:
    def __init__(self, app: ASGIApp, minimum_size: int, compresslevel: int = 9) -> None:
        self.app = app
        self.minimum_size = minimum_size
        self.compresslevel = compresslevel
        self.send: Send | None = None
        self.initial_message: Message = {}
        self.started = False
        self.content_encoding_set = False
        self.skip_compression = False
        self.gzip_buffer = io.BytesIO()
        self.gzip_file = gzip.GzipFile(
            mode="wb",
            fileobj=self.gzip_buffer,
            compresslevel=compresslevel,
        )

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        self.send = send
        await self.app(scope, receive, self.send_with_gzip)

    async def send_with_gzip(self, message: Message) -> None:
        message_type = message["type"]
        if message_type == "http.response.start":
            self.initial_message = message
            headers = Headers(raw=self.initial_message["headers"])
            self.content_encoding_set = "content-encoding" in headers
            content_type = str(headers.get("content-type") or "").lower()
            self.skip_compression = self.content_encoding_set or content_type.startswith("text/event-stream")
            return

        if message_type != "http.response.body":
            await self.send(message)
            return

        if self.skip_compression:
            if not self.started:
                self.started = True
                await self.send(self.initial_message)
            await self.send(message)
            return

        if self.content_encoding_set:
            if not self.started:
                self.started = True
                await self.send(self.initial_message)
            await self.send(message)
            return

        if not self.started:
            self.started = True
            body = message.get("body", b"")
            more_body = message.get("more_body", False)
            if len(body) < self.minimum_size and not more_body:
                await self.send(self.initial_message)
                await self.send(message)
                return
            if not more_body:
                self.gzip_file.write(body)
                self.gzip_file.close()
                body = self.gzip_buffer.getvalue()

                headers = MutableHeaders(raw=self.initial_message["headers"])
                headers["Content-Encoding"] = "gzip"
                headers["Content-Length"] = str(len(body))
                headers.add_vary_header("Accept-Encoding")
                message["body"] = body

                await self.send(self.initial_message)
                await self.send(message)
                return

            headers = MutableHeaders(raw=self.initial_message["headers"])
            headers["Content-Encoding"] = "gzip"
            headers.add_vary_header("Accept-Encoding")
            del headers["Content-Length"]

            self.gzip_file.write(body)
            message["body"] = self.gzip_buffer.getvalue()
            self.gzip_buffer.seek(0)
            self.gzip_buffer.truncate()

            await self.send(self.initial_message)
            await self.send(message)
            return

        body = message.get("body", b"")
        more_body = message.get("more_body", False)

        self.gzip_file.write(body)
        if not more_body:
            self.gzip_file.close()

        message["body"] = self.gzip_buffer.getvalue()
        self.gzip_buffer.seek(0)
        self.gzip_buffer.truncate()

        await self.send(message)
