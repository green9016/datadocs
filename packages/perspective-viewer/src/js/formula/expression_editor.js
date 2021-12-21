import {bindTemplate, throttlePromise} from "../utils.js";

import template from "../../html/expression_editor.html";

import style from "../../less/expression_editor.less";

// Eslint complains here because we don't do anything, but actually we globally
// register this class as a CustomElement
@bindTemplate(template, style) // eslint-disable-next-line no-unused-vars
class PerspectiveExpressionEditor extends HTMLElement {
    constructor() {
        super();
        this._value = "";
        this._ignored_nodes = ["BR", "DIV"];
    }

    connectedCallback() {
        this._register_ids();
        this._register_callbacks();

        // `renderer` is a function that takes a string of content and
        // returns a string of valid HTML. The default renderer
        // splits the string by space and returns `span` elements.
        this.renderer = this._render_content;
    }

    /**
     * Replace the render function of the editor instance with a custom
     * renderer, which allows for full manipulation of the final rendered
     * output of the editor.
     *
     * @param {Function} render_function a function that takes a string and
     * returns a string of valid HTML.
     */
    set_renderer(render_function) {
        this.renderer = render_function;
    }

    get_edit_area() {
        if (this._cell_editor) {
            return this._cell_editor;
        }
        return this._edit_area;
    }

    getSelection() {
        if (this._cell_editor && this._cell_editor.getRootNode()) {
            return this._cell_editor.getRootNode().getSelection();
        }
        return this.shadowRoot.getSelection();
    }

    /**
     * Analyze the content in the editor and redraw the selection caret every
     * time an `input` event is fired.
     */
    @throttlePromise
    update_content() {
        const selection = this.getSelection();
        const tokens = this.get_tokens(this.get_edit_area());

        // Dispatch a `perspective-expression-editor-input` event,
        // signifying that the input has reached the editor but has not
        // been rendered into HTML yet
        const input_event = new CustomEvent("perspective-expression-editor-input", {
            detail: {
                nodes: tokens.map(t => t.node),
                text: this.get_edit_area().textContent
            }
        });
        this.dispatchEvent(input_event);

        let anchor_idx = null;
        let focus_idx = null;
        let current_idx = 0;

        for (const token of tokens) {
            if (token.node === selection.anchorNode) {
                anchor_idx = current_idx + selection.anchorOffset;
            }

            if (token.node === selection.focusNode) {
                focus_idx = current_idx + selection.focusOffset;
            }

            current_idx += token.text.length;
        }

        this._value = tokens.map(t => t.text).join("");

        if (this._value.length === 0) {
            // Clear input from the editor
            this.clear_content();
        } else {
            // Calls the `renderer` to transform a text string to DOM tokens,
            // but only when string.length > 0
            const markup = this.renderer(this._value, tokens);
            this._edit_area.innerHTML = markup;
            if (this._cell_editor) {
                this._cell_editor.innerHTML = markup;
            }
        }

        this.restore_selection(anchor_idx, focus_idx);

        // Dispatch `perspective-expression-editor-rendered`, which signifies
        // that the editor UI has updated to its final state.
        const rendered_event = new CustomEvent("perspective-expression-editor-rendered", {
            detail: {
                nodes: tokens.map(t => t.node),
                text: this._value
            }
        });

        this.dispatchEvent(rendered_event);
    }

    clear_content() {
        this._edit_area.innerHTML = "";
        if (this._cell_editor) {
            this._cell_editor.innerHTML = "";
        }
    }

    _render_content(content) {
        return `<span class="psp-expression__fragment">${content}</span>`;
    }

