FROM denoland/deno:alpine-1.46.3

EXPOSE 8000
WORKDIR /app
USER deno

COPY --chown=deno:deno ["deno.json", "deno.lock", "config.ts", "main.ts", "lib.ts", "app.json", "/app/"]

RUN deno cache main.ts

CMD ["task", "main"]
