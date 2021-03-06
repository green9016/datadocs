/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
*
 */

import {html} from "lit-html";

import {bindTemplate, throttlePromise} from "../utils.js";

import template from "../../html/formula_bar.html";

import style from "../../less/formula_bar.less";

import {FunctionTokenType, OperatorTokenType, COLUMN_NAME_REGEX_PATTERN, RightParen, As, ColumnName, Whitespace, ColumnNameTokenType, StringTokenType, NumberTokenType, StringValue, NumberValue, LeftParen} from "../computed_column/lexer";
import {ComputedExpressionAutocompleteSuggestion, COMPUTED_EXPRESSION_PARSER} from "../computed_column/computed_column_parser";
import {tokenMatcher} from "chevrotain";

// Eslint complains here because we don't do anything, but actually we globally
// register this class as a CustomElement
@bindTemplate(template, style) // eslint-disable-next-line no-unused-vars
class PerpsectiveFormulaBarWidget extends HTMLElement {
    constructor() {
        super();

        this._parsed_expression = undefined;
        this.expressions = [];
        this._valid = false;
        this._selection_event = undefined;
        this._expression_editor = undefined;
        this._input_target = undefined;
        console.log('--------formula bar----element-----');


        this._computed_expression_parser = COMPUTED_EXPRESSION_PARSER;
    }

    connectedCallback() {
        this._register_ids();
        this._register_callbacks();

        this._expression_editor.set_renderer(this.render_expression.bind(this));

        console.log('-------formula---connectedCallback-----');

    }

    setFormulaHelper(formula_helper) {
        this._formula_helper = formula_helper;
        this._formula_helper.reposition = this._position_autocomplete.bind(this);
        this._formula_helper.addEventListener("perspective-autocomplete-item-clicked", this._autocomplete_item_clicked.bind(this));
    }

    setViewer(viewer) {
        this._viewer = viewer;
    }

    setEvent(selection) {
        this._selection_event = selection;
    }

    /**
     * A stub for the widget to have access to `perspective-viewer`'s _get_type
     * method. Replaced by a reference to the proper method when the widget is
     * opened inside `perspective-viewer`.
     *
     * @param {String} name a column name
     */
    _get_type(name) {
        if (this._viewer)
            return this._viewer._get_type(name);
        return "";
        // throw new Error(`Cannot get column type for "${name}".`);
    }

    /**
     * Returns a list of objects from column names, suitable for rendering
     * in the autocomplete widget.
     */
    _make_column_name_suggestions(names) {
        // label = what is shown in the autocomplete DOM
        // value = what the fragment in the editor will be replaced with
        return names.map(name => {
            return new ComputedExpressionAutocompleteSuggestion({
                label: name,
                value: `[${name}]`,
                is_column_name: true
            });
        });
    }

    /**
     * Given an expression string, render it into markup. Called only when the
     * expression is not an empty string.
     *
     * @param {String} expression
     */
    render_expression(text) {
        // Call `tokenize()` and not `lex()`, as `lex` cleans whitespace
        // tokens and we need whitespace tokens to render the expressions.
        if (!text.startsWith('=')) {
            ['='].push(`<span class="psp-expression__fragment">${expression}</span>`).join("");
            return;
        }
        const expression = text.substr(1);
        const lex_result = this._computed_expression_parser._lexer.tokenize(expression);

        // Track a sorted array of integer offsets into the expression, and
        // a map of offsets to tokens. This allows us to render errors (which
        // aren't in the list of parsed tokens) inline with valid tokens.
        let offsets = [];
        let token_map = {};

        for (const token of lex_result.tokens) {
            token_map[token.startOffset] = token;
            offsets.push(token.startOffset);
        }

        for (const error of lex_result.errors) {
            token_map[error.offset] = error;
            offsets.push(error.offset);
        }

        offsets = offsets.sort((a, b) => a - b);

        const output = ["="];
        // const names = this._get_view_all_column_names();

        // track the last non-whitespace token
        let last_token;

        for (const offset of offsets) {
            const token = token_map[offset];

            // errors have `message` set, whereas valid tokens do not
            const is_error = token.message;

            let content = "";
            let class_name = "fragment";

            if (is_error) {
                // grab the full text of the error
                content = expression.slice(token.offset, token.offset + token.length);
                class_name = "errored";
            } else {
                content = token.image;

                if (tokenMatcher(token, FunctionTokenType)) {
                    class_name = "function";
                } else if (tokenMatcher(token, OperatorTokenType)) {
                    class_name = "operator";
                } else if (tokenMatcher(token, ColumnName)) {
                    const column_name = token.payload;
                    const exists = true; // names.includes(column_name);
                    class_name = `column_name ${exists ? this._get_type(column_name) : ""}`;

                    // only mark as red if the column is not an alias AND does
                    // not exist in the dataset.
                    if ((!exists && !last_token) || (!exists && last_token && !tokenMatcher(last_token, As))) {
                        class_name = "errored";
                    }
                } else if (tokenMatcher(token, StringValue)) {
                    class_name = "string";
                } else if (tokenMatcher(token, NumberValue)) {
                    class_name = "number";
                }

                if (!tokenMatcher(token, Whitespace)) {
                    last_token = token;
                }
            }

            output.push(`<span class="psp-expression__${class_name}">${content}</span>`);
        }

        return output.join("");
    }

