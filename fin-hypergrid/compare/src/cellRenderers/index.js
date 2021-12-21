'use strict';

var Registry = require('../lib/Registry');

var warnedBaseClass;

/**
 * @classdesc Registry of cell renderer singletons.
 * @constructor
 */
var CellRenderers = Registry.extend('CellRenderers', {

    BaseClass: require('./CellRenderer'), // abstract base class

    initialize: function initialize() {
        // preregister the standard cell renderers
        this.add(require('./Button'));
        this.add(require('./SimpleCell'));
        this.add(require('./SliderCell'));
        this.add(require('./SparkBar'));
        this.add(require('./LastSelection'));
        this.add(require('./SparkLine'));
        this.add(require('./ErrorCell'));
        this.add(require('./TreeCell'));
    },

    // for better performance, instantiate at add time rather than render time.
    add: function add(name, Constructor) {
        Constructor = Registry.prototype.add.call(this, name, Constructor);

        if (Constructor) {
            this[Constructor.getClassName()] = new Constructor();
        }
    },

    get: function get(name) {
        if (name && name.toLowerCase() === 'emptycell') {
            if (!warnedBaseClass) {
                console.warn('grid.cellRenderers.get("' + name + '").constructor has been deprecated as of v2.1.0 in favor of grid.cellRenderers.BaseClass property. (Will be removed in a future release.)');
                warnedBaseClass = true;
            }
            this.BaseClass.constructor = this.BaseClass;
            return this.BaseClass;
        }
        return Registry.prototype.get.call(this, name);
    }

});

module.exports = new CellRenderers();
