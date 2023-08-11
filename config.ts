import * as flags from 'std/flags/mod.ts'
import {
  array,
  coerce,
  defaulted,
  define,
  env,
  envObj,
  Infer,
  literal,
  loadJsonConfig,
  number,
  object,
  optional,
  string,
  union,
} from './lib.ts'
import app from './app.json' assert { type: 'json' }

const PatternInit = object({
  // username: optional(string()),
  // password: optional(string()),
  // hash: optional(string()),
  // baseURL: optional(string()),
  port: optional(string()),
  protocol: optional(string()),
  hostname: optional(string()),
  pathname: optional(string()),
  search: optional(string()),
})

export const Pattern = coerce(
  define<URLPattern>('url-pattern', (v) => v instanceof URLPattern),
  union([string(), PatternInit]),
  (v) => new URLPattern(v),
)

export type RedirectRoute = Infer<typeof RedirectRoute>
const RedirectRoute = object({
  type: literal('redirect'),
  pattern: Pattern,
  url: string(),
})

export type ProxyRoute = Infer<typeof ProxyRoute>
export const ProxyRoute = object({
  type: literal('proxy'),
  pattern: Pattern,
  url: string(),
})

export type Route = Infer<typeof Route>
export const Route = union([RedirectRoute, ProxyRoute])

export type EndpointSource = Infer<typeof EndpointSource>
export const EndpointSource = object({
  url: string(),
  interval: number(),
})

export type StaticSource = Infer<typeof StaticSource>
export const StaticSource = object({
  routes: array(Route),
})

export type AppConfig = Infer<typeof AppConfig>
export const AppConfig = envObj({
  env: env('DENO_ENV', 'production'),
  selfUrl: env('SELF_URL', 'http://localhost:8000'),
  meta: envObj({
    name: defaulted(string(), app.name),
    version: defaulted(string(), app.version),
  }),
  routes: defaulted(array(Route), []),
  endpoint: optional(EndpointSource),
})

export function getAppConfig(filename = 'config.json') {
  const config = loadJsonConfig(
    new URL(filename, import.meta.url),
    AppConfig,
  )
  // any extra validation?
  return config
}

if (import.meta.main) {
  const { config } = flags.parse(Deno.args, { string: ['config'] })
  console.log(getAppConfig(config))
}