    /**
     * Given an Array of autocomplete suggestions, transform them to an Array
     * of `lit-html` templates so they can be rendered inside the autocomplete.
     *
     * Because the computed expression autocomplete contains large amounts
     * of metadata and additional functionality, we create the templates here
     * and let the autocomplete render the markup without any additional
     * changes.
     *
     * @param {Array<ComputedExpressionAutocompleteSuggestion>} suggestions an
     * Array of suggestion objects.
     */
    make_autocomplete_markup(suggestions) {
        return suggestions.map(suggestion => {
            return suggestion.label
                ? html`
                      <div
                          role="listitem"
                          title=${suggestion.help ? suggestion.help : ""}
                          class="psp-autocomplete__item"
                          data-label=${suggestion.label}
                          data-value=${suggestion.value}
                          data-signature=${suggestion.signature ? suggestion.signature : ""}
                          data-help=${suggestion.help ? suggestion.help : ""}
                          data-num_params=${suggestion.num_params || 0}
                          data-params=${suggestion.params ? suggestion.params: ""}
                          data-pattern=${suggestion.pattern ? suggestion.pattern: ""}
                          aria-selected="false"
                      >
                          <span
                              class="psp-autocomplete-item__label ${suggestion.is_column_name ? `psp-autocomplete-item__label--column-name ${this._get_type(suggestion.label)}` : ""}"
                              data-value=${suggestion.value}
                          >
                              ${suggestion.pattern ? suggestion.pattern : suggestion.label}
                          </span>

                          <span
                            class="psp-autocomplete-item__desc">
                            ${suggestion.help}
                        </span>
                      </div>
                  `
                : ""
        });
    }

    /**
     * Validate the expression after the
     * `perspective-expression-editor-rendered` has been fired. Fires on every
     * event, even when the expression is an empty string.
     * @param {*} ev
     */
    @throttlePromise
    async _validate_expression(ev) {
        this._formula_helper.clear();

        const text = ev.detail.text;

        if (text.length <= 1 || !text.startsWith("=")) {
            this._clear_error();
            return;
        }

        const expression = text.substr(1);

        try {
            // Use this just for validation. On anything short of a massive
            // expression, this should have no performance impact as we
            // share an instance of the parser throughout the viewer.
            this._parsed_expression = this._computed_expression_parser.parse(expression);
        } catch (e) {
            // Show autocomplete OR error, but not both
            this._clear_error();

            // Generate a list of tokens from the expression, cleaning out
            // whitespace tokens and without throwing any errors.
            const lex_result = this._computed_expression_parser.lex(expression);

            // Get the last non-whitespace token from the lexer result
            const last_token = this._computed_expression_parser.get_last_token(lex_result);

            if (last_token) {
                // Check if the last token is a column name - if so, don't show
                // autocomplete as we don't want to show autocomplete after a
                // completed column name.
                const is_column_name = tokenMatcher(last_token, ColumnName);

                // Don't show if last token is a parenthesis, as that indicates
                // a closed logical block.
                const is_paren = tokenMatcher(last_token, RightParen);

                // And not if the last token is `as/AS`, as that indicates a
                // custom column name supplied by the user.
                const is_alias = tokenMatcher(last_token, As);

                // If the last token is an operator, force autocomplete to show.
                const is_operator = tokenMatcher(last_token, OperatorTokenType);

            }

            // Get autocomplete suggestions from Chevrotain
            let suggestions = [];

            // Filter down those suggestions by an input type, if possible
            let input_types, match_types;

            // Go to the last function or operator token present in the
            // entire expression, and use it to calculate input types.
            const last_function_or_operator = this._computed_expression_parser.get_last_token_with_types([FunctionTokenType], lex_result);

            if (last_function_or_operator) {
                const param_idx = this._computed_expression_parser.get_param_idx_of_func(last_function_or_operator, lex_result);

                if (param_idx >= 0) {
                    input_types = last_function_or_operator.tokenType.input_types;
                    match_types = true;
    
                    this._formula_helper.render_details(last_function_or_operator.tokenType, param_idx);
                    return;
                }
            } else if (last_token && tokenMatcher(last_token, ColumnName)) {
                // get functions and operators that take the column type
                // as input, but don't check whether return types match
                input_types = [this._get_type(last_token.payload)];
                match_types = false;
            }

            suggestions = this._computed_expression_parser.get_autocomplete_suggestions(expression, lex_result, input_types, match_types);

            if (suggestions.length > 0) {
                // Show autocomplete and not error box
                const markup = this.make_autocomplete_markup(suggestions);
                this._formula_helper.render(markup);
                return;
            } else if (last_token && tokenMatcher(last_token, As)) {
                // don't show error if last token is alias
                return;
            } else {
                // Expression is syntactically valid but unparsable
                const message = e.message ? e.message : JSON.stringify(e);
                this._set_error(message, this._error);
                return;
            }
        }

        // Take the parsed expression and type check it on the viewer,
        // which will call `_type_check_expression()` with a computed_schema.
        const event = new CustomEvent("perspective-computed-expression-type-check", {
            detail: {
                parsed_expression: this._parsed_expression
            }
        });

        this.dispatchEvent(event);

        return;
    }

