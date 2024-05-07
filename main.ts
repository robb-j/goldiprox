import * as flags from 'std/flags/mod.ts'
import {
  AppConfig,
  getAppConfig,
  ProxyRoute,
  RedirectRoute,
  Route,
} from './config.ts'
import { array, create, template } from './lib.ts'

interface AppContext {
  state: 'running' | 'shutdown'
  routes: Route[]
  log(message: string, ...args: unknown[]): void
}

const app: AppContext = {
  state: 'running',
  routes: [],
  log() {},
}

function internalHostnames() {
  const segments = [
    'localhost',
    ...Deno.networkInterfaces()
      .filter((i) => i.family === 'IPv4')
      .map((i) => i.address),
  ]
  return `(${segments.join('|')})`
}

export function getHealthz(request: Request, state: string) {
  app.log('healthz', request.url.toString())
  return state === 'running'
    ? new Response('ok')
    : new Response('terminating', { status: 503 })
}
export function getRoutesz(request: Request, routes: Route[]) {
  app.log('routesz', request.url.toString())
  return Response.json(routes.map((r) => dumpRoute(r)))
}

export function getBaseRoutes(appConfig: AppConfig): Route[] {
  const extras: Route[] = []
  if (appConfig.env === 'development') {
    extras.push({
      type: 'internal',
      pattern: new URLPattern({
        hostname: internalHostnames(),
        pathname: '/routesz{/}?',
      }),
      fn: (r) => getRoutesz(r, app.routes),
    })
  }
  return [
    {
      type: 'internal',
      pattern: new URLPattern({
        hostname: internalHostnames(),
        pathname: '/healthz{/}?',
      }),
      fn: (r) => getHealthz(r, app.state),
    },
    ...extras,
    ...appConfig.routes,
  ]
}

async function fetchRoutes(url: string, staticRoutes: Route[]) {
  try {
    const routes = create(
      await fetch(url).then((r) => r.json()),
      array(Route),
    )
    return [...staticRoutes, ...routes].toSorted(compareRoutes)
  } catch (error) {
    console.error('Failed to fetch routes', error)
    return [...staticRoutes].toSorted(compareRoutes)
  }
}

// Create a redirection http Response
export function redirect(route: RedirectRoute, match: unknown) {
  const url = new URL(template(route.url, match))
  for (const [name, value] of Object.entries(route.addSearchParams)) {
    url.searchParams.set(name, value)
  }
  app.log('redirect', url.toString())
  return Response.redirect(url)
}

export function getProxyRequest(
  route: ProxyRoute,
  match: unknown,
  request: Request,
  remoteAddr: Deno.NetAddr,
) {
  const url = new URL(template(route.url, match))
  for (const [name, value] of Object.entries(route.addSearchParams)) {
    url.searchParams.set(name, value)
  }
  app.log('proxy', url.toString())

  const headers = new Headers(request.headers)
  for (const [name, value] of Object.entries(route.addHeaders)) {
    headers.set(name, value)
  }
  headers.set('Host', url.hostname)
  headers.set('X-Real-IP', remoteAddr.hostname)
  headers.set('X-Forwarded-Host', url.hostname)
  headers.set('X-Forwarded-For', remoteAddr.hostname)
  headers.set(
    'X-Forwarded-Proto',
    URL.parse(request.url)?.protocol.replace(/:$/, '') ?? 'http',
  )

  return new Request(url, {
    method: request.method,
    headers,
    body: request.body,
    redirect: 'manual',
  })
}

// Create a proxy http response
function proxy(
  route: ProxyRoute,
  match: URLPatternResult,
  request: Request,
  info: Deno.ServeHandlerInfo,
) {
  return fetch(getProxyRequest(route, match, request, info.remoteAddr))
}

// Score a route for sorting
function getRouteScore(route: Route) {
  return [
    route.pattern.hostname,
    route.pattern.pathname,
    route.pattern.search,
    route.pattern.protocol,
  ]
    .map((str) => getPatternScore(str))
    .reduce((sum, count) => sum + count, 0)
}

// Score a URLPattern part based on the length and number of wildcard/parameters
// - more wildcard -> later
// - more specific -> sooner
// - longer match -> sooner
function getPatternScore(pattern: string) {
  return ((pattern.match(/[\*:]/g)?.length ?? 0) * 1000) -
    pattern.length
}

function compareRoutes(a: Route, b: Route) {
  return getRouteScore(a) - getRouteScore(b)
}

function dumpRoute(route: Route) {
  const pattern =
    `${route.pattern.protocol}//${route.pattern.hostname}:${route.pattern.port}${route.pattern.pathname}`
  const score = getRouteScore(route)

  if (route.type === 'redirect') return { ...route, pattern, score }
  if (route.type === 'proxy') return { ...route, pattern, score }
  if (route.type === 'internal') return { type: 'internal', pattern, score }
  return 'unknown'
}

function prettyRoute(route: Route) {
  const pattern = `${route.pattern.hostname}${route.pattern.pathname}`

  if (route.type === 'redirect') return `${pattern} → redirect=${route.url}`
  if (route.type === 'proxy') return `${pattern} → proxy=${route.url}`
  if (route.type === 'internal') return `${pattern} → internal`
  return 'unknown'
}

// Handle a HTTP request with our proxy or redirect logic
function handleRequest(
  request: Request,
  info: Deno.ServeHandlerInfo,
  app: AppContext,
) {
  try {
    for (const route of app.routes) {
      const match = route.pattern.exec(request.url)
      if (!match) continue

      if (route.type === 'redirect') {
        return redirect(route, match)
      }
      if (route.type === 'proxy') {
        return proxy(route, match, request, info)
      }
      if (route.type === 'internal') {
        return route.fn(request)
      }
    }

    return new Response('Not found', { status: 404 })
  } catch (error) {
    console.error('Internal error', error)
    return new Response('Internal server error', { status: 500 })
  }
}

async function shutdown(appConfig: AppConfig, server: Deno.Server) {
  console.log('Exiting...')
  app.state = 'shutdown'
  server.unref()
  if (appConfig.env !== 'development') {
    // Wait longer in prod for connections to terminate
    // and Load balancers to update
    await new Promise((r) => setTimeout(r, 5_000))
  }
  Deno.exit()
}

if (import.meta.main) {
  const {
    port = '8000',
    config = 'config.json',
    verbose,
    log = false,
  } = flags.parse(Deno.args, {
    string: ['port', 'config'],
    boolean: ['verbose', 'log'],
  })

  const appConfig = getAppConfig(config)
  const baseRoutes = getBaseRoutes(appConfig)

  if (log) app.log = console.log

  // Add routes from CLI?

  if (appConfig.endpoint) {
    const { url, interval } = appConfig.endpoint
    app.routes = await fetchRoutes(url, baseRoutes)

    setInterval(async () => {
      app.routes = await fetchRoutes(url, baseRoutes)
    }, interval)
  } else {
    app.routes = baseRoutes.toSorted(compareRoutes)
  }

  if (verbose) {
    console.log('ROUTES:')
    for (const route of app.routes) {
      console.log(prettyRoute(route))
    }
  }

  const server = Deno.serve(
    { port: parseInt(port) },
    (r, i) => handleRequest(r, i, app),
  )

  Deno.addSignalListener('SIGINT', () => shutdown(appConfig, server))
  Deno.addSignalListener('SIGTERM', () => shutdown(appConfig, server))
}
