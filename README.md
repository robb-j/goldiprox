# goldiprox

A little programmable proxy built with [Deno](https://deno.land/) and based on
[URLPattern](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern)

> More documentation coming soon...

## About

Goldiprox is a minimal reverse-proxy and redirection server with routing based
on the (semi) web-standards URLPattern. It is either configured with a static
set of routes or it can pull down the routes to serve from a HTTP endpoint.
Routes are a URLPattern and a target to tell it how to process the request. This
is a simple redirection endpoint:

```json
{
  "pattern": "https://example.com",
  "type": "redirect",
  "url": "https://r0b.io"
}
```

When the server gets a request for `https://example.com` it will return an HTTP
redirect to `https://r0b.io`. This gets more interesting with the use of
patterns or wildcards in the pattern:

```json
{
  "pattern": "https://example.com/*",
  "type": "redirect",
  "url": "https://r0b.io/example/{{ pathname.groups.0 }}"
}
```

Here we are starting to use the URLPattern more. In the pattern configuration,
it not matches a wildcard path so any pathname on the host `example.com` under
the `https` protocol. Then in the target URL, it is using the result of matching
the URLPattern to template the URL and construct a url with the same path but
prefixed with `/example/`. For example:

- `https://example.com/` → `https://r0b.io/example/`
- `https://example.com/hello` → `https://r0b.io/example/hello`

You can even match on other parts of the request, such as the subdomain:

```json
{
  "pattern": "https://:subdomain.example.com/*",
  "type": "redirect",
  "url": "https://r0b.io/example/{{ hostname.groups.subdomain }}"
}
```

Here it will use whatever subdomain you have passed and add it to the pathname
in the redirection it generates. You can see here we've created the name match
`subdomain` and we can reference that in the url template. With wildcards, they
are numbered incrementally, but you can give them names instead.

The pattern doesn't have to be just a string too, you can specify it partwise to
only specify the bits that are interesting. The pattern is actually anything you
can pass to the first parameter of
[URLPattern](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern/URLPattern).
The templating in the URL lets you reference anything from the result of
[URLPattern#exec](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern/exec).

```json
{
  "pattern": { "hostname": "example.com" },
  "type": "redirect",
  "url": "https://r0b.io/example{{ pathname.groups.* }}"
}
```

This is the same as before but is set on a per-component basis, it will use a
wildcard for any component not set, such as the protocol and pathname in this
case. Also note that the wildcard in pathname includes the `/` prefix, so you
don't need to put it in the url template here.

So far this has all been about redirection, but the extra power is in proxying
requests too. This lets you rewrite requests to look a different way or access
things on networks not available to the client:

```json
{
  "pattern": { "hostname": ":version.example.com", "pathname": "/:path*" },
  "type": "proxy",
  "url": "https://s3.r0b.io/{{ hostname.groups.version }}/{{ pathname.groups.path }}"
}
```

In this example, it proxies the request to a fictional S3 server to serve
versioned assets at a different location:

- `https://v1.example.com/` → `https://s3.r0b.io/v1/`
- `https://v1.example.com/index.html` → `https://s3.r0b.io/v1/index.html`
- `https://v1.example.com/js/script.js` → `https://s3.r0b.io/v1/js/script.js`

From the requester's perspective they won't see `s3.r0b.io` as the request is
proxied by the server instead.

## Configuration

Run Goldiprox with a JSON configuration, `config.json` which is an array of the
routes described above. You can also specify an `endpoint`, which goldiprox will
use the fetch more routes and merge them with the statically defined routes,
both `routes` and `endpoint` are optional so you can set one both or neither.
Although neither would be a pretty boring server.

```json
{
  "routes": ["..."],
  "endpoint": {
    "url": "https://r0b.io/goldiprox-routes",
    "interval": 10000
  }
}
```

If `endpoint` is specified, Goldiprox will fetch the routes on start up then
refetch at the specified interval. The interval is in **milliseconds**.

> Routes are sorted in a rough way so that more-specific definitions are first
> and parameter-based or wildcard routes come later. This needs to be better
> tested.

## Deployment

Goldiprox is designed to be run as a container however you like to run your
containers. It runs as a non-root user, uses port `8000` internally and you
should mount your config at `/app/config.json`.

> WIP

## Release

1. Ensure git is clean and the changelog is up-to-date
2. Update the version in `app.json`
3. Commit as `vX.Y.X`
4. Tag as `vX.Y.Z`, signed with the same message
5. Push to GitHub