    @throttlePromise
    async _type_check_expression(computed_schema, expected_types) {
        const parsed = this._parsed_expression || [];
        const invalid = [];

        for (const column of parsed) {
            if (!computed_schema[column.column]) {
                invalid.push(column.column);
            }
        }

        if (invalid.length > 0) {
            let message = "TypeError:\n";
            for (const col of invalid) {
                message += `- \`${col}\` expected input column types ${expected_types[col].join("/")}\n`;
            }
            this._set_error(message, this._error);
        } else {
            this._clear_error();
        }
    }

    _save_expression() {
        console.log("-----formula-bar-save-expression----", this._valid, this._selection_event);
        if (/*!this._valid || */!this._selection_event) {
            return;
        }
        const expression = this._expression_editor.get_text();
        const parsed_expression = this._parsed_expression || [];

        const event = new CustomEvent("perspective-computed-expression-save", {
            detail: {
                input: {event: this._selection_event},
                expression: expression,
                old_expression: ""
            }
        });

        this.dispatchEvent(event);

        this.expressions.push(expression);
    }

    /**
     * Whenever the autocomplete re-renders, position it either at the end
     * of the cursor or dock it to the bottom of the computed expression widget.
     *
     * Do not call this method directly - it is set to override the `reposition`
     * method of `this._formula_helper` in `connectedCallback`.
     */
    _position_autocomplete() {
        let editor = this._expression_editor;
        if (editor._cell_editor) {
            editor = editor._cell_editor;
        }

        if (editor.offsetWidth === 250) {
            this._formula_helper._container.removeAttribute("style");
            this._formula_helper._container.classList.remove("undocked");
            this._formula_helper._container.classList.add("docked");
            return;
        } else {
            this._formula_helper._container.classList.remove("docked");
            this._formula_helper._container.classList.add("undocked");
        }

        const offset_left = editor.offsetLeft;
        const offset_width = editor.offsetWidth;
        const offset_top = editor.offsetTop;

        let left = offset_left + offset_width > 0 ? offset_left + offset_width : 0;
        let top = offset_top + 20 > 20 ? offset_top + 20 : 20;

        if (this._expression_editor._cell_editor) {
            console.log("_position_autocomplete---", editor);
            left = editor.offsetLeft + 10;
            top = editor.offsetTop + 60;
        }

        this._formula_helper._container.style.left = `${left}px`;
        this._formula_helper._container.style.top = `${top}px`;
    }