    /**
     * After editor content has been rendered, "un-reset" the caret position
     * by returning it to where the user selected.
     *
     * @param {Number} absolute_anchor_idx
     * @param {Number} absolute_focus_idx
     */
    restore_selection(absolute_anchor_idx, absolute_focus_idx) {
        const selection = this.getSelection();
        const tokens = this.get_tokens(this.get_edit_area());
        let anchor_node = this.get_edit_area();
        let anchor_idx = 0;
        let focus_node = this.get_edit_area();
        let focus_idx = 0;
        let current_idx = 0;

        for (const token of tokens) {
            const start_idx = current_idx;
            const end_idx = start_idx + token.text.length;

            if (start_idx <= absolute_anchor_idx && absolute_anchor_idx <= end_idx) {
                anchor_node = token.node;
                anchor_idx = absolute_anchor_idx - start_idx;
            }

            if (start_idx <= absolute_focus_idx && absolute_focus_idx <= end_idx) {
                focus_node = token.node;
                focus_idx = absolute_focus_idx - start_idx;
            }

            current_idx += token.text.length;
        }

        selection.setBaseAndExtent(anchor_node, anchor_idx, focus_node, focus_idx);
    }

    get_text() {
        return this._edit_area.textContent;
    }

    set_readonly(readonly) {
        if (readonly) {
            this._edit_area.classList.add("edit-readonly");
            this._edit_area.setAttribute("contenteditable", "false");
        }
        else {
            this._edit_area.classList.remove("edit-readonly");
            this._edit_area.setAttribute("contenteditable", "true");
        }
    }

    set_text(str) {
        if (str) {
            if (typeof str == "object") {
                if (str.value) {
                    this._edit_area.innerHTML = str.value.rollup;
                }
            }
            else {
                this._edit_area.innerHTML = str;
            }
        }
        else {
            this._edit_area.innerHTML == "";
        }

        // this.update_content();
    }

    get_tokens(element) {
        const tokens = [];
        for (const node of element.childNodes) {
            if (this._ignored_nodes.includes(node.nodeName)) continue;
            switch (node.nodeType) {
                case Node.TEXT_NODE:
                    tokens.push({text: node.nodeValue, node});
                    break;
                case Node.ELEMENT_NODE:
                    tokens.splice(tokens.length, 0, ...this.get_tokens(node));
                    break;
                default:
                    continue;
            }
        }
        return tokens;
    }

    focus() {
        this._edit_area.focus();
    }

    /**
     * Dispatch a `perspective-expression-editor-keyup` event containing
     * the original `keyup` event in `event.details`.
     *
     * @param {*} ev a `keyup` event.
     */
    keyup(ev) {
        const event = new CustomEvent("perspective-expression-editor-keyup", {
            detail: ev
        });
        this.dispatchEvent(event);
    }

    /**
     * Dispatch a `perspective-expression-editor-keydown` event containing
     * the original `keyup` event in `event.details`.
     *
     * @param {*} ev a `keydown` event.
     */
    keydown(ev) {
        if (this._edit_area.classList.contains("edit-readonly")) {
            ev.preventDefault();
            ev.stopPropagation();
            return;
        }
        
        const event = new CustomEvent("perspective-expression-editor-keydown", {
            detail: ev
        });
        this.dispatchEvent(event);
    }

    _reset_selection() {
        const selection = this.shadowRoot.getSelection();
        selection.setBaseAndExtent(selection.anchorNode, this._edit_area.textContent.length, selection.focusNode, this._edit_area.textContent.length);
    }

    /**
     * Map DOM IDs to class properties.
     */
    _register_ids() {
        // If editing formula bar, then we should use _edit_are.
        // if editing grid cell, _cell_editor will be availble and we should use _cell_editor 
        this._edit_area = this.shadowRoot.querySelector(".formula-input");
        this._cell_editor = null;
    }

    set_cell_editor(editor) {
        this._cell_editor = editor;
    }

    /**
     * Map callback functions to class properties.
     */
    _register_callbacks() {
        this._edit_area.addEventListener("input", this.update_content.bind(this));
        this._edit_area.addEventListener("keyup", this.keyup.bind(this));
        this._edit_area.addEventListener("keydown", this.keydown.bind(this));
    }
}
