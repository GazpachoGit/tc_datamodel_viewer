# TC Data Model Viewer

A local viewer for Teamcenter data model templates. It shows the classes,
inheritance, relations, attributes and LOVs of a selected template as a
UML-like class diagram.

Specifications live in [spec/](spec/): [requirements](spec/requirements.md),
[design](spec/design.md), [model](spec/model.md), [mapping](spec/mapping.md).

## Requirements

- Node.js 20 or later
- A directory with Teamcenter template files: `<prefix>_template.xml` and
  `<prefix>_dependency.xml` pairs

## Configuration

Set the template directory in `server.config.json`:

```json
{
  "modelDir": "examples/model",
  "host": "127.0.0.1",
  "port": 5180
}
```

`modelDir` is absolute or relative to `server.config.json`. `host` and `port`
are optional. The server reads the directory at startup, so restart it after
adding or changing templates.

## Running

```bash
npm install

# Development: API server and Vite dev server together.
# Open the address printed by Vite; /api is proxied to the server.
npm run dev

# Production: portable build, then serve API and client from one process.
npm run build
npm start          # node dist/server.mjs → http://127.0.0.1:5180/
```

## Portable build

`npm run build` produces a self-contained `dist/` folder:

```
dist/
├── server.mjs           # server with all its dependencies in one file
├── server.config.json   # copy of the config, modelDir adjusted for dist/
└── public/              # built client
```

It needs only Node.js 20 or later — no `npm install`, no `node_modules`,
no sources. To run it elsewhere, copy `dist/`, set `modelDir` in
`dist/server.config.json`, and start it:

```bash
node server.mjs                        # uses server.config.json next to it
node server.mjs --config my.config.json
```

`--config` takes a path relative to the current directory. Without it, the
server uses `server.config.json` next to `server.mjs`.

## Checks

```bash
npx vitest run     # tests (npm test runs them in watch mode)
npx tsc -b         # type check: client, server and build config
npm run lint       # oxlint
```

The `issuemgmt` integration test runs only when `examples/issuemgmt/` exists
with `issuemgmt`, `cm` and `foundation` templates; otherwise it is skipped.
