import {html, nothing, render} from "lit-html";

import {bindTemplate, throttlePromise} from "../utils.js";

import template from "../../html/formula_helper.html";

import style from "../../less/formula_helper.less";
import {COMPUTED_EXPRESSION_PARSER} from "../computed_column/computed_column_parser";

/**
 * A single suggestion object for the autocomplete, containing `label`, which
 * is the text displayed to the user, and `value`, which is the text that goes
 * into the input when a selection is chosen.
 */
export class AutocompleteSuggestion {
    /**
     * Construct a new autocomplete suggestion.
     *
     * @param {String} label the text shown to the user
     * @param {String} value the text used to replace inside the input
     */
    constructor(label, value) {
        this.label = label;
        this.value = value;
    }
}

// Eslint complains here because we don't do anything, but actually we globally
// register this class as a CustomElement
@bindTemplate(template, style) // eslint-disable-next-line no-unused-vars
class PerspectiveFormulaHelperWidget extends HTMLElement {
    constructor() {
        super();
        this.displayed = false;
        this._selection_index = -1;

        this._computed_expression_parser = COMPUTED_EXPRESSION_PARSER;
    }

    connectedCallback() {
        this._register_ids();
        this._register_callbacks();
    }

    /**
     * Render an array of suggestions inside the autocomplete. Calling this
     * method will overwrite the existing suggestions inside the
     * autocomplete container.
     *
     * @param {Array<Template>} markup An array of `lit-html` template objects
     * that will be rendered. If the length of `markup` is 0, the autocomplete
     * is cleared and hidden.
     * @param {Boolean} is_column_name if true, suggestions will be rendered
     * with additional CSS classes denoting that they are column names.
     *
     * TODO: do we want throttlePromise on all render functions?
     */
    @throttlePromise
    render(markup) {
        this._details.style.display = "none";
        this._container.classList.remove("show-details");
        this._list.classList.remove("small");

        if (this._selection_index > -1) {
            const children = this._list.children;
            children[this._selection_index].setAttribute("aria-selected", false);
        }

        if (markup.length === 0) {
            this.clear();
            return;
        }

        this.reposition();

        // Reset selection state
        this._selection_index = -1;

        // Show autocomplete container
        this.display();

        // Reset scroll inside container to be at the top
        this._list.scrollTop = 0;

        // Special classes for smaller selections
        if (markup.length < 4) {
            this._list.classList.add("small");
        }

        render(markup, this._list);
    }

    /**
     * Repositions the widget within the textarea - must be implemented by the
     * user. Defaults to a no-op;
     */
    reposition() {
        console.warning("PerspectiveAutocompleteWidget.reposition has not been implemented.");
        return;
    }

    /**
     * If an item is clicked inside the autocomplete, dispatch a
     * `perspective-autocomplete-item-clicked` event, containing the original
     * click event in the new event's `detail` attribute.
     *
     * @param {*} ev
     */
    item_clicked(ev) {
        if (ev.target && (ev.target.matches(".psp-autocomplete__item") || ev.target.matches(".psp-autocomplete-item__label"))) {
            const event = new CustomEvent("perspective-autocomplete-item-clicked", {
                detail: ev,
                bubbles: true
            });
            this.dispatchEvent(event);
        }
    }

    /**
     * When an item is hovered over, render the details panel if necessary.
     *
     * @param {*} ev
     */
    item_mouseover(ev) {
        // if (ev.target && ev.target.matches(".psp-autocomplete__item")) {
        //     this._render_details_panel(ev.target);
        // }
    }

    /**
     * When hover exits, clear the details panel.
     *
     * @param {*} ev
     */
    item_mouseleave(ev) {
        // if (ev.target && ev.target.matches(".psp-autocomplete__item")) {
        //     this._render_details_panel(ev.target);
        // }
    }

    /**
     * Returns the `data-value` attribute of the currently selected item, or
     * `undefined` if there is no selection.
     */
    get_selected_value() {
        if (this._selection_index !== -1) {
            return this._list.children[this._selection_index].getAttribute("data-value");
        }
    }