    /**
     * When an autocomplete item is clicked or selected via keypress,
     * append or replace the text in the editor.
     *
     * @param {String} new_value the value selected from the autocomplete item.
     */
    _autocomplete_replace(new_value) {
        const old_value = this._expression_editor.get_text();
        const last_input = this._computed_expression_parser.extract_partial_function(old_value);

        if (new_value === "(") {
            // Always append parentheses
            this._expression_editor._edit_area.innerText += new_value;
        } else if (last_input && last_input !== '"') {
            // replace the fragment with the full function/operator
            const final_value = old_value.substring(0, old_value.length - last_input.length) + new_value;
            this._expression_editor._edit_area.innerText = "=" + final_value;
        } else {
            // Check whether we are appending a column name
            // FIXME: clean up this affront against all things good
            const last_word = old_value.substring(old_value.lastIndexOf(" ")).trim();
            const last_word_is_column_name = /["'].*[^'"]/.test(last_word) || last_word === '"' || last_word === "'";
            const new_is_column_name = COLUMN_NAME_REGEX_PATTERN.test(new_value);

            if (last_word_is_column_name && new_is_column_name) {
                let last_word_idx = old_value.lastIndexOf(last_word);
                let final_value = old_value.substring(0, last_word_idx);

                // TODO: collapse some of these repeated regex tests
                const partials_inside_func = /\(['"]\w+$/.exec(last_word);

                if (partials_inside_func && partials_inside_func[0] && (last_word_idx === 0 || last_word[0] === "(")) {
                    // replace upto the open quote, but not before it
                    final_value += last_word.substring(0, partials_inside_func.index + 1);
                }

                final_value += new_value;

                this._expression_editor._edit_area.innerText = "=" + final_value;
            } else {
                if (!last_word_is_column_name && (last_word[last_word.length - 1] === '"' || last_word[last_word.length - 1] === "'")) {
                    // Remove the last quote in strings like `pow2("
                    const stripped_last = this._expression_editor._edit_area.innerText.substring(0, this._expression_editor._edit_area.innerText.length - 1);
                    this._expression_editor._edit_area.innerText = stripped_last;
                }
                // Append the autocomplete value
                this._expression_editor._edit_area.innerText += new_value;
            }
        }

        this._formula_helper.clear();
        this._expression_editor._reset_selection();
        this._expression_editor.update_content();
    }

    /**
     * When the autocomplete instance dispatches the
     * `perspective-autocomplete-item-clicked` event, replace or append the
     * value to the editor.
     *
     * @param {CustomEvent} ev a `perspective-autocomplete-item-clicked` event.
     */
    _autocomplete_item_clicked(ev) {
        this._autocomplete_replace(ev.detail.target.getAttribute("data-value"));
    }

    // UI actions
    _clear_expression_editor() {
        this._expression_editor.clear_content();
    }

    _close_expression_widget() {
        this.style.display = "none";
        this._side_panel_actions.style.display = "flex";
        this._clear_error();
        this._clear_expression_editor();
        this._formula_helper.clear();
        // Disconnect the observer.
        this._editor_observer.disconnect();
    }

    /**
     * Given an error message, display it in the DOM and disable the
     * save button.
     *
     * @param {String} error An error message to be displayed.
     * @param {HTMLElement} target an `HTMLElement` that displays the `error`
     * message.
     */
    _set_error(error, target) {
        if (target) {
            target.innerText = error;
            target.style.display = "block";
        }
    }

    _clear_error() {
        // this._error.innerText = "";
        // this._error.style.display = "none";
    }

    _editor_keydown(ev) {
        // All operations need to be done on `ev.detail`, not `ev`, as the event
        // is passed through from the editor.
        switch (ev.detail.key) {
            case "Enter":
            case "Tab":
                ev.detail.preventDefault();
                ev.detail.stopPropagation();
                {
                    // If autocomplete is open, select the current autocomplete
                    // value. Otherwise, save the expression.
                    if (this._formula_helper.displayed === true) {
                        const value = this._formula_helper.get_selected_value();
                        if (value) {
                            this._autocomplete_replace(value);
                        }
                    } else {
                        this._save_expression();
                    }
                }
                break;
            case "ArrowDown":
                {
                    ev.detail.preventDefault();
                    ev.detail.stopPropagation();
                    console.log("arrow down----------");
                    if (this._formula_helper.displayed === true) {
                        this._formula_helper._next();
                    }
                }
                break;
            case "ArrowUp":
                {
                    ev.detail.preventDefault();
                    ev.detail.stopPropagation();
                    if (this._formula_helper.displayed === true) {
                        this._formula_helper._prev();
                    }
                }
                break;
            case "z": {
                // prevent Ctrl/Command-z for undo, as it has no effect
                // inside the editor but will fire keypress events and mess
                // up the flow.
                if (ev.detail.metaKey === true || ev.detail.ctrlKey === true) {
                    ev.detail.preventDefault();
                    ev.detail.stopPropagation();
                }
            }
            default:
                break;
        }
    }

    /**
     * Map DOM IDs to class properties.
     */
    _register_ids() {
        this._expression_editor = this.shadowRoot.querySelector("#formula-input-box");
    }

    /**
     * Map callback functions to class properties.
     */
    _register_callbacks() {
        this._expression_editor.addEventListener("perspective-expression-editor-rendered", this._validate_expression.bind(this));
        this._expression_editor.addEventListener("perspective-expression-editor-keydown", this._editor_keydown.bind(this));
    }
}
