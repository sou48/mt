const Dom = {
    createFragment(markup) {
        const range = document.createRange();
        const context = document.body || document.documentElement;
        if (context) {
            range.selectNode(context);
        }
        return range.createContextualFragment(String(markup || ''));
    },

    setMarkup(element, markup) {
        if (!element) return;
        element.replaceChildren(this.createFragment(markup));
    },

    clear(element) {
        element?.replaceChildren();
    },
};
