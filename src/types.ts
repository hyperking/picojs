export interface App {
    componets: App[];
    name: string;
    root: HTMLElement;
    receive: Function;
    beforemount: Function;
    actions: object;
    state: object;
    view: Function;

}
export interface IFrag {
    type?: BlockTypes;
    $tmpl: string;
    $should_update: boolean;
    node: Text | Attr | any;
    $render: Function;
    attr_name?: string;
    as_html?: boolean;
    parent_node?: HTMLElement;
}
export interface IBlock extends INode {
    iter_item: string;
    state_key: string;
    foreignKeys: any[];
    $state: any[];
}
export interface INode {
    type?: BlockTypes;
    node: HTMLElement | any;
    children: Array<any>;
    parent_node?: HTMLElement;
    frags?: Array<IFrag[]>;
    blockNodes: IBlock[];
}
export interface TNode {
    id: string,
    parent?: string | ChildNode,
    type?: BlockTypes,
    nodeName: string,
    textContent?: string,
    childNodes?: TNode[],
    attributes?: any[]
}
export interface PicoNode extends TNode {
    flowtype: BlockTypes,
    frags: IFrag[],
    blocks: IBlock[],
    node: HTMLElement
}
export type TPico = {
    components?: Array<TPico>,
    view: Function;
    state?: any;
    actions?: any;
    receive?: Function;
    emit?: Function;
    beforemount?: Function;
    root?: HTMLElement
}

export type LoopCtx = {
    frags?: Array<IFrag>,
    blocks?: IBlock[],
    pivotnode?: HTMLElement,
    strategy?: Strategy,
    iter_item: string,
    iter_value?: any,
    loop?: any,
    outer?: LoopCtx
}
export type ITarget = {
    dataset: any;
    id: any;
    value: any;
}
export type IEvent = {
    target: ITarget;
    key: any;
    type: any;
}
export enum Strategy {
    NOOP,
    NEW,
    APPEND,
    PREPEND,
    DELETE,
    MODIFY
}

export enum BlockTypes {
    STATIC = 'STATIC',
    TXT = 'TXT',
    ATTR = 'ATTR',
    NODE = 'NODE',
    FORLOOP = 'FORLOOP',
    SWITCH = 'SWITCH',
    COMPONENT = 'COMPONENT'
}