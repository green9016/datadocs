/* eslint-env browser */

'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var Base = require('../Base');
var effects = require('../lib/DOM/effects');
var Localization = require('../lib/Localization');
const { formulaColors } = require('../Hypergrid/themes');
var Formula = require('../lib/fparser');

const EDITOR_TEXT_COLORIZATION = 'textcolorization';
const EDITOR_BIG_TEXT = 'bigtext';
const EDITOR_TEXTFIELD = 'textfield';
const INT_BIG_TEXT_LENGTH = 10000;
var PROGRESS = ['progress', '-moz-progress', '-webkit-progress'];

var _ = {
    markupUtil: {
		encode: function (tokens) {
			if (tokens instanceof Token) {
				return new Token(tokens.type, _.markupUtil.encode(tokens.content), tokens.alias);
			} else if (Array.isArray(tokens)) {
				return tokens.map(_.markupUtil.encode);
			} else {
				return tokens.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\u00a0/g, ' ');
			}
		},

		type: function (o) {
			return Object.prototype.toString.call(o).slice(8, -1);
		},

		objId: function (obj) {
			if (!obj['__id']) {
				Object.defineProperty(obj, '__id', { value: ++uniqueId });
			}
			return obj['__id'];
		},

		// Deep clone a language definition (e.g. to extend it)
		clone: function deepClone(o, visited) {
			var clone, id, type = _.markupUtil.type(o);
			visited = visited || {};

			switch (type) {
				case 'Object':
					id = _.markupUtil.objId(o);
					if (visited[id]) {
						return visited[id];
					}
					clone = {};
					visited[id] = clone;

					for (var key in o) {
						if (o.hasOwnProperty(key)) {
							clone[key] = deepClone(o[key], visited);
						}
					}

					return clone;

				case 'Array':
					id = _.markupUtil.objId(o);
					if (visited[id]) {
						return visited[id];
					}
					clone = [];
					visited[id] = clone;

					o.forEach(function (v, i) {
						clone[i] = deepClone(v, visited);
					});

					return clone;

				default:
					return o;
			}
		}
	},

    highlight: function (text, grammar, language) {
		var env = {
			code: text,
			grammar: grammar,
			language: language
		};

		env.tokens = this.tokenize(env.code, env.grammar);
		return Tokenstringify(_.markupUtil.encode(env.tokens), env.language);
	},

    matchGrammar: function (text, strarr, grammar, index, startPos, oneshot, target) {
		for (var token in grammar) {
			if(!grammar.hasOwnProperty(token) || !grammar[token]) {
				continue;
			}

			if (token == target) {
				return;
			}

			var patterns = grammar[token];
			patterns = (_.markupUtil.type(patterns) === "Array") ? patterns : [patterns];

			for (var j = 0; j < patterns.length; ++j) {
				var pattern = patterns[j],
					inside = pattern.inside,
					lookbehind = !!pattern.lookbehind,
					greedy = !!pattern.greedy,
					lookbehindLength = 0,
					alias = pattern.alias;

				if (greedy && !pattern.pattern.global) {
					// Without the global flag, lastIndex won't work
					var flags = pattern.pattern.toString().match(/[imuy]*$/)[0];
					pattern.pattern = RegExp(pattern.pattern.source, flags + "g");
				}

				pattern = pattern.pattern || pattern;

				// Don’t cache length as it changes during the loop
				for (var i = index, pos = startPos; i < strarr.length; pos += strarr[i].length, ++i) {

					var str = strarr[i];

					if (strarr.length > text.length) {
						// Something went terribly wrong, ABORT, ABORT!
						return;
					}

					if (str instanceof this.Token) {
						continue;
					}

					if (greedy && i != strarr.length - 1) {
						pattern.lastIndex = pos;
						var match = pattern.exec(text);
						if (!match) {
							break;
						}

						var from = match.index + (lookbehind ? match[1].length : 0),
						    to = match.index + match[0].length,
						    k = i,
						    p = pos;

						for (var len = strarr.length; k < len && (p < to || (!strarr[k].type && !strarr[k - 1].greedy)); ++k) {
							p += strarr[k].length;
							// Move the index i to the element in strarr that is closest to from
							if (from >= p) {
								++i;
								pos = p;
							}
						}

						// If strarr[i] is a Token, then the match starts inside another Token, which is invalid
						if (strarr[i] instanceof this.Token) {
							continue;
						}

						// Number of tokens to delete and replace with the new match
						delNum = k - i;
						str = text.slice(pos, p);
						match.index -= pos;
					} else {
						pattern.lastIndex = 0;

						var match = pattern.exec(str),
							delNum = 1;
					}

					if (!match) {
						if (oneshot) {
							break;
						}

						continue;
					}

					if(lookbehind) {
						lookbehindLength = match[1] ? match[1].length : 0;
					}

					var from = match.index + lookbehindLength,
					    match = match[0].slice(lookbehindLength),
					    to = from + match.length,
					    before = str.slice(0, from),
					    after = str.slice(to);

					var args = [i, delNum];

					if (before) {
						++i;
						pos += before.length;
						args.push(before);
					}

					var wrapped = new this.Token(token, inside? this.tokenize(match, inside) : match, alias, match, greedy);

					args.push(wrapped);

					if (after) {
						args.push(after);
					}

					Array.prototype.splice.apply(strarr, args);

					if (delNum != 1)
						this.matchGrammar(text, strarr, grammar, i, pos, true, token);

					if (oneshot)
						break;
				}
			}
		}
	},

    tokenize: function(text, grammar) {
        var strarr = [text];

        var rest = grammar.rest;

        if (rest) {
            for (var token in rest) {
                grammar[token] = rest[token];
            }

            delete grammar.rest;
        }
        this.matchGrammar(text, strarr, grammar, 0, 0, false);

        return strarr;
    },

    Token: Token
}

