'use strict';

var CellRenderer = require('./CellRenderer');
var Rectangle = require('rectangular').Rectangle;
var images = require('../../images');

var WHITESPACE = /\s\s+/g;

/**
 * @constructor
 * @summary The default cell renderer for a vanilla cell.
 * @desc Great care has been taken in crafting this function as it needs to perform extremely fast.
 *
 * Use `gc.cache` instead which we have implemented to cache the graphics context properties. Reads on the graphics context (`gc`) properties are expensive but not quite as expensive as writes. On read of a `gc.cache` prop, the actual `gc` prop is read into the cache once and from then on only the cache is referenced for that property. On write, the actual prop is only written to when the new value differs from the cached value.
 *
 * Clipping bounds are not set here as this is also an expensive operation. Instead, we employ a number of strategies to truncate overflowing text and content.
 *
 * @extends CellRenderer
 */
var SimpleCell = CellRenderer.extend('SimpleCell', {
    paint: function(gc, config) {
        var val = config.value,
            bounds = config.bounds,
            x = bounds.x,
            y = bounds.y,
            width = bounds.width,
            height = bounds.height,
            iconPadding = config.iconPadding,
            partialRender = config.prefillColor === undefined, // signifies abort before rendering if same
            snapshot = config.snapshot,
            same = snapshot && partialRender,
            valWidth = 0,
            textColor, textFont,
            ixoffset, iyoffset,
            leftIcon, rightIcon, centerIcon,
            leftPadding, rightPadding,
            hover, hoverColor, selectColor, foundationColor, inheritsBackgroundColor,
            c, colors;

        // setting gc properties are expensive, let's not do it needlessly

        /*if (val && val.constructor === Array) {
            leftIcon = val[0];
            rightIcon = val[2];
            val = config.exec(val[1]);
            if (val && val.naturalWidth !== undefined) { // must be an image (much faster than instanceof HTMLImageElement)
                centerIcon = val;
                val = null;
            }
        } else {*/
            leftIcon = images[config.leftIcon];
            centerIcon = images[config.centerIcon];
            rightIcon = images[config.rightIcon];
        //}

        // Note: vf == 0 is fastest equivalent of vf === 0 || vf === false which excludes NaN, null, undefined
        var renderValue = val || config.renderFalsy && val == 0; // eslint-disable-line eqeqeq

        if (renderValue && config.isDataRow) {
            var count = config.grid.behavior.dataModel.getCount(config.dataCell.x, config.dataCell.y);
            if (count !== undefined) {
                config.valuePostfix = '(' + count + ')';
            }
        }

        if (renderValue) {
            val = config.formatValue(val, config);

            if (Array.isArray(val)) {
                val = '[' + val.join(', ') + ']';
            }

            textFont = config.isSelected ? config.foregroundSelectionFont : config.font;

            textColor = gc.cache.strokeStyle = config.isSelected
                ? config.foregroundSelectionColor
                : config.color;
        } else {
            val = '';
        }

        same = same &&
            val === snapshot.value &&
            textFont === snapshot.textFont &&
            textColor === snapshot.textColor;

        // fill background only if our bgColor is populated or we are a selected cell
        colors = [];
        c = 0;
        if (config.isCellHovered && config.hoverCellHighlight.enabled) {
            hoverColor = config.hoverCellHighlight.backgroundColor;
        } else if (config.isRowHovered && (hover = config.hoverRowHighlight).enabled) {
            hoverColor = config.isDataColumn || !hover.header || hover.header.backgroundColor === undefined ? hover.backgroundColor : hover.header.backgroundColor;
        } else if (config.isColumnHovered && (hover = config.hoverColumnHighlight).enabled) {
            hoverColor = config.isDataRow || !hover.header || hover.header.backgroundColor === undefined ? hover.backgroundColor : hover.header.backgroundColor;
        }
        if (gc.alpha(hoverColor) < 1) {
            //if (config.isSelected) {
            //    selectColor = config.backgroundSelectionColor;
            //}
            if (config.isSelected && !config.isFirstSelectedCell && (config.isHeaderRow || !config.isDataColumn)) {
                selectColor = config.backgroundHeaderSelectionColor;
            }

            if (gc.alpha(selectColor) < 1) {
                inheritsBackgroundColor = (config.backgroundColor === config.prefillColor);
                if (!inheritsBackgroundColor) {
                    foundationColor = true;
                    //colors.push(config.backgroundColor);
                    if (config.combineColors) {
                        colors.push(config.backgroundColor);
                    } else {
                        colors = [config.backgroundColor];
                    }
                    same = same &&  foundationColor === snapshot.foundationColor &&
                        config.backgroundColor === snapshot.colors[c++];
                }
            }

            if (selectColor !== undefined) {
                if (config.combineColors) {
                    colors.push(selectColor);
                } else {
                    colors = [selectColor];
                }
                //colors.push(selectColor);
                same = same && selectColor === snapshot.colors[c++];
            }
        }
        if (hoverColor !== undefined) {
            //colors.push(hoverColor);
            if (config.combineColors) {
                colors.push(hoverColor);
            } else {
                colors = [hoverColor];
            }
            same = same && hoverColor === snapshot.colors[c++];
        }

        // todo check if icons have changed
        if (same && c === snapshot.colors.length) {
            return;
        }

        // return a snapshot to save in cellEvent for future comparisons by partial renderer
        config.snapshot = {
            value: val,
            textColor: textColor,
            textFont: textFont,
            foundationColor: foundationColor,
            colors: colors
        };

        layerColors(gc, colors, x, y, width, height, foundationColor);

        // Measure left and right icons, needed for rendering and for return value (min width)
        //leftPadding = leftIcon ? iconPadding + leftIcon.width + iconPadding : config.cellPadding;
        //rightPadding = rightIcon ? iconPadding + rightIcon.width + iconPadding : config.cellPadding;
        leftPadding = leftIcon ? iconPadding + leftIcon.width + iconPadding : config.cellPaddingLeft;
        rightPadding = rightIcon ? iconPadding + rightIcon.width + iconPadding : config.cellPaddingRight;

        if (config.isAggregationTreeColumn) {
            leftPadding += config.treeLevel * config.aggregationGroupTreeLevelOffset;
        }

        var textRightPadding = rightPadding;

        if (config.renderTotalErrorSignNeeded && config.renderTotalErrorCount) {
            var totalErrorsCountIconStartY = y + (height / 2 - config.totalErrorsCountIconHeight / 2) - 2;
            var totalErrorsCountIconStartX = x + (width / 2 - config.totalErrorsCountIconWidth / 2);
            this.renderRoundedTriangleWithText(gc, totalErrorsCountIconStartX, totalErrorsCountIconStartY, config.totalErrorsCountIconHeight, config.totalErrorsCountIconWidth, 2, config.columnWarningIconColor, config.renderTotalErrorCount, config.columnWarningFont, config.columnWarningFontColor);
        }

        if (config.showCellContextMenuIcon && renderValue) {
            let hasNewIcon = false;
            if(renderValue && config.appliedFilterColumn){
                var columns = config.appliedFilterColumn.map(a => a.field)
                if(columns.indexOf(renderValue) > -1){
                    var f = _.find(config.appliedFilterColumn, {field: renderValue})
                    rightIcon = images[f.icon];
                    hasNewIcon = true
                }
            }
            gc.cache.strokeStyle = config.contextMenuButtonStrokeStyle;
            if (config.contextMenuIconIsHovered) {
                gc.cache.fillStyle = config.contextMenuButtonHoveredFillStyle;
            } else {
                gc.cache.fillStyle = config.contextMenuButtonFillStyle;
            }

            var buttonStartY = y + (height / 2 - config.contextMenuButtonHeight / 2);
            var buttonContentWidth = config.contextMenuButtonIconPreferedWidth + 2 * config.contextMenuButtonPadding;

            var buttonStartX = x + width - config.contextMenuButtonRightMargin - buttonContentWidth;

            if(!hasNewIcon){
                this.roundRect(gc, buttonStartX, buttonStartY, buttonContentWidth, config.contextMenuButtonHeight, 1, true);
            }

            var prevFontState = gc.cache.font,
                prevFillStyleState = gc.cache.fillStyle;

            gc.cache.font = config.contextMenuIconFont;

            if (config.contextMenuIconIsHovered) {
                gc.cache.fillStyle = config.contextMenuIconHoveredColor;
            } else {
                gc.cache.fillStyle = config.contextMenuIconColor;
            }

            var configClone = Object.assign({}, config);
            configClone.halign = 'right';

            var iconStartX = x + width - config.contextMenuButtonRightMargin - config.contextMenuButtonPadding - config.contextMenuButtonIconPreferedWidth;
            var iconStartY = buttonStartY + config.contextMenuButtonHeight / 2;

            gc.simpleText(config.contextMenuIconUnicodeChar, iconStartX, iconStartY);

            gc.cache.font = prevFontState;
            gc.cache.fillStyle = prevFillStyleState;

            textRightPadding += buttonContentWidth + config.contextMenuLeftSpaceToCutText;
        }

        if (config.showColumnType && config.colTypeSign) {
            var _prevFontState = gc.cache.font,
                _prevFillStyleState = gc.cache.fillStyle;

            gc.cache.font = config.columnTypeSignFont;
            gc.cache.fillStyle = config.columnTypeSignColor;

            var _configClone = Object.assign({}, config);
            _configClone.halign = 'right';

            textRightPadding += renderSingleLineText(gc, _configClone, config.colTypeSign, leftPadding, textRightPadding);

            gc.cache.font = _prevFontState;
            gc.cache.fillStyle = _prevFillStyleState;
        }

        if (config.valuePrefix && !config.ignoreValuePrefix) {
            var _prevFontState2 = gc.cache.font,
                _prevFillStyleState2 = gc.cache.fillStyle;

            gc.cache.font = config.valuePrefixFont;
            gc.cache.fillStyle = config.valuePrefixColor;

            var oldIgnoreUnderliningState = config.ignoreUnderlining;
            config.ignoreUnderlining = config.prefixIgnoreUnderliningNeeded;
            renderSingleLineText(gc, config, config.valuePrefix, leftPadding, textRightPadding);
            leftPadding += gc.getTextWidth(config.valuePrefix) + config.columnTitlePrefixRightSpace;
            config.ignoreUnderlining = oldIgnoreUnderliningState;

            gc.cache.font = _prevFontState2;
            gc.cache.fillStyle = _prevFillStyleState2;
        }

        if (config.backgroundText) {
            gc.cache.fillStyle = config.backgroundTextColor;
            gc.cache.font = config.backgroundTextFont;

            renderSingleLineText(gc, config, config.backgroundText, leftPadding, textRightPadding);
        }

        if (renderValue) {
            // draw text
            gc.cache.fillStyle = textColor;
            gc.cache.font = textFont;
            //valWidth = config.isHeaderRow && config.headerTextWrapping
            //    ? renderMultiLineText(gc, config, val, leftPadding, rightPadding)
            //    : renderSingleLineText(gc, config, val, leftPadding, rightPadding);
            valWidth = config.isHeaderRow && config.headerTextWrapping ? renderMultiLineText(gc, config, val, leftPadding, textRightPadding) : renderSingleLineText(gc, config, val, leftPadding, textRightPadding);

            if (config.valuePostfix && !config.ignoreValuePostfix) {
                var newLeftPadding = leftPadding + gc.getTextWidth(val) + config.cellValuePostfixLeftOffset;
                var _oldIgnoreUnderliningState = config.ignoreUnderlining;
                config.ignoreUnderlining = true;
                gc.cache.fillStyle = config.cellValuePostfixColor;
                gc.cache.font = config.cellValuePostfixFont;
                valWidth += renderMultiLineText(gc, config, config.valuePostfix, newLeftPadding, textRightPadding);
                config.ignoreUnderlining = _oldIgnoreUnderliningState;
            }
        }

        if (centerIcon) {
            // Measure & draw center icon
            iyoffset = Math.round((height - centerIcon.height) / 2);
            ixoffset = width - Math.round((width - centerIcon.width) / 2) - centerIcon.width;
            gc.drawImage(centerIcon, x + ixoffset, y + iyoffset, centerIcon.width, centerIcon.height); // see [SIZE NOTE]!
            valWidth = iconPadding + centerIcon.width + iconPadding;
            if (config.hotIcon === 'center') {
                config.clickRect = new Rectangle(ixoffset, iyoffset, centerIcon.width, centerIcon.height);
            }
        }


        if (leftIcon) {
            // Draw left icon
            iyoffset = Math.round((height - leftIcon.height) / 2);
            gc.drawImage(leftIcon, x + iconPadding, y + iyoffset, leftIcon.width, leftIcon.height); // see [SIZE NOTE]!
            if (config.hotIcon === 'left') {
                config.clickRect = new Rectangle(iconPadding, iyoffset, leftIcon.width, leftIcon.height);
            }
        }

        if (rightIcon) {
            // Repaint background before painting right icon, because text may have flowed under where it will be.
            // This is a work-around to clipping which is too expensive to perform here.
            ixoffset = width - (rightIcon.width + iconPadding);
            var rightX = x + ixoffset;
            if (inheritsBackgroundColor) {
                foundationColor = true;
                colors.unshift(config.backgroundColor);
            }
            layerColors(gc, colors, rightX, y, rightPadding, height, foundationColor);

            // Draw right icon
            iyoffset = Math.round((height - rightIcon.height) / 2);
            gc.drawImage(rightIcon, rightX, y + iyoffset, rightIcon.width, rightIcon.height); // see [SIZE NOTE]!
            if (config.hotIcon === 'right') {
                config.clickRect =  new Rectangle(ixoffset, iyoffset, rightIcon.width, rightIcon.height);
            }
        }

        if (config.cellBorderThickness) {
            gc.beginPath();
            gc.rect(x, y, width, height);
            gc.cache.lineWidth = config.cellBorderThickness;
            gc.cache.strokeStyle = config.cellBorderStyle;
            gc.stroke();
            gc.closePath();
        }

        //config.minWidth = leftPadding + valWidth + rightPadding;
        if (valWidth) {
            config.minWidth = leftPadding + valWidth + rightPadding;
        }
    }
});

