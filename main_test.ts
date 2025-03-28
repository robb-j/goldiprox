import { assertEquals } from '@std/assert'
import {
  applyRedirects,
  expandUrl,
  getBaseRoutes,
  getHealthz,
  getLocation,
  getProxyRequest,
  getRoutesz,
  redirect,
} from './main.ts'
import { testingAppConfig } from './config.ts'

//
// getHealthz
//
Deno.test('#getHealthz returns an ok', async () => {
  const result = getHealthz(
    new Request('http://localhost:8000/healthz'),
    'running',
  )
  assertEquals(result.status, 200, 'It should be a http/200')
  assertEquals(await result.text(), 'ok', 'It should say ok')
})
Deno.test('#getHealthz returns a terminating', async () => {
  const result = getHealthz(
    new Request('http://localhost:8000/healthz'),
    'terminating',
  )
  assertEquals(result.status, 503, 'It should be a http/503')
  assertEquals(await result.text(), 'terminating', 'It should say terminating')
})

//
// getRoutesz
//
Deno.test('#getRoutesz sends an JSON array', async () => {
  const result = getRoutesz(new Request('http://localhost:8000/healthz'), [])
  assertEquals(result.status, 200, 'It should be a http/200')
  assertEquals(
    result.headers.get('content-type'),
    'application/json',
    'It should be JSON',
  )
  assertEquals(await result.json(), [], 'It should say ok')
})
Deno.test('#getRoutesz sends dumped routes', async () => {
  const result = getRoutesz(new Request('http://localhost:8000/healthz'), [{
    type: 'internal',
    pattern: new URLPattern({ pathname: '/' }),
    fn: () => new Response(),
  }])
  const json = await result.json()
  assertEquals(result.status, 200, 'It should be a http/200')
  assertEquals(json.length, 1)
  assertEquals(json[0].type, 'internal')
  assertEquals(typeof json[0].pattern, 'string')
  assertEquals(typeof json[0].score, 'number')
})

//
// getBaseRoutes
//
Deno.test('#getBaseRoutes returns the healthz route by default', () => {
  const routes = getBaseRoutes(testingAppConfig)
  assertEquals(routes.length, 1)
  assertEquals(routes[0].type, 'internal')
  assertEquals(routes[0].pattern.pathname, '/healthz{/}?')
})
Deno.test('#getBaseRoutes adds the routesz route when in development', () => {
  const routes = getBaseRoutes({
    ...testingAppConfig,
    env: 'development',
  })
  assertEquals(routes.length, 2)
  assertEquals(routes[1].type, 'internal')
  assertEquals(routes[1].pattern.pathname, '/routesz{/}?')
})
Deno.test('#getBaseRoutes includes routes from the AppConfig', () => {
  const routes: any = getBaseRoutes({
    ...testingAppConfig,
    routes: [
      {
        type: 'redirect',
        pattern: new URLPattern({ pathname: '/some/path/' }),
        url: 'https://example.com',
        addSearchParams: {},
      },
    ],
  })
  assertEquals(routes.length, 2)
  assertEquals(routes[1].type, 'redirect')
  assertEquals(routes[1].pattern.pathname, '/some/path/')
  assertEquals(routes[1].url, 'https://example.com')
})

//
// redirect
//
Deno.test('#redirect returns a http redirection', () => {
  const result = redirect(
    {
      type: 'redirect',
      pattern: new URLPattern({ pathname: '/' }),
      url: 'https://example.com',
      addSearchParams: {},
    },
    {},
    new Request('http://testing.local'),
  )

  assertEquals(result.status, 302, 'it should be a http/302')
  assertEquals(
    result.headers.get('location'),
    'https://example.com/',
    'it should set the location',
  )
})
Deno.test('#redirect replaces patterns in the location', () => {
  const result = redirect(
    {
      type: 'redirect',
      pattern: new URLPattern({ pathname: '/:slug' }),
      url: 'https://example.com/{{ pathname.groups.slug }}',
      addSearchParams: {},
    },
    { pathname: { groups: { slug: 'albatross' } } },
    new Request('http://testing.local'),
  )

  assertEquals(result.status, 302, 'it should be a http/302')
  assertEquals(
    result.headers.get('location'),
    'https://example.com/albatross',
    'it should replace variables in the location',
  )
})
Deno.test('#redirect injects search parameters', () => {
  const result = redirect(
    {
      type: 'redirect',
      pattern: new URLPattern({ pathname: '/' }),
      url: 'https://example.com',
      addSearchParams: { some: 'thing' },
    },
    {},
    new Request('http://testing.local'),
  )

  assertEquals(
    result.headers.get('location'),
    'https://example.com/?some=thing',
    'it add URLSearchParameters onto the end',
  )
})
Deno.test('#redirect preserves request search parameters', () => {
  const result = redirect(
    {
      type: 'redirect',
      pattern: new URLPattern({ pathname: '/' }),
      url: 'https://example.com',
      addSearchParams: {},
    },
    {},
    new Request('http://testing.local?name=Geoff'),
  )

  const url = new URL(result.headers.get('location')!)
  assertEquals(url.searchParams.get('name'), 'Geoff')
})

