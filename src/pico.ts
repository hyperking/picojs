import { TPico, BlockTypes, Strategy, LoopCtx, TNode } from "./types";
import { partText, htmlToDom, compile_analyzer, applyAttrs, skipNode, concatTemplate } from "./utils";

export default function Pico(obj: TPico, PRECOMPILED?: TNode[]){

    class IFrag {
        $should_update: boolean;
        node: Text | Attr | any;
        $render: Function;
        type?: BlockTypes;
        $tmpl: string;
        attr_name?: string;
        as_html?: boolean = null;
        parent_node?: HTMLElement;
    
        constructor(str: string, parent_node: HTMLElement, should_update?: boolean, attr_name?: string){
            this.$tmpl = str;
            this.type = attr_name ? BlockTypes.ATTR : BlockTypes.TXT
            this.parent_node = parent_node;
            this.$should_update = should_update
            this.attr_name = attr_name
            this.as_html = str.startsWith('{@html')
            this.node = attr_name ? document.createAttribute(attr_name) : document.createTextNode(str);
            if(this.$should_update) {
                const t = this.$tmpl.replace(/{/g,'').replace(/}/g,'').replace('@html','');
                this.$render = createRender(t, LOOPCTX);
                this.updateTxt(state, null, LOOPCTX);
                !LOOPCTX && reactfrags.push(this);
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
    
        updateTxt(state, memoMap?: any, loopctx?: LoopCtx): any{
            const outerctxv = (loopctx && loopctx.outer) && loopctx.outer.iter_value;
            const outerctxl = (loopctx && loopctx.outer) && loopctx.outer.loop;
            const v = memoMap ? memoMap : loopctx ? this.$render(state, loopctx.iter_value, loopctx.loop, outerctxv, outerctxl) : this.$render(state);

            if(this.attr_name){
                this.node.value = v;
                const is_input = this.node.ownerElement && this.node.ownerElement.nodeName==='INPUT';
                if(is_input) { this.node.ownerElement[this.attr_name] = v;}
            }else{
                this.node.textContent = v;
            }
            return v;
        }
    }

    class IAttr extends IFrag {} 

    class INode {
        node: HTMLElement | any;
        children: Array<any>;
        parent_node?: HTMLElement;
        frags?: Array<any>;
        blockNodes: INode[];
        //Block fields
        iter_item: string;
        state_key: string;
        foreignKeys: any[] = [];
        type?: BlockTypes = BlockTypes.NODE;
        $state: any[];

        constructor(astNode: any[]){
            let iter_str;
            const SKIP_ATTRS = ['data-for','data-switch','data-case'];
            const [parent_node, id, nodeName, type, textContent, childNodes, attributes] = astNode;
            this.parent_node = !parent_node ? root : parent_node;
            this.node = document.createElement(nodeName);
            this.children = childNodes;
            this.type = type;
            attributes && attributes.forEach(attrAST=>{
                // LOOPCTX && console.log(attrAST, this.node)
                const [name, value, should_update] = attrAST;
                if(SKIP_ATTRS.includes(name)) { iter_str = value; return;}
                if(should_update){
                    new IAttr( value, this.node, true, name);
                }else{
                    this.node.setAttribute(name, value);
                }
            })

            if(type===BlockTypes.FORLOOP){
                const [iter_name, iter_state_key] = iter_str.split(' in ')
                const des_statekey = iter_state_key.startsWith('[') && JSON.parse(iter_state_key);
                const add_sub = NESTED_BLOCK_KEYS.size === 0;
                this.iter_item = iter_name;
                this.state_key = des_statekey ? null : iter_state_key;
                this.$state = des_statekey || state[iter_state_key] ||  LOOPCTX.iter_value;
                // Re-wrap child node with root node
                const btree = [parent_node, id, nodeName, BlockTypes.NODE, null, childNodes, attributes]
                this.children = [btree]
                this.node = parent_node

                this.reconcileIterable(LOOPCTX);

                if(add_sub) {
                    this.foreignKeys = [...NESTED_BLOCK_KEYS].slice(1);
                    this.blockNodes = BLOCK_NODES.length>0 && [...BLOCK_NODES];
                    subscribers.push(this);
                    cleanup()
                }
            }else{
                insertNode(this);
                if(LOOPCTX&&LOOPCTX.strategy===Strategy.PREPEND){LOOPCTX.strategy = Strategy.APPEND;}
                childNodes && this.processChildren(childNodes)
            }
        }
        
        processChildren(childNodes){
            const applyStrategy = (Tnode) => {
                LOOPCTX && console.log(Tnode, LOOPCTX.frags)
                if(!Tnode) return;
                if((LOOPCTX && LOOPCTX.frags)) {
                    if(!this.frags) this.frags = []
                    this.frags.push(LOOPCTX.frags)
                }
                if(Tnode.constructor=== IBlock && NESTED_BLOCK_KEYS.size>0) {
                    BLOCK_NODES.push(Tnode)
                }
            }
            for (let index = 0; index < childNodes.length; index++) {
                const cnode = childNodes[index];
                if(!cnode) continue;
                cnode[0] = this.node;
                applyStrategy(processNode(cnode)) 
            }
        }

        receive ( k, newData: any) {
            console.log('---'+ k)
            const strategy = this.arrayStrategy(newData[this.state_key])
            this.reconcileIterable();
            if(this.blockNodes) this.blockNodes = strategy===Strategy.PREPEND ? [...BLOCK_NODES, ...this.blockNodes] : [...this.blockNodes, ...BLOCK_NODES];
            cleanup()
        }

        arrayStrategy(inputData?: any[]): Strategy {
            if(!IS_READY) return Strategy.NEW;
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
            return strategy;
        }

        itemStrategy(inputData?: any[]): Array<any> {
            const strategy = this.arrayStrategy(inputData);
            const curr = strategy===Strategy.NEW? 0 : this.$state.length;
            const itr = strategy===Strategy.APPEND ? inputData.slice(this.$state.length, inputData.length) : 
            strategy===Strategy.PREPEND ? inputData.slice(0,inputData.length - this.$state.length) : inputData;
            return [strategy, itr, curr];
        }

        reconcileIterable ( outerctx?: LoopCtx) {
            NESTED_BLOCK_KEYS.add(this.state_key)
            const oldData: Array<any> = this.$state;
            const newData: Array<any> = state[this.state_key]||oldData;
            const [strategy, iterable, cursor] = (LOOPCTX && LOOPCTX.strategy) ? [LOOPCTX.strategy, newData, 0] : this.itemStrategy(newData);

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
                if(strategy===Strategy.APPEND||strategy===Strategy.PREPEND||!IS_READY){
                    this.processChildren(this.children);
                } else {
                    if(this.blockNodes && this.blockNodes[index].constructor.name==='IBlock') {
                        this.blockNodes[index].reconcileIterable(LOOPCTX)
                    }else{
                        update('', this.frags[index])
                    }
                }
            }
            this.$state = newData
        }
    }

    class IBlock extends INode { }

    function createRender(t:string, iloop?: LoopCtx, inline?: boolean): Function {
        const outerctx = (iloop && iloop.outer) && iloop.outer.iter_item;
        let locals = inline && iloop ? [`const ${iloop.iter_item} = ${JSON.stringify(iloop.iter_value)};`,`const loop = ${JSON.stringify(iloop.loop)};`, 
        (outerctx ? `const ${iloop.outer.iter_item} = ${JSON.stringify(iloop.outer.iter_value)}; \n const outerloop = ${JSON.stringify(iloop.outer.loop)};` : '')].join('\n') : '';
        if(locals){
            return new Function('state', locals+'\n return '+t)
        }
        return iloop ? new Function("state", iloop.iter_item, "loop", outerctx, "outerloop", "return " + t ) : Function("state", "return " + t );
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

    function processNode(astNode: any){
        if(skipNode(astNode)){ 
            if(astNode.nodeName==='STYLE') styles.push(astNode)
            return;}
        const [parent, id, nodeName, type, textContent, childNodes, attributes] = astNode;
        const newNode: any = nodeName==='#text' ? processFrag(textContent, parent) : type===BlockTypes.FORLOOP ? new IBlock(astNode) : new INode(astNode); 
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

    function insertNode(newIObj: INode | IFrag){
        if(newIObj.type===BlockTypes.ATTR){
            return newIObj.parent_node && newIObj.parent_node.setAttributeNode(newIObj.node)
        }
        hydrateNode(newIObj.node, newIObj.node.attributes)
        switch(LOOPCTX && LOOPCTX.strategy){
            case Strategy.DELETE:
                break;
            case Strategy.PREPEND:
                newIObj.parent_node && newIObj.parent_node.insertBefore(newIObj.node, LOOPCTX.pivotnode);
                break;
            default:
                newIObj.parent_node && newIObj.parent_node.appendChild(newIObj.node);
        }
    }

    function cleanup(){
        NESTED_BLOCK_KEYS.clear();
        BLOCK_NODES.length = 0;
        LOOPCTX = undefined;
    }

    function update( key?: string, frags?: IFrag[]) {
        const memoMap = {};
        let detach = null;
        (frags||reactfrags).forEach((ifrag, i) => {
            if(ifrag.type===BlockTypes.TXT && !document.body.contains(ifrag.node)){
                //collect garbage
                detach = !detach ? [i] : detach.concat(i);
                console.log(ifrag.node)
                return
            }
            const tmpl = ifrag.$tmpl || [ifrag.state_key]
            if( key && tmpl.indexOf(key) === -1 ){ return;}
            memoMap[tmpl] = ifrag.updateTxt(state, memoMap[tmpl], LOOPCTX);
        });
        //sweap garbage
        detach && detach.forEach(id=> reactfrags.splice(id, 1))
        key && subscribers.forEach((isub: IBlock)=> {
            if(isub.state_key===key || isub.foreignKeys.includes(key)) isub.receive(key, state);
        }) 
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
    
    function emit( key: any ){
    }
    
    function receive(id: string, data: any){
        if(obj.receive){
            obj.receive(id, data, state)
        }else{
            Object.keys(data).forEach(k=>{ state[k] = data[k]; });  
        }
    }

    //Dispatch event handlers on target dom nodes
    function vapply_events (vnode: HTMLElement, evtType: string, callback: string | Function){
        let eventHandler = typeof callback === 'function' ? callback 
        : callback[0]==='(' ? createRender("("+callback+")()", LOOPCTX, true)
        // : callback[0]==='(' ? Function("("+callback+")()")
        : actions[callback] && actions[callback];
        if(!eventHandler){console.log('Unable to assign '+callback); return;}
        // callback[0]==='(' && console.log(LOOPCTX, eventHandler)
        const Ihandler = (event) => { eventHandler(state, event); }
        vnode.addEventListener(evtType,Ihandler);
    }

    let IS_READY, LOOPCTX: LoopCtx = undefined;
    let NESTED_BLOCK_KEYS = new Set();
    const root = obj.root;
    const actions = {...obj.actions};
    const subscribers = [], reactfrags = [], styles=[], BLOCK_NODES = [];
    const state = createState(obj.state || {});
    if(obj.beforemount){
        obj.beforemount(state)
    }
    if(!PRECOMPILED){
        const DomTree: ChildNode[] = htmlToDom(typeof obj.view==='function'? obj.view(state) : obj.view);
        DomTree.forEach(n=> processNode(n));
    }else{
        PRECOMPILED.forEach(n=> processNode(n));
    }
    (styles.length > 0) && styles.forEach(styl=>root.appendChild(styl));
    IS_READY = true;
    
    this.__proto__.$ = {send: emit, receive: receive, rf: reactfrags, subs: subscribers, actions: actions, root: root, state: state}
}