    /**
     * Clears the autocomplete widget and sets the widget's `display`
     * style to `none`.
     */
    clear() {
        this._selection_index = -1;
        this._container.classList.add("undocked");
        this._container.removeAttribute("style");
        this.hide();
        render(nothing, this._list);
    }

    /**
     * Displays the autocomplete and sets `this.displayed` to true.
     */
    display() {
        this._container.style.display = "flex";
        this.displayed = true;
    }

    /**
     * Hides the autocomplete, and sets `this.displayed` to false.
     */
    hide() {
        this._container.style.display = "none";
        this.displayed = false;
    }

    /**
     * Navigate to the next element inside the container.
     */
    _next() {
        const count = this._list.children.length;
        const idx = this._selection_index < count - 1 ? this._selection_index + 1 : count ? 0 : -1;
        this._go_to(idx);
    }

    /**
     * Go back one element inside the container.
     */
    _prev() {
        const count = this._list.children.length;
        const position = this._selection_index - 1;
        const idx = this._selection_index > -1 && position !== -1 ? position : count - 1;
        this._go_to(idx);
    }

    /**
     * Navigate to element `idx` inside the container.
     *
     * @param {Number} idx
     */
    _go_to(idx) {
        // liberally borrowed from awesomplete
        const children = this._list.children;

        if (this._selection_index > -1) {
            children[this._selection_index].setAttribute("aria-selected", false);
        }

        // reset selection
        this._selection_index = idx;

        if (idx > -1 && children.length > 0) {
            children[idx].setAttribute("aria-selected", "true");
            children[idx].scrollIntoView({
                block: "nearest"
            });

            // this._render_details_panel(children[idx]);
        }
    }

    _render_details_panel(item) {
        // Because hover and keyboard events can interact, always clear before
        // re-rendering the details panel.
        this._clear_details_panel();
        if (item.hasAttribute("data-help") && item.getAttribute("data-help")) {
            this._container.classList.add("show-details");
            const label = item.getAttribute("data-label");
            const pattern = item.getAttribute("data-pattern");
            const help = item.getAttribute("data-help");
            const signature = item.getAttribute("data-signature");
            const num_params = item.getAttribute("data-num_params") || 0;
            const params = JSON.parse(item.getAttribute("data-params") || "[]");

            this.reposition();
            this._render_details_panel_private({label, pattern, help, signature, num_params, params}, 0);
        }
    }

    render_details(token, param_idx) {
        this.reposition();
        this.display();
        this._render_details_panel_private(token, param_idx);
    }

