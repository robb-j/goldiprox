import * as flags from 'std/flags/mod.ts'
import { EndpointSource, getAppConfig, Route } from './config.ts'
import { array, create, template } from './lib.ts'

let appRoutes: Route[] = []

async function fetchRoutes(endpoint: EndpointSource, staticRoutes: Route[]) {
  try {
    const routes = create(
      await fetch(endpoint.url).then((r) => r.json()),
      array(Route),
    )
    appRoutes = [...staticRoutes, ...routes].toSorted(compareRoutes)
  } catch (error) {
    console.error('Failed to fetch routes', error)
    appRoutes = [...staticRoutes].toSorted(compareRoutes)
  }
}

async function setupEndpoint(endpoint: EndpointSource, staticRoutes: Route[]) {
  await fetchRoutes(endpoint, staticRoutes)
  setInterval(() => fetchRoutes(endpoint, staticRoutes), endpoint.interval)
}

// Create a redirection http Response
function redirect(url: string | URL) {
  console.debug('redirect', url.toString())
  return Response.redirect(url)
}

// Create a proxy http response
async function proxy(input: string, request: Request) {
  const url = new URL(input)
  console.debug('proxy', url.toString())

  const headers = new Headers(request.headers)
  headers.set('Host', url.hostname)

  const proxy = new Request(url, {
    method: request.method,
    headers,
    body: request.body,
    redirect: 'manual',
  })

  return fetch(proxy)
}

// Score a route for sorting
function getRouteScore(route: Route) {
  return [
    route.pattern.hostname,
    route.pattern.pathname,
    route.pattern.search,
    route.pattern.protocol,
    route.pattern.port,
  ]
    .map((str) => getPatternScore(str))
    .reduce((sum, count) => sum + count, 0)
}

// Score a URLPattern part based on the length and number of wildcard/parameters
// - more wildcard -> later
// - more specific -> sooner
// - longer match -> sooner
function getPatternScore(pattern: string) {
  return ((pattern.match(/[\*:]/g)?.length ?? 0) * 100) -
    pattern.length
}

function compareRoutes(a: Route, b: Route) {
  return getRouteScore(a) - getRouteScore(b)
}

function prettyPattern(pattern: URLPattern) {
  return `${pattern.hostname}${pattern.pathname}`
}

// Handle a HTTP request with our proxy or redirect logic
function handleRequest(request: Request) {
  try {
    for (const route of appRoutes) {
      const match = route.pattern.exec(request.url)
      if (!match) continue

      if (route.type === 'redirect') {
        return redirect(template(route.url, match))
      }
      if (route.type === 'proxy') {
        return proxy(template(route.url, match), request)
      }
    }

    return new Response('Not found', { status: 404 })
  } catch (error) {
    console.error('Internal error', error)
    return new Response('Internal server error', { status: 500 })
  }
}

if (import.meta.main) {
  const { port = '8000', config = 'config.json', verbose } = flags.parse(
    Deno.args,
    {
      string: ['port', 'config'],
      boolean: ['verbose'],
    },
  )

  const appConfig = getAppConfig(config)

  appRoutes = appConfig.routes.toSorted(compareRoutes)

  if (appConfig.endpoint) {
    await setupEndpoint(appConfig.endpoint, appConfig.routes)
  }

  if (verbose) {
    for (const route of appRoutes) {
      console.log(
        '%o → %s',
        prettyPattern(route.pattern),
        `${route.type}(${route.url})`,
      )
    }
  }

  Deno.serve({ port: parseInt(port) }, handleRequest)
}
