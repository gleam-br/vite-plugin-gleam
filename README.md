# 🚀 Gleam plugin to vite runtime.

[Gleam](https://gleam.run) language plugin to [vitejs](https://vite.dev/).

## 🌸 Options

Vite config [vite.config.js](https://vite.dev/config/):

```ts
import { resolve } from "vite";
import { defineConfig } from "vite";

// type to plugin options
import gleam, { type GleamPlugin } from "vite-plugin-gleam";

export default defineConfig({
  plugins: [
    // gleam plugin options
    gleam({
      // gleam root dir project
      cwd: ".", // process.cwd() is default
      // gleam binary path
      bin: "gleam",
      log: {
        // "info" | "debug" | "trace" | "none"
        level: "info",
        // if put date and time
        time: true
      },
      build: {
        // gleam build arg to break on warnings
        warningsAsErrors: true,
        // gleam build arg to show or not cmd output
        noPrintProgress: false
      }
    })
  ],
  resolve: {
    alias: {
      // vite aliases to gleam build dir
      '@gleam': resolve(__dirname, "./build/dev/javascript")
    }
  }
})
```

## 🧪 Demo

- [bun-plugin-gleam-demo](https://github.com/gleam-br/bun-plugin-gleam-demo)
- [bunup-plugin-gleam-demo](https://github.com/gleam-br/bunup-plugin-gleam-demo)
- [vite-plugin-gleam-demo](https://github.com/gleam-br/vite-plugin-gleam-demo)
- [vite-ts-plugin-gleam-demo](https://github.com/gleam-br/vite-ts-plugin-gleam-demo)
- [vite-lustre-plugin-gleam-demo](https://github.com/gleam-br/vite-lustre-plugin-gleam-demo)

## 🌄 Roadmap

- [x] Unit tests
- [ ] More docs
- [x] GH workflow
  - [x] test
  - [x] build
  - [x] changelog & issue to doc
  - [x] ~~auto publish~~ manual publish
    - [x] `npm publish`
- [ ] Pure gleam code

## Thanks & Acknowledgements

- [Enderchief/gleam-tools](https://github.com/enderchief/gleam-tools)
