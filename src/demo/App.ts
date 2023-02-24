import ListApp from "./ListApp";

const App = {
    componets: [ListApp],
    name: "Pico Service demo",
    root: document.getElementById('app'),
    receive(id, newdata, state) {
        state.todos = [...state.todos, ...newdata.todos]
    },
    beforemount: (state) => {
        console.log('before we mount our nodes...')
        state.tablecolumns = ['done', 'id', 'name'];
    },
    actions: {
        increment: (state) => {
            console.log('inc')
            state.likes += 1;
        },
        decrement: (state) => {
            state.likes -= 1;
        },
        addtodo(state) {
            state.todo = event.target.value;
            if (!state.todo || (event.key !== 'Enter' && event.type !== 'click')) { return; }
            state.todos = [...state.todos, { name: state.todo, done: false, id: state.todos.length }]
            state.todo = ''
        },
        handleMousemove(state, event) {
            const m = { x: event.clientX, y: event.clientY };
            state.mouse = m;
        },
        shuffleColumns(state) {
            state.tablecolumns = state.tablecolumns[0] === 'name' ? ['id', 'done', 'name'] : ['name', 'id', 'done']
        },
        appendTodos(state) {
            state.todos = [...state.todos, { done: true, id: state.todos.length, name: `foo ${state.todos.length}` }] //appends to existing list * recommended
        },
        swapTodos(state) {
            const itm_one = state.todos[1];
            const itm_two = state.todos[3];
            state.todos[1] = itm_two;
            state.todos[3] = itm_one;
            state.todos = [...state.todos];
        },
        prependTodos(state) {
            state.todos = [{ done: true, id: state.todos.length, name: `foo ${state.todos.length}` }, ...state.todos] //prepends to existing list
        },
        sortby(state) {
            let key = event.target.dataset.sortby;
            state.sortcolumns = { [key]: !state.sortcolumns[key] };
            const dsc_order = state.sortcolumns[key];
            function normalize(value) {
                return typeof value === 'string' ? value.toLowerCase() : value;
            }
            const stodos = state.todos.sort((cursor, next_cursor) => (normalize(cursor[key]) > normalize(next_cursor[key])) ? (dsc_order ? 1 : -1) : (dsc_order ? -1 : 1));
            console.log(stodos)
            state.todos = [...stodos];
        },
        markDone(state) {
            const i = event.target.id;
            console.log(i, event.target)
        },
        showMeter(state) {
            console.log(event.target)
            state.showMeter = !state.showMeter;
        },
        setFilter(state) {
            state.filterFor = event.target.value;
        }
    },
    state: {
        showMeter: false,
        $: {//Computed properties are named functions that return values which are set to state during update
            filteredTodos: (state) => {
                if(state.filterFor===""){return state.todos;}
                const search_filter = state.filterFor;
                const filterTodos = state.todos.filter((entry) => JSON.stringify(Object.values(entry)).toLowerCase().includes(search_filter.toLowerCase()));
                return filterTodos;
            },
            character: (state) => 'Your Pokemon Level ' + (
                (state.likes > 15) ? 'Is oVER 9000!!!' :
                    (state.likes > 10) ? 'is getting stronger...' :
                        (state.likes > 5) ? 'Is growing the more it battles' :
                            (state.likes >= 3) ? 'has found a trainer' : 'is waiting for a trainer')
        },
        filterFor: '',
        sortcolumns: {},
        likes: 0,
        items: ["one", "two", "three"],
        todos: [{ done: false, id: 0, name: "pico sm" },{done: false,id:1, name: "means very small"}],
        todo: '',
        mouse: { x: 0, y: 0 }
    },
    view: (state) => {
        return `
        <style>
            ol { list-style: decimal outside; } .red { color: red; } .green { color: green; } .strike { text-decoration: line-through } .todolist { background: aliceblue; padding: 1rem; } span.highlight { background: aqua; } #app { margin: 0 auto; padding: 2rem; max-width: 700px; }
        </style>

        <h2 class="{state.todos.length % 2===0 ? 'green': 'red'}">Todos: {state.todos.length}</h2>
        <p>Likes: {state.likes}, Sorting by: {JSON.stringify(state.sortcolumns)}</p>
        <div class="form-group">
            <label class="form-label">Name</label>
            <input value="{state.todo}" onkeypress="addtodo" class="form-input" type="text"
                placeholder="Press enter key to submit a todo" />
            <p><strong>{state.todo} : {state.todo.length}</strong></p>
        </div>
        <div class="btn-group btn-group-block">
            <button onclick="prependTodos" class="btn">Prepend Todos <span>{state.likes}</span></button>
            <button onclick="appendTodos" class="btn">Append Todos <span>{state.likes}</span></button>
            <button onclick="swapTodos" class="btn">Swap Todos <span>{state.likes}</span></button>
            <button onclick="shuffleColumns" class="btn">Shuffle Columns<span>{state.likes}</span></button>
        </div>
        <div class="btn-group btn-group-block">
            <button onclick="increment" class="btn btn-primary">+Likes</button>
            <button onclick="markDone" class="btn btn-primary">Show Meter</button>
            <button onclick="decrement" class="btn btn-primary">-Dislikes</button>
        </div>
        <div class="character">
            {state.character}
        </div>
        <table class="table table-striped table-hover" onmousemove="handleMousemove">
            <thead>
                <tr>
                    <th data-for="tcol in tablecolumns">{tcol}<button onclick="sortby" data-sortby="{tcol}">^</button></th>
                </tr>
            </thead>
            <tbody>
                <tr data-for="thing in filteredTodos">
                    <td data-for="col in tablecolumns">{thing[col]} : {state.likes}
                        <!--<ul>
                        <li data-for="item in items">{item} , {loop.index}
                            <ul>
                                <li data-for="letter in item">{letter} :: {loop.index}</li>
                                <li data-for='x in ["just ","a ","random ","list "]'>{x.toUpperCase()}</li>
                            </ul>
                        </li>
                        </ul>-->
                    </td>
                </tr>
            </tbody>
            <tfoot>
                <tr>
                    <th colspan="2" class="table-search">
                        <label for="table-search">Search</label>
                        <input oninput="setFilter" id="table-search" class="form-input" type="text" placeholder="searching by ...">
                    </th>
                    <th>x:{state.mouse.x} y: {state.mouse.y}, {state.likes}</th>
                </tr>
            </tfoot> </table>`
    }
}

export default App