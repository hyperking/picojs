class IDom {
    $tag: string;
    $tmpl: string | any;
    $node: HTMLElement | IText | any;
    $should_update?: boolean = false;
    $data_refs:string[] = [];
    $children: Array<IDom | IText> = [];
    $props: object = {};
    $evtprops: object;
    $iter_block?: boolean;
    $databind?: string[];
    $render?: Function;

    constructor(ref:HTMLElement | string, should_update?: boolean){
        this.$should_update = should_update;
        ref && this.init(ref);
    }
    createRender(iter_ctx?: string){
        this.$render = new Function("state", "i", iter_ctx, "return " + this.$tmpl.replace(/{/g,'').replace(/}/g,'') );
    }

    updateTxt(state, memoMap?: any): any{
        const v = memoMap ? memoMap : this.$render(state, state.i, state.iter_item);
        this.$node.data = v;
        return v;
    }
    //Creates new reactive DOM node
    init(ref:HTMLElement | any) {
        if(typeof ref === 'string' || ref.nodeType===3){
            this.$tag = ref.nodeType ? 'IText' : 'IProp';
            this.$tmpl = typeof ref === 'string' ? ref : ref.data;
            this.$node = (typeof ref === 'string') ? document.createTextNode(ref) : this.$tag==='IText' && ref;
            this.$data_refs = this.$should_update && [this.$tmpl.replace(/{/g,'').replace(/}/g,'').trim()]
            this.$should_update && this.createRender();
            return;
        }
        this.$tag = ref.nodeName
        this.$node = document.createElement(this.$tag);
        //Assign Props
        [...ref.attributes].forEach(atr=>{
            let attr_name = atr.name;
            if(atr.name === 'data-for'){ 
                this.$iter_block = true;
                this.$props['datafor'] = atr.value.split(' in ')
                return; 
            }
            if(atr.name.startsWith('on')){ 
                if(!this.$evtprops) this.$evtprops = {};
                this.$evtprops[atr.name.replace('on','')] = atr.value;
                return;
            }
            if(atr.name.startsWith('data-bind')){
                this.$databind = [atr.name.replace('data-bind:',''), atr.value];
                const [prop_name, state_attr] = this.$databind;
                attr_name = prop_name;
                atr.value = '{state.'+state_attr+'}'                
            }
            const propv = this.$databind || atr.value.includes('{') ? new IProp(atr.value, attr_name, this.$node) : atr.value;
            if(!this.$props[attr_name]) this.$props[attr_name] = propv; 
            if(typeof propv === 'string'){
                this.$node.setAttribute(attr_name, atr.value);
            }
        });
        //convert children into IDom nodes
        ref.childNodes && toVdom([...ref.childNodes])[0].forEach((inode: IDom )=>{
            this.$children.push(inode);        
            !this.$iter_block && this.$node.appendChild(inode.$node); 
        });
    }
}
class IText extends IDom {}
class IProp extends IDom {
    $attr: string;

    constructor(tml:string, attr:string, nodeEl: HTMLElement){
        super(tml, true)
        this.$node = nodeEl;
        this.$attr = attr;
    }

    updateTxt(state, memoMap?: any): any{
        const v = memoMap ? memoMap : this.$render(state, state.i, state.iter_item);
        !this.$node.value ? this.$node.setAttribute(this.$attr, v) : this.$node.value = v;
        return v;
    }
}
//IT would be a huge performance boost to have these nodes prerendered.
const toVdom = (htmlNodes: Array<ChildNode>) => {
    const convertNodes = (tmpl) => [...document.createRange().createContextualFragment(tmpl.trim()).childNodes];
    const nodeList = typeof htmlNodes === 'string' ? convertNodes(htmlNodes) : htmlNodes;
    const res = [];
    let style;
    nodeList.forEach((node: any)=>{
        if(node.nodeName==='STYLE'){style = node; return;}
        if(!node || node.data && node.data.trim()===""){return}
        const d = node.nodeType===3 ? partText(node.data) : new IDom(node);
        if(Array.isArray(d)){d.forEach(inode=> res.push(inode))}else{ res.push(d) }
    })  
    return [res, style];
};
//Converts template literals into IText object. returns a list of Text fragments
const partText = (str) => {
    function useRegex(input) {
        const regex = /\{[\s]*.*?[\s]*\}/gs;
        const res = [...input.matchAll(regex)];
        return res.length > 0 ? res.map(a => a[0].replace()) : false;
    }
    var reFrag = useRegex(str);
    if(!reFrag){return new IText(str);}
    var frags = reFrag.map((r,_)=> r);
    var textNodes = [];
    frags.forEach((match, i) => {
            var [left, right] = str.split(match);
            let lfrag = left.trim()!="" ? new IText(left) : left;
            let rfrag = new IText(match, true);
            if(left.trim()!="") {textNodes.push(lfrag);}
            textNodes.push(rfrag);
            str = right;
            if (i+1 === frags.length && str.trim()!=""){
                textNodes.push(new IText(str))
            }
        });
    return textNodes;
};

