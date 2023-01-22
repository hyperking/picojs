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
