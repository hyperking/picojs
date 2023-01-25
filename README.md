# Kunai JS

A micro library for building fine-grained reactive frontend user interfaces on the web.

`bundle size: 4.48kb / gzip: 1.92kb`

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


**Fully supports:**

- Typescript & Vanilla Javascript
- NO JSX!
- Single file components coming soon!

**This Project is experimental and serves as an example of reactive web applications.**

