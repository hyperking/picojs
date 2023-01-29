type kunai = {
    view: Function;
    state?: any; 
    actions?: any;
    receive?: Function;
    send?: Function;
    beforemount?: Function;
    root?: HTMLElement
}
type loopctx = {
    iter_item: string,
    iter_value?: any,
    loop?: any,
    inner?: loopctx
}
enum Strategy {
    NEW,
    APPEND,
    PREPEND
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
export default function Kunai(obj: kunai){
    
    class IFrag {
        $tmpl: string;
        $should_update: boolean;
        node: Text | Attr | any;
        $render: Function;
        $attr_name?: string;
    
        constructor(str: string, parent_node: HTMLElement, should_update?: boolean, iter_ctx?: loopctx, attr_name?: string){
            this.$tmpl = str;
            this.$should_update = should_update
            this.$attr_name = attr_name
            this.node = attr_name ? document.createAttribute(attr_name) : document.createTextNode(str);
            if(this.$should_update) {
                if(iter_ctx) {
                    blockfrags.push(this)
                }else{
                    this.createRender(iter_ctx);
                    reactfrags.push(this)
                }; 
            }
            insertNode(this, parent_node);
        }
    
        createRender(iloop?: loopctx){
            const t = this.$tmpl.replace(/{/g,'').replace(/}/g,'');
            const outerctx = (iloop && iloop.inner) && iloop.inner.iter_item;
            this.$render = iloop ? Function("state", iloop.iter_item, "loop", outerctx, "outerloop", "return " + t ) : Function("state", "return " + t );
        }
    
        updateTxt(state, memoMap?: any, loopctx?: loopctx): any{
            const innerctxv = (loopctx && loopctx.inner) && loopctx.inner.iter_value;
            const innerctxl = (loopctx && loopctx.inner) && loopctx.inner.loop;
            const v = memoMap ? memoMap : loopctx ? this.$render(state, loopctx.iter_value, loopctx.loop, innerctxv, innerctxl) : this.$render(state);
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
        constructor( attr_name:string, attr_val: string, nodeEl: HTMLElement, iter_ctx?: loopctx){
            const tmpl = partText(attr_val).map(st=>{
                if(st.includes("{")){
                    return st.replace('{','').replace('}','')
                } return `"${st}"`
            }).join(' + ');
            super(tmpl, nodeEl, true, iter_ctx, attr_name)
        }
    }

    class INode {
        node: HTMLElement | any;
        children: Array<any>;
        constructor(olnode: HTMLElement|any, parent_node: HTMLElement, iter_ctx?: loopctx){
            this.node = document.createElement(olnode.nodeName);
            // copy Attrs
            olnode.attributes && [...olnode.attributes].map(atr=>{
                if(atr.value.includes('{')){
                    new IAttr( atr.name, atr.value, this.node, iter_ctx);
                }else{
                    this.node.setAttribute(atr.name, atr.value);
                }
            })
            this.children = (this.constructor!==IBlock && olnode.childNodes.length > 0 ) ? [...olnode.childNodes]
                .reduce((nl, cn)=>{
                    const n = processNode(cn, this.node, iter_ctx);
                    if(!n){return nl}
                    if(Array.isArray(n)){ n.forEach(fn=> nl.push(fn)) }else{ nl.push(n) }
                    return nl;
                },[]) : [...olnode.childNodes];
            this.constructor!==IBlock && insertNode(this, parent_node);
        }
    }

    class IBlock extends INode{
        iter_item: string;
        state_key: string;
        $loop: loopctx;
        $frags: any[];
        $state: any[];
        $nested_keys = new Set();
        constructor(block_node: HTMLElement, parent_root: HTMLElement, loop_ctx?: loopctx){
            const [iter_name, iter_state_key] = block_node.dataset.for.split(' in ');
            super(block_node, parent_root, loop_ctx)
            this.$nested_keys.add(iter_state_key);
            this.$frags = [...blockfrags];
            this.iter_item = iter_name;
            this.state_key = iter_state_key;
            this.$state = state[iter_state_key];
            insertNode(this, parent_root);
            if(!loop_ctx){
                this.reconcileIterable(); 
                subscribers.push([this.state_key, this, [...this.$nested_keys, 'likes']])
            }
        }

        receive ( k, newData: any) {
            this.reconcileIterable(newData);
            this.$state = newData[k];
        }

        arrayStrategy(inputData?: any[]): Array<any> {
            const oldData = this.$state;
            const has_changed = oldData.length !== inputData.length;
            const is_prepend = has_changed && JSON.stringify(oldData) === JSON.stringify(inputData.slice((inputData.length - oldData.length)));
            const is_append = has_changed && JSON.stringify(oldData) === JSON.stringify(inputData.slice(0,oldData.length));
            // const noop = !has_changed && !is_append && !is_prepend;
            const strategy = !is_prepend&&!is_append ? Strategy.NEW : is_append ? Strategy.APPEND : Strategy.PREPEND;
            const curr = strategy===Strategy.NEW? 0 : oldData.length;
            const itr = is_append ? inputData.slice(oldData.length, inputData.length) : 
            is_prepend ? inputData.slice(0,inputData.length - oldData.length) : inputData;
            return [strategy, itr, curr];
        }

        reconcileIterable ( inData?: any , outerctx?: loopctx) {
            const oldData: Array<any> = state[this.state_key];
            const newData: Array<any> = inData && inData[this.state_key]||oldData;
            const [strategy, iterable, cursor] = this.arrayStrategy(newData);
            const pivotnode: HTMLElement = strategy===Strategy.PREPEND ? this.node.firstChild : this.node;
            blockfrags.length = 0;
            if(strategy===Strategy.NEW){this.node.innerHTML = '';}
            if(strategy==='DELETE'){
                oldData.forEach((o,i)=>{
                    const start = i * this.children.length;
                    if(!newData.includes(o)){
                        for (let index = 0; index < this.children.length; index++) {
                            this.node.childNodes[start].remove();
                        }
                    }
                })
                return;
            }
            for (let index = 0; index < iterable.length; index++) {
                blockfrags.length = 0;
                this.$loop = {
                    iter_item: this.iter_item,
                    iter_value: iterable[index],
                    loop: {index: strategy===Strategy.NEW ? index : cursor+index},
                    inner: outerctx
                }
                for (let index = 0; index < this.children.length; index++) {
                    const ichild: any = this.children[index];
                    const inode: any = processNode(ichild, this.node, this.$loop);
                    if(!inode) continue
                    // this.update(blockfrags, this.$loop)
                    if(ichild===IBlock){
                        this.$nested_keys.add(ichild.state_key);
                        ichild.reconcileIterable(null, this.$loop);
                    }else{
                        this.update(blockfrags, this.$loop)
                    }
                }
            }
            // for (let index = 0; index < iterable.length; index++) {
            //     this.$loop = {
            //         iter_item: this.iter_item,
            //         iter_value: iterable[index],
            //         loop: {index: strategy===Strategy.NEW ? index : cursor+index},
            //         inner: outerctx
            //     }
            //     for (let index = 0; index < this.children.length; index++) {
            //         const ichild: any = this.children[index];
            //         if(ichild===IBlock){
            //             this.$nested_keys.add(ichild.state_key);
            //             ichild.reconcileIterable(null, this.$loop);
            //         }else{
            //             this.update();
            //             insertNode(ichild, this.node, strategy, pivotnode, true);
            //         }
            //     }
            // }
        }

        update(frags, loopctx) {
            const memoMap = {};
            frags.forEach((ifrag: IFrag) => {
                const tmpl = ifrag.$tmpl;
                !ifrag.$render && ifrag.createRender(loopctx)
                memoMap[tmpl] = ifrag.updateTxt(state, memoMap[tmpl], loopctx);
            });
        }

        // update() {
        //     const memoMap = {};
        //     this.$frags.forEach((ifrag: IFrag) => {
        //         const tmpl = ifrag.$tmpl;
        //         !ifrag.$render && ifrag.createRender(this.$loop)
        //         memoMap[tmpl] = ifrag.updateTxt(state, memoMap[tmpl], this.$loop);
        //     });
        // }
    }

    function processFrag(textContent: string, parent_node: HTMLElement, iter_ctx?: loopctx){
        const txtparts = partText(textContent);
        const txtFrags = [];
        txtparts && txtparts.forEach((match, i) => {
            const [left, right] = textContent.split(match);
            let lfrag = left.trim()!="" ? new IFrag(left, parent_node, false, iter_ctx) : left;
            let rfrag = new IFrag(match, parent_node, true, iter_ctx);
            if(left.trim()!="") {txtFrags.push(lfrag);}
            txtFrags.push(rfrag);
            textContent = right;
            if (i+1 === txtparts.length && textContent.trim()!=""){
                txtFrags.push(new IFrag(left, parent_node,false, iter_ctx))
            }
        });
        
        return txtparts ? txtFrags : [new IFrag(textContent, parent_node, false, iter_ctx)]
    }
    function processNode(oldNode: HTMLElement | any, parent_node: HTMLElement, iter_ctx?: loopctx){
        if(skipNode(oldNode)){return;}
        const is_block_loop = (oldNode.dataset && 'for' in oldNode.dataset);
        const is_block_switch = oldNode.dataset && 'switch' in oldNode.dataset;
        const newNode: any = oldNode.nodeName==='#text' ? processFrag(oldNode.textContent, parent_node, iter_ctx) : 
        !is_block_loop ? new INode(oldNode, parent_node, iter_ctx) : 
        new IBlock(oldNode, parent_node, iter_ctx);
        // if(is_block_loop){ 
        //     if(!iter_ctx){
        //         newNode.reconcileIterable(); blockfrags.length = 0;
        //         subscribers.push([newNode.state_key, newNode, [...newNode.$nested_keys]])
        //     }
        // }
        return newNode;
    }
    
    function xhydrateNode(newIobject: INode | IBlock){
        newIobject.node.attributes && [...newIobject.node.attributes].forEach(atr=>{
            if(atr.name.startsWith('on')){ 
                newIobject.node.removeAttribute(atr.name);
                const event_name = atr.name.replace('on','');
                const event_callback = atr.value;
                vapply_events(newIobject.node, event_name, event_callback);
                return;
            }
        })
    }

    function hydrateNode(newNode: HTMLElement, attrs){
        attrs && [...attrs].forEach(atr=>{
            if(atr.name.startsWith('on')){ 
                newNode.removeAttribute(atr.name);
                const event_name = atr.name.replace('on','');
                const event_callback = atr.value;
                // console.log(event_name, newNode)
                vapply_events(newNode, event_name, event_callback);
                // return;
            }
        })
    }

    function insertNode(newIobject: INode | IBlock | IFrag, parent_node: HTMLElement, strategy?: Strategy, pivotnode?: HTMLElement, clone?:boolean){
        if(newIobject.constructor.name === 'IAttr'){
            return parent_node && parent_node.setAttributeNode(newIobject.node)
        }
        const insert_obj = clone ? newIobject.node.cloneNode(true) : newIobject.node
        hydrateNode(insert_obj, newIobject.node.attributes)
        switch(strategy){
            case Strategy.PREPEND:
                parent_node && parent_node.insertBefore(insert_obj, pivotnode);
                break;
            default:
                parent_node && parent_node.appendChild(insert_obj);
        }
    }

    function update(key?: string) {
        const memoMap = {};
        reactfrags.forEach((ifrag) => {
            const tmpl = ifrag.$tmpl
            if( key && tmpl.indexOf(key) === -1 ){return;}
            memoMap[tmpl] = ifrag.updateTxt(state, memoMap[tmpl]);
        });
        key && send(key);
    }

    function compile_analyzer(str){
        function useRegex(input) {
            const regex = /state.[a-z]+/g;
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
            computes.push([k, stateObj.$[k], refs])
            ckey.push(k)
            stateObj[k] = stateObj.$[k](stateObj);
            console.log(k, refs)
        });
        delete stateObj.$;
        const handler = {
            get(data, key){ 
                return key in data ? data[key] : null;
            },
            set(data, key, newvalue){
                if(key in data && data[key] === newvalue){ return key;}
                !ckey.includes(key) && computes.forEach(([k, cfunc, refs])=> state[k] = cfunc(data))
                data[key] = newvalue;
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
        console.log('Youve got mail 🌍💌 from: '+ id, data);
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
    
    const root = obj.root;
    const state = createState(obj.state || {});
    const actions = {...obj.actions};
    const subscribers = [], reactfrags = [],  blockfrags = [], styles=[];
    if(obj.beforemount){
        obj.beforemount(state)
    }
    const domtree = convertNodes(obj.view).map(n=> processNode(n, root)).filter(n=>!!n);
    styles.length > 0 && root.appendChild(...styles);
    update();

    this.__proto__.$ = {send: send, receive: receive, rf: reactfrags, subs: subscribers, domtree: domtree, actions: actions, root: root, state: state}
}