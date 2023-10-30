# Change log


This file contains notable changes to the project

## 0.3.0

* **feature** added a `/routesz` endpoint, similarly named to `/healthz`, to dump the routes and their scores. This is only enabled when `env == development`
* **fix** the routes are now sorted as expected, most specific first, most parameters later.

## 0.2.0

* **feature** inject headers on `proxy` routes with optional `addHeaders`
* **feature** inject search params on `proxy` & `redirect` routes with optional `addSearchParams`
* **feature** add `/healthz` endpoint and wrap the process 5s termination state to improve use behind load balancers
* **fix** correct the container's command + args

## 0.1.1

Retry the build

## 0.1.0

🎉 Everything is new!
