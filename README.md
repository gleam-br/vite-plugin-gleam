# 🚀 Gleam plugin to vite runtime.

[Gleam](https://gleam.run) language plugin to [vitejs](https://vite.dev/).

## 🌸 Options

Vite config [vite.config.js](https://vite.dev/config/):

```ts
import { resolve } from "vite";
import { defineConfig } from "vite";

// type to plugin options
import gleam from "vite-plugin-gleam";
import {type GleamPlugin} from "./src/project";

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
    } as GleamPlugin)
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

- [vite-plugin-gleam-demo](https://github.com/gleam-br/vite-plugin-gleam-demo)
- [vite-ts-plugin-gleam-demo](https://github.com/gleam-br/vite-ts-plugin-gleam-demo)
- [vite-lustre-plugin-gleam-demo](https://github.com/gleam-br/vite-lustre-plugin-gleam-demo)

## 🌄 Roadmap

- [ ] Unit tests
- [ ] More docs
- [ ] GH workflow
  - [ ] test
  - [x] build
  - [x] changelog & issue to doc
  - [x] ~~auto publish~~ manual publish
    - [x] `npm publish`
- [ ] Pure gleam code