//
// getProxyRequest
//
Deno.test('#getProxyRequest creates a request', async () => {
  const result = getProxyRequest(
    {
      type: 'proxy',
      pattern: new URLPattern({ pathname: '/' }),
      url: 'https://example.com',
      addSearchParams: {},
      addHeaders: {},
      redirects: [],
    },
    new URL('https://example.com'),
    new Request('http://testing.local', { method: 'POST', body: 'hello' }),
    { transport: 'tcp', hostname: '127.0.0.1', port: 8000 },
  )

  assertEquals(
    result.url,
    'https://example.com/',
    'it should have the URL from the route',
  )
  assertEquals(
    result.method,
    'POST',
    'it should be the same method as the inbound request',
  )
  assertEquals(result.redirect, 'manual', 'it should not follow redirects')
  assertEquals(await result.text(), 'hello', 'it should send the inbound body')
})
Deno.test('#getProxyRequest sets headers', () => {
  const result = getProxyRequest(
    {
      type: 'proxy',
      pattern: new URLPattern({ pathname: '/' }),
      url: 'https://example.com',
      addSearchParams: {},
      addHeaders: {},
      redirects: [],
    },
    new URL('https://example.com'),
    new Request('http://testing.local', { method: 'POST', body: 'hello' }),
    { transport: 'tcp', hostname: '127.0.0.1', port: 8000 },
  )

  assertEquals(
    result.headers.get('host'),
    'example.com',
    'it should set the "host" header',
  )
  assertEquals(
    result.headers.get('x-real-ip'),
    '127.0.0.1',
    'it should set the "x-real-ip" header',
  )
  assertEquals(
    result.headers.get('x-forwarded-host'),
    'example.com',
    'it should set the "x-forwarded-host" header',
  )
  assertEquals(
    result.headers.get('x-forwarded-for'),
    '127.0.0.1',
    'it should set the "x-forwarded-for" header',
  )
  assertEquals(
    result.headers.get('x-forwarded-proto'),
    'http',
    'it should set the "x-forwarded-proto" header',
  )
})
Deno.test('#getProxyRequest inject headers onto the request', () => {
  const result = getProxyRequest(
    {
      type: 'proxy',
      pattern: new URLPattern({ pathname: '/' }),
      url: 'https://example.com',
      addSearchParams: {},
      addHeaders: { authorization: 'not_secret' },
      redirects: [],
    },
    new URL('https://example.com'),
    new Request('http://testing.local', { method: 'POST', body: 'hello' }),
    { transport: 'tcp', hostname: '127.0.0.1', port: 8000 },
  )

  assertEquals(
    result.headers.get('authorization'),
    'not_secret',
    'it should add the authorization header from the addHeaders directive',
  )
})

//
// expandUrl
//
Deno.test('#expandUrl processes the template', () => {
  const result = expandUrl(
    {
      type: 'redirect',
      pattern: new URLPattern({ pathname: '/:slug' }),
      url: 'https://example.com/{{ pathname.groups.slug }}',
      addSearchParams: {},
    },
    { pathname: { groups: { slug: 'albatross' } } },
    new Request('http://testing.local', { method: 'POST', body: 'hello' }),
  )

  assertEquals(
    result,
    new URL('https://example.com/albatross'),
    'it should process the URL template and replace the slug in it',
  )
})
Deno.test('#expandUrl appends search parameters onto the request', () => {
  const result = expandUrl(
    {
      type: 'redirect',
      pattern: new URLPattern({ pathname: '/' }),
      url: 'https://example.com',
      addSearchParams: { hello: 'there' },
    },
    {},
    new Request('http://testing.local', { method: 'POST', body: 'hello' }),
  )

  assertEquals(
    result,
    new URL('https://example.com/?hello=there'),
    'it should append URL parameters based on addSearchParams',
  )
})
Deno.test('#expandUrl preserves request search parameters', () => {
  const result = expandUrl(
    {
      type: 'redirect',
      pattern: new URLPattern({ pathname: '/' }),
      url: 'https://example.com',
      addSearchParams: {},
    },
    {},
    new Request('http://testing.local?name=Geoff'),
  )

  const url = new URL(result)
  assertEquals(url.searchParams.get('name'), 'Geoff')
})

//
// getLocation
//
Deno.test('#getLocation returns a URL', () => {
  assertEquals(
    getLocation(new Headers({ location: 'https://example.com/albatross' })),
    new URL('https://example.com/albatross'),
  )
})
Deno.test('#getLocation applies the base', () => {
  assertEquals(
    getLocation(
      new Headers({ location: './albatross' }),
      'https://example.com',
    ),
    new URL('https://example.com/albatross'),
  )
})

//
// applyRedirects
//
Deno.test('#applyRedirects returns a Response', async () => {
  const result = applyRedirects(
    {
      type: 'proxy',
      pattern: new URLPattern({ pathname: '/' }),
      url: 'https://example.com',
      addSearchParams: {},
      addHeaders: {},
      redirects: [
        // {
        //   pattern: new URLPattern({ pathname: '/somewhere/*' }),
        //   url: 'http://testing.local/something/{{ pathname.groups.0}}',
        // },
      ],
    },
    new Response('response_body', {
      status: 419,
      statusText: 'OKish',
      headers: { 'X-Hotel-Bar': 'Hotel bar?' },
    }),
    new URL('https://example.com/somewhere'),
    new URL('http://testing.local'),
  )

  assertEquals(await result.text(), 'response_body')
  assertEquals(result.status, 419)
  assertEquals(result.statusText, 'OKish')
  assertEquals(result.headers.get('X-Hotel-Bar'), 'Hotel bar?')
})
Deno.test('#applyRedirects applies the template', () => {
  const result = applyRedirects(
    {
      type: 'proxy',
      pattern: new URLPattern({ pathname: '/' }),
      url: 'https://example.com',
      addSearchParams: {},
      addHeaders: {},
      redirects: [
        {
          pattern: new URLPattern({ pathname: '/somewhere/*' }),
          url: 'http://testing.local/something/{{ pathname.groups.0}}',
        },
      ],
    },
    new Response(),
    new URL('https://example.com/somewhere/please'),
    new URL('http://testing.local'),
  )

  assertEquals(
    result.headers.get('Location'),
    'http://testing.local/something/please',
  )
})
