import { domToAST, htmlToDom} from "./utils";
import Pico from "./pico";
import App from "./demo/main";

// Convert 
const appView = htmlToDom(typeof App.view==='function'? App.view(App.state) : App.view)
const appAST = domToAST(appView)

// Compile
// App.compiledActions = Object.keys(App.actions) .map(actionName=>`const ${actionName} = (state) => ${App.actions[actionName].toString()}`)
// App.compiledView = appAST

// Deploy
window.app = new Pico(App, appAST)