/* [SIZE NOTE] (11/1/2018): Always call `drawImage` with explicit width and height overload.
 * Possible browser bug: Although 3rd and 4th parameters to `drawImage` are optional,
 * when image data derived from SVG source, some browsers (e.g., Chrome 70) implementation
 * of `drawImage` only respects _implicit_ `width` x `height` specified in the root <svg>
 * element `width` & `height` attributes. Otherwise, image is copied into canvas using its
 * `naturalWidth` x `naturalHeight`. That is, _explict_ settings of `width` & `height`
 * (i.e, via property assignment, calling setAttribute, or in `new Image` call) have no
 * effect on `drawImage` in the case of SVGs on these browsers.
 */

/**
 * @summary Renders single line text.
 * @param {CanvasRenderingContext2D} gc
 * @param {object} config
 * @param {Rectangle} config.bounds - The clipping rect of the cell to be rendered.
 * @param {*} val - The text to render in the cell.
 * @memberOf SimpleCell.prototype
 */
function renderMultiLineText(gc, config, val, leftPadding, rightPadding) {
    var x = config.bounds.x,
        y = config.bounds.y,
        width = config.bounds.width,
        height = config.bounds.height,
        cleanVal = (val + '').trim().replace(WHITESPACE, ' '), // trim and squeeze whitespace
        lines = findLines(gc, config, cleanVal.split(' '), width);

    if (lines.length === 1) {
        return renderSingleLineText(gc, config, cleanVal, leftPadding, rightPadding);
    }

    var halignOffset = leftPadding,
        valignOffset = config.voffset,
        halign = config.halign,
        textHeight = gc.getTextHeight(config.font).height;

    switch (halign) {
        case 'right':
            halignOffset = width - rightPadding;
            break;
        case 'center':
            halignOffset = width / 2;
            break;
    }

    var hMin = 0, vMin = Math.ceil(textHeight / 2);

    valignOffset += Math.ceil((height - (lines.length - 1) * textHeight) / 2);

    halignOffset = Math.max(hMin, halignOffset);
    valignOffset = Math.max(vMin, valignOffset);

    gc.cache.save(); // define a clipping region for cell
    gc.beginPath();
    gc.rect(x, y, width, height);
    gc.clip();

    gc.cache.textAlign = halign;
    gc.cache.textBaseline = 'middle';

    for (var i = 0; i < lines.length; i++) {
        gc.simpleText(lines[i], x + halignOffset, y + valignOffset + (i * textHeight));
    }

    gc.cache.restore(); // discard clipping region

    return width;
}

