# Pico JS

A micro library for building fine-grained reactive frontend user interfaces on the web.

`bundle size: 6.40kb / brotliCompress: 2.34kb`

**App example**

```js
import Pico from "pico";
const app = new Pico({
    state: {greet: 'Hello'},
    view:()=>`<h1>{state.greet} World</h1>`,
    root: document.getElementById('app'),
    });

// Output: <div id="app"><h1>Hello World</h1></div>
```

**This Project is experimental and exploring concepts around reactive web frameworks.**



