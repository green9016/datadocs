/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

export function treeLineRendererPaint(gc, config) {
    var x = config.bounds.x;
    var y = config.bounds.y;
    var width = config.bounds.width;
    var height = config.bounds.height;

    config.minWidth = 1;
    if (config.value === null || config.value == undefined) {
        return;
    }

    if (config.value.rowPath == undefined){
        return;
    }
    var value = config.value.rollup;
    var leaf = config.value.isLeaf;
    var depth = config.value.rowPath.length - 1;
    var max_depth = config.value.max_depth;
    var parent = config.expanded;
    var lastChild = config.last;
    var outside_of_tree = config.value.outside_of_tree ? config.value.outside_of_tree : false;
    var contains_out_of_tree = config.value.contains_out_of_tree ? config.value.contains_out_of_tree: false;
    var always_expand = config.value.always_expand ? config.value.always_expand: false;
    var contains_quick_icon = config.value.contains_quick_icon ? config.value.contains_quick_icon: false;
    const is_sort = config.value.is_sort ? config.value.is_sort: false;
    const sort_order = config.value.sort_order ? config.value.sort_order: undefined;
    const nb_sort = config.value.nb_sort ? config.value.nb_sort: undefined;
    const is_filter = config.value.is_filter ? config.value.is_filter: false;
    if (value === undefined){
        return;
    }
    var backgroundColor = config.backgroundColor;
    /*if (config.isSelected) {
        backgroundColor = config.backgroundSelectionColor;
    }*/
    if (config.isRowHovered && config.hoverRowHighlight.enabled && !config.isCellHovered) {
        backgroundColor = config.hoverRowHighlight.backgroundColor;
    } else if (config.isCellHovered && config.hoverCellHighlight.enabled) {
        backgroundColor = config.hoverCellHighlight.backgroundColor;
    }

    gc.save();
    gc.cache.fillStyle = backgroundColor;
    gc.rect(x, y, width, height);
    gc.fillRect(x, y, width, height);

    var fgColor = config.isSelected ? config.foregroundSelectionColor : config.color;
    gc.cache.strokeStyle = fgColor;
    gc.cache.fillStyle = fgColor;
    var xOffset = x;
    var lineNodeSpace = 16;
    var nodeRadius = 3;

    // Draw vertical line
    gc.globalAlpha = 1.0;//0.3;
    gc.strokeStyle = fgColor;

    gc.beginPath();
    xOffset += config.cellPaddingLeft;
    var iconWidth = 3;
    var iconHeight = 3;
    var iconPaddingRight = 5;

    for (var i = 1; i <= depth; i++) {
        xOffset += lineNodeSpace;
    }

    // Draw node circle
    if (!leaf && !always_expand) {
        if (parent && !contains_out_of_tree) {
            //var topPointX = xOffset + iconWidth;
            //var topPointY = y + height / 2 + iconHeight;
            //gc.moveTo(topPointX, y + height / 2 + iconHeight / 2);
            //gc.lineTo(topPointX - iconWidth, topPointY - iconWidth * 2);
            //gc.lineTo(topPointX + iconHeight, topPointY - iconHeight * 2);

            // Down Arrow
            //drawArrowhead(gc, {"x": xOffset, "y": y + (height / 2)}, {"x": xOffset + 3, "y": (height / 2) + 3}, 0.5);

            var img_down = document.getElementById("triangle_down");
            gc.drawImage(img_down, xOffset, y + 3);

        }else{
            //var topPointX = xOffset + iconWidth + iconWidth/2;
            //var topPointY = y + height / 2;
            //gc.moveTo(topPointX, y + height / 2);
            //gc.lineTo(topPointX - iconWidth * 1.5, topPointY - iconHeight);
            //gc.lineTo(topPointX - iconWidth * 1.5, topPointY + iconHeight);

            // Right Arrow
            //drawArrowhead(gc, {"x": xOffset, "y": y + (height / 2)}, {"x": xOffset + 3, "y": (height / 2) + 3}, 0.5);

            var img_right = document.getElementById("triangle_right");
            gc.drawImage(img_right, xOffset, y + 5);
        }

        if (config.isCellHovered) {
            //gc.globalAlpha = 0.45;
            gc.fill();
            //gc.globalAlpha = 0.3;
        }
    } else {
        if (contains_quick_icon === true){
          //const img_quick_icon = document.getElementById("quick_down_icon");
          //gc.drawImage(img_quick_icon, x + width - 20, y + 1);

          let qfs_icon;
          if (is_sort === true && is_filter === true){
            if (sort_order === "asc"){
              qfs_icon = document.getElementById("qfs_filter_and_sort_asc");
            }else if(sort_order === "desc"){
              qfs_icon = document.getElementById("qfs_filter_and_sort_desc");
            }else{
              qfs_icon = document.getElementById("qfs_filter");
            }
          }else if(is_filter === true){
            qfs_icon = document.getElementById("qfs_filter");
          }else if(is_sort === true){
            if (sort_order === "asc"){
              qfs_icon = document.getElementById("qfs_sort_asc");
            }else if(sort_order === "desc"){
              qfs_icon = document.getElementById("qfs_sort_desc");
            }
          }

          if (!qfs_icon){
            qfs_icon = document.getElementById("quick_down_icon");
          }

          gc.drawImage(qfs_icon, x + width - 20, y + 1);

          if (nb_sort && nb_sort > 0){
            gc.moveTo(x + width - 20 - 10, y + (height / 2) + 1);
            gc.fillText(nb_sort, x + width - 20 - 10, y + (height / 2) + 1);
          }

        }
        gc.moveTo(xOffset, y + height / 2);
    }

    if (!leaf && !always_expand) {
        //gc.globalAlpha = 0.8;
        gc.fill();
        gc.moveTo(xOffset + lineNodeSpace, y + height);
        //gc.globalAlpha = 0.3;
    }

    gc.stroke();
    gc.closePath();

    // render message text

    gc.globalAlpha = 1.0;
    gc.fillStyle = config.isSelected ? config.foregroundSelectionColor : config.color;
    gc.textAlign = "start";
    gc.textBaseline = "middle";
    gc.font = config.isSelected ? config.foregroundSelectionFont : config.treeHeaderFont;
    var cellTextOffset = (!leaf && !always_expand) ? xOffset + 3: xOffset;
    if (!leaf) {
        //value = "[\"" + value + "\"]";
        if (!always_expand){
            gc.font = config.treeHeaderFontNotLeaf;
            cellTextOffset += iconWidth + iconPaddingRight;
        }else{
            // Make it bold when it contains a child but it's not really a tree node.
            gc.font = config.treeHeaderFontNotLeaf;
        }
    }else if(depth !== max_depth && !outside_of_tree){
        gc.font = config.treeHeaderFontNotLeaf;
    }
    let formatted_value = config.formatValue(value, config._type);
    //config.minWidth = cellTextOffset + gc.getTextWidth(formatted_value) + config.cellPaddingLeft + config.cellPaddingRight;
    //config.minWidth = Math.min(config.minWidth, config.maximumColumnWidth);
    var metrics;
    if (contains_quick_icon === true || nb_sort && nb_sort > 0){
      const quick_icon_width = 20;
      let nb_sort_width = 0;

      if (nb_sort && nb_sort > 0){
        if (nb_sort < 10){
          nb_sort_width = 7;
        }else if(nb_sort < 100){
          nb_sort_width = 13;
        }else{
          nb_sort_width = 19;
        }
      }

      let remaining_width = width - cellTextOffset + (x-4) - config.cellPaddingRight;
      if (nb_sort && nb_sort > 0){
        let nb_metrics = gc.get_tree_text_width_truncated(nb_sort, "", remaining_width);
      }
      remaining_width -= quick_icon_width + nb_sort_width; // Number of sort and quick icon's width

      metrics = gc.get_tree_text_width_truncated(formatted_value, nb_sort, remaining_width, config.truncateTextWithEllipsis, config.highlightedChars);
    }else{
      metrics = gc.getTextWidthTruncated(formatted_value, width - cellTextOffset + (x-4) - config.cellPaddingRight, config.truncateTextWithEllipsis, config.highlightedChars);
    }
    var yOffset = y + height / 2;
    gc.fillText((metrics.string !== undefined && metrics.string !== null) ? metrics.string : formatted_value, cellTextOffset, yOffset);
    gc.restore();
}

