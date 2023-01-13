# picoJS

A micro reactive runtime library for building reactive frontend user interfaces for the web.

`bundle size: 4.62kb / gzip: 2kb`

```js
const app = new Pico({
    name:"myApp", 
    root: document.getElementById('app'),
    state: {greet: 'Hello'},
    view:()=>`<h1>{state.greet} World</h1>`
    });

// Output: <div id="app"><h1>Hello World</h1></div>
```

**Fully supports:**

- Typescript
- ES6 modules