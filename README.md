# picoJS

A micro reactive runtime library for building fine-grained reactive frontend user interfaces for the web.

`bundle size: 4.29kb / gzip: 2kb`

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

**Preloading data from external resources**

Its a better practice to asynchronously fetch data from services before hydrating the UI to avoid loading spinners.

The example below will query each endpoints, save the data into state, then mount the pico app.

```js
import PicoServices from "pico/picoservices";
const app = new PicoServices({
    "@app":{
        name:"myApp",
        root: document.getElementById('app'),
        state: {todos: []},
        view:()=>`<ul class="todo-list">
        ${state.todos.map(item => `<li>${item}</li>`).join("")}
        </ul>`
    },
    "@call_oninit":["/api/todos"],
    "@domain":"https://localhost:3000",
    "@headerMap": {"/save_todo": {method:'POST', bearerToken:"picoUserPublicAuthToken"}},
    "/todos": (res, state)=> { state.todos = [...state.todos, ...res.data];},
    "/save_todo": (res, state)=> { state.todos = [...state.todos, ...res.data];
    },
})
```

**Fully supports:**

- Typescript & Vanilla Javascript
- ES6 modules
- NO JSX!

**This Project in IN Development**

