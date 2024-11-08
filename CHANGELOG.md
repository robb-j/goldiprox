# Change log

This file contains notable changes to the project

## 0.4.2

- **feature** experimental
  [WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
  support for proxy routes

## 0.4.1

- **fix** search parameters are preserved while proxying/redirecting, i.e. the
  parameters on the request are set on the redirect location and proxied request
- **change** the container is now based on `alpine-1.46.3`

## 0.4.0

- **feature** set `x-forwarded-` headers when using proxy
- **fix** upgrade the container to use deno `1.43.1`

## 0.3.4

- **fix** reimplement internal routing for `healthz` & `routesz`

## 0.3.3

- **fix** revert incorrect internal hostnames for `healthz` & `routesz`
- **fix** improve logging of internal routes

## 0.3.2

- **feature** upgrade container to deno `1.37.2`

## 0.3.1

- **fix** sort routes the correct way again, `0.3.0` was wrong
- **fix** make `routesz`/`healthz` more specific so they only trigger on
  localhost

## 0.3.0

- **feature** added a `/routesz` endpoint, similarly named to `/healthz`, to
  dump the routes and their scores. This is only enabled when
  `env == development`
- **fix** the routes are now sorted as expected, most specific first, most
  parameters later.

## 0.2.0

- **feature** inject headers on `proxy` routes with optional `addHeaders`
- **feature** inject search params on `proxy` & `redirect` routes with optional
  `addSearchParams`
- **feature** add `/healthz` endpoint and wrap the process 5s termination state
  to improve use behind load balancers
- **fix** correct the container's command + args

## 0.1.1

Retry the build

## 0.1.0

🎉 Everything is new!
