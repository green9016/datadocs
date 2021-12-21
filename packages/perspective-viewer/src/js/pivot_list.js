import HyperList from "./hyperlist.js";

//////////////////////////////////////////////////
// How to use PivotList
//////////////////////////////////////////////////
// 1. how to detect inactive item
// let is_inactive = this.parentElement.getAttribute("id") === "inactive_columns"
// let is_inactive = this.getAttribute("container") === "inactive_columns"

// 2. how to detect active item
// let is_active = parent.parentElement.getAttribute("id") === "active_columns";
// let is_active = parent.getAttribute('container') == "active_columns";

// 3. get active_columns
// Array.prototype.slice.call(this._active_columns.children)
// this._pivotList.getActiveCols()

// 4. get inactive_columns
// Array.prototype.slice.call(this._inactive_columns.children)
// this._pivotList.getInactiveCols()

// 5. add inactive_column
// this._inactive_columns.appendChild(row);
// this._pivotList.addInactiveRow(row, true);

// 6. insert inactive_column
// this._inactive_columns.insertBefore(row, this._inactive_columns.children[c_index]);
// this._pivotList.insertInactiveRow(row, c_index);

// 7. remove active_column
// this._active_columns.removeChild(child);
// this._pivotList.removeActiveRow(child);

// 8. insert active_column
// this._active_columns.insertBefore(row, this._active_columns.children[c_index]);
// this._pivotList.insertActiveRow(row, c_index);

// 9. add active_column
// this._active_columns.appendChild(row);
// this._pivotList.addActiveRow(row, true);

// 10. get active_columns
// let children = this._active_columns.children;
// this._pivotList.getActiveCols()

// 11. get inactive_columns
// let children = this._inactive_columns.children;
// this._pivotList.getInactiveCols()

// 12. clear active_columns
// this._viewer._active_columns.innerHTML = "";
// this._viewer._pivotList.clearActiveRows();

// 13. how to compare target elelement is active_columns
// this._drop_target_hover.parentElement === this._active_columns
// this._drop_target_hover.parentElement== this._pivotList.getActiveContainer()

// 14. after changed active_column or inactive_column, should call refresh
// this._pivotList.refresh();
//////////////////////////////////////////////////

export class PivotList {
    constructor(_perspective_el) {
        this._perspective_el = _perspective_el;

        // top container element of hyper list.
        this._available_fields_container = _perspective_el._available_fields_container;
        // container of contents
        //this._available_fields_columns = this._available_fields_container;// _perspective_el.shadowRoot.querySelector("#available_fields_columns");
        this._available_fields_columns = _perspective_el._available_fields_columns;
        // container of hyper list items.

        // data array of hyper list
        this._model_cols = [];
    }
    init() {
        const active_cols = this._perspective_el._active_columns_frag;
        const inactive_cols = this._perspective_el._inactive_columns_frag.filter(el => !el.classList.contains("active"));

        // merge active_cols && inactive_cols into model_cols
        this._model_cols = active_cols.concat(inactive_cols);

        // hyperlist configuration
        var that = this;
        this._config = {
            //height: '90',
            itemHeight: 22,
            total: that._model_cols.length,
            // Set to true to put into 'chat mode'.
            reverse: false,
            scrollerTagName: "div",

            generate(row) {
                if (row < that._model_cols.length) {
                    const el = that._model_cols[row];
                    return el;
                }
                else {
                    console.error("model data error....", row, that._model_cols.length);
                    return document.createElement("div");
                }
            }
        };

        // create hyperlist
        this._hyperlist = HyperList.create(this._available_fields_columns, this._config);
        // window.onresize = e => {
        //     this._config.height = '100%'; //parentDom.style.height;
        //     this._hyperlist.refresh(this._available_fields_columns, this._config);
        // };
        this._available_fields_columns.classList.add("container");
    }

    clear() {
        // clear data
        this._perspective_el._active_columns_frag = [];
        this._perspective_el._inactive_columns_frag = [];
        this.refresh();
    }

    clearActiveRows() {
        // clear active row data
        this._perspective_el._active_columns_frag = [];
        this.refresh();
    }

    refresh(force = false) {
        // rebuild model data of hyper list
        // and refresh hyper list.
        if (this._hyperlist) {
            const active_cols = this._perspective_el._active_columns_frag.filter(
                el => !el.classList.contains("hidden"));
            const inactive_cols = this._perspective_el._inactive_columns_frag.filter(
                el => !el.classList.contains("active") && !el.classList.contains("hidden"));

            const c1 = this._perspective_el._active_columns_frag.length;
            const c2 = this._perspective_el._inactive_columns_frag.filter(
                el => !el.classList.contains("active")).length;

            // model data
            this._model_cols = active_cols.concat(inactive_cols);

            // reset total item count of hyperlist
            this._config.total = this._model_cols.length;

            if (!force && c1 + c2 != this._perspective_el._inactive_columns_frag.length) {
                // console.error('refresh error.', this._model_cols,
                // this._perspective_el._active_columns_frag,
                // this._perspective_el._inactive_columns_frag);
                // console.error('refresh error.---', c1, c2);
                return;
            }

            // refresh hyper list
            this._hyperlist.refresh(this._available_fields_columns, this._config);
        }
    }

    addEventListener(event, callback) {
        if (this._available_fields_columns) {
            this._available_fields_columns.addEventListener(event, callback);
        }
    }

