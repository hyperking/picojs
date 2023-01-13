class IProp {
    $tmpl: string;
    $attr: string;
    $should_update?: boolean = true;
    $nodeEl: HTMLElement; 
    $data_refs?: string[];
    $type: string = 'IProp';
    $render: Function;

    constructor(tml:string, attr:string, nodeEl: HTMLElement){
        this.$tmpl = tml;
        this.$attr = attr;
        this.$nodeEl = nodeEl;
        this.$data_refs = [tml.replace('{','').replace('}','').replace('state.','').trim()]
        this.$render = this.$should_update && this.createRender();
    }

    updateTxt(state, memoValue?: any): any{
        const v = memoValue ? memoValue : this.$render(state, state.i);
        !this.$nodeEl.value ? this.$nodeEl.setAttribute(this.$attr, v) : this.$nodeEl.value = v;
        return v;
    }

    createRender(){
        return new Function("state", "i", "return " + this.$tmpl.replace('{','').replace('}','') )
    }
}

class IDom {
    $tag: string;
    $tmpl: string;
    $node: HTMLElement | IText | any;
    $should_update?: boolean = false;
    $data_refs = [];
    $children: Array<IDom | IText> = [];
    $props: object = {};
    $evtprops: object;
    $iter_templ?: IDom | any;
    $databind?: string[];
    $render?: Function;

    constructor(ref:HTMLElement, should_update?: boolean){
        this.init(ref, should_update);
    }

