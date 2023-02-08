type TPico = {
    view: Function;
    state?: any; 
    actions?: any;
    receive?: Function;
    send?: Function;
    beforemount?: Function;
    root?: HTMLElement
}
type loopctx = {
    pivotnode?: HTMLElement,
    strategy?: Strategy,
    iter_item: string,
    iter_value?: any,
    loop?: any,
    outer?: loopctx
}
enum Strategy {
    NOOP,
    NEW,
    APPEND,
    PREPEND,
    DELETE,
}
function partText (str): string[] {
    function useRegex(input) {
        const regex = /\{[\s]*.*?[\s]*\}/gs;
        const res = [...input.matchAll(regex)];
        return res.length > 0 ? res.map(a => a[0].replace()) : false;
    }
    var reFrag = useRegex(str);
    if(!reFrag){return null;}
    var frags = reFrag.map((r,_)=> r);
    return frags;
};
export default function Pico(obj: TPico){
    function highlight(text) {
        console.log(state, text);
        if (!state.filterFor || !text) {
            return text;
        }
        return text.replace(state.filterFor, `<span class="highlight">${state.filterFor}</span>`);
    }
    class IFrag {
        $tmpl: string;
        $should_update: boolean;
        node: Text | Attr | any;
        $render: Function;
        $attr_name?: string;
        as_html?: boolean = null;
    
        constructor(str: string, parent_node: HTMLElement, should_update?: boolean, attr_name?: string){
            this.$tmpl = str;
            this.$should_update = should_update
            this.$attr_name = attr_name
            this.node = attr_name ? document.createAttribute(attr_name) : document.createTextNode(str);
            if(this.$should_update) {
                this.createRender(loopctx);
                this.updateTxt(state, null, loopctx);
                reactfrags.push(this); //TODO: aggregate frags according to block elements
            }
            if(this.as_html){
                parent_node.innerHTML = this.node.nodeValue
            }else{
                insertNode(this, parent_node);
            }
        }
    
        createRender(iloop?: loopctx){
            const as_html = this.$tmpl.startsWith('{@html')
            const t = this.$tmpl.replace(/{/g,'').replace(/}/g,'').replace('@html','');
            const outerctx = (iloop && iloop.outer) && iloop.outer.iter_item;
            const locals = `${highlight.toString()}\n`;
            if(as_html){this.as_html = true}
            this.$render = iloop ? Function("state", iloop.iter_item, "loop", outerctx, "outerloop", locals + "return " + t ) : Function("state", "return " + t );
        }
    
        updateTxt(state, memoMap?: any, loopctx?: loopctx): any{
            const outerctxv = (loopctx && loopctx.outer) && loopctx.outer.iter_value;
            const outerctxl = (loopctx && loopctx.outer) && loopctx.outer.loop;
            const v = memoMap ? memoMap : loopctx ? this.$render(state, loopctx.iter_value, loopctx.loop, outerctxv, outerctxl) : this.$render(state);

            if(this.$attr_name){
                this.node.value = v;
                const is_input = this.node.ownerElement && this.node.ownerElement.nodeName==='INPUT';
                if(is_input) { this.node.ownerElement[this.$attr_name] = v;}
            }else{
                this.node.textContent = v;
            }
            return v;
        }
    }
    class IAttr extends IFrag{
        constructor( attr_name:string, attr_val: string, nodeEl: HTMLElement){
            const tmpl = partText(attr_val).map(st=>{
                if(st.includes("{")){
                    return st.replace('{','').replace('}','')
                } return `"${st}"`
            }).join(' + ');
            super(tmpl, nodeEl, true, attr_name)
        }
    }

    class INode {
        node: HTMLElement | any;
        children: Array<any>;
        constructor(olnode: HTMLElement|any, parent_node: HTMLElement){
            this.node = document.createElement(olnode.nodeName);
            this.children = [...olnode.childNodes];
            // copy Attrs
            olnode.attributes && [...olnode.attributes].map(atr=>{
                if(atr.value.includes('{')){
                    new IAttr( atr.name, atr.value, this.node);
                }else{
                    this.node.setAttribute(atr.name, atr.value);
                }
            })
            !skip_insert_mode && this.processChildren();
            insertNode(this, parent_node);
        }

        processChildren(){
            const res = (this.children && this.children.length > 0 ) ? this.children
            .reduce((nl, cn)=>{
                const n = processNode(cn, this.node);
                if(!n){return nl}
                if(Array.isArray(n)){ n.forEach(fn=> nl.push(fn)) }else{ nl.push(n) }
                return nl;
            },[]) : null;
            return res;
        }
    }

    class IBlock extends INode{
        iter_item: string;
        state_key: string;
        frags?: IFrag;
        $state: any[];
        constructor(block_node: HTMLElement, parent_root: HTMLElement){
            const [iter_name, iter_state_key] = block_node.dataset.for.split(' in ');
            const add_sub = blockfrags.size === 0;
            skip_insert_mode = true;
            super(block_node, parent_root)
            skip_insert_mode = false
            
            this.iter_item = iter_name;
            this.state_key = iter_state_key;
            this.$state = state[iter_state_key];
            this.reconcileIterable(null, loopctx);
            
            if(add_sub) {
                subscribers.push([this.state_key, this, [...blockfrags]])
                blockfrags.clear()
            }
        }

        receive ( k, newData: any) {
            this.reconcileIterable(newData);
            if(k===this.state_key){ this.$state = newData[k];}
        }

        arrayStrategy(inputData?: any[]): Array<any> {
            const oldData = this.$state;
            const has_changed = oldData.length !== inputData.length || JSON.stringify(oldData) !== JSON.stringify(inputData);
            const is_prepend = has_changed && JSON.stringify(oldData) === JSON.stringify(inputData.slice((inputData.length - oldData.length)));
            const is_append = has_changed && JSON.stringify(oldData) === JSON.stringify(inputData.slice(0,oldData.length));
            const noop = !has_changed && !is_append && !is_prepend && this.node.innerHTML !== '';
            const strategy = (!is_prepend && !is_append && !noop) ? Strategy.NEW 
            : is_append ? Strategy.APPEND 
            : is_prepend ? Strategy.PREPEND : Strategy.NEW;
            const curr = strategy===Strategy.NEW? 0 : oldData.length;
            const itr = is_append ? inputData.slice(oldData.length, inputData.length) : 
            is_prepend ? inputData.slice(0,inputData.length - oldData.length) : inputData;
            return [strategy, itr, curr];
        }

        reconcileIterable ( inData?: any, outerctx?: loopctx) {
            blockfrags.add(this.state_key)
            const oldData: Array<any> = state[this.state_key];
            const newData: Array<any> = inData && inData[this.state_key]||oldData;
            const [strategy, iterable, cursor] = this.arrayStrategy(newData);
            const pivotnode: HTMLElement = strategy===Strategy.PREPEND ? this.node.firstChild : this.node;
            if(strategy===Strategy.NOOP){return }
            if(strategy===Strategy.NEW){this.node.innerHTML = ''; }
            for (let index = 0; index < iterable.length; index++) {
                loopctx = {
                    pivotnode: pivotnode,
                    strategy: strategy,
                    iter_item: this.iter_item,
                    iter_value: iterable[index],
                    loop: {index: strategy===Strategy.NEW ? index : cursor+index},
                    outer: outerctx
                }
                const cblock = this.processChildren();      
            }
            loopctx = undefined

        }

    }

    function processFrag(textContent: string, parent_node: HTMLElement){
        const txtparts = partText(textContent);
        const txtFrags = [];
        txtparts && txtparts.forEach((match, i) => {
            const [left, right] = textContent.split(match);
            let lfrag = left.trim()!="" ? new IFrag(left, parent_node, false) : left;
            let rfrag = new IFrag(match, parent_node, true);
            if(left.trim()!="") {txtFrags.push(lfrag);}
            txtFrags.push(rfrag);
            textContent = right;
            if (i+1 === txtparts.length && textContent.trim()!=""){
                txtFrags.push(new IFrag(left, parent_node,false))
            }
        });
        
        return txtparts ? txtFrags : [new IFrag(textContent, parent_node, false)]
    }

    function processNode(oldNode: HTMLElement | any, parent_node: HTMLElement){
        if(skipNode(oldNode)){return;}
        const is_block_loop = (oldNode.dataset && 'for' in oldNode.dataset);
        const is_block_switch = oldNode.dataset && 'switch' in oldNode.dataset;
        const newNode: any = oldNode.nodeName==='#text' ? processFrag(oldNode.textContent, parent_node) : 
        !is_block_loop ? new INode(oldNode, parent_node) : 
        new IBlock(oldNode, parent_node);
        return newNode;
    }

    function hydrateNode(newNode: HTMLElement, attrs){
        attrs && [...attrs].forEach(atr=>{
            if(atr.name.startsWith('on')){ 
                newNode.removeAttribute(atr.name);
                const event_name = atr.name.replace('on','');
                const event_callback = atr.value;
                vapply_events(newNode, event_name, event_callback);
            }
        })
    }

    function insertNode(newIobject: INode | IBlock | IFrag, parent_node: HTMLElement){
        if(newIobject.constructor.name === 'IAttr'){
            return parent_node && parent_node.setAttributeNode(newIobject.node)
        }
        const insert_obj = loopctx ? newIobject.node : newIobject.node
        hydrateNode(insert_obj, newIobject.node.attributes)
        switch(loopctx && loopctx.strategy){
            case Strategy.DELETE:
                break;
            case Strategy.PREPEND:
                // console.log('prepending', loopctx.pivotnode, insert_obj)
                parent_node && parent_node.insertBefore(insert_obj, loopctx.pivotnode);
                break;
            default:
                parent_node && parent_node.appendChild(insert_obj);
        }
    }

    function update( key?: string, frags?: IFrag[],) {
        const memoMap = {};
        (frags||reactfrags).forEach((ifrag) => {
            const tmpl = ifrag.$tmpl
            if( key && tmpl.indexOf(key) === -1 ){return;}
            memoMap[tmpl] = ifrag.updateTxt(state, memoMap[tmpl]);
        });
        key && send(key);
    }

    function compile_analyzer(str){
        function useRegex(input) {
            const regex = /state.[a-z,A-Z]+/g;
            const res = [...input.matchAll(regex)];
            return res.length > 0 ? res.reduce((rmap, r)=>{
                rmap.add(r[0].replace('state.',''))
                return rmap;
            },new Set()) : false;
        }
        return useRegex(str)
    }

    function createState(stateObj){
        const computes = [];
        const ckey = [];
        Object.keys(stateObj.$).forEach( k => {
            const refs = compile_analyzer(stateObj.$[k].toString())
            computes.push([k, stateObj.$[k], [...refs]])
            ckey.push(k)
            stateObj[k] = stateObj.$[k](stateObj);
        });
        delete stateObj.$;
        const handler = {
            get(data, key){ 
                return key in data ? data[key] : null;
            },
            set(data, key, newvalue){
                if(key in data && data[key] === newvalue){ return key;}
                data[key] = newvalue;
                !ckey.includes(key) && computes.forEach(([k, cfunc, refs])=> {
                    if(ckey.includes(key) || refs.includes(key)) {state[k] = cfunc(data)}
                })
                update(key);
                return key;
            }
        }
        return new Proxy(stateObj, handler);
    }
    
    function send( key: any ){
        subscribers.forEach(([k, isub, refs])=> {
            if(k===key || refs.includes(key)) isub.receive(key, state);
        }) 
    }
    
    function receive(id: string, data: any){
        if(obj.receive){
            obj.receive(id, data, state)
        }else{
            Object.keys(data).forEach(k=>{ state[k] = data[k]; });  
        }
    }
    
    function convertNodes(tmpl){
        if(typeof tmpl==='function'){tmpl = tmpl(state)}else if(tmpl.tagName==='TEMPLATE'){return [...tmpl.content.childNodes];}
        return [...document.createRange().createContextualFragment(tmpl.trim()).childNodes];
    }

    function skipNode(node): boolean { if(node.nodeName==='STYLE'){styles.push(node)}
        return node.data && node.data.trim()==="" || node.nodeName==='STYLE' || node.nodeName==='#comment'; 
    }
    
    //Dispatch event handlers on target dom nodes
    function vapply_events (vnode: HTMLElement, evtType: string, callback: string | Function){
        let eventHandler = typeof callback === 'function' ? callback : actions[callback];
        if(!eventHandler){console.log('Unable to assign '+callback); return null;}
        const Ihandler = (event) => { eventHandler(state, event); }
        vnode.addEventListener(evtType,Ihandler);
    }

    let skip_insert_mode = false;
    let loopctx: loopctx = undefined;
    let blockfrags = new Set();
    const root = obj.root;
    const actions = {...obj.actions};
    const subscribers = [], reactfrags = [], styles=[];
    const state = createState(obj.state || {});
    if(obj.beforemount){
        obj.beforemount(state)
    }
    const domtree = convertNodes(obj.view).map(n=> processNode(n, root)).filter(n=>!!n);
    //@ts-ignore
    styles.length > 0 && root.appendChild(...styles);

    this.__proto__.$ = {send: send, receive: receive, rf: reactfrags,bf: blockfrags, subs: subscribers, domtree: domtree, actions: actions, root: root, state: state}
}