export default function Pico(obj){
    let memoMap = {}, reative_keys = [];
    const is_iter_block = obj.iter_block;
    const reactive_frags = [];
    const subscribers = [];
    const root = obj.root || is_iter_block.$node;
    const name = obj.name;
    const state = !is_iter_block ? create_state(obj.state) : obj.state;
    const _template = typeof obj.view === 'function' ? obj.view(obj.state) : obj.view;
    const [domtree, styletree] = !is_iter_block ? toVdom(_template) : [];
    const actions = obj.actions;
    const recieve = ( k:string, data: any) => {
        const cursor = Array.isArray(data[k]) && state[k].length;
        state[k] = data[k];
        console.log(state, 'Youve got mail 🌍💌');
        if(is_iter_block){
            iter_insert(cursor);
        }
    }
    const send = ( key: any ) => {
        subscribers.forEach(([k, isub])=> {if(k===key) {isub.recieve(key, state);console.log(key,k, 'Message sent!🎉');}}) 
    }
    function create_state(obj){
        const handler = {
            get(data, key){
                return key in data ? data[key] : null;
            },
            set(data, key, newvalue){
                if(key in data && data[key] === newvalue){ return key;}
                data[key] = newvalue;
                update(key);
                return key;
            }
        }
        return new Proxy(obj, handler)
    }

    //Dispatch event handlers on target dom nodes
    function apply_events(evtType: string, evtHandler: string | Function, idom: IDom) {
        let eventHandler = typeof evtHandler === 'function' ? evtHandler : actions[evtHandler];
        if(!eventHandler){console.log('Unable to assign '+evtHandler); return null;}
        const Ihandler = async (event) => {
            await eventHandler(state, event);
          }
        idom.$node.addEventListener(evtType,Ihandler);
    }
    //Update reactive frags from any qualifying dom node
    const collate_reactives = (n: IDom, ctx_name?: string) => {
        n.$children && n.$children.forEach(dc=>collate_reactives(dc, ctx_name));
        n.$props && Object.values(n.$props).forEach((pc:IProp)=>collate_reactives(pc, ctx_name));
        n.$should_update && ctx_name && n.createRender(ctx_name); 
        n.$should_update && reactive_frags.push([n.$tmpl, n]);
    }
    //Initialize event handlers on dom nodes
    const delegate_events = (idom: IDom) => {
        if(idom.$evtprops){
            for(const k in idom.$evtprops){
                const event_name = idom.$evtprops[k]
                apply_events(k, event_name, idom)
            }
        }
        idom.$children && idom.$children.forEach(ichld => ichld.$tag!=='IText' && delegate_events(ichld))   
    }
    //Automatic event handlers for input nodes with bind props
    const data_bind_inputs = (node: IDom) => {
        if(!node.$databind){return;}
        const [prop_name, state_attr] = node.$databind;
        apply_events('input', (gstate)=>{
            gstate[state_attr] = node.$node[prop_name||'value'];
        }, node);
    }
    //Mount Domtree to root node
    const mount_tree = (root_node?: HTMLElement) => {
        domtree && domtree.forEach((idom: IDom, i)=>{
            if(idom.$iter_block){ create_block(idom, i); return; }
            root_node && root_node.appendChild(idom.$node);
        });
        (styletree && root_node) && root_node.appendChild(styletree);
    }
    //Hydrate domtree events, reactivity, and binders
    const hydrate = (node_tree?: IDom[], is_iter_item?: string) => {
        node_tree.forEach((idom: IDom, i)=>{
            data_bind_inputs(idom);
            delegate_events(idom);
            collate_reactives(idom, is_iter_item);
        });
    } 
    //Updates all reactive fragments
    function update(key?: string) {
        reactive_frags.forEach((ilist: [string, IDom]) => {
            const [tmpl, itxt] = ilist;
            if( key && tmpl.indexOf(key) === -1 ){return;} //TODO: Lets use the data_ref attributes to fine tune the guard
            memoMap[tmpl] = itxt.updateTxt(state, memoMap[tmpl]);
        })
        key && send(key);//returns updated state back to caller 
        memoMap = {};
    }
    // Block nodes are Loops and Conditional that share context with root
    const create_block = (idom: IDom, replace_index)=>{
        const state_key = idom.$props['datafor'][1];
        const icomp = new Pico({ //Makes Root iter node and its children
            name: "iter_block",
            iter_block: idom,
            state: {[state_key]: state[state_key]},
        });
        root.appendChild(icomp.$.root);
        domtree[replace_index] = icomp;
        subscribers.push([state_key, icomp]);
        return icomp;
    }

    Object.defineProperty(this, 'send', {
        get(){ return send}
    })
    Object.defineProperty(this, 'recieve', {
        get(){ return recieve}
    })
    Object.defineProperty(this, '$', {
        get(){ return {subs: subscribers, name: name, children: domtree, root: root, state: state, re_txts: reactive_frags, reative_keys: reative_keys}}
    })
    
    const iter_insert = (cursor?: number) =>{
        const [ctx_name, state_key] = is_iter_block.$props.datafor;
        const refIterble = state[state_key];
        for (let index = cursor || 0; index < refIterble.length; index++) {
            state[ctx_name] = refIterble[index];
            state['iter_item'] = state[ctx_name];
            state['i'] = index;
            hydrate(is_iter_block.$children, ctx_name);
            update('');//force all frag updates
            is_iter_block.$children.forEach(cn=>root.appendChild(cn.$node.cloneNode(true)));
        }
    }
    const mount = ()=>{
        typeof obj.beforemount === 'function' && obj.beforemount(state);
        if(!is_iter_block) {mount_tree(root); hydrate(domtree); update();}else{ iter_insert(); }
    }
    if(obj.resources){
        const get_resource = async (endpoint)=>await fetch(endpoint).then(res=>res.json());
        const promise_pool = Object.keys(obj.resources).map((endpoint)=>get_resource(endpoint) );
        Promise.all(promise_pool).then(allres => {
            Object.values(obj.resources).forEach((callback: Function,i)=>{
                callback(allres[i], state)
            })
            mount();
        });
    }else{
        mount();
    }
}