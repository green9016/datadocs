'use strict';

var CellEditor = require('./CellEditor');
var Localization = require('../lib/Localization');


/**
 * As of spring 2016:
 * Functions well in Chrome, Safari, Firefox, and Internet Explorer.
 * @constructor
 * @extends CellEditor
 */
var Bigtext = CellEditor.extend('BigText', {

    template: '<div lang="{{locale}}" class="hypergrid-bigtext" style="{{style}}">',

    initialize: function() {
        this.input.style.textAlign = this.event.properties.halign;
        this.input.style.font = this.event.properties.font;
        this.input.style.position = "absolute";
        this.input.style.fonSize = "12px";
        this.input.style.color = "black";
        this.input.style.boxSizing = "border-box";
        this.input.style.margin = 0;
        this.input.style.paddingRight = "5px";
        this.input.style.paddingLeft = "5px";
        this.input.style.paddingBottom = "2px";
        this.input.style.border = "1px #5292f7 solid";
        this.input.style.outline = 0;
        this.input.style.WebkitBoxShadow = "0 2px 5px rgba(0,0,0,0.4)";
        this.input.style.mozBoxShadow = "0 2px 5px rgba(0,0,0,0.4)";
        this.input.style.boxShadow = "0 2px 5px rgba(0,0,0,0.4)";
        this.input.style.backgroundColor = this.event.properties.backgroundColor;

        this.input.style.overflowX = "auto";
        this.input.style.overflowY = "auto";

        //if (this.event.requires_full_value && this.event.requires_full_value === true){
            //this.input.style.overflowY = "scroll";
        //}

        this.input.style.WebkitUserSelect = "text";
        this.input.style.KhtmlUserSelect = "text";
        this.input.style.MozUserSelect = "text";
        this.input.style.MsUserSelect = "text";
        this.input.style.userSelect = "text";

        this.input.style.cursor = "auto";
        this.input.style.wordWrap = "break-word";
    },

    localizer: Localization.prototype.string,

    selectAll: function() {
        //this.input.setSelectionRange(0, this.input.value.length);
    }
});

module.exports = Bigtext;
