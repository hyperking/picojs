type TPico = {
    view: Function;
    state?: any; 
    actions?: any;
    receive?: Function;
    send?: Function;
    beforemount?: Function;
    root?: HTMLElement
}

enum Strategy {
    NOOP,
    NEW,
    APPEND,
    PREPEND,
    DELETE,
    MODIFY
}
enum BlockTypes {
    FORLOOP = 'FORLOOP',
    SWITCH = 'SWITCH',
    COMPONENT = 'COMPONENT'
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

    type loopctx = {
        frags?: IFrag[],
        pivotnode?: HTMLElement,
        strategy?: Strategy,
        iter_item: string,
        iter_value?: any,
        loop?: any,
        outer?: loopctx
    }
    
    class IFrag {
        $tmpl: string;
        $should_update: boolean;
        node: Text | Attr | any;
        $render: Function;
        $attr_name?: string;
        as_html?: boolean = null;
        parent_node?: HTMLElement;
    
        constructor(str: string, parent_node: HTMLElement, should_update?: boolean, attr_name?: string){
            this.$tmpl = str;
            this.parent_node = parent_node;
            this.$should_update = should_update
            this.$attr_name = attr_name
            this.node = attr_name ? document.createAttribute(attr_name) : document.createTextNode(str);
            if(this.$should_update) {
                this.createRender(LOOPCTX);
                this.updateTxt(state, null, LOOPCTX);
                !LOOPCTX && reactfrags.push(this); //TODO: aggregate frags according to block elements
                if(LOOPCTX){
                    LOOPCTX.frags ? LOOPCTX.frags.push(this) : LOOPCTX.frags = [this];
                }
            }
            if(this.as_html){
                this.parent_node.innerHTML = this.node.nodeValue
            }else{
                insertNode(this);
            }
        }
    
        createRender(iloop?: loopctx){
            const as_html = this.$tmpl.startsWith('{@html')
            const t = this.$tmpl.replace(/{/g,'').replace(/}/g,'').replace('@html','');
            const outerctx = (iloop && iloop.outer) && iloop.outer.iter_item;
            if(as_html){this.as_html = true}
            this.$render = iloop ? Function("state", iloop.iter_item, "loop", outerctx, "outerloop", "return " + t ) : Function("state", "return " + t );
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
        reconcileIterable(LOOPCTX: { frags?: IFrag[]; pivotnode?: HTMLElement; strategy?: Strategy; iter_item: string; iter_value?: any; loop?: any; outer?: loopctx; }) {
            throw new Error("Method not implemented.");
        }
        node: HTMLElement | any;
        children: Array<any>;
        parent_node?: HTMLElement;
        frags?: Array<IFrag[]>;
        blockNodes: INode[];
        constructor(olnode: HTMLElement|any, parent_node: HTMLElement){
            this.parent_node = parent_node;
            this.node = document.createElement(olnode.nodeName);
            this.children = [...olnode.childNodes].filter(n=>!skipNode(n));
            // copy Attrs
            olnode.attributes && [...olnode.attributes].map(atr=>{
                if(atr.value.includes('{')){
                    new IAttr( atr.name, atr.value, this.node);
                }else{
                    this.node.setAttribute(atr.name, atr.value);
                }
            })
            insertNode(this);
            !SKIP_CHILDREN && this.processChildren(Strategy.NEW)
            
        }
        
        processChildren(strategy?: Strategy){
            // if(SKIP_CHILDREN){ return }
            const cnodes = this.children || [];
            const applyStrategy = (cblock) => {
                if((LOOPCTX && LOOPCTX.frags)) {
                    if(!this.frags) this.frags = []
                    this.frags.push(LOOPCTX.frags)
                }
                else{
                    if(!this.blockNodes) this.blockNodes = []
                    const pos = (strategy===Strategy.PREPEND) ? 0 : this.blockNodes.length; 
                    this.blockNodes.splice(pos, 0, cblock)
                }
            }
            for (let index = 0; index < cnodes.length; index++) {
                const cnode = processNode(cnodes[index], this.node);
                if(!cnode) continue;
                applyStrategy(cnode) 
            }
        }
    }

    class IBlock extends INode{
        iter_item: string;
        state_key: string;
        foreignKeys: any[] = [];
        type?: BlockTypes;
        $state: any[];
        constructor(block_node: HTMLElement, parent_root: HTMLElement){
            const [iter_name, iter_state_key] = block_node.dataset.for.split(' in ');
            const des_statekey = iter_state_key.startsWith('[') && JSON.parse(iter_state_key);
            const add_sub = BLOCK_KEYS.size === 0;
            SKIP_CHILDREN = true;
            super(block_node, parent_root)
            SKIP_CHILDREN = false
            this.type = block_node.dataset.for ? BlockTypes.FORLOOP : BlockTypes.COMPONENT;
            this.iter_item = iter_name;
            this.state_key = des_statekey ? null : iter_state_key;
            this.$state = des_statekey || state[iter_state_key] ||  LOOPCTX.iter_value;
            this.reconcileIterable(LOOPCTX);

            if(add_sub) {
                this.foreignKeys = [...BLOCK_KEYS].slice(1);
                subscribers.push(this);
                BLOCK_KEYS.clear();
            }
        }

        receive ( k, newData: any) {
            console.log('---'+ k)
            this.reconcileIterable();
        }

