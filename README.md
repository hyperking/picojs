# picoJS

A micro reactive runtime library for building fine-grained reactive frontend user interfaces for the web.

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

**Services / Store**

PicoService instance provides a way to agregate data from multiple sources before hydrating web application from the client side.

The example below will query each endpoints, save the data into state, then mount the pico app instances.

```js
import PicoServices from "pico/picoservices";
//setup service instance
const app = new PicoServices({
    call_oninit:["/api/todos"],
    domain:"https://localhost:3000",
    headerMap: {"/save_todo": {method:'POST', bearerToken:"picoUserPublicAuthToken"}},
    endpoints:[
        ["/todos": (res, state)=> { state.todos = [...state.todos, ...res.data];}],
        ["/save_todo": (res, state)=> { state.todos = [...state.todos, ...res.data]];
        ]
    }) //load apps after services have resolved
    .loadApps([new Pico({...})])
```

**Fully supports:**

- Typescript & Vanilla Javascript
- NO JSX!
- Single file components coming soon!

**This Project is experimental and serves as an example of reactive web applications.**

