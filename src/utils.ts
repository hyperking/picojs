import { BlockTypes, TNode } from "./types";
import sizeof from 'object-sizeof'

/**
* Analizes a given HTMLElement to determine if it should be processed
* @param  HTMLElement node html element to be converted
* @return boolean true or false
*/
export function skipNode(node): boolean { 
    return !node || node.data && node.data.trim()==="" || node.nodeName==='STYLE' || node.nodeName==='#comment'; 
}
/**
 * Analizes a string for all acess to state object
 * @param str 
 * @returns Set set of state keys
 */
export function compile_analyzer(str){
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
/**
 * Finds all template literal matching {...} pattern or null.
 * @param str 
 * @returns list
 */
export function partText (str): string[] {
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

/**
* Converts template literal into a concatenated string
*/
export function concatTemplate(template: string): string {
    return partText(template).map(st=>{
        if(st.includes("{")){
            return st.replace('{','').replace('}','')
        } return `"${st}"`
    }).join(' + ');
}

/**
* Compiles AST into executable javascript.
* deprecated due to output size is larger than AST string
*/
function compile(vnode: any){
    const [parent, id, nodeName, type, textContent, childNodes, attributes] = vnode;
    const targetNode = nodeName.replace('#','') +'_'+ id
    const attrList = [`${targetNode}.setAttribute("pico-id", "${targetNode}")`]
    const attrFrags = []
    const cnodes = []
    childNodes && childNodes.forEach(cn=> {
        cnodes.push(compile(cn))
    })
    attributes && attributes.forEach(atr=>{
        if(atr.type==='ATTR'){
            attrFrags.push(atr)
            const create_attr = `const attr_${id} = document.createAttribute("${atr.name}")`
            const set_attr = `${targetNode}.setAttributeNode(attr_${id})`
            attrList.push([create_attr, set_attr].join('\n'))
        }else{
            attrList.push(`${targetNode}.setAttribute("${atr.name}", "${atr.value}")`)
        }
    })
    if(type!==BlockTypes.NODE && textContent){
        const tmp = "const v = '"+textContent.replace('{','\' + (').replace('}',') +\'')+"'";
        const renderFunc = new Function('state', [tmp,`${targetNode}.textContent = v`].join('\n')).toString()
        return `
        const ${targetNode} = document.createTextNode("${textContent}"); 
        const ${targetNode}_render = ${renderFunc}
        ${parent}.appendChild(${targetNode});
        //render text
        ${targetNode}_render(state)
        `
    }
    return `\
        create_node_${targetNode} (root, state)/* ${targetNode} */{
            const frags = [] //dynamic frags only
            const ${targetNode} = document.createElement("${nodeName}");
            //Attrs
            ${attrList.join('\n')}
            //children
            ${cnodes.join('\n')}
            //mount app or node
            document.getElementById(root).appendChild(${targetNode})
        }`
}

/**
* Converts HTMLDOM element into PicoNode object
* @param  HTMLElement olnode html element to be converted
* @param string | ChildNode parent optional element parent id as string or parent dom element
* @return PicoNode} picoNode representing a dom node
*/
function toVnode(olnode: any, parent?: string | ChildNode ): TNode[] {
    const vnodeId = () => 'pico_'+(Math.random() + 1).toString(36).substring(7);
    const skip = skipNode(olnode)
    if(skip) return olnode;
    const is_txt = olnode.nodeName === '#text'
    const is_frag = is_txt && olnode.textContent.includes('{')
    const nodeId = vnodeId();
    const cnodes = (olnode.childNodes && [...olnode.childNodes].map(cn => toVnode(cn, nodeId)).filter(cn=>cn))
    const flowtype = is_frag ? BlockTypes.TXT : is_txt ? BlockTypes.STATIC :
     (olnode.dataset && olnode.dataset.for) ? BlockTypes.FORLOOP :  BlockTypes.NODE
    
    let res = [
        /* parent: */ parent,
        /* id: */ nodeId,
        /* nodeName: */ olnode.nodeName,
        /* flowtype: */ flowtype, 
        /* textContent: */ (is_txt ? olnode.textContent : null),
        /* childNodes: */ cnodes,
        /* attributes: */ olnode.attributes && [...olnode.attributes].map((atr) => {
            const attr = [
                /* name: */ atr.name,
                /* value:  */atr.value,
                /* parent: nodeId*/ 
                ]
            return attr; 
            })
        ]
    return res        
}

export function processAttrs(astAttrs: any[], parent?: HTMLElement): string[]{
    const SKIP_ATTRS = ['data-for'];
    const attrFrags = [];
    astAttrs.forEach(atr=>{
       const [name, value] = atr;
        if(SKIP_ATTRS.includes(name)) return;
        if(value.includes('{')){
            const iattr = concatTemplate(value);
            attrFrags.push([name, iattr])
        }else{
            parent.setAttribute(name, value);
        }
    })
    return attrFrags;
}
/**
* Converts HTMLDOM tree into PicoNode object
* @param  HTMLElement olnode html element to be converted
* @param string | HTMLElement parent optional element parent id as string or html element
* @return PicoNode picoNode representing a dom node
*/
export function domToAST(domtree: ChildNode[], rootnode?: ChildNode): any[]{
    return domtree.map(oln=>toVnode(oln, rootnode));
}

/**
* Converts HTML string into HTMLElement tree
* @param  string|any html html element to be converted
* @return ChildNode[] HTML dom tree
*/
export function htmlToDom(html: string|any): ChildNode[]{
    if(html.tagName==='TEMPLATE'){
        return [...html.content.childNodes];
    }
    return [...document.createRange().createContextualFragment(html.trim()).childNodes];
}