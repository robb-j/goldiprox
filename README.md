# goldiprox

A little programmable proxy built with [Deno](https://deno.land/) and based on
[URLPattern](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern)

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
parameters or wildcards in the pattern:

```json
{
  "pattern": "https://example.com/*",
  "type": "redirect",
  "url": "https://r0b.io/example/{{ pathname.groups.0 }}"
}
```

Here we are starting to use the URLPattern more. In the pattern configuration,
it now matches a wildcard pathname on the host `example.com` under the `https`
protocol is matched. Then in the target URL, it is using the match from the
URLPattern to template a URL with the same path but prefixed with `/example/`.
For example:

- `https://example.com/` → `https://r0b.io/example/`
- `https://example.com/hello` → `https://r0b.io/example/hello`

You can even match on other parts of the request, such as the subdomain:

```json
{
  "pattern": "https://:subdomain.example.com/*",
  "type": "redirect",
  "url": "https://r0b.io/example/{{ hostname.groups.subdomain }}/{{ pathname.groups.0 }}"
}
```

Here it will use whatever subdomain you have visited and add it to the pathname
in the redirection it generates. You can see here we've created a parameter
named `subdomain` and we can reference that in the URL template. With wildcards,
they are numbered incrementally, but you can give them names instead.

The pattern doesn't have to be just a string too, you can specify it partwise to
only specify the bits that are interesting. The pattern is actually a subset of
what you can pass to the first parameter of
[URLPattern](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern/URLPattern).
The templating in the URL lets you reference anything from the result of
[URLPattern#exec](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern/exec).

> There are some fields in the
> [input](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern/URLPattern#parameters)
> that don't make sense in this context so they are emitted, namely
> `username,password,baseURL,port`.

```json
{
  "pattern": { "hostname": "example.com" },
  "type": "redirect",
  "url": "https://r0b.io/example{{ pathname.groups.* }}"
}
```

> I also made this tool, [URLPattern Editor](https://urlpattern.r0b.io/?ref=goldiprox),
> which helps construct patterns completely in the browser

This is the same as before but is set on a per-component basis, it will use a
wildcard for any component not set, such as the protocol and pathname in this
case. Also note that the wildcard in pathname includes the `/` prefix, so you
don't need to put it in the URL template here.

So far this has all been about redirection, but the other power is in proxying
requests. This lets you rewrite requests to look a different way or access
things on networks not available to the client:

> In the future there could be more options to proxy, e.g. to add secret headers
> or parameters to the request during the proxy. For example you might want to
> set an `Authorization` header in-flight to access resources behind
> authentication.

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

You can tell Goldiprox to inject headers or search parameters by adding
`addHeaders` or `addSearchParams` fields to your route definitions. Headers
injected to `proxy` routes and search parameters are added to the query string
for `proxy` and `redirect` routes:

```json
{
  "pattern": { "pathname": "/" },
  "type": "proxy",
  "url": "https://example.com",
  "addHeaders": {
    "Authorization": "top_secret"
  },
  "addSearchParams": {
    "ref": "goldiprox"
  },
  "redirects": [
    {
      "pattern": "https://example.com/*",
      "url": "http://localhost:8080/{{ pathname.groups.0 }}"
    }
  ]
}
```

While proxying, the `Authorization` header will be injected into the proxy
request and the `?ref=goldiprox` is added to the end of the URL. You can do the
same with a `redirect` route, but you can't set headers, that only works with
`proxy` routes.

With a `proxy` route, you can also configure `redirects` which will process the
`Location:` header to rewrite it to something else.

Goldiproxy can periodically fetch the routes from an external HTTP endpoint to
let them change on demand to do cool and interesting things. See Configuration
below.

## Configuration

Run Goldiprox with a JSON configuration, `config.json`, which is an array of the
`routes`, as described above. You can also specify an `endpoint` which goldiprox
will use to periodically fetch routes and merge them with the static `routes`,
both `routes` and `endpoint` are optional so you can set one, both or neither.
Although setting neither would be a pretty boring server.

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
containers. It runs as a non-root user `id=1000`, it internally uses port `8000`
and you should mount your config at `/app/config.json`.

> WIP

## Release

1. Ensure git is clean and the changelog is up-to-date
2. Update the version in `app.json`
3. Commit as `vX.Y.X`
4. Tag as `vX.Y.Z`, signed with the same message
5. Push to GitHub
