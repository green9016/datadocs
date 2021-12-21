'use strict';

/* eslint-disable */

/* eslint-env node, browser */

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var orientationHashes = require('./orientationHashes');

/**
 *
 * @param finBar
 * @type {FinBar}
 * @constructor
 */

var FinBarTouch = function () {
    function FinBarTouch(finBar) {
        _classCallCheck(this, FinBarTouch);

        this.finBar = finBar;

        /**
         * @summary flag to detect is mouse was continuously clicked over scrollbar (not thumb)
         * @type {boolean}
         * @memberOf FinBarTouch.prototype
         */
        this.isTouchHoldOverBar = false;

        /**
         * @summary flag to detect is user touch starts over container (used to smooth scroll on mobile devices)
         * @type {boolean}
         * @memberOf FinBarTouch.prototype
         */
        this.isTouchHoldOverContainer = false;

        /**
         * @summary contains last detected position of user touch
         * @type {number|null}
         * @memberOf FinBarTouch.prototype
         */
        this.containerLastTouchPos = null;

        /**
         * @summary contains last detected user touch time (timestamp)
         * @type {number|null}
         * @memberOf FinBarTouch.prototype
         */
        this.containerLastTouchTime = null;

        /**
         * @summary contains current user touch move velocity
         * @type {number}
         * @memberOf FinBarTouch.prototype
         */
        this.containerTouchVelocity = 0;

        // /**
        //  * @summary contains current user touch move velocity limit
        //  * @description use this variable for tuning kinetic scroll speed
        //  * @type {number}
        //  * @memberOf FinBarTouch.prototype
        //  */
        // this.containerTouchVelocityMax = 20000;

        // /**
        //  * @deprecated use containerTouchVelocityModifier from hashed instead
        //  * @summary multiplier for start scroll speed calculation
        //  * @description use this variable for tuning kinetic scroll speed
        //  * @type {number}
        //  * @memberOf FinBarTouch.prototype
        //  */
        // this.containerTouchVelocityModifier = 4.2;

        /**
         * @summary contains current user touch move amplitude
         * @type {number}
         * @memberOf FinBarTouch.prototype
         */
        this.containerTouchAmplitude = 0;

        /**
         * @summary contains current smooth touch scroll interval. Used to smoothly scroll content
         * @type {number}
         * @memberOf FinBarTouch.prototype
         */
        this.containerTouchScrollInterval = 0;

        /**
         * @summary contains current user touch move offset
         * @type {number}
         * @memberOf FinBarTouch.prototype
         */
        this.containerTouchScrollOffset = null;

        /**
         * @summary contains current user touch move target. Used to detect end position of smooth scroll
         * @type {number}
         * @memberOf FinBarTouch.prototype
         */
        this.containerTouchScrollTarget = null;

        this.isLastTouchOverBar = null;

        /**
         * @summary interval which used when mouse hold scroll performed
         * @desc table will be scrolled on one full page with this interval until mouse hold ends
         * @type {number}
         * @memberOf FinBarTouch.prototype
         */
        this.mouseHoldPerformIntervalRate = 50;

        /**
         * @private
         * @summary utility field that contains mouseHold processing interval id
         * @type {number}
         * @memberOf FinBarTouch.prototype
         */
        this.mouseHoldPerformInterval = 0;

        this.mouseHoldPerformIntervalCurrentCoordsObj = null;

        /**
         * @private
         * @summary utility field that contains timeout id, which used when moseHold processing starts
         * @type {number}
         * @memberOf FinBarTouch.prototype
         */
        this.mouseHoldPerformTimeout = 0;

        /**
         * @private
         * @summary flag to detect that user clicked over thumb, and scroll need to be performed exactly to that point
         * @type {boolean}
         * @memberOf FinBarTouch.prototype
         */
        this.isThumbDragging = true;

        /**
         * @private
         * @summary flag to detect that user start touch move over thumb, and scroll need to be placed based on mouse position
         * @type {boolean}
         * @memberOf FinBarTouch.prototype
         */
        this.isThumbTouchDragging = false;

        /**
         * @readonly
         * @name paging
         * @summary Enable page up/dn clicks.
         * @desc Set by the constructor. See the similarly named property in the {@link finbarOptions} object.
         *
         * If truthy, listen for clicks in page-up and page-down regions of scrollbar.
         *
         * If an object, call `.paging.up()` on page-up clicks and `.paging.down()` will be called on page-down clicks.
         *
         * Changing the truthiness of this value after instantiation currently has no effect.
         * @type {boolean|object}
         * @memberOf FinBarTouch.prototype
         */
        this.paging = true;
    }

    /**
     * @private
     * @summary utility method to unify logic when user stops holding mouse on empty scroll bar space
     * @return {void}
     * @memberOf FinBarTouch.prototype
     */


    _createClass(FinBarTouch, [{
        key: 'performMouseHoldOverBarEnd',
        value: function performMouseHoldOverBarEnd() {
            this.isTouchHoldOverBar = false;
            this.mouseHoldPerformIntervalCurrentCoordsObj = null;
            if (this.mouseHoldPerformInterval) {
                clearInterval(this.mouseHoldPerformInterval);
                this.mouseHoldPerformInterval = 0;
            }

            this.clearMouseHoldTimeout();
        }

        /**
         * @private
         * @summary utility method to perform clearing of an mouseHold timeout,
         * if user stops holding mouse before timeout function fork
         * @return {void}
         * @memberOf FinBarTouch.prototype
         */

    }, {
        key: 'clearMouseHoldTimeout',
        value: function clearMouseHoldTimeout() {
            if (this.mouseHoldPerformTimeout) {
                clearTimeout(this.mouseHoldPerformTimeout);
                this.mouseHoldPerformTimeout = 0;
            }
        }
    }, {
        key: '_addEvt',
        value: function _addEvt(evtName) {
            var spy = this.testPanelItem && this.testPanelItem[evtName];
            if (spy) {
                spy.classList.add('listening');
            }
            window.addEventListener(evtName, this['on' + evtName]);
        }
    }, {
        key: '_removeEvt',
        value: function _removeEvt(evtName) {
            var spy = this.testPanelItem && this.testPanelItem[evtName];
            if (spy) {
                spy.classList.remove('listening');
            }
            window.removeEventListener(evtName, this['on' + evtName]);
        }
    }, {
        key: 'shortStop',
        value: function shortStop(evt) {
            evt.stopPropagation();
        }
    }, {
        key: 'onwheel',
        value: function onwheel(evt) {
            var key = this.deltaProp;
            // swap coordinates if shift key pressed
            if (evt.shiftKey) {
                key = orientationHashes[key === orientationHashes.horizontal.delta ? 'vertical' : 'horizontal'].delta;
            }
            //this.index += evt[key];
            this.index += evt[key] * this.finBar[this.deltaProp + 'Factor'] * this.finBar.normal;
            evt.stopPropagation();
            evt.preventDefault();
        }
    }, {
        key: 'onclick',
        value: function onclick(evt) {
            this.thumb.addEventListener('transitionend', function waitForIt() {
                this.removeEventListener('transitionend', waitForIt);
                this.onmouseup(evt);
            }.bind(this));

            evt.stopPropagation();
        }
    }, {
        key: 'onmouseout',
        value: function onmouseout(evt) {
            this.performMouseHoldOverBarEnd();
        }
    }, {
        key: 'onmousedown',
        value: function onmousedown(evt) {
            var thumbBox = this.thumb.getBoundingClientRect();
            this.pinOffset = evt[this.oh.axis] - thumbBox[this.oh.leading] + this.bar.getBoundingClientRect()[this.oh.leading] + this.thumbMarginLeading;
            document.documentElement.style.cursor = 'default';

            this._addEvt('mousemove');
            this._addEvt('mouseup');

            this._performCursorDown(evt);

            evt.stopPropagation();
            evt.preventDefault();
        }
    }, {
        key: 'onbartouchstart',
        value: function onbartouchstart(evt) {
            var thumbBox = this.thumb.getBoundingClientRect();
            this.pinOffset = evt.touches[0][this.oh.coordinate] - thumbBox[this.oh.leading] + this.bar.getBoundingClientRect()[this.oh.leading] + this.thumbMarginLeading;
            document.documentElement.style.cursor = 'default';

            this._addEvt('touchend');
            this._addEvt('touchmove');

            this._performCursorDown(evt.touches[0]);
            this.isLastTouchOverBar = true;

            evt.stopPropagation();
            evt.preventDefault();
        }
    }, {
        key: '_performCursorDown',
        value: function _performCursorDown(coordsObject) {
            var _this = this;

            var thumbBox = this.thumb.getBoundingClientRect();
            var mouseOverThumb = thumbBox.left <= coordsObject.clientX && coordsObject.clientX <= thumbBox.right && thumbBox.top <= coordsObject.clientY && coordsObject.clientY <= thumbBox.bottom,
                mouseOverThumbCenter = false,
                goingUp = false,
                incrementValue = 0;

            if (!mouseOverThumb) {
                goingUp = coordsObject[this.oh.coordinate] < thumbBox[this.oh.leading];

                if (_typeof(this.paging) === 'object') {
                    this.index = this.paging[goingUp ? 'up' : 'down'](Math.round(this.index));
                } else {
                    //this.index += goingUp ? -this.increment : this.increment;
                    var idx = 0;
                    var _bar = this.bar.getBoundingClientRect();
                    var _coordinate = coordsObject[this.oh.coordinate];
                    if (this.oh.coordinate == "clientX"){
                        _coordinate -= _bar.x;
                        idx = Math.floor(_coordinate * this.max / _bar.width);
                    }else{
                        _coordinate -= _bar.y;
                        idx = Math.floor(_coordinate * this.max / _bar.height);
                    }
                    this.index = idx;
                    /*var _thumbCenterLeadingSide = thumbBox[this.oh.leading] + thumbBox[this.oh.size] / 3;
                    var _thumbCenterTrailingSide = thumbBox[this.oh.trailing] - thumbBox[this.oh.size] / 3;

                    incrementValue = goingUp ? - this.increment : this.increment;

                    if (goingUp && coordsObject[this.oh.coordinate] <= _thumbCenterLeadingSide && this.index + incrementValue <= 0) {
                        this.index = 0;
                    } else {
                        this.index += incrementValue;
                    }*/

                }

                this.clearMouseHoldTimeout();
                this.mouseHoldPerformTimeout = setTimeout(function () {
                    _this.isTouchHoldOverBar = true;
                    _this.isThumbDragging = false;

                    _this.mouseHoldPerformIntervalCurrentCoordsObj = coordsObject;

                    _this.mouseHoldPerformInterval = setInterval(function () {
                        var co = _this.mouseHoldPerformIntervalCurrentCoordsObj;
                        thumbBox = _this.thumb.getBoundingClientRect();
                        mouseOverThumb = thumbBox.left <= co.clientX && co.clientX <= thumbBox.right && thumbBox.top <= co.clientY && co.clientY <= thumbBox.bottom;

                        var thumbCenterLeadingSide = thumbBox[_this.oh.leading] + thumbBox[_this.oh.size] / 3;
                        var thumbCenterTrailingSide = thumbBox[_this.oh.trailing] - thumbBox[_this.oh.size] / 3;
                        mouseOverThumbCenter = mouseOverThumb && thumbCenterLeadingSide <= co[_this.oh.coordinate] && thumbCenterTrailingSide >= co[_this.oh.coordinate];

                        // goingUp value changed only if thumb not in cursor yet.
                        // Otherwise we can think, that scroll continuous and goingUp don't need to be changed
                        if (!mouseOverThumb) {
                            goingUp = co[_this.oh.coordinate] < thumbBox[_this.oh.leading];
                        }

                        incrementValue = goingUp ? -_this.increment : _this.increment;

                        if (_this.isTouchHoldOverBar && !mouseOverThumbCenter) {
                            if (goingUp && co[_this.oh.coordinate] <= thumbCenterLeadingSide && _this.index + incrementValue <= 0) {
                                _this.index = 0;
                            } else {
                                _this.index += incrementValue;
                            }
                        }

                        if (_this.isTouchHoldOverBar && mouseOverThumbCenter) {
                            _this.performMouseHoldOverBarEnd();
                        }
                    }, _this.mouseHoldPerformIntervalRate);
                }, 200);
            } else if (!this.isTouchHoldOverBar) {
                this.isThumbDragging = true;
            }
        }
    }, {
        key: 'onmousemove',
        value: function onmousemove(evt) {
            if (this.isThumbDragging) {
                var scaled = Math.min(this.thumbMax, Math.max(0, evt[this.oh.axis] - this.pinOffset));
                var idx = scaled / this.thumbMax * (this.max - this.min) + this.min;

                this._setScroll(idx, scaled);
            }

            if (this.isTouchHoldOverBar) {
                this.mouseHoldPerformIntervalCurrentCoordsObj = evt;
            }

            evt.stopPropagation();
            evt.preventDefault();
        }
    }, {
        key: 'onmouseup',
        value: function onmouseup(evt) {
            this.performMouseHoldOverBarEnd();
            this.isThumbDragging = false;

            this._removeEvt('mousemove');
            this._removeEvt('mouseup');

            document.documentElement.style.cursor = 'auto';

            evt.stopPropagation();
            evt.preventDefault();
        }
    }, {
        key: 'trackTouchScroll',
        value: function trackTouchScroll() {
            var currentTimestamp = Date.now();
            var elapsed = currentTimestamp - this.containerLastTouchTime;
            this.containerLastTouchTime = currentTimestamp;
            var delta = this.containerTouchScrollOffset - this._touchScrollFrame;
            this._touchScrollFrame = this.containerTouchScrollOffset;
            var v = 1000 * delta / (1 + elapsed);
            this.containerTouchVelocity = this.oh.containerTouchVelocityModifier * v + 0.2 * this.containerTouchVelocity;
            // correct velocity with max value
            if (this.containerTouchVelocity < -this.oh.containerTouchVelocityMax) {
                this.containerTouchVelocity = -this.oh.containerTouchVelocityMax;
            }
            if (this.containerTouchVelocity > this.oh.containerTouchVelocityMax) {
                this.containerTouchVelocity = this.oh.containerTouchVelocityMax;
            }
        }
    }, {
        key: 'ontouchstart',
        value: function ontouchstart(evt) {
            this.isTouchHoldOverContainer = true;
            this.isThumbTouchDragging = false;
            this.containerLastTouchPos = evt.touches[0][this.oh.coordinate];
            this.containerLastTouchTime = Date.now();

            this._touchScrollFrame = this.containerTouchScrollOffset;
            this.containerTouchVelocity = this.containerTouchAmplitude = 0;

            this.isLastTouchOverBar = false;
            this.containerTouchScrollOffset = this.index;
            this.containerTouchScrollInterval = setInterval(this.trackTouchScroll, 100);

            evt.preventDefault();
            evt.stopPropagation();
        }
    }, {
        key: 'getPos',
        value: function getPos(e) {
            // touch event
            if (e.targetTouches && e.targetTouches.length >= 1) {
                return e.targetTouches[0][this.oh.coordinate];
            }
            if (e.touches && e.touches.length >= 1) {
                return e.touches[0][this.oh.coordinate];
            }

            // mouse event
            return e[this.oh.coordinate];
        }
    }, {
        key: 'onthumbtouchstart',
        value: function onthumbtouchstart(evt) {
            var thumbBox = this.thumb.getBoundingClientRect();
            var currentMovePos = this.getPos(evt);
            this.pinOffset = currentMovePos - thumbBox[this.oh.leading] + this.bar.getBoundingClientRect()[this.oh.leading] + this.thumbMarginLeading;

            this.isThumbTouchDragging = true;
            this.containerLastTouchPos = null;

            this._addEvt('touchend');
            this._addEvt('touchmove');

            evt.stopPropagation();
            evt.preventDefault();
        }
    }, {
        key: 'ontouchend',
        value: function ontouchend(evt) {
            if (this.isTouchHoldOverContainer) {
                this.isTouchHoldOverContainer = false;
                clearInterval(this.containerTouchScrollInterval);
                this.trackTouchScroll();
                if (this.containerTouchVelocity > 10 || this.containerTouchVelocity < -10) {
                    this.containerTouchAmplitude = 0.8 * this.containerTouchVelocity;
                    this.containerTouchScrollTarget = Math.round(this.containerTouchScrollOffset + this.containerTouchAmplitude);
                    this.containerLastTouchTime = Date.now();
                    requestAnimationFrame(this._performTouchAutoScroll);
                }
            }

            this.isThumbTouchDragging = false;
            this.isTouchHoldOverContainer = false;
            this.containerLastTouchPos = null;

            this.performMouseHoldOverBarEnd();

            this._removeEvt('touchend');
            this._removeEvt('touchmove');

            evt.stopPropagation();
            evt.preventDefault();
        }
    }, {
        key: '_performTouchAutoScroll',
        value: function _performTouchAutoScroll() {
            if (this.containerTouchAmplitude) {
                var elapsed = Date.now() - this.containerLastTouchTime;
                var delta = -this.containerTouchAmplitude * Math.exp(-elapsed / 325);
                if (delta > 0.5 || delta < -0.5) {
                    this._performTouchScroll(this.containerTouchScrollTarget + delta);
                    requestAnimationFrame(this._performTouchAutoScroll);
                } else {
                    this._performTouchScroll(this.containerTouchScrollTarget);
                }
            }
        }
    }, {
        key: '_performTouchScroll',
        value: function _performTouchScroll(y) {
            var newOffset = y > this.max ? this.max : y < this.min ? this.min : y;
            if (newOffset !== this.containerTouchScrollOffset) {
                this.containerTouchScrollOffset = newOffset;
                this._setScroll(this.containerTouchScrollOffset);
            }
        }
    }, {
        key: 'ontouchmove',
        value: function ontouchmove(evt) {
            if (this.isThumbTouchDragging) {
                var currentMovePos = this.getPos(evt);

                var scaled = Math.min(this.thumbMax, Math.max(0, currentMovePos - this.pinOffset));
                var idx = scaled / this.thumbMax * (this.max - this.min) + this.min;

                this._setScroll(idx, scaled);
            } else if (this.isTouchHoldOverContainer) {
                var pos = this.getPos(evt);
                var delta = this.containerLastTouchPos - pos;
                delta = delta * this.oh.touchToScrollPixelsCoefficient;
                if (delta > 2 * this.oh.touchToScrollPixelsCoefficient || delta < -2 * this.oh.touchToScrollPixelsCoefficient) {
                    this.containerLastTouchPos = pos;
                    this._performTouchScroll(this.containerTouchScrollOffset + delta);
                }
            } else if (this.isLastTouchOverBar) {
                var boundsBox = this.bar.getBoundingClientRect();
                var touchOverBar = boundsBox.left <= evt.touches[0].clientX && evt.touches[0].clientX <= boundsBox.right && boundsBox.top <= evt.touches[0].clientY && evt.touches[0].clientY <= boundsBox.bottom;

                if (!touchOverBar) {
                    this.performMouseHoldOverBarEnd();
                }
            }

            if (this.mouseHoldPerformIntervalCurrentCoordsObj) {
                this.mouseHoldPerformIntervalCurrentCoordsObj = evt.touches[0];
            }

            evt.stopPropagation();
            evt.preventDefault();
        }
    }, {
        key: '_setScroll',
        value: function _setScroll(idx, scaled) {
            this.finBar._setScroll(idx, scaled);
        }
    }, {
        key: 'min',
        get: function get() {
            return this.finBar.min;
        }
    }, {
        key: 'max',
        get: function get() {
            return this.finBar.max;
        }
    }, {
        key: 'bar',
        get: function get() {
            return this.finBar.bar;
        }
    }, {
        key: 'thumb',
        get: function get() {
            return this.finBar.thumb;
        }
    }, {
        key: 'thumbMax',
        get: function get() {
            return this.finBar.thumbMax;
        }
    }, {
        key: 'oh',
        get: function get() {
            return this.finBar.oh;
        }
    }, {
        key: 'deltaProp',
        get: function get() {
            return this.finBar.deltaProp;
        }
    }, {
        key: 'thumbMarginLeading',
        get: function get() {
            return this.finBar.thumbMarginLeading;
        }
    }, {
        key: 'testPanelItem',
        get: function get() {
            return this.finBar.testPanelItem;
        }
    }, {
        key: 'index',
        set: function set(val) {
            this.finBar.index = val;
        },
        get: function get() {
            return this.finBar.index;
        }
    }, {
        key: 'increment',
        get: function get() {
            return this.finBar.increment;
        }
    }]);

    return FinBarTouch;
}();

// Interface


module.exports = FinBarTouch;
