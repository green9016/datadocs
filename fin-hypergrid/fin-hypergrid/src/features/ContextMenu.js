/* eslint-env browser */

'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var Feature = require('./Feature');

var menuDiv;

var previousHoveredCellEvent;

/**
 * @constructor
 * @extends Feature
 */
var ContextMenu = Feature.extend('ContextMenu', {
    /**
     * @memberOf ContextMenu.prototype
     * @desc give me an opportunity to initialize stuff on the grid
     * @param {Hypergrid} grid
     */
    initializeOn: function initializeOn(grid) {
        if (!menuDiv) {
            menuDiv = this.initializeContextMenuDiv();
        }

        if (this.next) {
            this.next.initializeOn(grid);
        }
    },
    /**
     * @memberOf ContextMenu.prototype
     * @desc initialize context menu div
     */
    initializeContextMenuDiv: function initializeContextMenuDiv() {
        var menuHolderDiv = document.createElement('div');
        menuHolderDiv.setAttribute('id', 'menu-div');

        menuHolderDiv.style.display = 'none';
        menuHolderDiv.style.position = 'fixed';
        menuHolderDiv.setAttribute('class', 'ag-custom');


        document.body.appendChild(menuHolderDiv);

        return {
            element: menuHolderDiv,
            related: []
        };
    },

    /**
     * @memberOf ContextMenu.prototype
     * @param {Hypergrid} grid
     * @param {CellEvent} event
     */
    handleMouseDown: function handleMouseDown(grid, event) {
        this.hideContextMenu(menuDiv);
        if (this.next) {
            this.next.handleMouseDown(grid, event);
        }
    },

    onApiDestroyCalled: function onApiDestroyCalled(grid, event) {
//      Do not hide context menu when switched from preview screen to datadoc view and apply filter
//        this.hideContextMenu(menuDiv);

        if (this.next) {
            this.next.onApiDestroyCalled(grid, event);
        }
    },

    handleCanvasOutsideMouseDown: function handleCanvasOutsideMouseDown(grid, event) {
        this.hideContextMenu(menuDiv);

        if (this.next) {
            this.next.handleCanvasOutsideMouseDown(grid, event);
        }
    },

    toggleHeaderContextMenu: true,

    /**
     * @memberOf ContextMenu.prototype
     * @param {Hypergrid} grid
     * @param {CellEvent} event
     */
    handleClick: function handleClick(grid, event) {
        this.hideContextMenu(menuDiv);

        var isCursorOverContextMenuIcon = this.overContextMenuCell(grid, event);

        var contextMenuIconRightX = event.bounds.x + event.bounds.width - grid.properties.contextMenuButtonRightMargin;
        var contextMenuIconLeftX = contextMenuIconRightX - grid.properties.contextMenuButtonIconPreferedWidth - grid.properties.contextMenuButtonPadding * 2;

        if (self.toggleHeaderContextMenu === undefined || self.toggleHeaderContextMenu === null) {
            self.toggleHeaderContextMenu = true;
        }

        if (isCursorOverContextMenuIcon) {

            // set showContextMenu = true for all column except current
            grid.properties.columnNames.forEach( cn => {
                var c = grid.properties.columns[cn].colDef;
                if(c) {
                    if(cn !== event.column.schema.name) {
                        c.showContextMenu = true;
                    } else {
                        if(c.showContextMenu === undefined || c.showContextMenu === null) {
                             c.showContextMenu = true;
                        }
                    }
                }
            });

            // toggle showContextMenu for current column
            var column = grid.properties.columns[event.column.schema.name].colDef;
            if(column.showContextMenu === undefined || column.showContextMenu === null) {
                column.showContextMenu = true;
            } else {
                column.showContextMenu = !column.showContextMenu;
            }

            if(!column.showContextMenu){
                var contextMenu = grid.behavior.getCellProperties(event).cellContextMenu || grid.properties.cellContextMenu;

                if (event.isHeaderRow && grid.properties.headerContextMenu) {
                    contextMenu = grid.properties.headerContextMenu;
                }else if(event.isHandleColumn && event.gridCell.y > 1 && grid.properties.rowHeaderContextMenu){
                    contextMenu = grid.properties.rowHeaderContextMenu;
                }
                var rightToLeft = event.primitiveEvent.detail.mouse.x + 270 + grid.canvas.size.left >= window.innerWidth;
                var startX = rightToLeft ? contextMenuIconRightX : contextMenuIconLeftX;
                startX += grid.canvas.size.left;
                this.paintContextMenu(menuDiv, grid, event, contextMenu, startX, event.bounds.y + event.bounds.height + grid.canvas.size.top, rightToLeft);
                setTimeout(function() {
                    let quickFilterText = document.getElementById("quickFilterText")
                    if(quickFilterText && quickFilterText != null){
                        document.getElementById("quickFilterText").select();
                    }
                }, 40);
            }
        } else {
            // ensure context menus show up when user click else where in grid and click on context menu again
            grid.properties.columnNames.forEach( cn => {
                var c = grid.properties.columns[cn].colDef;
                if(c) {
                    c.showContextMenu = undefined;
                }
            });
        }

        if (this.next) {
            this.next.handleClick(grid, event);
        }
    },

    /**
     * @summary update selections if needed based on right click cell or header. if menu called on unselected item especially
     * @param {Hypergrid} grid
     * @param {CellEvent} event - the event details
     */
    updateSelections: function updateSelections(grid, event) {
        if (event.isHeaderRow && event.isHandleColumn && !event.isDataRow) {
            grid.clearSelections();
            grid.selectionModel.selectAllRows();
        } else if (event.isHeaderRow && !event.isColumnSelected) {
            // top row ow headers
            grid.clearSelections();
            grid.selectColumn(event.dataCell.x, event.dataCell.x);
        } else if (event.isHandleColumn && event.isDataRow /*&& !event.isRowSelected*/) {
            // left row number headers
            if (event.isRowSelected){
                // Do something if needed
            }else{
                grid.clearSelections();
                grid.selectRow(event.dataCell.y, event.dataCell.y);
            }
        } else if (!event.isCellSelected) {
            // simple cell
            grid.clearSelections();
            grid.select(event.dataCell.x, event.dataCell.y, 0, 0);
        }
    },

    /**
     * @memberOf ContextMenu.prototype
     * @param {Hypergrid} grid
     * @param {CellEvent} event - the event details
     */
    handleContextMenu: function handleContextMenu(grid, event) {
        const selected_columns = grid.behavior.getSelectedColumns() || [];
        const selected_rows = grid.behavior.getSelectedRows() || [];
        var contextMenu = void 0;
        if ((event.isHeaderRow || (selected_columns && selected_columns.includes(event.gridCell.x)))
          && grid.properties.headerContextMenu) {
            contextMenu = grid.properties.headerContextMenu;
        }else if(event.gridCell.y > 1
          && (event.isHandleColumn || (selected_rows && selected_rows.includes(event.gridCell.y - grid.properties.fixedRowCount)))
          && grid.properties.rowHeaderContextMenu){
            contextMenu = grid.properties.rowHeaderContextMenu;
        }else {
            contextMenu = grid.behavior.getCellProperties(event).cellContextMenu || grid.properties.cellContextMenu;
        }

        this.updateSelections(grid, event);

        // update cell menu for left column of row numbers
        if (event.isHandleColumn && event.gridCell.y <= 1) {
            var point = grid.selectionModel.getFirstSelectedCellOfLastSelection();
            if (point) {
                contextMenu = grid.behavior.getCellProperties(point.x, point.y).cellContextMenu || grid.properties.cellContextMenu;
            }
        }

        var rightToLeft = event.primitiveEvent.detail.mouse.x + 200 >= window.innerWidth;
        this.paintContextMenu(menuDiv, grid, event, contextMenu, event.primitiveEvent.detail.mouse.x + grid.canvas.size.left, event.primitiveEvent.detail.mouse.y + grid.canvas.size.top, rightToLeft);
        if (this.next) {
            this.next.handleContextMenu(grid, event);
        }
    },

    handleMouseMove: function handleMouseMove(grid, event) {
        // this.closeAllChilds(menuDiv);

        var stateChanged = false;
        var isCursorOverContextMenuIcon = this.overContextMenuCell(grid, event);
        var isPreviousCellEventExist = !!previousHoveredCellEvent;

        if (isCursorOverContextMenuIcon) {
            if (!previousHoveredCellEvent || event.bounds.x !== previousHoveredCellEvent.bounds.x || event.bounds.y !== previousHoveredCellEvent.bounds.y) {

                // CAUTION! If call setCellProperty method of cellEvent, renderer properties cache will not be
                // changed (so hover state of icon not be displayed before cell properties cache change)
                grid.behavior.setCellProperty(event.dataCell.x, event.dataCell.y, 'contextMenuIconIsHovered', true);
                event.contextMenuIconIsHovered = true;
                stateChanged = true;
                previousHoveredCellEvent = event;
                this.cursor = 'pointer';
            }
        } else {
            if (isPreviousCellEventExist) {

                // CAUTION! If call setCellProperty method of cellEvent, renderer properties cache will not be
                // changed (so hover state of icon not be displayed before cell properties cache change)
                grid.behavior.setCellProperty(previousHoveredCellEvent.dataCell.x, previousHoveredCellEvent.dataCell.y, 'contextMenuIconIsHovered', false);
                event.contextMenuIconIsHovered = false;
                previousHoveredCellEvent = null;
                stateChanged = true;
            }
            this.cursor = null;
        }

        if (stateChanged) {
            grid.repaint();
        }

        if (this.next) {
            this.next.handleMouseMove(grid, event);
        }
    },

    /**
     * @memberOf Feature.prototype
     * @desc handle grid data added event
     * @param {Hypergrid} grid
     * @param {object} event
     * @private
     * @comment Not really private but was cluttering up all the feature doc pages.
     */
    handleDataAdded: function handleDataAdded(grid, event) {
//        this.hideContextMenu(menuDiv);

        if (this.next) {
            this.next.handleDataAdded(grid, event);
        }
    },

    overContextMenuCell: function overContextMenuCell(grid, event) {
        var cellHasContextMenuItem = event.properties.showCellContextMenuIcon || event.rowProperties && event.rowProperties.showCellContextMenuIcon || event.cellOwnProperties && event.cellOwnProperties.showCellContextMenuIcon;

        if (!cellHasContextMenuItem) {
            return false;
        }

        var eventCellRightX = event.bounds.width;
        var contextMenuIconRightX = eventCellRightX - grid.properties.contextMenuButtonRightMargin;

        var typeSignWidth = 0;
        if (event.column.schema && event.column.schema.colTypeSign) {
            var gc = grid.canvas.gc,
                prevFontState = gc.cache.font,
                prevFillStyleState = gc.cache.fillStyle,
                config = event.properties;

            gc.cache.font = config.columnTypeSignFont;
            gc.cache.fillStyle = config.columnTypeSignColor;
            typeSignWidth = gc.measureText(event.column.schema.colTypeSign).width;
            typeSignWidth += config.contextMenuLeftSpaceToCutText;

            gc.cache.font = prevFontState;
            gc.cache.fillStyle = prevFillStyleState;
        }
        var contextMenuIconLeftX = contextMenuIconRightX - grid.properties.contextMenuButtonIconPreferedWidth - grid.properties.contextMenuButtonPadding * 2 - typeSignWidth;

        var contextMenuIconTopY = event.bounds.height / 2 - grid.properties.contextMenuButtonHeight / 2;
        var contextMenuIconBottomY = contextMenuIconTopY + grid.properties.contextMenuButtonHeight;

        return event.mousePoint.x <= contextMenuIconRightX && event.mousePoint.x >= contextMenuIconLeftX && event.mousePoint.y <= contextMenuIconBottomY && event.mousePoint.y >= contextMenuIconTopY;
    },

    /**
     * @memberOf ContextMenu.prototype
     * @desc utility method to paint context menu based on click event, and position params
     * @param {object} menuHolderDiv - object with Html element and related elements
     * @param {Hypergrid} grid
     * @param {CellEvent} event
     * @param {[]|function} items - menu items
     * @param {number} x - defines horizontal point of menu start
     * @param {number} y - defines vertical point of menu start
     * @param {boolean} rightToLeft - if true, menu will be displayed that way when it horizontally ends on X point
     */
    paintContextMenu: function paintContextMenu(menuHolderDiv, grid, event, items, x, y, rightToLeft) {
        var _this = this;

        this.hideContextMenu(menuHolderDiv);

        var menuListHolderDiv = document.createElement('div');

        if (typeof items === 'function') {
            items = items({ column: event.column, node: { data: event.dataRow, level: event.column.treeLevel }, value: event.value, isRightClick : event.primitiveEvent.detail.isRightClick });
        }

        if(!items){
            return;
        }
        setTimeout(function() {
            if(grid.div.id == "ag-grid" && items && items.length > 4){
                var spinner = document.getElementById("loading-filters-spinner")
                if(spinner){
                    var needToDisplaySpinner = items[0].spinner;
                    if(needToDisplaySpinner){
                        var load = document.getElementById('quickFilterLoader')
                        load.classList.add("loading-filters-spinner");
                    }
                }
            }}
            ,100);

        if(grid.div.id == "ag-grid" && items.length > 5){
            menuListHolderDiv.setAttribute('class', 'ag-menu quick-sort-filter-panel');
        }else{
            menuListHolderDiv.setAttribute('class', 'ag-menu');
        }

        menuHolderDiv.element.appendChild(menuListHolderDiv);

        items.forEach(function (item) {
            _this.makeContextMenuItem(grid, event, menuHolderDiv, menuListHolderDiv, item);
        });

        if (grid.properties.applyContextMenuStyling) {
            if (grid.properties.contextMenuHolderStyle) {
                Object.assign(menuHolderDiv.element.style, grid.properties.contextMenuHolderStyle);
            }
            if (grid.properties.applyContextMenuStyling) {
                Object.assign(menuListHolderDiv.style, grid.properties.contextMenuListStyle);
            }
        }

        var iH = 12 + items.length * 27;
        var iHView = window.innerHeight - 60;
        if (iHView - y < iH){
            y = iHView - iH;
        }

        this.showContextMenu(menuHolderDiv, x, y, rightToLeft);
    },

    /**
     * @memberOf ContextMenu.prototype
     * @desc utility method to paint single menu item and append it to list that passed as param
     * @param {Hypergrid} grid
     * @param {CellEvent} event
     * @param {object} menuHolderDiv - object with Html element and related elements
     * @param {HTMLElement} menuListHolderDiv - HTML element that represents a list of menu items
     * @param {object} item - menu item object
     */
    makeContextMenuItem: function makeContextMenuItem(grid, event, menuHolderDiv, menuListHolderDiv, item) {
        if (item.hasOwnProperty('isShown')) {
            if (typeof item.isShown === 'function' && !item.isShown(event)) {
                return;
            } else if (!item.isShown) {
                return;
            }
        }

        var self = this;

        var menuOption = document.createElement('div');
        menuOption.style.display = 'block';
        if (event.isHandleColumn && item.key == "HIDE" && !grid.behavior.dataModel._viewer.pk){
            // Grey the menu item out
            menuOption.style.opacity = 0.5;
        }

        if(item.type == 'info'){
            menuOption.setAttribute('class', 'ag-info-option');
        }else{

            if(item.class){
                menuOption.setAttribute('class', 'ag-menu-option '+item.class);
                if(item.type == 'button'){
                    menuOption.setAttribute('id', 'clear-filter-button');
                }
            }else{
                menuOption.setAttribute('class', 'ag-menu-option');
            }

        }

        if ((typeof item === 'undefined' ? 'undefined' : _typeof(item)) === 'object') {
            var menuOptionIconSpan = document.createElement('div');
            if(grid.div.id != 'ag-grid'){
                menuOptionIconSpan.setAttribute('class', 'ag-menu-option-icon');
                menuOptionIconSpan.setAttribute('id', 'eIcon');

                var menuOptionIconDetail = document.createElement('div');
                if (item.key == "COPY"){
                    menuOptionIconDetail.setAttribute('class', 'icon-img-container icon-img icon-img-copy');
                }else if(item.key == "HIDE"){
                    menuOptionIconDetail.setAttribute('class', 'icon-img-container icon-img icon-img-hide');
                }else if(item.key == "ADD_NEW_COLUMN"){
                    menuOptionIconDetail.setAttribute('class', 'icon-img-container icon-img icon-img-hide');
                }else{
                    menuOptionIconDetail.setAttribute('class', 'icon-img-container icon-img icon-img-copy');
                }

                menuOptionIconSpan.appendChild(menuOptionIconDetail);

                menuOption.appendChild(menuOptionIconSpan);
            }

            if (item.icon) {
                menuOptionIconSpan.innerHTML = item.icon;
            }

            var menuOptionNameSpan = document.createElement('span');
            if(item.type == 'input'){
                menuOptionNameSpan.setAttribute('class', 'ag-menu-input-text');
                menuOptionNameSpan.setAttribute('id', 'eName');
                menuOptionNameSpan.innerHTML = item.title || item.name;
                menuOption.appendChild(menuOptionNameSpan);
            }else if(item.type == 'multiValue'){
                menuOptionNameSpan.setAttribute('class', 'ag-menu-option-text');
                menuOptionNameSpan.setAttribute('id', 'eName');
                menuOptionNameSpan.innerHTML = item.title || item.name;
                menuOption.appendChild(menuOptionNameSpan);
            }else if(item.type == 'info'){
                menuOptionNameSpan.setAttribute('class', 'ag-menu-info-text');
                menuOptionNameSpan.setAttribute('id', 'eName');
                menuOptionNameSpan.innerHTML = item.title || item.name;
                menuOption.appendChild(menuOptionNameSpan);
            }else if(item.type == 'button'){
                menuOptionNameSpan.setAttribute('class', 'ag-menu-option-text');
                menuOptionNameSpan.setAttribute('id', 'filter-button');
                menuOptionNameSpan.innerHTML = item.title || item.name;
                menuOption.appendChild(menuOptionNameSpan);
            }else {
                menuOptionNameSpan.setAttribute('class', 'ag-menu-option-text');
                menuOptionNameSpan.setAttribute('id', 'eName');
                menuOptionNameSpan.innerHTML = item.title || item.name;
                menuOption.appendChild(menuOptionNameSpan);

            }


            var menuOptionShortcutSpan = document.createElement('span');
            menuOptionShortcutSpan.setAttribute('class', 'context-menu-option-shortcut');
            menuOptionShortcutSpan.setAttribute('id', 'eShortcut');
            var isMac = navigator.platform.toUpperCase().indexOf('MAC')>=0;

            if (item.enable_shortcut){
              if (item.key == "COPY"){
                  menuOptionShortcutSpan.innerHTML = "Ctrl+C";
                  if (isMac){
                      menuOptionShortcutSpan.innerHTML = "⌘C";
                  }
              }else if(item.key == "HIDE"){
                  menuOptionShortcutSpan.innerHTML = (item.is_row && item.is_row === true) ? "Ctrl+9": "Ctrl+0";
                  if (isMac){
                      menuOptionShortcutSpan.innerHTML = (item.is_row && item.is_row === true) ? "⌘9": "⌘0";
                  }
              }
            }

            menuOption.appendChild(menuOptionShortcutSpan);

            var menuOptionPopupPointerSpan = document.createElement('span');
            menuOptionPopupPointerSpan.setAttribute('class', 'context-menu-option-popup-pointer');
            menuOptionPopupPointerSpan.setAttribute('id', 'ePopupPointer');

            if (item.childMenu && item.childMenu.length) {
                menuOptionPopupPointerSpan.innerHTML = grid.properties.contextMenuChildMenuArrowIconTag;
            }

            menuOption.appendChild(menuOptionPopupPointerSpan);
            if(!item.header){
                menuOption.addEventListener('click', function (clickEvent) {
                    if (item.action) {
                        grid.menuClick = true;
                        item.action(clickEvent, event);
                        delete grid.menuClick;
                    }
                    if(item.class != 'filter')
                        self.hideContextMenu(menuDiv);
                });
            }

            if(item.type == 'input'){
                menuOption.addEventListener('input', function (inputEvent) {
                    if (item.action) {
                        grid.menuClick = true;
                        item.action(inputEvent, event);
                        delete grid.menuClick;
                    }
                });
            }

            if(item.type == 'button'){
            menuOption.addEventListener('click', function (clickEvent) {
                    if (item.action) {
                        grid.menuClick = true;
                        item.action(clickEvent, event);
                        delete grid.menuClick;
                    }
                    self.hideContextMenu(menuDiv);
                })
            }

            if(item.type == 'multiValue'){

                var liList = menuOption.querySelectorAll('li');
                var inputList = menuOption.querySelectorAll('input');
                if(liList){
                    for(var i = 0, size = liList.length; i < size ; i++){
                       liList[i].addEventListener('click',function(checkevent){

                            if(!_.isEmpty(document.getElementById("quickFilterText").value)){
                                if(hasAllChecked(inputList)){
                                    liList[0].innerHTML = getDeselectAllElement(true);
                                }else{
                                    liList[0].innerHTML = getSelectAllElement();
                                }
                            } else if(hasAnyChecked(inputList)){
                                liList[0].innerHTML = getDeselectAllElement(true);
                            } else {
                               liList[0].innerHTML = getDeselectAllElement(false);
                            }

                            if(checkevent.target.tagName.toUpperCase() === "SPAN"){
                                var checkBoxId = checkevent.path[0].getAttribute("for");;
                                var element = document.getElementById(checkBoxId)
                                element.checked = !element.checked;
                                if(checkevent.srcElement.innerText === '(Deselect All)'){
                                    deselectAll(inputList, element)
                                }
                                if(checkevent.srcElement.innerText === '(Select All)'){
                                    selectAll(inputList, element)
                                }
                                switchElement(inputList, liList);
                                item.action(checkevent, checkBoxId, element.checked);
                            }else if(checkevent.target.tagName.toUpperCase() === "LABEL"){
                                var element = document.getElementById(checkevent.srcElement.htmlFor)
                                element.checked = !element.checked;
                                if(checkevent.srcElement.htmlFor === '(Deselect All)'){
                                    deselectAll(inputList, element)
                                }
                                if(checkevent.srcElement.innerText === '(Select All)'){
                                    selectAll(inputList, element)
                                }
                                switchElement(inputList, liList);
                                item.action(checkevent, checkevent.srcElement.htmlFor, element.checked);
                            }else{
                                return;
                            }
                        })
                    }
                }
            }

            function switchElement(inputList, liList){
                 if(!_.isEmpty(document.getElementById("quickFilterText").value)){
                    console.log('in iffff')
                    if(hasAllChecked(inputList)){
                        console.log('all checked')
                        liList[0].innerHTML = getDeselectAllElement(true);
                    }else{
                        liList[0].innerHTML = getSelectAllElement();
                    }
                } else if(hasAnyChecked(inputList)){
                    liList[0].innerHTML = getDeselectAllElement(true);
                } else {
                   liList[0].innerHTML = getDeselectAllElement(false);
                }
            }

            function getSelectAllElement(){
                return "<li><div class='checkbox-cell' id='selectAllDiv'> <span> <input type='checkbox' id='(Select All)' value='(Select All)' class='regular-checkbox'> <label for='(Select All)'></label> </span> <span for='(Select All)'>(Select All)</span> </div></li>";
            }

            function getDeselectAllElement(enabled){
                if(enabled){
                    return "<li><div class='checkbox-cell' id='deSelectAllDiv'> <span> <input type='checkbox' id='(Deselect All)' value='(Deselect All)' class='regular-checkbox'> <label for='(Deselect All)'></label> </span> <span for='(Deselect All)'>(Deselect All)</span> </div></li>";
                }

                return "<li><div class='checkbox-cell disabled' id='deSelectAllDiv'> <span> <input type='checkbox' id='(Deselect All)' value='(Deselect All)' class='regular-checkbox'> <label for='(Deselect All)'></label> </span> <span for='(Deselect All)'>(Deselect All)</span> </div></li>";;
            }

            function hasAllChecked(inputList) {
                // omit first element as it will be either select all or deselect all
                for (var i = 1; i < inputList.length; i++) {
                     if(!inputList[i].checked){
                        return false;
                     }
                }
                return true;
            }

            function hasAnyChecked(inputList) {
                // omit first element as it will be either select all or deselect all
                for (var i = 1; i < inputList.length; i++) {
                     if(inputList[i].checked){
                        return true;
                     }
                }
                return false;
            }

            function deselectAll(inputList, element){
                 for (var i = 0; i < inputList.length; i++) {
                     inputList[i].checked = false;
                 }
            }

            function selectAll(inputList, element){
                 for (var i = 0; i < inputList.length; i++) {
                     inputList[i].checked = true;
                 }
            }

            if (grid.properties.applyContextMenuStyling) {
                if (grid.properties.contextMenuListOptionStyle) {
                    Object.assign(menuOption.style, grid.properties.contextMenuListOptionStyle);
                }

                if (grid.properties.contextMenuListOptionIconStyle) {
                    Object.assign(menuOptionIconSpan.style, grid.properties.contextMenuListOptionIconStyle);
                }

                if (grid.properties.contextMenuListOptionTextStyle) {
                    Object.assign(menuOptionNameSpan.style, grid.properties.contextMenuListOptionTextStyle);
                }

                if (grid.properties.contextMenuListOptionShortcutStyle) {
                    Object.assign(menuOptionShortcutSpan.style, grid.properties.contextMenuListOptionShortcutStyle);
                }

                if (grid.properties.contextMenuListOptionPopupPointerStyle) {
                    Object.assign(menuOptionPopupPointerSpan.style, grid.properties.contextMenuListOptionPopupPointerStyle);
                }
            }

        if(!item.header){
            menuOption.addEventListener('mouseenter', function (event) {
                self.closeAllChilds(menuHolderDiv);
                if (item.childMenu && item.childMenu.length && !item.childMenuDiv) {
                    item.childMenuDiv = self.initializeContextMenuDiv();

                    menuHolderDiv.related.push(item.childMenuDiv);

                    var rectangle = menuOption.getBoundingClientRect();
                    var rightBorderX = rectangle.right;
                    if (rightBorderX + 200 > window.innerWidth) {
                        self.paintContextMenu(item.childMenuDiv, grid, event, item.childMenu, rectangle.left, rectangle.top, true);
                    } else {
                        self.paintContextMenu(item.childMenuDiv, grid, event, item.childMenu, rightBorderX, rectangle.top);
                    }
                }
            });

            menuOption.addEventListener('mouseover', function (event) {
                if (grid.properties.applyContextMenuStyling && grid.properties.contextMenuListOptionHoverStyle) {
                    Object.assign(menuOption.style, grid.properties.contextMenuListOptionHoverStyle);
                }
            });

            menuOption.addEventListener('mouseleave', function (event) {
                if (grid.properties.applyContextMenuStyling && grid.properties.contextMenuListOptionStyle) {
                    Object.assign(menuOption.style, grid.properties.contextMenuListOptionStyle);
                }

                if (item.childMenuDiv && !self.isElementContainsChild(item.childMenuDiv.element, event.relatedTarget)) {
                    self.hideContextMenu(item.childMenuDiv);
                    self.removeDOMElement(item.childMenuDiv.element);
                    item.childMenuDiv = null;
                }
            });
            }
        } else if (item === 'separator') {
            menuOption.className = 'ag-menu-separator';

            var hrElement = document.createElement('hr');
            menuOption.appendChild(hrElement);

            if (grid.properties.applyContextMenuStyling) {
                if (grid.properties.contextMenuSeparatorStyle) {
                    Object.assign(hrElement.style, grid.properties.contextMenuSeparatorStyle);
                }
            }
        }

        menuListHolderDiv.appendChild(menuOption);
    },

    /**
     * @memberOf ContextMenu.prototype
     * @desc utility method to clear context menu HTML object and all related objects
     * @param {object} menuHolderDiv
     */
    clearContextMenu: function clearContextMenu(menuHolderDiv) {
        while (menuHolderDiv.element.firstChild) {
            menuHolderDiv.element.removeChild(menuHolderDiv.element.firstChild);
        }
        this.closeAllChilds(menuHolderDiv);
    },

    closeAllChilds: function closeAllChilds(menuHolderDiv) {
        while (menuHolderDiv.related.length) {
            this.hideContextMenu(menuHolderDiv.related[0]);
            menuHolderDiv.related.shift();
        }
    },

    /**
     * @memberOf ContextMenu.prototype
     * @desc utility method to start show context menu on defined point.
     * @desc Menu must be formed before it will be passed to this method
     * @param {object} menuHolderDiv - object with Html element and related elements
     * @param {number} x - defines horizontal point of menu start
     * @param {number} y - defines vertical point of menu start
     * @param {boolean} rightToLeft - if true, menu will be displayed that way when it horizontally ends on X point
     */
    showContextMenu: function showContextMenu(menuHolderDiv, x, y, rightToLeft) {
        menuHolderDiv.element.style.display = 'block';
        menuHolderDiv.element.style.top = y + 'px';

        var startX = x;
        if (rightToLeft) {
            startX = x - menuHolderDiv.element.offsetWidth;
        }
        menuHolderDiv.element.style.left = startX + 'px';
    },

    /**
     * @memberOf ContextMenu.prototype
     * @desc utility method to stop displaying context menu
     * @param {object} menuHolderDiv - object with Html element and related elements
     */
    hideContextMenu: function hideContextMenu(menuHolderDiv) {
        this.clearContextMenu(menuHolderDiv);
        menuHolderDiv.element.style.display = 'none';
    },

    /**
     * @memberOf ContextMenu.prototype
     * @desc utility method to remove HTML element from current DOM
     * @param {HTMLElement} element - HTML element that need to be removed from DOM
     */
    removeDOMElement: function removeDOMElement(element) {
        element.remove();
    },

    /**
     * @memberOf ContextMenu.prototype
     * @desc utility method to check is one HTML element contains another in any level
     * @param {HTMLElement} element - HTML element that need to be checked
     * @param {HTMLElement} concreteChild - HTML element that need to be found inside
     */
    isElementContainsChild: function isElementContainsChild(element, concreteChild) {
        if (element === concreteChild) {
            return true;
        }

        for (var child = element.firstChild; child; child = child.nextSibling) {
            if (child === concreteChild) {
                return true;
            }

            var isChildContainsElement = this.isElementContainsChild(child, concreteChild);
            if (isChildContainsElement) {
                return true;
            }
        }

        return false;
    }
});

module.exports = ContextMenu;