/**
 * Draw an arrowhead on a line on an HTML5 canvas.
 *
 * @param context The drawing context on which to put the arrowhead.
 * @param from A point, specified as an object with 'x' and 'y' properties, where the arrow starts
 *             (not the arrowhead, the arrow itself).
 * @param to   A point, specified as an object with 'x' and 'y' properties, where the arrow ends
 *             (not the arrowhead, the arrow itself).
 * @param radius The radius of the arrowhead. This controls how "thick" the arrowhead looks.
 */
export function drawArrowhead(context, from, to, radius) {
	var x_center = to.x;
	var y_center = to.y;

	var angle;
	var x;
	var y;

	context.beginPath();

	angle = Math.atan2(to.y - from.y, to.x - from.x)
	x = radius * Math.cos(angle) + x_center;
	y = radius * Math.sin(angle) + y_center;

	context.moveTo(x, y);

	angle += (1.0/3.0) * (2 * Math.PI)
	x = radius * Math.cos(angle) + x_center;
	y = radius * Math.sin(angle) + y_center;

	context.lineTo(x, y);

	angle += (1.0/3.0) * (2 * Math.PI)
	x = radius *Math.cos(angle) + x_center;
	y = radius *Math.sin(angle) + y_center;

	context.lineTo(x, y);

	context.closePath();

	context.fill();
}