/**
 * @summary Renders single line text.
 * @param {CanvasRenderingContext2D} gc
 * @param {object} config
 * @param {Rectangle} config.bounds - The clipping rect of the cell to be rendered.
 * @param {*} val - The text to render in the cell.
 * @memberOf SimpleCell.prototype
 */
function renderSingleLineText(gc, config, val, leftPadding, rightPadding) {
    var x = config.bounds.x,
        y = config.bounds.y,
        width = config.bounds.width,
        halignOffset = leftPadding,
        halign = config.halign,
        minWidth,
        metrics;
    var linkWithoutPaddingRight = config.link ? rightPadding - 1: 0;

    if (config.columnAutosizing) {
        //metrics = gc.getTextWidthTruncated(val, width - leftPadding, config.truncateTextWithEllipsis);
        //minWidth = metrics.width;
        metrics = gc.getTextWidthTruncated(val, width - leftPadding - rightPadding + linkWithoutPaddingRight, config.truncateTextWithEllipsis, config.highlightedChars);
        minWidth = metrics.width + rightPadding;
        val = metrics.string || val;
        switch (halign) {
            case 'right':
                halignOffset = width - rightPadding - metrics.width;
                break;
            case 'center':
                halignOffset = (width - metrics.width) / 2;
                break;
        }
    } else {
        //metrics = gc.getTextWidthTruncated(val, width - leftPadding, config.truncateTextWithEllipsis, true);
        //minWidth = 0;
        metrics = gc.getTextWidthTruncated(val, width - leftPadding - rightPadding + linkWithoutPaddingRight, config.truncateTextWithEllipsis, config.highlightedChars, true);
        minWidth = 0 + rightPadding;
        if (metrics.string !== undefined) {
            val = metrics.string;
        } else {
            switch (halign) {
                case 'right':
                    halignOffset = width - rightPadding - metrics.width;
                    break;
                case 'center':
                    halignOffset = (width - metrics.width) / 2;
                    break;
            }
        }
    }

    if (val !== null) {
        x += Math.max(leftPadding, halignOffset);
        //y += Math.floor(config.bounds.height / 2);
        y += config.bounds.height / 2;

        if (metrics.highlights.length > 0) {
            var fillStyleOld = gc.cache.fillStyle;
            gc.cache.fillStyle = config.highlightColor;
            metrics.highlights.forEach(function (h) {
                return gc.fillRect(x + h.x, config.bounds.y, h.width, config.bounds.height);
            });
            gc.cache.fillStyle = fillStyleOld;
        }

        if (config.isUserDataArea) {
            //if (config.link) {
            var isAggregationHighlightingNeeded = !config.isGrandTotalRow && config.isAggregationTreeColumn && config.isAggregationRow && config.aggregationChildCount > 0;
            if (config.link || isAggregationHighlightingNeeded && !config.ignoreUnderlining) {
                if (config.isCellHovered || !config.linkOnHover) {
                    if (config.linkColor) {
                        gc.cache.strokeStyle = config.linkColor;
                    }
                    gc.beginPath();
                    underline(config, gc, val, x, y, 1);
                    gc.stroke();
                    gc.closePath();
                }
                if (config.linkColor && (config.isCellHovered || !config.linkColorOnHover)) {
                    gc.cache.fillStyle = config.linkColor;
                }
            }

            if (config.strikeThrough === true) {
                gc.beginPath();
                strikeThrough(config, gc, val, x, y, 1);
                gc.stroke();
                gc.closePath();
            }
        }

        gc.cache.textAlign = 'left';
        gc.cache.textBaseline = 'middle';
        gc.simpleText(val, x, y);
    }

    return minWidth;
}

