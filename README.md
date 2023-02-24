# Pico JS

A micro library for building fine-grained reactive frontend user interfaces on the web.
Inspired by giants like [Hyperapp](https://github.com/jorgebucaran/hyperapp), [Svelte](https://github.com/sveltejs/svelte), [React](https://github.com/facebook/react), [Vue](https://github.com/vuejs/), and [SolidJs](https://github.com/solidjs/solid)

`bundle size: 6.79 kB │ gzip: 2.88 kB`

`bundle size: 6.63kb | brotliCompress: 2.51kb`

**Install**

1. Clone repo
    ```
    git clone git@github.com:hyperking/picojs.git
    ```
2. CD into local directory and run NPM
    ```
    npm install && npm run dev
    ```
3. Preview App running on localhost:3000

**Example Setup**

```js
import Pico from "pico";
const app = new Pico({
    state: {greet: 'Hello'},
    view:()=>`<h1>{state.greet} World</h1>`,
    root: document.getElementById('app'),
    });

// Output: <div id="app"><h1>Hello World</h1></div>
```

**This Project is not for Production Use and serves as an Exploratory project**


