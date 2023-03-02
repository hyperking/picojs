const ListApp = {
    state: {
        items: ["four", "five", "six"],
    },
    view: (state) => `<ul>${state.items.map(itm=>`<li>${itm}</li>`)}</ul>`
}

export default ListApp