function Token(type, content, alias, matchedStr, greedy) {
    this.type = type;
    this.content = content;
    this.alias = alias;
    // Copy of the full string this token was created from
    this.length = (matchedStr || "").length|0;
    this.greedy = !!greedy;
}

function Tokenstringify(o, language) {
    if (typeof o == 'string') {
        return o;
    }

    if (Array.isArray(o)) {
        return o.map(function(element) {
            return Tokenstringify(element, language);
        }).join('');
    }

    var env = {
        type: o.type,
        content: Tokenstringify(o.content, language),
        tag: 'span',
        classes: ['token', o.type],
        attributes: {},
        language: language
    };

    if (o.alias) {
        var aliases = Array.isArray(o.alias) ? o.alias : [o.alias];
        Array.prototype.push.apply(env.classes, aliases);
    }

    //_.hooks.run('wrap', env);

    var attributes = Object.keys(env.attributes).map(function(name) {
        return name + '="' + (env.attributes[name] || '').replace(/"/g, '&quot;') + '"';
    }).join(' ');

    return '<' + env.tag + ' class="' + env.classes.join(' ') + '"' + (attributes ? ' ' + attributes : '') + '>' + env.content + '</' + env.tag + '>';
}

/**
 * @constructor
 * @desc Displays a cell editor and handles cell editor interactions.
 *
 * > This constructor (actually `initialize`) will be called upon instantiation of this class or of any class that extends from this class. See {@link https://github.com/joneit/extend-me|extend-me} for more info.
 *
 * Instances of `CellEditor` are used to render an HTML element on top of the grid exactly within the bound of a cell for purposes of editing the cell value.
 *
 * Extend this base class to implement your own cell editor.
 *
 * @param {Hypergrid} grid
 * @param {object} options - Properties listed below + arbitrary mustache "variables" for merging into template.
 * @param {Point} options.editPoint - Deprecated; use `options.gridCell`.
 * @param {string} [options.format] - Name of a localizer with which to override prototype's `localizer` property.
 */
var CellEditor = Base.extend('CellEditor', {

    initialize: function(grid, options) {
        console.log('celleditor init---------', options);
        // Mix in all enumerable properties for mustache use, typically `column` and `format`.
        for (var key in options) {
            this[key] = options[key];
        }

        this.event = options;

        var value = (options.columnProperties.colDef && options.columnProperties.colDef.computed_expression) 
            ? "=" + options.columnProperties.colDef.computed_expression
            : this.event.value;

        if (value instanceof Array) {
            //value = value[1]; //it's a nested object
            value = '[' + value.join(', ') + ']';
        }else if (value && _typeof(value) === "object") {

            if ("rollup" in value){
                value = value.rollup;
            }else if(value.type && value.type === "ERROR"){
                value = "";
            }
        }

        if (value === undefined || value === null){
            value = "";
        }

        /**
         * my instance of hypergrid
         * @type {Hypergrid}
         * @memberOf CellEditor.prototype
         */
        this.grid = grid;

        this.grid.cellEditor = this;

        this.locale = grid.localization.locale; // for template's `lang` attribute

        // Only override cell editor's default 'null' localizer if the custom localizer lookup succeeds.
        // Failure is when it returns the default ('string') localizer when 'string' is not what was requested.
        var localizer = this.grid.localization.get(options.format); // try to get named localizer
        if (!(localizer === Localization.prototype.string || options.format === 'string')) {
            this.localizer = localizer;
        }

        var container = document.createElement('DIV');

        this.initialValue = this.event.requires_full_value === true ? this.event.to_str_full_value : value;
        //this.initialMarkupValue = this.initialValue;
        this.nbOverflowRows = 0;
        this.maxOverflowRowLength = 0;
        this.maxOverflowRowText = "";
        var _this = this;
        if (this.event.isJSONValue){
            /*var f = {
                brace: 0
            }; // for tracking matches, in particular the curly braces

            //JSON.stringify(this.initialValue, undefined, 4);
            this.initialValue = this.initialValue.replace(/({|}[,]*|[^{}:]+:[^{}:,]*[,{]*)/g, function (m, p1) {
                var rtnFn = function() {
                        _this.nbOverflowRows++;
                        return _this.getJsonRowValue(p1, f['brace'], "blank");
                        //return '<div style="text-indent: ' + (f['brace'] * 20) + 'px;">' + p1 + '</div>';
                    },
                    rtnStr = 0;
                if (p1.lastIndexOf('{') === (p1.length - 1)) {
                    rtnStr = rtnFn();
                    f['brace'] += 1;
                } else if (p1.indexOf('}') === 0) {
                    f['brace'] -= 1;
                    rtnStr = rtnFn();
                } else {
                    rtnStr = rtnFn();
                }
                if (rtnStr && rtnStr.length > _this.maxOverflowRowLength){
                    _this.maxOverflowRowLength = rtnStr.length;
                    _this.maxOverflowRowText = rtnStr;
                }
                return rtnStr;
            });*/
            //var _template = "<div class='hypergrid-textoverflow' style=''>" + this.initialMarkupValue + "</div>";
            //this.initialValue = this.initialMarkupValue;
            //this.initialValue = this.json2PlainTree(this.initialValue);
            this.initialValue = this.markupJSON(this.initialValue);
            container.innerHTML = this.grid.modules.templater.render(this.template, this);
        }else if(this.event.isXMLValue){
            //var xml = new DOMParser().parseFromString(this.initialValue, "text/xml");
            //var obj = this.parseXML(xml);
            this.initialValue = this.markupXML(this.initialValue);
            container.innerHTML = this.grid.modules.templater.render(this.template, this);
        }else if(this.event.is_big_string == true){
            this.lastValue = this.initialValue.substring(INT_BIG_TEXT_LENGTH);
            this.initialValue = this.initialValue.substring(0, INT_BIG_TEXT_LENGTH);
            container.innerHTML = this.grid.modules.templater.render(this.template, this);
        }else{
            container.innerHTML = this.grid.modules.templater.render(this.template, this);
        }

        /**
         * This object's input control, one of:
         * * *input element* - an `HTMLElement` that has a `value` attribute, such as `HTMLInputElement`, `HTMLButtonElement`, etc.
         * * *container element* - an `HTMLElement` containing one or more input elements, only one of which contains the editor value.
         *
         * For access to the input control itself (which may or may not be the same as `this.el`), see `this.input`.
         *
         * @type {HTMLElement}
         * @default null
         * @memberOf CellEditor.prototype
         */
        this.el = container.firstChild;

        this.input = this.el;

        this.errors = 0;
        /**
         * this value represents if the editor is in text mode or formula mode.
         * if this value is true, now editor is in formula mode, in other words, starts with '='
         * we should pain selection rectangles as dashed style in formulaMode and
         * if the rects selected, the cell position should be applied to the formula.
        */
        this.isFormulaMode = false;

        var self = this;
        this.el.addEventListener('keyup', this.keyup.bind(this));
        this.el.addEventListener('keydown', function(e) {
            // Prevent TAB and ENTER
            if (e.keyCode === 9 || e.keyCode === 13) {
                // prevent TAB from leaving input control
                e.preventDefault();
            }

            if (self.readOnly){
              var allowedKeys = {"37" : "arrow-left", "38" : "arrow-up", "39" : "arrow-right", "40" : "arrow-down", "9" : "tab", "27" : "esc"};
              if (!allowedKeys[e.which] && !((e.ctrlKey || e.metaKey) && (e.keyCode == 65 || e.keyCode == 67))) {
                e.preventDefault();
              }
            }
            if (grid.behavior.dataModel._viewer._formula_helper.displayed) {
                // arrow up && arrow down && tab && enter
                if (e.keyCode == 38 || e.keyCode == 40 || e.keyCode == 9 || e.keyCode == 13) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }

            grid.fireSyntheticEditorKeyDownEvent(self, e);
        });
        this.el.addEventListener('keypress', function(e) {
            console.log("keypress----", self.input.value);
            grid.fireSyntheticEditorKeyPressEvent(self, e);
        });
        this.el.addEventListener('mousedown', function(e) {
            self.onmousedown(e);
        });

        this.el.addEventListener('contextmenu', function(e) {
            e.stopPropagation();
        });
        this.el.addEventListener('copy', function(e) {
            e.stopPropagation();
        });

    },

    /*set_full_value: function(full_value){
        this.full_value = full_value;
    },

    get_full_value: function(){
        return this.full_value;
    },*/

    getJsonRowValue: function(strValue, brace, type){
        if (!type || type == 'div'){
            return '<div style="text-indent: ' + (brace * 20) + 'px;">' + strValue + '</div>';
        }else{
            // 4 spaces
            var _blank = "    ";
            var strSpaces = "";
            var i;
            for (i = 0; i < brace; i++){
                strSpaces = _blank + strSpaces;
            }
            strValue = strSpaces + strValue + "\n";
            return strValue;
        }
    },

    json2PlainTree: function(jsonData){
        var _this = this;

        var f = {
            brace: 0
        };
        return jsonData.replace(/({|}[,]*|[^{}:]+:[^{}:,]*[,{]*)/g, function (m, p1) {
            var rtnFn = function() {
                    _this.nbOverflowRows++;
                    return _this.getJsonRowValue(p1, f['brace'], "blank");
                    //return '<div style="text-indent: ' + (f['brace'] * 20) + 'px;">' + p1 + '</div>';
                },
                rtnStr = 0;
            if (p1.lastIndexOf('{') === (p1.length - 1)) {
                rtnStr = rtnFn();
                f['brace'] += 1;
            } else if (p1.indexOf('}') === 0) {
                f['brace'] -= 1;
                rtnStr = rtnFn();
            } else {
                rtnStr = rtnFn();
            }
            if (rtnStr && rtnStr.length > _this.maxOverflowRowLength){
                _this.maxOverflowRowLength = rtnStr.length;
                _this.maxOverflowRowText = rtnStr;
            }
            return rtnStr;
        });
    },

    markupJSON: function(text){
        return text;
        // var grammar = {
        // 	'property': {
        // 		pattern: /"(?:\\.|[^\\"\r\n])*"(?=\s*:)/,
        // 		greedy: true
        // 	},
        // 	'string': {
        // 		pattern: /"(?:\\.|[^\\"\r\n])*"(?!\s*:)/,
        // 		greedy: true
        // 	},
        // 	'comment': /\/\/.*|\/\*[\s\S]*?(?:\*\/|$)/,
        // 	'number': /-?\d+\.?\d*(e[+-]?\d+)?/i,
        // 	'punctuation': /[{}[\],]/,
        // 	'operator': /:/,
        // 	'boolean': /\b(?:true|false)\b/,
        // 	'null': {
        // 		pattern: /\bnull\b/,
        // 		alias: 'keyword'
        // 	}
        // };

        // text = this.json2PlainTree(text);

        // return _.highlight(text, grammar, 'json');
    },

    markupXML: function(text){
        var grammar = {
        	'comment': /<!--[\s\S]*?-->/,
        	'prolog': /<\?[\s\S]+?\?>/,
        	'doctype': /<!DOCTYPE[\s\S]+?>/i,
        	'cdata': /<!\[CDATA\[[\s\S]*?]]>/i,
        	'tag': {
        		pattern: /<\/?(?!\d)[^\s>\/=$<%]+(?:\s(?:\s*[^\s>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))|(?=[\s/>])))+)?\s*\/?>/i,
        		greedy: true,
        		inside: {
        			'tag': {
        				pattern: /^<\/?[^\s>\/]+/i,
        				inside: {
        					'punctuation': /^<\/?/,
        					'namespace': /^[^\s>\/:]+:/
        				}
        			},
        			'attr-value': {
        				pattern: /=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+)/i,
        				inside: {
        					'punctuation': [
        						/^=/,
        						{
        							pattern: /^(\s*)["']|["']$/,
        							lookbehind: true
        						}
        					]
        				}
        			},
        			'punctuation': /\/?>/,
        			'attr-name': {
        				pattern: /[^\s>\/]+/,
        				inside: {
        					'namespace': /^[^\s>\/:]+:/
        				}
        			}

        		}
        	},
        	'entity': /&#?[\da-z]{1,8};/i
        };

        text = this.xml2PlainTree(text);

        return _.highlight(text, grammar, 'markup');
    },

    xml2PlainTree: function(xml) {
      // xml is a string
      var formatted = '';
      var reg = /(>)(<)(\/*)/g;
      xml = xml.toString().replace(reg, '$1\r\n$2$3');
      var pad = 0;
      var nodes = xml.split('\r\n');
      for(var n in nodes) {
        var node = nodes[n];
        var indent = 0;
        if (node.match(/.+<\/\w[^>]*>$/)) {
          indent = 0;
        } else if (node.match(/^<\/\w/)) {
          if (pad !== 0) {
            pad -= 1;
          }
        } else if (node.match(/^<\w[^>]*[^\/]>.*$/)) {
          indent = 1;
        } else {
          indent = 0;
        }

        var padding = '';

        // Will use ' '.repeat(pad) instead
        for (var i = 0; i < pad; i++) {
          padding += '  ';
        }

        formatted += padding + node + '\r\n';
        pad += indent;

        var currentStr = padding + node + '\r\n';
        if (currentStr && currentStr.length > this.maxOverflowRowLength){
            this.maxOverflowRowLength = currentStr.length;
            this.maxOverflowRowText = currentStr;
        }
        this.nbOverflowRows++;
      }

      return formatted;
      //return formatted.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/ /g, '&nbsp;');
    },

    flatten: function(object) {
      var check = typeof object === "object" && _.size(object) === 1;
      return check ? flatten(Object.values(object)[0]) : object;
    },

    parseXML: function(xml){
        var data = {};

          var isText = xml.nodeType === 3,
              isElement = xml.nodeType === 1,
              body = xml.textContent && xml.textContent.trim(),
              hasChildren = xml.children && xml.children.length,
              hasAttributes = xml.attributes && xml.attributes.length;

          if (isText) {
              this.nbOverflowRows++;
              return xml.nodeValue.trim();
          }

          if (!hasChildren && !hasAttributes) {
              return body;
          }

          // if it doesn't have children but _does_ have body content, we'll use that
          if (!hasChildren && body.length) {
              data.text = body;
          }

          // if it's an element with attributes, add them to data.attributes
          if (isElement && hasAttributes) {
            data.attributes = xml.attributes.map(function(obj, name, id) {
              var attr = xml.attributes.item(id);
              obj[attr.name] = attr.value;
              return obj;
            }, {});
          }

          // recursively call #parse over children, adding results to data
          for (var i = 0; i < xml.children.length ;i++) {
            var name = xml.children[i].nodeName;

            // if we've not come across a child with this nodeType, add it as an object
            // and return here
            if (!data.hasOwnProperty(name)) {
              data[name] = this.parseXML(xml.children[i]);
              return;
            }

            // if we've encountered a second instance of the same nodeType, make our
            // representation of it an array
            if (!Array.isArray(data[name])) {
                data[name] = [data[name]];
            }

            // and finally, append the new child
            data[name].push(this.parseXML(xml.children[i]));
          }

          // if we can, let's fold some attributes into the body
          data.attributes.forEach(function(value, key) {
            if (data[key] != null) { return; }
            data[key] = value;
            delete data.attributes[key];
          });

          // if data.attributes is now empty, get rid of it
          if (this.isEmpty(data.attributes)) {
              delete data.attributes;
          }

          return flatten(data);
    },

    isEmpty: function(val){
        return (val === undefined || val == null || val.length <= 0) ? true : false;
    },

    // If you override this method, be sure to call it as a final step (or call stopPropagation yourself).
    onmousedown: function(event) {
        event.stopPropagation(); // Catch mousedown here before it gets to the document listener defined in Hypergrid().
    },

    localizer: Localization.prototype.null,

    specialKeyups: {
        //0x08: 'clearStopEditing', // backspace
        0x09: 'stopEditing', // tab
        0x0d: 'stopEditing', // return/enter
        0x1b: 'cancelEditing' // escape
    },

    keyup: function(e) {
        var grid = this.grid,
            cellProps = this.event.properties,
            feedbackCount = cellProps.feedbackCount,
            keyChar = grid.canvas.getKeyChar(e),
            specialKeyup,
            stopped;

        // STEP 1: Call the special key handler as needed
        if (
            (specialKeyup = this.specialKeyups[e.keyCode]) &&
            (stopped = this[specialKeyup](feedbackCount))
        ) {
            grid.repaint();
        }

        // STEP 2: If this is a possible "nav key" consumable by CellSelection#handleKeyDown, try to stop editing and send it along
        if (cellProps.mappedNavKey(keyChar, e.ctrlKey)) {
            if (
                !specialKeyup &&
                // We didn't try to stop editing above so try to stop it now
                (stopped = this.stopEditing(feedbackCount))
            ) {
                grid.repaint();
            }

            if (stopped) {
                // Editing successfully stopped
                // -> send the event down the feature chain
                var finEvent = grid.canvas.newEvent(e, 'fin-editor-keyup', {
                    grid: grid,
                    alt: e.altKey,
                    ctrl: e.ctrlKey,
                    char: keyChar,
                    legacyChar: e.legacyKey, // decorated by getKeyChar
                    code: e.charCode,
                    key: e.keyCode,
                    meta: e.metaKey,
                    shift: e.shiftKey,
                    identifier: e.key,
                    editor: this
                });
                grid.delegateKeyUp(finEvent);
            }
        }

        this.parseAndProcess(keyChar);
        this.grid.fireSyntheticEditorKeyUpEvent(this, e);

        return stopped;
    },

    /**
     * if true, check that the editor is in the right location
     * @type {boolean}
     * @default false
     * @memberOf CellEditor.prototype
     */
    checkEditorPositionFlag: false,

    readOnly: false,

    /**
     * @memberOf CellEditor.prototype
     * @desc This function is a callback from the fin-hypergrid.   It is called after each paint of the canvas.
     */
    gridRenderedNotification: function() {
        this.checkEditor();
    },

    /**
     * @memberOf CellEditor.prototype
     * @desc scroll values have changed, we've been notified
     */
    scrollValueChangedNotification: function() {
        this.checkEditorPositionFlag = true;
    },

    /**
     * @memberOf CellEditor.prototype
     * @desc move the editor to the current editor point
     */
    moveEditor: function() {
        this.setBounds(this.event.bounds);
    },

    /**
     * @memberOf CellEditor.prototype
     * @desc zoom the editor for setting ratio
     */
    zoomEditor: function() {
        let ratio = this.grid.behavior.dataModel.getZoomRatio();
        var style = this.el.style;

        Object.assign(style, { zoom: ratio });
    },

    beginEditing: function() {
        console.log('begin editing-------------');
        if (this.grid.fireRequestCellEdit(this.event, this.initialValue)) {
            this.checkEditorPositionFlag = true;
            this.checkEditor();
        }
    },

    showReadonlyEdit: function() {
        console.log('show readonly edit------');
        if (this.grid.fireRequestCellEdit(this.event, this.initialValue)) {
            this.checkEditorPositionFlag = true;
            this.checkEditor(false);
            //this.el.readOnly = true;
            this.readOnly = true;
        }
    },

    /**
     * @summary Put the value into our editor.
     * @desc Formats the value and displays it.
     * The localizer's {@link localizerInterface#format|format} method will be called.
     *
     * Override this method if your editor has additional or alternative GUI elements.
     *
     * @param {object} value - The raw unformatted value from the data source that we want to edit.
     * @memberOf CellEditor.prototype
     */
    setEditorValue: function(value, last_value) {
        if (this.event.editor && this.event.editor === EDITOR_TEXT_COLORIZATION){
            this.input.innerHTML = this.localizer.format(value);
        }else if(this.event.editor && this.event.editor === EDITOR_BIG_TEXT){
            this.input.innerHTML = this.localizer.format(value) + "<a href='javascript: void(0);' onclick=\"this.style.display = 'none'; if (this.nextElementSibling){this.nextElementSibling.style.display = 'inline';} \"> more</a><span style='display:none'>" + this.localizer.format(last_value) + "</span>";
        }else if (this.event.editor && this.event.editor === EDITOR_TEXTFIELD){
            this.input.innerHTML = this.localizer.format(value);
        }else{
            this.input.value = this.localizer.format(value);
        }
    },

    /**
     * @memberOf CellEditor.prototype
     * @desc display the editor
     */
    showEditor: function() {
        this.el.style.display = 'inline';
    },

    /**
     * @memberOf CellEditor.prototype
     * @desc hide the editor
     */
    hideEditor: function() {
        this.el.style.display = 'none';

        this.grid.fireRequestHideCellEdit();
    },

    /** @summary Stops editing.
     * @desc Before saving, validates the edited value in two phases as follows:
     * 1. Call `validateEditorValue`. (Calls the localizer's `invalid()` function, if available.)
     * 2. Catch any errors thrown by the {@link CellEditor#getEditorValue|getEditorValue} method.
     *
     * **If the edited value passes both phases of the validation:**
     * Saves the edited value by calling the {@link CellEditor#saveEditorValue|saveEditorValue} method.
     *
     * **On validation failure:**
     * 1. If `feedback` was omitted, cancels editing, discarding the edited value.
     * 2. If `feedback` was provided, gives the user some feedback (see `feedback`, below).
     *
     * @param {number} [feedback] What to do on validation failure. One of:
     * * **`undefined`** - Do not show the error effect or the end effect. Just discard the value and close the editor (as if `ESC` had been typed).
     * * **`0`** - Just shows the error effect (see the {@link CellEditor#errorEffect|errorEffect} property).
     * * **`1`** - Shows the error feedback effect followed by the detailed explanation.
     * * `2` or more:
     *   1. Shows the error feedback effect
     *   2. On every `feedback` tries, shows the detailed explanation.
     * * If `undefined` (omitted), simply cancels editing without saving edited value.
     * * If 0, shows the error feedback effect (see the {@link CellEditor#errorEffect|errorEffect} property).
     * * If > 0, shows the error feedback effect _and_ calls the {@link CellEditor#errorEffectEnd|errorEffectEnd} method) every `feedback` call(s) to `stopEditing`.
     * @returns {boolean} Truthy means successful stop. Falsy means syntax error prevented stop. Note that editing is canceled when no feedback requested and successful stop includes (successful) cancel.
     * @memberOf CellEditor.prototype
     */
    stopEditing: function(feedback) {
        console.log('---stop editing--');

        if (this.grid.behavior.dataModel._viewer._formula_helper.displayed) {
            return false;
        }

        var str;
        if (this.event.editor && this.event.editor === EDITOR_TEXT_COLORIZATION){
            str = this.input.innerHTML;
        }else{
            str = this.input.innerText;
        }

        try {
            var error = this.validateEditorValue(str);
            if (!error) {
                var value = this.getEditorValue(str);
            }
        } catch (err) {
            error = err;
        }

        if (!error && this.grid.fireSyntheticEditorDataChangeEvent(this, this.initialValue, value)) {
            console.log('fireSyntheticEditorDataChangeEvent---', this.initialValue, value);
            try {
                this.saveEditorValue(value);
            } catch (err) {
                error = err;
            }
        }

        this.clearFormulaData();

        if (!error) {
            this.hideEditor();
            this.grid.cellEditor = null;
            this.el.remove();
        } else if (feedback >= 0) { // false when `feedback` undefined
            this.errorEffectBegin(++this.errors % feedback === 0 && error);
        } else { // invalid but no feedback
            this.cancelEditing();
        }

        return !error;
    },

    /** @summary Cancels editing.
     * @returns {boolean} Successful. (Cancel is always successful.)
     */
    cancelEditing: function() {
        this.setEditorValue(this.initialValue, this.lastValue);
        this.hideEditor();
        this.grid.cellEditor = null;
        this.el.remove();
        this.grid.takeFocus();
        this.clearFormulaData();

        return true;
    },

    /**
     * Calls the effect function indicated in the {@link module:defaults.feedbackEffect|feedbackEffect} property, which triggers a series of CSS transitions.
     * @param {boolean|string|Error} [error] - If defined, call the {@link CellEditor#errorEffectEnd|errorEffectEnd} method at the end of the last effect transition with this error.
     * @memberOf CellEditor.prototype
     */
    errorEffectBegin: function(error) {
        if (this.effecting) {
            return;
        }

        var spec = this.grid.properties.feedbackEffect, // spec may e a string or an object with name and options props
            effect = effects[spec.name || spec]; // if spec is a string, spec.name will be undefined

        if (effect) {
            var options = Object.assign({}, spec.options); // if spec is a string, spec.options will be undefined
            options.callback = this.errorEffectEnd.bind(this, error);
            this.effecting = true;
            effect.call(this, options);
        }
    },

    /**
     * This function expects to be passed an error. There is no point in calling this function if there is no error. Nevertheless, if called with a falsy `error`, returns without doing anything.
     * @this {CellEditor}
     * @param {boolean|string|Error} [error]
     */
    errorEffectEnd: function(error, options) {
        if (error) {
            var msg =
                'Invalid value. To resolve, do one of the following:\n\n' +
                '   * Correct the error and try again.\n' +
                '         - or -\n' +
                '   * Cancel editing by pressing the "esc" (escape) key.';

            error = error.message || error;

            if (typeof error !== 'string') {
                error = '';
            }

            if (this.localizer.expectation) {
                error = error ? error + '\n' + this.localizer.expectation : this.localizer.expectation;
            }

            if (error) {
                if (/[\n\r]/.test(error)) {
                    error = '\n' + error;
                    error = error.replace(/[\n\r]+/g, '\n\n   * ');
                }
                msg += '\n\nAdditional information about this error: ' + error;
            }

            setTimeout(function() { // allow animation to complete
                alert(msg); // eslint-disable-line no-alert
            });
        }
        this.effecting = false;
    },

    /**
     * @desc save the new value into the behavior (model)
     * @returns {boolean} Data changed and pre-cell-edit event was not canceled.
     * @memberOf CellEditor.prototype
     */
    saveEditorValue: function(value) {
        console.log('---setEditorValue---', this.event.gridCell, value);
        //if (this.el.readOnly){
        if (this.readOnly){
            return this.initialValue;
        }
        var save = (
            !(value && value === this.initialValue) && // data changed
            this.grid.fireBeforeCellEdit(this.event.gridCell, this.initialValue, value, this) // proceed
        );

        if (save) {
            this.event.value = value;
            this.grid.fireAfterCellEdit(this.event.gridCell, this.initialValue, value, this);
        }

        return save;
    },

    /**
     * @summary Extract the edited value from the editor.
     * @desc De-format the edited string back into a primitive value.
     *
     * The localizer's {@link localizerInterface#parse|parse} method will be called on the text box contents.
     *
     * Override this method if your editor has additional or alternative GUI elements. The GUI elements will influence the primitive value, either by altering the edited string before it is parsed, or by transforming the parsed value before returning it.
     * @param {string} str - current editors input string
     * @returns {object} the current editor's value
     * @throws {boolean|string|Error} Throws an error on parse failure. If the error's `message` is defined, the message will eventually be displayed (every `feedbackCount`th attempt).
     * @memberOf CellEditor.prototype
     */
    getEditorValue: function(str) {
        if (this.event.editor && this.event.editor === EDITOR_TEXT_COLORIZATION){
            return this.localizer.parse(str || (this.input.innerHTML) || '');
        }
        else if (this.event.editor && this.event.editor === EDITOR_TEXTFIELD){
            return this.localizer.parse(str || (this.input.innerHTML) || '');
        }

        return this.localizer.parse(str || (this.input.value) || '');
    },

    /**
     * If there is no validator on the localizer, returns falsy (not invalid; possibly valid).
     * @param {string} str - current editors input string
     * @returns {boolean|string} Truthy value means invalid. If a string, this will be an error message. If not a string, it merely indicates a generic invalid result.
     * @throws {boolean|string|Error} May throw an error on syntax failure as an alternative to returning truthy. Define the error's `message` field as an alternative to returning string.
     * @memberOf CellEditor.prototype
     */
    validateEditorValue: function(str) {
        if (this.event.editor && this.event.editor === EDITOR_TEXT_COLORIZATION){
            return this.localizer.invalid && this.localizer.invalid(str || this.input.innerHTML);
        }
        else if (this.event.editor && this.event.editor === EDITOR_TEXTFIELD){
            return this.localizer.invalid && this.localizer.invalid(str || this.input.innerHTML);
        }
        return this.localizer.invalid && this.localizer.invalid(str || this.input.value);
    },

    /**
     * @summary Request focus for my input control.
     * @desc See GRID-95 "Scrollbar moves inward" for issue and work-around explanation.
     * @memberOf CellEditor.prototype
     */
    takeFocus: function() {
        var el = this.el,
            leftWas = el.style.left,
            topWas = el.style.top;

        el.style.left = el.style.top = 0; // work-around: move to upper left

        var x = window.scrollX, y = window.scrollY;
        this.input.focus();
        window.scrollTo(x, y);
        this.selectAll();

        el.style.left = leftWas;
        el.style.top = topWas;
    },

    /**
     * @memberOf CellEditor.prototype
     * @desc select everything
     */
    selectAll: nullPattern,

    /**
     * @memberOf CellEditor.prototype
     * @desc set the bounds of my input control
     * @param {rectangle} rectangle - the bounds to move to
     */
    setBounds: function(cellBounds) {
        /*var style = this.el.style;

        style.left = px(cellBounds.x);
        style.top = px(cellBounds.y);
        style.width = px(cellBounds.width);
        style.height = px(cellBounds.height);*/
        var selectionRegionBorderWidth = this.grid.properties.selectionRegionBorderWidth;
        var ratio = this.grid.behavior.dataModel.getZoomRatio();
        var _grid$canvas = this.grid.canvas,
            gc = _grid$canvas.gc,
            canvasWidth = parseInt(_grid$canvas.width/ratio),
            canvasHeight = parseInt(_grid$canvas.height/ratio);
        var style = this.el.style;

        var rowFont = this.event.rowProperties.font || this.event.properties.font;

        var left = cellBounds.x;

        var maximumColumnWidth = canvasWidth - left;

        gc.cache.font = rowFont;
        // additional width because of inner padding and border
        var width = gc.getTextWidth(this.initialValue) + 12;

        var extraOverflowHeight = 0;
        if (this.event.isJSONValue || this.event.isXMLValue){
            extraOverflowHeight = 15 * this.nbOverflowRows;
            width = gc.getTextWidth(this.maxOverflowRowText) + 12;
        }

        // correct width if it too much
        if (!width || width < cellBounds.width) {
            width = cellBounds.width + selectionRegionBorderWidth;
        }
        if (width > maximumColumnWidth) {
            width = maximumColumnWidth;
        }

        // move to left if it needed
        if (left + width > canvasWidth) {
            left = canvasWidth - width;
        }

        width += selectionRegionBorderWidth;


        Object.assign(style, { left: px(left), width: px(width), font: rowFont, resize: 'none' });

        // additional height because of inner padding and border
        var height = (width === maximumColumnWidth + selectionRegionBorderWidth ? this.el.scrollHeight : cellBounds.height) + 2 + extraOverflowHeight;

        var top = cellBounds.y - selectionRegionBorderWidth;
        var maximumColumnHeight = canvasHeight - top;

        // correct height if it too mush
        if (height > maximumColumnHeight) {
            height = maximumColumnHeight;
        }

        // move to top if it needed
        if (top + height > canvasHeight) {
            top = canvasHeight - height;
        }

        Object.assign(style, { top: px(top), height: px(height) });
    },

    /**
     * @desc check that the editor is in the correct location, and is showing/hidden appropriately
     * @memberOf CellEditor.prototype
     */
    checkEditor: function() {
        if (this.checkEditorPositionFlag) {
            this.checkEditorPositionFlag = false;
            if (this.event.isCellVisible) {
                setTimeout(function() {
                    this.setEditorValue(this.initialValue, this.lastValue);
                    this.attachEditor();
                    this.moveEditor();
                    this.zoomEditor();
                    this.showEditor();
                    this.takeFocus();
                    if (this.event.check_to_load_full_value) {
                        this.grid.beProgressCursor(["default"], undefined);
                    }
                }.bind(this));
            } else {
                this.hideEditor();
            }
        }
    },

    attachEditor: function() {
        this.grid.div.appendChild(this.el);
    },

    template: '',

    isFormulaMode: false,
    lastInputStartPos: 0,
    lastFormulaSelection: null,
    formulaSelections: [],

    setFormulaMode: function(b) {
        this.isFormulaMode = b;
    },
    setLastInputStartPos(pos) {
        this.lastInputStartPos = pos;
    },
    canStopEditing() {
        return !this.isFormulaMode || this.lastInputStartPos === 0;
    },
    getFormulaSelections() {
        return this.formulaSelections;
    },
    clearFormulaData() {
        this.lastInputStartPos = 0;
        this.isFormulaMode = false;
        this.formulaSelections = [];
    },
    storeLastSelection() {
        if (this.lastFormulaSelection) {
            this.formulaSelections.push(this.lastFormulaSelection);
        }
    },
    clearLastSelection() {
        this.lastFormulaSelection = null;
    },

    updateValueBySelections: function(selections) {
        const oldLastSelection = this.lastFormulaSelection;
        if (this.lastInputStartPos > 0) {
            this.clearLastSelection();

            const schema = this.grid.behavior.schema;
            const selected_cells = [];
            const clamp = (v, a, b) => ((v < a) ? a : (v > b ? b : v));
            for (const selection of selections) {
                const left = clamp(selection.left, 0, schema.length);
                const right = clamp(selection.right, 0, schema.length);
                const top = clamp(selection.top, 0, selection.top);
                const bottom = clamp(selection.bottom, 0, selection.bottom);
        
                if (right - left > 0 || bottom - top > 0) {
                    let colName1 = this.grid.behavior.dataModel.getColumnName(left);
                    let colName2 = this.grid.behavior.dataModel.getColumnName(right);
        
                    try {
                        colName1 = JSON.parse(colName1).columnName;
                        colName2 = JSON.parse(colName2).columnName;
                    }
                    catch(e) {
                        // nothing to do
                    }
                    selected_cells.push(`[${colName1}:${colName2}]`);
                }
                else {
                    let colName1 = this.grid.behavior.dataModel.getColumnName(left);
        
                    try {
                        colName1 = JSON.parse(colName1).columnName;
                    }
                    catch(e) {
                        // nothing to do
                    }
                    selected_cells.push(`[${colName1}]`);
                }

                this.storeLastSelection();
                this.lastFormulaSelection = selection;
            }
        
            console.log('-----------------', selected_cells, this.input.lastChild);

            if (this.lastInputStartPos > 0 && oldLastSelection) {
                this.input.removeChild(this.input.lastChild);
            }
            //const str = this.input.value.substr(0, this.lastInputStartPos);
            // this.setEditorValue(str + selected_cells.join(','));
            if (selected_cells.length > 0) {
                var color = formulaColors[this.getFormulaSelections().length % formulaColors.length];
                this.setEditorValue(this.input.innerHTML + `<span class="colorized" style="color: ${color}">${selected_cells[0]}</span>`);
            }
            this.takeFocus();
            this.setCaretToEnd();
        }
        else {
            // nothing to do
        }
    },

    colorizeInput(keyChar) {
        // if (this.input.lastChild) {
        //     if (keyChar.match(/[a-zA-Z0-9_,.\+\-\*\/]/)) {
        //         if (this.input.lastChild.classList.contains("colorized")) {
        //             this.input.lastChild.innerText = this.input.lastChild.innerText.substring(0, this.input.lastChild.innerText.length-1);
        //             this.input.innerHTML = this.input.innerHTML + `<span>${keyChar}</span>`;

        //             this.setCaretToEnd();
        //         }
        //         else {
        //             // nothing to do
        //         }
        //     }
        // }
    },

    parseAndProcess(keyChar) {
        if (this.input.innerText.startsWith('=')) {
            if (!this.isFormulaMode) {
                this.setFormulaMode(true);
                this.setLastInputStartPos(1);
            }
            else if (/[*,+-]$/.test(this.input.innerText)) {
                this.setLastInputStartPos(this.input.innerText.length);
                this.storeLastSelection();
                this.clearLastSelection();
            }
            else {
                this.setLastInputStartPos(0);
                this.clearLastSelection();
            }

            this.colorizeInput(keyChar);
        }
        else {
            this.setFormulaMode(false);
            this.setLastInputStartPos(0);
            this.clearLastSelection();
        }
    }

});

function nullPattern() {}
function px(n) { return n + 'px'; }


module.exports = CellEditor;