function findLines(gc, config, words, width) {

    if (words.length === 1) {
        return words;
    }

    // starting with just the first word...
    var stillFits, line = [words.shift()];
    while (
        // so lone as line still fits within current column...
    (stillFits = gc.getTextWidth(line.join(' ')) < width)
    // ...AND there are more words available...
    && words.length
        ) {
        // ...add another word to end of line and retest
        line.push(words.shift());
    }

    if (
        !stillFits // if line is now too long...
        && line.length > 1 // ...AND is multiple words...
    ) {
        words.unshift(line.pop()); // ...back off by (i.e., remove) one word
    }

    line = [line.join(' ')];

    if (words.length) { // if there's anything left...
        line = line.concat(findLines(gc, config, words, width)); // ...break it up as well
    }

    return line;
}

function strikeThrough(config, gc, text, x, y, thickness) {
    var textWidth = gc.getTextWidth(text);

    switch (gc.cache.textAlign) {
        case 'center':
            x -= textWidth / 2;
            break;
        case 'right':
            x -= textWidth;
            break;
    }

    //y = Math.round(y) + 0.5;
    y = Math.round(y + 0.5) - 0.5;

    gc.cache.lineWidth = thickness;
    gc.moveTo(x - 1, y);
    gc.lineTo(x + textWidth + 1, y);
}

function underline(config, gc, text, x, y, thickness) {
    var textHeight = gc.getTextHeight(config.font).height,
        textWidth = gc.getTextWidth(text);

    switch (gc.cache.textAlign) {
        case 'center':
            x -= textWidth / 2;
            break;
        case 'right':
            x -= textWidth;
            break;
    }

    //y = Math.ceil(y) + Math.round(textHeight / 2) - 0.5;
    y = Math.round(y + textHeight / 2) - 0.5;

    //gc.beginPath();
    if (thickness) {
        gc.lineWidth = thickness;
    }
    gc.cache.lineWidth = thickness;
    gc.moveTo(x, y);
    gc.lineTo(x + textWidth, y);
}

function layerColors(gc, colors, x, y, width, height, foundationColor) {
    for (var i = 0; i < colors.length; i++) {
        if (foundationColor && !i) {
            gc.clearFill(x, y, width, height, colors[i]);
        } else {
            gc.cache.fillStyle = colors[i];
            gc.fillRect(x, y, width, height);
        }
    }
}

module.exports = SimpleCell;
