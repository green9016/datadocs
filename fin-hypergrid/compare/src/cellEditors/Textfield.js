'use strict';

var CellEditor = require('./CellEditor');
var Localization = require('../lib/Localization');

/**
 * As of spring 2016:
 * Functions well in Chrome, Safari, Firefox, and Internet Explorer.
 * @constructor
 * @extends CellEditor
 */
var Textfield = CellEditor.extend('Textfield', {

    template: '<textarea lang="{{locale}}" class="hypergrid-textfield" style="{{style}}">',

    initialize: function initialize() {
        this.input.style.textAlign = this.event.properties.halign;
    },

    localizer: Localization.prototype.string,

    selectAll: function selectAll() {
        this.input.setSelectionRange(0, this.input.value.length);
    }
});

module.exports = Textfield;
