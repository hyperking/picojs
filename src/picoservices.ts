export default function PicoServices (options?: any){
    const domain = options.domain || '';
    const headers = options.headerMap || {};
    const mocks = options.mocks || {};
    const oninit = options.call_oninit;
    let protocol = options.protocol || 'http';
    const endpoints = {};
    const apps = [];
    const get_opts = (endpoint) => headers[endpoint] || null;
    const get_resource = async (endpoint)=>await fetch(`${protocol}://${domain}${endpoint}`, get_opts(endpoint)).then(res=>res.json());
    const opt_endpoints = options.endpoints
    this.__proto__.resolve = (init_endpoints?: string[]) => {
        const promise_pool = Object.keys(endpoints).filter(ep=>init_endpoints.indexOf(ep)>-1).map((endpoint)=>get_resource(endpoint) );
        const state = {};
        Promise.all(promise_pool).then(allres => {
            Object.values(endpoints).forEach((callback: Function,i)=>{
                callback(allres[i], state);
            })
            apps.map(app => app.receive('picoservices', state))
        });
    }

    this.__proto__.add = (slug:string, callback:string, headers?: any) => {
        endpoints[slug] = callback
        if (headers) headers[slug] = headers;
    }

    this.__proto__.loadApps = (appList: any[]) => appList.forEach(app=>{apps.push(app)});
    options.endpoints.forEach((route: any[])=>{
        const [route_slug, callback] = route;
        this.add(route_slug, callback);
    })
    this.resolve(oninit);
}