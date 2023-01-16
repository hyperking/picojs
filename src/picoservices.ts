import Pico from "@src/pico";
export default function PicoServices (options?: any){
    const domain = options['@domain'] || {};
    const headers = options['@headerMap'] || {};
    const mocks = options['@mocks'] || {};
    const oninit = options['@call_oninit'];
    const endpoints = {};
    let app = options['@app'] || {};
    const get_opts = (endpoint) => headers[endpoint] || null;
    const get_resource = async (endpoint)=>await fetch(endpoint, get_opts(endpoint)).then(res=>res.json());
    this.__proto__.resolve = (init_endpoints?: string[]) => {
        const promise_pool = Object.keys(endpoints).filter(ep=>init_endpoints.indexOf(ep)>-1).map((endpoint)=>get_resource(endpoint) );
        Promise.all(promise_pool).then(allres => {
            Object.values(endpoints).forEach((callback: Function,i)=>{
                callback(allres[i], app.state);
                app = new Pico(app);
            })
        });
    }

    this.__proto__.add = (slug:string, callback:string, headers?: any) => {
        endpoints[slug] = callback
        if (headers) headers[slug] = headers;
    }

    this.__proto__.loadApp = (picoStruct: any) => {app = picoStruct;};
    Object.keys(options).forEach(route_name=>{
        if(route_name.startsWith('@')){return;}
        this.add(route_name, options[route_name]);
    })
    this.resolve(oninit);
 

}