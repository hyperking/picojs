// Constructor class for form inputs generated from JSON
export enum FormTypes {
  BASIC='basic', //vanilla html form
  MULTISTEP='multistep', //separate forms or form fieldsets displayed in steps
  PRODUCT='product', //form with special pricing updates when values are selected
  BUILDER='builder' //Build a new form in the UI
}
class ICtrl {
  label: string;
  label_for?: string;
  type?: any;
  value?: any;
  props?: any;
  inputs?: any;

  constructor(label, value, parnt, props={}){
    this.label = label;
    this.label_for = [parnt? parnt.label : null, label].filter(s=>s!=null).join(".").toLowerCase().replace(' ','');
    this.type = this.getIType(value, parnt)
    this.value = this.type === 'fieldset' ? null : this.type === 'text' ? value : null;
    this.inputs = ['fieldset','multiInput'].indexOf(this.type)>-1 ? KunaiForm.fromJson(value, this) : null;
    // const base_prop_names = ['id', 'name', 'type', 'value', 'disabled', 'class', 'selected'];
    this.props = {name: this.label_for, id: this.label_for, class: null, ...props}
  }

  getIType = (v, ptyp) => {
    const dt = Array.isArray(v) ? 'array' : typeof v === 'object' ? 'map' : 'scalar';
    return dt === 'scalar' && !ptyp ? 'text' : dt==='map' ? 'fieldset' : !ptyp ? 'multiInput' : 'option';
  }

  render(){
    //Renders static HTML form input elements with wrapping div containers
  }
}

class KunaiForm {
  type?: FormTypes = FormTypes.BASIC;
  id?: string = "KunaiForm-" + Math.random().toString(36).substring(7);
  source: HTMLFormElement;
  validator: any = {
    required_fields: [],//Any name input prefixed with * will be placed here
    errors: {}, //Holds form errors sent by input handlers
    add_error(inp, msg){this.errors[inp] = msg},
    rm_error(inp){this.errors[inp] && delete this.errors[inp]}
  };
  
  prefill?: object = {};
  handlers?: Array<[string, string, Function]>;
  data: object = {};
  options?: object = {
    skip_empty: false, //skips empty values on submit
    ignore_fields: [], // ignore field names
  };

  constructor(source: any, options?:object, prefill?: object, handlers?: []) {
    this.options = {...this.options, options};
    this.source = source;
    this.prefill = prefill;
    this.handlers = handlers;
    this.initPreFill();
    this.initHandlers();
    this.toJson();
    console.log(this.data)
  }

  /* Adds Event listners onto form inputs as validators or to apply additional behavior to the input. You can mount special reactive library components */ 
  initHandlers() {
    if(!this.handlers){return;}
    this.handlers.forEach((enh) => {
      const [evt, name, handler] = enh;
      const inputEl: HTMLInputElement = this.source.querySelector(`[name=${name}]`);
      if(!inputEl){return}
      const Ihandler = (event) => {
        const self = this;
        handler(event, self);
      }
      const new_element = inputEl.cloneNode(true);
      new_element.addEventListener(evt,Ihandler);
      inputEl.parentNode.replaceChild(new_element, inputEl);
    });
  }

  /* Prefills form elements based on matching keys in prefill object */ 
  initPreFill() {
    if (!this.prefill || !this.source.DOCUMENT_TYPE_NODE) return;
    Object.keys(this.prefill).forEach((k) => {
      const inputElList: NodeList = this.source.querySelectorAll(`[name='${k}']`);
      inputElList.forEach((inputEl: HTMLInputElement) => {
        const is_radio_checkbox_element = ['radio', 'checkbox'].indexOf(inputEl.type) > -1
        const prevalue = this.prefill[k];
        if(!is_radio_checkbox_element){
          inputEl.value = prevalue
        }else if(is_radio_checkbox_element){
          const has_value = typeof prevalue === 'object' ? prevalue.indexOf(inputEl.value) > -1 : prevalue === inputEl.value;
          inputEl.checked = has_value;
        }
      })
    });
  }

  /* Convert JSON data into virtual HTML form object. */
  static fromJson (json_input, json_parent?: object, props?: object) {
    const input_dataType = Array.isArray(json_input) ? 'array' : typeof json_input === 'object' ? 'map' : 'scalar';
    let results = null;
    switch (input_dataType) {
        case 'map':
            results = Object.keys(json_input).reduce((newArr, key) => {
                const val = this.fromJson(json_input[key], json_parent, props);
                const input = new ICtrl(key, val, json_parent, props);
                newArr.push(input);
                return newArr;
            }, []);
            break;
        case 'array':
            results = json_input.map(el => this.fromJson(el, json_parent, props));
            break;
        default:
            results = new ICtrl(json_input, json_input, json_parent, props);
    }
    return results;
  }

  // Contructs form ctrls from loose description json object
  static fromConfig (inputs){
    const res = inputs.map(inp => {
      const x = new ICtrl(null, null, null)
    })
  }

  /* Convert HTML Form data into JSON object. option Validation bool arg */
  toJson() {
    if(!this.source){return}
    function map_to_obj(key: string, value: any, obj: any) {
      const path = key.split(".");
      while (path.length) {
        let k = path && path.shift();
        if (!k) break;
        if (path.length === 0) {
          const array_type = k && k.indexOf("[") > -1;
          k=k.replace('[]','');
          if (Array.isArray(obj[k])) obj[k].push(value);
          else if (array_type) obj[k] = [value];
          else obj[k] = value;
        } else {
          const t: any = obj[k] || {};
          obj[k] = map_to_obj(path.join("."), value, t);
          break;
        }
      }
      return obj;
    }

    const formdata = new FormData(this.source);
    formdata.forEach((value, key)=> {
      map_to_obj(key, value, this.data);
    })
  }
}
export default KunaiForm