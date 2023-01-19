//Converts template literals into IText object. returns a list of Text fragments
const partText = (str) => {
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
    $node: Text | Attr;
    $render: Function;
    $should_update: boolean;

    constructor(str: string){
        this.$tmpl = str;
        this.$node = document.createTextNode(str);
    }

    createRender(iter_ctx?: string){
        this.$render = new Function("state", "i", iter_ctx, "return " + this.$tmpl.replace(/{/g,'').replace(/}/g,'') );
    }

    updateTxt(state, memoMap?: any): any{
        const v = memoMap ? memoMap : this.$render(state, state.i, state.iter_item);
        this.$node.textContent = v;
        return v;
    }
}
class IProp extends IFrag{
    $attr: string;
    constructor(str:string, attr:string, nodeEl: Attr){
        super(str)
        this.$tmpl = str;
        this.$node = document.createAttribute(attr);
        this.$attr = attr;
    }
    updateTxt(state, memoMap?: any): any{
        const v = memoMap ? memoMap : this.$render(state, state.i, state.iter_item);
        // @ts-ignore
        this.$node.value = v;
        // @ts-ignore
        const is_input = this.$node.ownerElement && this.$node.ownerElement.nodeName==='INPUT';
        // @ts-ignore
        if(is_input) { this.$node.ownerElement[this.$attr] = v;}
        return v;
    }
}
class IBlock {
    $node: HTMLElement;
    iter_item: string;
    state_key: string;
    $children: any[];
    $frags: any[];
    $state: any;
    constructor(block_root: HTMLElement, iter_item: string, state_key: string, frags: any[], state: any){
        this.$node = block_root;
        this.iter_item = iter_item;
        this.state_key = state_key;
        this.$frags = frags;
        this.$state = {[state_key]: state[state_key],iter_item: null, i: 0};
    }
    receive ( k, newData: any) {
        const cursor = Array.isArray(newData[k]) && this.$state[k].length;
        let rmcursor = null
        if(cursor!==null){
            const max = this.$children.length;
            const oldlist = this.$state[k];
            oldlist.forEach((o)=>{
                if(!(o in newData[k])){
                    rmcursor = 0;
                    for (let index = 0; index < max; index++) {
                        this.$node.childNodes[0].remove();
                    }
                }
            })
        }
        this.$state[k] = newData[k];
        this.insert_iter((rmcursor===null ? cursor : 0));
        console.log(newData, 'for block updated');
    }
    insert_iter ( cursor?: number) {
        const refIterble = this.$state[this.state_key];
        for (let index = cursor || 0; index < refIterble.length; index++) {
            this.$state['iter_item'] = refIterble[index];
            this.$state['i'] = index;
            this.update();
            this.$children.forEach(cn=>this.$node.appendChild(cn.cloneNode(true)));
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
//IT would be a huge performance boost to have these nodes prerendered.
const toVdom = (htmlNodes: Array<ChildNode>, root_node?: HTMLElement, state?: any, actions?: any) => {
    function vdatabind(node: HTMLElement, attr_name: string, state_attr: string){
        vapply_events(node, 'input', (state)=>{
            state[state_attr] = node[attr_name];
        });
    }
    //Dispatch event handlers on target dom nodes
    function vapply_events(vnode: HTMLElement, evtType: string, callback: string | Function) {
        let eventHandler = typeof callback === 'function' ? callback : actions[callback];
        if(!eventHandler){console.log('Unable to assign '+callback); return null;}
        const Ihandler = (event) => { eventHandler(state, event); }
        vnode.addEventListener(evtType,Ihandler);
    }
    const convertNodes = (tmpl) => [...document.createRange().createContextualFragment(tmpl.trim()).childNodes];

    function processNodes(nodeList: any[], parent_node?: HTMLElement, iter_ctx_name?: string){
        const istyles = [];
        const iblocks = [];
        const ifrags = [];
        const ichildren = [];
        const max = nodeList.length;
    
        for (let index = 0; index < nodeList.length; index++) {
            const refnode: any = nodeList[index];
            const tag = refnode.nodeName;
            const is_last = max===index+1;
            if(tag==='STYLE'){istyles.push(refnode); continue;}
            if(tag==='#text' && refnode.textContent.trim()===""){continue;}
            
            if(tag==='#text'){
                const txtparts = partText(refnode.textContent);
                if(!txtparts) {parent_node.appendChild(refnode); iter_ctx_name && ichildren.push(refnode);}
                if( txtparts && Array.isArray(txtparts) ){ 
                    txtparts.forEach( (vtxt: IFrag) => {
                        parent_node.appendChild(vtxt.$node);
                        if(vtxt.$should_update) {
                            ifrags.push(vtxt); 
                            vtxt.createRender(iter_ctx_name && iter_ctx_name);
                        }
                    });
                }
                continue;
            }
            const is_block_loop = 'for' in refnode.dataset;
            const vnode = document.createElement(tag);
            // //Process iterblock
            if(is_block_loop && !iter_ctx_name){
                const [iter_ctx_name, iter_state_key] = refnode.dataset.for.split(' in ');
                const [jstyles, jblocks, jfrags, jchildren] = processNodes([...refnode.childNodes], vnode, iter_ctx_name);
                vnode.innerHTML = ''
                const forblock = new IBlock(vnode, iter_ctx_name, iter_state_key, jfrags, state);
                forblock.$children = jchildren
                forblock.insert_iter();
                console.log(jfrags, jchildren)
                iblocks.push([iter_state_key, forblock]);
                parent_node.appendChild(vnode);
                continue;
            }
            iter_ctx_name && ichildren.push(vnode)
            //Process Props
            const vprops = [...refnode.attributes].map(atr=>{
                const is_binder = atr.name.startsWith('data-bind');
                let attr_name = atr.name.replace('data-bind:','');
                let attr_value = atr.value;
                if(attr_value.includes('{')){
                    const pfrag = new IProp(attr_value,attr_name, vnode);
                    pfrag.createRender(iter_ctx_name && iter_ctx_name);
                    vnode.setAttributeNode(pfrag.$node);
                    return pfrag;
                };
                if(attr_name.startsWith('on')){  //hydratible node
                    const event_name = attr_name.replace('on','');
                    const event_callback = attr_value;
                    vapply_events(vnode, event_name, event_callback);
                    return;
                }
                if(is_binder){
                    const pfrag = new IProp("{"+attr_value+"}", attr_name, vnode);
                    pfrag.createRender((iter_ctx_name && iter_ctx_name));
                    vnode.setAttributeNode(pfrag.$node);
                    vdatabind(vnode, attr_name, attr_value.replace('state.',''));
                    return pfrag;              
                }
                vnode.setAttribute(attr_name, attr_value);
            }).filter(vp=>!!vp);
            ifrags.push(...vprops);

            //Process children
            if(refnode.childNodes) {
                const [jstyles, jblocks, jfrags, jchildren] = processNodes([...refnode.childNodes], vnode, iter_ctx_name);
                istyles.push(...jstyles);
                iblocks.push(...jblocks);
                ifrags.push(...jfrags);
                is_last && ichildren.push(...jchildren);
            }
            parent_node.appendChild(vnode);
        }//end for loop
        
        return [istyles, iblocks, ifrags, ichildren];
    }//end process
    const nodeList = typeof htmlNodes === 'string' ? convertNodes(htmlNodes) : htmlNodes;
    const [styles, blocks, frags, children] = processNodes(nodeList, root_node);
    return [styles, blocks, frags, children];
}

export default function Pico(obj){
    const iter_block = obj.iter_block;
    const subscribers = [];
    const root = obj.root || iter_block.$node;
    const name = obj.name;
    const actions = obj.actions;
    const state = !iter_block ? create_state(obj.state) : obj.state;
    const _template = typeof obj.view === 'function' ? obj.view(obj.state) : obj.view;
    const [styles, blocks, reactive_frags] = !iter_block ? toVdom(_template, root, state, actions) : [[], []];
    styles && root.appendChild(...styles);
    subscribers.push(...blocks);
    const send = ( key: any ) => {
        subscribers.forEach(([k, isub])=> {if(k===key) {isub.receive(key, state);console.log(key,k, 'Message sent!🎉');}}) 
    }
    this.__proto__.receive = (id, data) => {
        if(obj.receive){
            obj.receive(id, data, state)
        }else{
            console.log('Youve got mail 🌍💌 from: '+ id, data);
            Object.keys(data).forEach(k=>{ state[k] = data[k]; });
        }
    }
    this.__proto__.$ = () => { //For Debugging purposes
        return {rf: reactive_frags, subs: subscribers, name: name, actions: actions, root: root, state: state}
    }
    function update(key?: string) {
        const memoMap = {};
        reactive_frags.forEach((ifrag) => {
            const tmpl = ifrag.$tmpl
            if( key && tmpl.indexOf(key) === -1 ){return;} //TODO: Lets use the data_ref attributes to fine tune the guard
            memoMap[tmpl] = ifrag.updateTxt(state, memoMap[tmpl]);
        });
        key && send(key);//returns updated state back to caller 
    }
    function create_state(obj){
        const handler = {
            get(data, key){ return key in data ? data[key] : null; },
            set(data, key, newvalue){
                if(key in data && data[key] === newvalue){ return key;}
                data[key] = newvalue;
                update(key);
                return key;
            }
        }
        return new Proxy(obj, handler);
    }
    update();
}