    //Creates new reactive DOM node
    init(ref:HTMLElement | string, should_update) {
        if(typeof ref === 'string' || ref.nodeType===3){
            this.$tag = 'IText';
            this.$should_update = should_update;
            this.$node = typeof ref === 'string' ? document.createTextNode(ref) : ref;
            this.$tmpl = typeof ref === 'string' ? ref : ref.wholeText;
            this.$data_refs = [this.$tmpl.replace('{','').replace('}','').replace('state.','').trim()]
            this.$render = should_update && new Function("state", "i", "return " + this.$tmpl.replace('{','').replace('}','') );
            return;
        }
        this.$tag = ref.nodeName
        this.$node = document.createElement(this.$tag);
        //Assign Props
        [...ref.attributes].forEach(atr=>{
            let attr_name = atr.name;
            if(atr.name === 'data-for'){ 
                this.$iter_templ = true;
                this.$props['data-for'] = atr.value.split(' in ')
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
            // @ts-ignore
            const propv = this.$databind || atr.value.includes('{') ? new IProp(atr.value, attr_name, this.$node) : atr.value;
            if(!this.$props[attr_name]) this.$props[attr_name] = propv; 
            if(typeof propv === 'string'){ // @ts-ignore
                this.$node.setAttribute(attr_name, atr.value);
            }

        });
        //Assign children
        ref.childNodes && toVdom([...ref.childNodes]).forEach((inode: IDom | IText )=>{
            this.$children.push(inode);            
        });
        // @ts-ignore Append child nodes
        this.$children.forEach((cn: IDom | IText )=> this.$node.appendChild(cn.$node))
    }
    updateTxt(state, memoValue?: any): any{
        const v = memoValue ? memoValue : this.$render(state, state.i);
        this.$node.data = v;
        return v;
    }
    appendChild(idom){
        this.$node.appendChild(idom)
    }
    copy(){
        return new IDom(this.$node.cloneNode(true), this.$should_update);
    }
    
}
class IText extends IDom {}

//Recursively iterates over original html dom nodes and converts them into reactive objects
//IT would be a huge performance boost to have these nodes prerendered.
const toVdom = (htmlNodes: Array<ChildNode>) => {
    const convertNodes = (tmpl) => [...document.createRange().createContextualFragment(tmpl.trim()).childNodes];
    const nodeList = typeof htmlNodes === 'string' ? convertNodes(htmlNodes) : htmlNodes;
    const res = [];
    nodeList.forEach((node: any)=>{
        if(!node || node.data && node.data.trim()===""){return}
        const d = node.nodeType===3 ? partText(node.data) : new IDom(node);
        if(Array.isArray(d)){d.forEach(inode=> res.push(inode))}else{ res.push(d) }
    })    
    return res;
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


function Component(obj){

    const create_iterables = (idom: IDom, has_iter_for, replace_index)=>{
        const is_iter_root = idom.$props && idom.$props['data-for'];
        if(!is_iter_root && !has_iter_for ){return;}
        const [ctx_name, state_key] = has_iter_for ? has_iter_for : idom.$props['data-for'];
        const refObj = state[state_key];
        const domtree_index = refObj? refObj.length - 1 : replace_index;
        idom.$iter_templ = null;
        const icomp = new Component({ //Makes Root iter node and its children
            name: "iter_root_"+idom.$tag,
            root: root,
            state: {...state, [ctx_name]: (refObj && refObj[domtree_index]), i: domtree_index},
            view: idom,
            iter_tmpl: idom.$children[0].copy()
        });
        if(has_iter_for) domtree[0].$children.push(icomp); subscribers.push([state_key, icomp]);
        if(!has_iter_for){ 
            domtree[replace_index] = icomp; 
        };        
        return icomp;
    }

    function createState(obj){
        const handler = {
            get(data, key){
                return key in data ? data[key] : null;
            },
            set(data, key, newvalue){
                if(key in data && data[key] === newvalue){ return true;}
                data[key] = newvalue;
                ready && update(key);
                return true;
            }
        }
        return new Proxy(obj, handler)
    }

    //Dispatch event handlers on target dom nodes
    function createEventListeners(evtType: string, evtHandler: string | Function, idom: IDom) {
        let eventHandler = typeof evtHandler === 'function' ? evtHandler : actions[evtHandler];
        if(!eventHandler){console.log('Unable to assign '+evtHandler); return null;}
        const Ihandler = async (event) => {
            await eventHandler(state, event);
          }
        idom.$node.addEventListener(evtType,Ihandler);
    }

    //Update reactive frags from any qualifying dom node
    const collate_reactives = (n) => {
        n.$should_update ? reactive_texts.push([n.$tmpl, n]) : n.$children && n.$children.forEach(dc=>collate_reactives(dc))
        n.$props && Object.values(n.$props).forEach((pc:IProp)=>pc.$should_update&&reactive_texts.push([pc.$tmpl, pc]))
    }

    //Initialize event handlers on dom nodes
    const delegate_events = (idom: IDom) => {
        if(idom.$evtprops){
            for(const k in idom.$evtprops){
                const event_name = idom.$evtprops[k]
                createEventListeners(k, event_name, idom)
            }
        }else if (idom.$children) {
            // @ts-ignore
            idom.$children.forEach(ichld => ichld.$type==='IDom' && delegate_events(ichld))
        }
    }

    //Automatic event handlers for nodes with bind props
    const data_bind_inputs = (node: IDom) => {
        if(!node.$databind){return;}
        const [prop_name, state_attr] = node.$databind;
        createEventListeners('input', (gstate)=>{
            // @ts-ignore
            gstate[state_attr] = node.$node.value;
        }, node);
    }

    const mount = (domtree) => {
        domtree.forEach((idom: IDom, i)=>{
            if(Array.isArray(idom)){ mount(idom); return;}
            if(idom.$iter_templ){create_iterables(idom, null, i); return;}
            root.appendChild(idom.$node ? idom.$node : idom);
            data_bind_inputs(idom);
            delegate_events(idom);
            collate_reactives(idom);
        })
        if(!ready && iter_tmpl){
            const iter_root: IDom = domtree[0];
            const iter_tree = iter_root.$children;
            root = iter_root
            domtree = iter_tree
        }
        ready = true;       
    } 
    
    function update(key?: string) {
        if(!ready){return}
        reactive_texts.forEach(ilist => {
            const [tmpl, itxt] = ilist;
            if(key && tmpl.indexOf(key) === -1){return;} //TODO: Lets use the data_ref attributes to fine tune the guard
            memoValue[tmpl] = itxt.updateTxt(state, memoValue[tmpl]);
        })
        subscribers.forEach(([k, isub])=> k===key && isub.recieve(key, state)) //returns updated state back to caller 
        memoValue = {};
    }
    
    let ready = false, memoValue = {}, root = obj.root;
    const name = obj.name;
    const state = createState(obj.state);
    const template = typeof obj.view === 'function' ? obj.view(obj.state) : obj.view;
    const reactive_texts = [];
    const subscribers = [];
    const domtree = !template.$tag ? toVdom(template) : [template];
    const actions = obj.actions;
    let iter_tmpl = obj.iter_tmpl;

    const recieve = ( k:string, data: any ) => {
        state[k] = data[k];
        if(iter_tmpl){
            create_iterables(iter_tmpl.copy(), root.$props['data-for'], null)
        }
        console.log(state, 'Youve got mail 🌍💌')
    }
    const send = ( data: any ) => {
        console.log(data, 'Message sent!🎉')
    }
    Object.defineProperty(this, 'send', {
        get(){ return send}
    })
    Object.defineProperty(this, 'recieve', {
        get(){ return recieve}
    })
    Object.defineProperty(this, 'debug', {
        get(){ return {name: name, domtree: domtree, state: state, re_txts: reactive_texts}}
    })

    mount(domtree);
    update();
}
const Pico = Component
export default Pico;