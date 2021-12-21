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

    // template: '<textarea lang="{{locale}}" class="hypergrid-textfield" style="{{style}}">',//'<input type="text" lang="{{locale}}" class="hypergrid-textfield" style="{{style}}">',
    template: '<div lang="{{locale}}" class="hypergrid-textfield" style="{{style}}" contenteditable="true"></div>',//'<input type="text" lang="{{locale}}" class="hypergrid-textfield" style="{{style}}">',

    initialize: function() {
        this.input.style.textAlign = this.event.isRowFixed ? "left" : this.event.properties.halign;
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
        this.input.style.overflow = "auto";
        this.input.style.cursor = "text";
        this.input.style.background = "rgb(255,255,255)";
    },

    localizer: Localization.prototype.string,

    selectAll: function() {
        // this.input.setSelectionRange(0, this.input.value.length);
        var sel, range;
        if (window.getSelection && document.createRange) {
            range = document.createRange();
            range.selectNodeContents(this.el);
            sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        } else if (document.body.createTextRange) {
            range = document.body.createTextRange();
            range.moveToElementText(this.el);
            range.select();
        }
    },

    setCaretToEnd: function() {
        var sel, range;
        if(window.getSelection &&  document.createRange) { //Firefox, Chrome, Opera, Safari, IE 9+
            range = document.createRange();     //Create a range (a range is a like the selection but invisible)
            range.selectNodeContents(this.el);  //Select the entire contents of the element with the range
            range.collapse(false);              //collapse the range to the end point. false means collapse to end rather than the start
            sel = window.getSelection();        //get the selection object (allows you to change selection)
            sel.removeAllRanges();              //remove any selections already made
            sel.addRange(range);                //make the range you have just created the visible selection
        }
        else if(document.body.createTextRange) {            //IE 8 and lower
            range = document.body.createTextRange();        //Create a range (a range is a like the selection but invisible)
            range.moveToElementText(this.el);               //Select the entire contents of the element with the range
            range.collapse(false);                          //collapse the range to the end point. false means collapse to end rather than the start
            range.select();                                 //Select the range (make it the visible selection
        }
    }
});

module.exports = Textfield;
