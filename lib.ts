import { create, defaulted, object, string, Struct } from 'superstruct'

export * from 'superstruct'

export function env(key: string, fallback: string) {
  return defaulted(string(), Deno.env.get(key) ?? fallback)
}

// deno-lint-ignore no-explicit-any
export function envObj<T extends Record<string, Struct<any, any>>>(v: T) {
  return defaulted(object(v), {})
}

// synchronously load in a JSON file and validate it against a structure
export function loadJsonConfig<T>(url: URL, struct: Struct<T>): T {
  let file: string
  try {
    file = Deno.readTextFileSync(url)
  } catch {
    return create({}, struct)
  }
  return create(JSON.parse(file), struct)
}

/** Use dot-notation syntax to retrieve a nested value from an object */
// deno-lint-ignore no-explicit-any
export function dot(value: any, key: string[]) {
  const [head, ...tail] = key
  if (value === undefined || typeof value !== 'object' || value === null) {
    return undefined
  } else if (tail.length > 0) return dot(value[head], tail)
  else return value[head]
}

/**
 * Replace variable references in the `input` string with values from the `context`
 * using dot notation within double brackets to retrive values
 * e.g. `"https://example.com/{{ pathname.groups.path }}"`
 */
// deno-lint-ignore no-explicit-any
export function template(input: string, context: any) {
  return input.replace(
    /{{\s*([\w.$]+)\s*}}/g,
    (_, variable: string) => dot(context, variable.split('.')) ?? '',
  )
}

export function tryUrl(input: string, base?: string | URL) {
  try {
    return new URL(input, base)
  } catch {
    return null
  }
}