    addInactiveRow(row, need_refresh = false) {
        // row: perspective-row element
        // need_refresh: if true, refresh hyper list
        //      now force to refresh if add a new one.
        if (this._perspective_el) {
            this._perspective_el._inactive_columns_frag.push(row);

            if (need_refresh || true) {
                this.refresh();
            }
        }
    }

    addActiveRow(row, need_refresh = false) {
        // row: perspective-row element
        // need_refresh: if true, refresh hyper list
        //      now force to refresh if add a new one.

        if (this._perspective_el) {
            this._perspective_el._active_columns_frag.push(row);

            if (need_refresh || true) {
                this.refresh();
            }
        }
    }

    removeActiveRow(row, need_refresh = false) {
        // row: perspective-row element
        // need_refresh: if true, refresh hyper list
        //      now force to refresh if add a new one.

        if (this._perspective_el) {
            const idx = this._perspective_el._active_columns_frag.indexOf(row);

            if (idx != -1) {
                this._perspective_el._active_columns_frag.splice(idx, 1);
            }

            if (need_refresh || true) {
                this.refresh();
            }
        }
    }

    removeInactiveRow(row, need_refresh = false) {
        if (this._perspective_el) {
            const idx = this._perspective_el._inactive_columns_frag.indexOf(row);

            if (idx != -1) {
                this._perspective_el._inactive_columns_frag.splice(idx, 1);
            }

            if (need_refresh || true) {
                this.refresh();
            }
        }
    }

    removeActiveRowAt(idx, need_refresh = false) {
        if (this._perspective_el) {
            if (idx != -1 && idx < this._perspective_el._active_columns_frag.length) {
                this._perspective_el._active_columns_frag.splice(idx, 1);
            }

            if (need_refresh || true) {
                this.refresh();
            }
        }
    }

    swapActiveRow(old_idx, new_idx) {
        if (old_idx == -1 || new_idx == -1) {
            return;
        }

        if (old_idx < this._perspective_el._active_columns_frag.length &&
            new_idx < this._perspective_el._active_columns_frag.length) {

            if (old_idx < new_idx) {
                const row = this._perspective_el._active_columns_frag[old_idx];
                this._perspective_el._active_columns_frag.splice(new_idx, 0, row);
                this._perspective_el._active_columns_frag.splice(old_idx, 1);

                this.refresh(true);
            }
            else if (old_idx != new_idx) {
                const row = this._perspective_el._active_columns_frag[old_idx];
                this._perspective_el._active_columns_frag.splice(old_idx, 1);
                this._perspective_el._active_columns_frag.splice(new_idx, 0, row);

                this.refresh(true);
            }
        }
        else if (new_idx == this._perspective_el._active_columns_frag.length) {
            const row = this._perspective_el._active_columns_frag[old_idx];
            this._perspective_el._active_columns_frag.splice(old_idx, 1);
            this._perspective_el._active_columns_frag.push(row);

            this.refresh(true);
        }
    }

    swapActiveRowByObj(row, new_idx) {
        const old_idx = this._perspective_el._active_columns_frag.indexOf(row);
        this.swapActiveRow(old_idx, new_idx);
    }

    swapActiveRowWithInactive(row, new_idx) {
        if (this._perspective_el) {
            const idx = this._perspective_el._inactive_columns_frag.indexOf(row);

            if (idx != -1) {
                this._perspective_el._inactive_columns_frag.splice(idx, 1);
            }

            this._perspective_el._active_columns_frag.splice(idx, 0, row);
            this.refresh(true);
        }
    }

    insertActiveRow(row, idx) {
        if (this._perspective_el) {
            this._perspective_el._active_columns_frag.splice(idx, 0, row);

            this.refresh();
        }
    }


    insertActiveRowBefore(row, row_before) {
        if (this._perspective_el) {
            const idx = this._perspective_el._active_columns_frag.indexOf(row_before);
            if (idx == -1) {
                console.error("can not find the row in the active_columns...", row_before);
            } else {
                this._perspective_el._active_columns_frag.splice(idx, 0, row);
            }

            this.refresh();
        }
    }

    getActiveCols(clone = true) {
        // clone: if true, return cloned array of active_columns
        //        else,    return active_columns
        //        but now, always return cloned array.
        return [...this._perspective_el._active_columns_frag];
    }

    getInactiveCols(clone = true) {
        return [...this._perspective_el._inactive_columns_frag];
    }

    getActiveCount() {
        return this._perspective_el._active_columns_frag.length;
    }

    getInactiveCount() {
        return this._perspective_el._inactive_columns_frag.length;
    }

    addClassOfActive(className) {
        if (this._available_fields_columns) {
            this._available_fields_columns.classList.add(className);
        }
    }
    removeClassOfActive(className) {
        if (this._available_fields_columns) {
            this._available_fields_columns.classList.remove(className);
        }
    }

    getScrollTop() {
        return this._available_fields_columns.scrollTop;
    }

    isActive(row) {
        return this._perspective_el._active_columns_frag.indexOf(row) != -1;
    }

    isInactive(row) {
        return this._perspective_el._inactive_columns_frag.indexOf(row) != -1;
    }

    getActiveContainer() {
        return this._available_fields_columns;
    }

    getInactiveContainer() {
        return this._available_fields_columns;
    }

    getItemHeight() {
        return this._config.itemHeight;
    }
    addClass(className) {
        // this._available_fields_columns is parent of this._available_fields_columns
        this._available_fields_columns.classList.add(className);
    }

    removeClass(className) {
        // this._available_fields_columns is parent of this._available_fields_columns
        this._available_fields_columns.classList.remove(className);
    }
}
