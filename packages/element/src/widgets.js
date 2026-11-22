// A shelf for the widgets an app adds to the bars: pills of its own, placed among the element's.
// The bottom row has one after its own pills and one before undo and redo, and the top row has
// one in its right-hand corner. Each widget can name the tabs it shows in.

export function createWidgetShelf() {
  const widgets = new Set();
  const root = document.createElement('span');
  root.className = 'fl-widgets';
  let tab = 'write';

  const show = () => {
    for (const widget of widgets) {
      // A widget taken away has left the shelf.
      if (widget.root.parentNode !== root) widgets.delete(widget);
      else widget.root.hidden = !!widget.tabs && !widget.tabs.includes(tab);
    }
  };

  return {
    root,
    /** Places a widget, { root, tabs }, which shows only in its tabs when it lists some. */
    add(widget) {
      widgets.add(widget);
      root.append(widget.root);
      show();
    },
    /** Shows the widgets for the tab now showing. */
    setTab(next) {
      tab = next;
      show();
    },
  };
}