        arrayStrategy(inputData?: any[]): Array<any> {
            if(!IS_READY) return [Strategy.NEW, inputData, 0];
            const oldData = this.$state;
            const has_changed = oldData.length !== inputData.length || JSON.stringify(oldData) !== JSON.stringify(inputData);
            const is_prepend = has_changed && JSON.stringify(oldData) === JSON.stringify(inputData.slice((inputData.length - oldData.length)));
            const is_append = has_changed && JSON.stringify(oldData) === JSON.stringify(inputData.slice(0,oldData.length));
            const is_delete = oldData.length < inputData.length || inputData.length < oldData.length;
            const is_modify = has_changed
            const noop = !has_changed && (!is_append && !is_prepend) && this.node.innerHTML !== '';
            const strategy = this.node.innerHTML === '' ? Strategy.NEW 
            : is_append ? Strategy.APPEND 
            : is_prepend ? Strategy.PREPEND 
            : is_delete ? Strategy.DELETE 
            : is_modify ? Strategy.MODIFY : Strategy.NOOP;
            const curr = strategy===Strategy.NEW? 0 : oldData.length;
            const itr = is_append ? inputData.slice(oldData.length, inputData.length) : 
            is_prepend ? inputData.slice(0,inputData.length - oldData.length) : inputData;
            return [strategy, itr, curr];
        }

        reconcileIterable ( outerctx?: loopctx) {
            BLOCK_KEYS.add(this.state_key)
            const oldData: Array<any> = this.$state;
            const newData: Array<any> = state[this.state_key]||oldData;
            let [strategy, iterable, cursor] = (LOOPCTX && LOOPCTX.strategy) ? [LOOPCTX.strategy, newData, 0] : this.arrayStrategy(newData);
            const pivotnode: HTMLElement = strategy===Strategy.PREPEND ? this.node.firstChild : this.node;
            for (let index = 0; index < iterable.length; index++) {

                LOOPCTX = {
                    pivotnode: pivotnode,
                    strategy: strategy,
                    iter_item: this.iter_item,
                    iter_value: iterable[index],
                    loop: {index: (strategy===Strategy.NEW ? index : cursor+index)},
                    outer: outerctx
                }
                if(!IS_READY){
                    this.processChildren(Strategy.NEW);
                }else if(strategy===Strategy.APPEND||strategy===Strategy.PREPEND||!IS_READY){
                    const defaultstrategy = !outerctx ? strategy : Strategy.NEW
                    this.processChildren(defaultstrategy);
                } else {
                    if(this.blockNodes && this.blockNodes[index].constructor.name==='IBlock') {
                        this.blockNodes[index].reconcileIterable(LOOPCTX)
                    }else if(!this.frags){
                        const iterfrag = this.blockNodes[index]
                        update('', iterfrag.frags[0])
                    }else{
                        update('', this.frags[index])
                    }
                }
            }

            LOOPCTX = undefined
            this.$state = newData
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
                txtFrags.push(new IFrag(textContent, parent_node,false))
            }
        });
        const res = txtparts ? txtFrags : new IFrag(textContent, parent_node, false)
        return res
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

    function insertNode(newIObj: INode | IBlock | IFrag){
        if(newIObj.constructor.name === 'IAttr'){
            return newIObj.parent_node && newIObj.parent_node.setAttributeNode(newIObj.node)
        }
        const insert_obj = LOOPCTX ? newIObj.node : newIObj.node
        hydrateNode(insert_obj, newIObj.node.attributes)
        switch(LOOPCTX && LOOPCTX.strategy){
            case Strategy.DELETE:
                break;
            case Strategy.PREPEND:
                newIObj.parent_node && newIObj.parent_node.insertBefore(insert_obj, LOOPCTX.pivotnode);
                break;
            default:
                newIObj.parent_node && newIObj.parent_node.appendChild(insert_obj);
        }
    }

    function update( key?: string, frags?: IFrag[],) {
        // console.log(key)
        const memoMap = {};
        (frags||reactfrags).forEach((ifrag) => {
            const tmpl = ifrag.$tmpl || [ifrag.state_key]
            if( key && tmpl.indexOf(key) === -1 ){return;}
            memoMap[tmpl] = ifrag.updateTxt(state, memoMap[tmpl], LOOPCTX);
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
        subscribers.forEach((isub: IBlock)=> {
            if(isub.state_key===key || isub.foreignKeys.includes(key)) isub.receive(key, state);
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

    let SKIP_CHILDREN = false;
    let IS_READY = false;
    let LOOPCTX: loopctx = undefined;
    let BLOCK_KEYS = new Set();
    const root = obj.root;
    const actions = {...obj.actions};
    const subscribers = [], reactfrags = [], styles=[];
    const state = createState(obj.state || {});
    if(obj.beforemount){
        obj.beforemount(state)
    }
    const domtree: HTMLElement[] = convertNodes(obj.view);
    const vdomtree = domtree.map(n=> processNode(n, root)).filter(n=>!!n);
    console.log(vdomtree)
    //@ts-ignore
    styles.length > 0 && root.appendChild(...styles);
    IS_READY = true;

    this.__proto__.$ = {send: send, receive: receive, rf: reactfrags,bf: BLOCK_KEYS, subs: subscribers, domtree: domtree, actions: actions, root: root, state: state}
}