import { domToAST, htmlToDom} from "./utils";
import Pico from "./pico";
import App from "./demo/App";

// Convert 
const appView = htmlToDom(typeof App.view==='function'? App.view(App.state) : App.view)
const appAST = domToAST(appView)
console.log(appAST)

// Compile
// App.compiledActions = Object.keys(App.actions) .map(actionName=>`const ${actionName} = (state) => ${App.actions[actionName].toString()}`)
// App.compiledView = appAST

// Deploy
new Pico(App, appAST)