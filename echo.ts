#!/usr/bin/env deno run --allow-net --watch

Deno.serve({ port: 9000 }, async (request) => {
  if (request.url.match(/\/stream\/?$/)) {
    const { response, socket } = Deno.upgradeWebSocket(request, {})

    let i = 0
    const timer = setInterval(() => socket.send('hello: ' + i++), 1_000)

    socket.onclose = () => clearTimeout(timer)
    return response
  }

  return Response.json({
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body: await request.text(),
  })
})
