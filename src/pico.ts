type pico = {
    view: Function;
    state?: any; 
    actions?: any;
    receive?: Function;
    send?: Function;
    beforemount?: Function;
    root?: HTMLElement
}
export default function Pico(obj: pico){
    //Converts template literals into IText object. returns a list of Text fragments
    const partText = (str): IFrag[] => {
        function useRegex(input) {
            const regex = /\{[\s]*.*?[\s]*\}/gs;
            const res = [...input.matchAll(regex)];
            return res.length > 0 ? res.map(a => a[0].replace()) : false;
        }
        var reFrag = useRegex(str);
        if(!reFrag){return null;}
        var frags = reFrag.map((r,_)=> r);
        var textNodes = [];
        frags.forEach((match, i) => {
                var [left, right] = str.split(match);
                let lfrag = left.trim()!="" ? new IFrag(left) : left;
                let rfrag = new IFrag(match);
                rfrag.$should_update = true;
                if(left.trim()!="") {textNodes.push(lfrag);}
                textNodes.push(rfrag);
                str = right;
                if (i+1 === frags.length && str.trim()!=""){
                    textNodes.push(new IFrag(str))
                }
            });
        return textNodes;
    };
    class IFrag {
        $tmpl: string;
        node: Text | Attr | any;
        $render: Function;
        $should_update: boolean;
    
        constructor(str: string){
            this.$tmpl = str;
            this.node = document.createTextNode(str);
        }
    
        createRender(iter_ctx?: string){
            this.$render = new Function("state", "i", iter_ctx, "return " + this.$tmpl.replace(/{/g,'').replace(/}/g,'') );
        }
    
        updateTxt(state, memoMap?: any): any{
            const v = memoMap ? memoMap : this.$render(state, state.i, state.iter_item);
            this.node.textContent = v;
            return v;
        }
    }
    class IAttr extends IFrag{
        $attr: string;
        constructor(str:string, attr:string, nodeEl: Attr){
            super(str)
            this.$tmpl = str;
            this.node = document.createAttribute(attr);
            this.$attr = attr;
        }
        updateTxt(state, memoMap?: any): any{
            const v = memoMap ? memoMap : this.$render(state, state.i, state.iter_item);
            this.node.value = v;
            const is_input = this.node.ownerElement && this.node.ownerElement.nodeName==='INPUT';
            if(is_input) { this.node.ownerElement[this.$attr] = v;}
            return v;
        }
    }
    class INode {
        node: HTMLElement | any;
        children: Array<any>;
        attrs: any;
        constructor(node: HTMLElement|any, iter_ctx?: string){
            this.node = document.createElement(node.nodeName);
            this.children = (node.childNodes.length > 0) && [...node.childNodes]
            .reduce((nl, cn)=>{
                const n = processNode(cn, this.node, iter_ctx);
                if(!n){return nl}
                if(Array.isArray(n)){ n.forEach(fn=> nl.push(fn)) }else{ nl.push(n) }
                return nl;
            },[]);
        }
    }
    class IBlock extends INode{
        iter_item: string;
        state_key: string;
        $state: any;
        $frags: any[];
        constructor(block_node: HTMLElement, parent_root: HTMLElement){
            const [iter_name, iter_state_key] = block_node.dataset.for.split(' in ');
            super(block_node, iter_name)
            this.$frags = [...blockfrags];
            this.iter_item = iter_name;
            this.state_key = iter_state_key;
            this.$state = {[iter_state_key]: state[iter_state_key], iter_item: null, i: 0};
            this.reconcileIterable();
            parent_root.appendChild(this.node);
            subscribers.push([this.state_key, this])
        }
        receive ( k, newData: any) {
            this.reconcileIterable(newData);
            this.$state[this.state_key] = newData[k];
        }

        arrayStrategy(inputData?: any[]): Array<any> {
            const oldData = this.$state[this.state_key];
            const has_changed = oldData.length !== inputData.length;
            const is_prepend = has_changed && JSON.stringify(oldData) === JSON.stringify(inputData.slice((inputData.length - oldData.length)));
            const is_append = has_changed && JSON.stringify(oldData) === JSON.stringify(inputData.slice(0,oldData.length));
            // const is_prepend = has_changed && oldData.toString() === inputData.slice((inputData.length - oldData.length)).toString();
            // const is_append = has_changed && oldData.toString() === inputData.slice(0,oldData.length).toString();
            const strategy = !is_prepend&&!is_append ? 'NEW' : is_append ? 'APPEND' : 'PREPEND';
            const curr = strategy==='NEW'? 0 : oldData.length;
            const itr = is_append ? inputData.slice(oldData.length, inputData.length) : 
            is_prepend ? inputData.slice(0,inputData.length - oldData.length) : inputData;
            return [strategy, itr, curr];
        }

        reconcileIterable ( inData?: any ) {
            const oldData: Array<any> = this.$state[this.state_key];
            const newData: Array<any> = inData && inData[this.state_key]||oldData;
            const [strategy, iterable, cursor] = this.arrayStrategy(newData);
            console.log(strategy, cursor, iterable)
            const pivotnode: HTMLElement = strategy==='PREPEND' ? this.node.firstChild : this.node;

            if(strategy==='NEW'){this.node.innerHTML = '';}
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
                this.$state['iter_item'] = iterable[index];
                this.$state['i'] = cursor + index;
                this.update();
                if(strategy==='PREPEND' ){this.children.forEach(cn=>this.node.insertBefore(cn.node.cloneNode(true), pivotnode));}
                else{this.children.forEach(cn=>pivotnode.appendChild(cn.node.cloneNode(true)));}
            }
        }

        update() {
            const memoMap = {};
            this.$frags.forEach((ifrag) => {
                const tmpl = ifrag.$tmpl;
                memoMap[tmpl] = ifrag.updateTxt(this.$state, memoMap[tmpl]);
            });
        }
    }

    function processNode(cnode: HTMLElement| any, parent_node: HTMLElement, iter_ctx?: string){
        if(skipNode(cnode)){return;}
        const is_block_loop = cnode.dataset && 'for' in cnode.dataset;
        const n = cnode.nodeName==='#text' ? new IFrag(cnode.textContent) : !is_block_loop && new INode(cnode, iter_ctx);

        if(cnode.nodeName==='#text'){
            const txtparts = partText(n.node.textContent);
            if( txtparts && Array.isArray(txtparts) ){
                txtparts.forEach( (vtxt: IFrag) => {
                    parent_node.appendChild(vtxt.node);
                    if(vtxt.$should_update) {
                        vtxt.createRender(iter_ctx);
                        if(!iter_ctx) {reactfrags.push(vtxt)}else{blockfrags.push(vtxt)}; 
                    }
                });
                return txtparts;
            }
        }
  
        if(is_block_loop){
            const b = new IBlock(cnode, parent_node);
            blockfrags.length = 0;
            return b;
        }
        //@ts-ignor Process Attrs
        cnode.attributes && [...cnode.attributes].map(atr=>{
            if(atr.name.startsWith('on')){  //hydratible node
                const event_name = atr.name.replace('on','');
                const event_callback = atr.value;
                vapply_events(n.node, event_name, event_callback);
                return;
            }
            
            if(atr.value.includes('{')){
                const pfrag = new IAttr(atr.value, atr.name, n.node);
                pfrag.createRender(iter_ctx);
                n.node.setAttributeNode(pfrag.node); //sets an attr node type
                if(!iter_ctx) {reactfrags.push(pfrag)}else{blockfrags.push(pfrag)}; 
                return;
            }
            n.node.setAttribute(atr.name, atr.value);
        })

        parent_node.appendChild(n.node);
        return n;
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
    
    function createState(stateObj){
        const computes = []
        Object.keys(stateObj.$).forEach(k=>{
            computes.push([k, stateObj.$[k]])
            stateObj[k] = stateObj.$[k](stateObj);
        })
        const handler = {
            get(data, key){ 
                return key in data ? data[key] : null;
            },
            set(data, key, newvalue){
                if(key in data && data[key] === newvalue){ return key;}
                data[key] = newvalue;
                computes.forEach(([k, cfunc])=> state[k] = cfunc(state))
                update(key);
                return key;
            }
        }
        return new Proxy(stateObj, handler);
    }
    
    function send( key: any ){
        subscribers.forEach(([k, isub])=> {if(k===key) {isub.receive(key, state);console.log(key,k, 'Message sent!🎉');}}) 
    }
    
    function receive(id: string, data: any){
        console.log('Youve got mail 🌍💌 from: '+ id, data);
        if(obj.receive){obj.receive(id, data, state)}else{
        Object.keys(data).forEach(k=>{ state[k] = data[k]; });  }
    }
    
    function convertNodes(tmpl){return [...document.createRange().createContextualFragment(tmpl.trim()).childNodes];}
    function skipNode(node): boolean { if(node.nodeName==='STYLE'){styles.push(node)}
        return node.data && node.data.trim()==="" || node.nodeName==='STYLE' || node.nodeName==='#comment'; 
    }
    
    // function vdatabind (node: HTMLElement, attr_name: string, state_attr: string){
    //     vapply_events(node, 'input', (state)=>{
    //         state[state_attr] = node[attr_name];
    //     });
    // }
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
    const subscribers = [], reactfrags = [], blockfrags = [], styles=[];
    const domtree = convertNodes(obj.view(state)).map(n=> processNode(n, root)).filter(n=>!!n);
    console.log(domtree);
    styles.length > 0 && root.appendChild(...styles);
    update();
    this.__proto__.$ = {send: send, receive: receive, rf: reactfrags, subs: blockfrags, domtree: domtree, actions: actions, root: root, state: state}
}