    _render_details_panel_private(item, param_idx) {
        if (item) {
            this._container.classList.add("show-details");

            let {label, pattern, help, signature, num_params, params} = item;
            if (!label) {
                label = item.LABEL;
                pattern = item.PATTERN.source.replace(/\\/g, "");
            }

            if (params && params != "" && typeof params == "string") {
                params = JSON.parse(params);
            }

            const template = html`
            <div
                class="formula-help-popup-title"
                role="tab"
                aria-expanded="true"
            >
                <div class="formula-help-popup-header">
                    <span class="formula-help-popup-funcname">${pattern}</span>
                    <span class="formula-help-popup-example-paren">(</span>
                    <span class="formula-help-popup-header-holder">
                    ${params.map((param, idx) => 
                        html`<span class="formula-arguments-help-parameter" dir="auto">${param.name + (idx < params.length - 1 ? ", " : "")}</span>`
                        )} 
                    <span class="formula-help-popup-example-paren">)</span>
                </div>
                <div class="formula-arguments-help-button-container">
                    <div
                        class="formula-arguments-help-button"
                        role="button"
                        tabindex="0"
                        data-tooltip="Minimize (F1)"
                        aria-label="Minimize (F1)"
                        style="user-select: none;"
                    >
                        <div class="waffle-formula-help-button-hover-container">
                            <div
                                class="docs-icon goog-inline-block waffle-arguments-help-toggle-icon"
                            >
                                <div
                                    class="docs-icon-img-container docs-icon-img docs-icon-down"
                                    aria-hidden="true"
                                    >
                                    &nbsp;
                                </div>
                            </div>
                        </div>
                    </div>
                    <div
                        class="waffle-arguments-help-close waffle-arguments-help-button"
                        role="button"
                        tabindex="0"
                        data-tooltip="Close (Shift-F1)"
                        aria-label="Close (Shift-F1)"
                        style="user-select: none;"
                    >
                        <div class="waffle-formula-help-button-hover-container">
                            <div class="docs-icon goog-inline-block ">
                                <div
                                class="docs-icon-img-container docs-icon-img docs-icon-close"
                                aria-hidden="true"
                                >
                                &nbsp;
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div style="overflow: hidden;">
                <div class="formula-help-popup-body">
                    <div class="formula-help-popup-example">
                        <div class="formula-help-popup-section-title">Example</div>
                        <div class="formula-help-popup-example-holder">
                            <div class="formula-help-popup-example-formula">
                                <span class="formula-help-popup-example-func-name">${pattern}</span>
                                <bdo dir="ltr">
                                <span class="formula-help-popup-example-paren">(</span>
                                <span class="formula-help-popup-example-args-holder">
                                    ${params.map((param, idx) => 
                                        html`<span class="formula-arguments-help-parameter" dir="auto">${param.example}</span> 
                                        ${(idx < params.length - 1 ? ', ' : '')}`)}
                                </span>
                                <span class="formula-help-popup-example-paren">)</span>
                                </bdo>
                            </div>
                        </div>
                    </div>
                    <div class="formula-help-popup-content">
                        <div>
                            <div class="formula-help-popup-about">
                                <div class="formula-help-popup-section-title">About</div>
                                <span class="formula-help-popup-about-content">${help}</span>
                            </div>
                            <hr />
                            <div class="formula-help-popup-parameter">
                                ${params.map((param) => 
                                    html`<div class="formula-help-popup-parameter-section">
                                        <div class="formula-help-popup-parameter-section-title">
                                            ${param.name}
                                        </div>
                                        <span
                                            class="formula-help-popup-parameter-section-content">
                                            ${param.desc}
                                        </span>
                                    </div>`)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;

            render(template, this._details);

            this.setDetailActiveParamIdx(param_idx);

            this._details.scrollTop = 0;
            this._details.style.display = "block";
        }
    }

    setDetailActiveParamIdx(param_idx) {
        const activeItems = this._details.querySelectorAll(".active");
        activeItems.forEach(item => item.classList.remove("active"));
        
        const helpParams = this._details.querySelectorAll(".formula-help-popup-header-holder .formula-arguments-help-parameter");
        const exampleParams = this._details.querySelectorAll(".formula-help-popup-example-holder .formula-arguments-help-parameter");
        const paramDescItems = this._details.querySelectorAll(".formula-help-popup-parameter .formula-help-popup-parameter-section");
        
        if (param_idx < helpParams.length) {
            helpParams.item(param_idx).classList.add("active");
            exampleParams.item(param_idx).classList.add("active");
            paramDescItems.item(param_idx).classList.add("active");
            paramDescItems.item(param_idx).children[0].classList.add("active");
        }
    }

    /**
     * Remove and hide the details panel.
     */
    _clear_details_panel() {
        render(nothing, this._details);
        this._details.style.display = "none";
        this._container.classList.remove("show-details");
    }

    /**
     * Map DOM IDs to class properties.
     */
    _register_ids() {
        this._container = this.shadowRoot.querySelector(".psp-autocomplete-widget");
        this._list = this.shadowRoot.querySelector("#formula-list");
        this._details = this.shadowRoot.querySelector("#formula-help-popup");
    }

    /**
     * Map callback functions to class properties.
     */
    _register_callbacks() {
        // Dispatch a custom event on click & disable the `mousedown` handler
        this._list.addEventListener("click", this.item_clicked.bind(this));
        this._list.addEventListener("mousedown", ev => ev.preventDefault());
        this._list.addEventListener("mouseover", this.item_mouseover.bind(this));
        this._list.addEventListener("mouseleave", this.item_mouseleave.bind(this));
    }
}
