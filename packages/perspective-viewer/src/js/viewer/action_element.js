/******************************************************************************
 *
 * Copyright (c) 2018, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

import perspective from "@jpmorganchase/perspective";
import {undrag, column_undrag, column_dragleave, column_dragover, column_drop, drop, drag_enter, allow_drop, disallow_drop, dragover, dragleave} from "./dragdrop.js";
import {DomElement} from "./dom_element.js";
import _ from "lodash";
import { Action } from "./action.js";
import {tokenMatcher} from "chevrotain";
import {FunctionTokenType, OperatorTokenType, COLUMN_NAME_REGEX_PATTERN, RightParen, As, ColumnName, Whitespace} from "../computed_column/lexer";

const shadowFocusHandler = (function() {
  const eventName = '-shadow-focus';
  const dispatch = function(target) {
    const args = {composed: true, bubbles: true, detail: target};
    const customEvent = new CustomEvent(eventName, args);
    target.dispatchEvent(customEvent);
  };

  if (!window.WeakSet || !window.ShadowRoot) {
    return event => dispatch(event.target);
  }

  const focusHandlerSet = new WeakSet();

  /**
   * @param {Node} target to work on
   * @param {function(!FocusEvent)} callback to invoke on focus change
   */
  function _internal(target, callback) {
    let currentFocus = target;  // save real focus

    // #1: get the nearest ShadowRoot
    while (!(target instanceof ShadowRoot)) {
      if (!target) { return; }
      target = target.parentNode;
    }

    // #2: are we already handling it?
    if (focusHandlerSet.has(target)) { return; }
    focusHandlerSet.add(target);

    // #3: setup focus/blur handlers
    const hostEl = target.host;
    const focusinHandler = function(ev) {
      if (ev.target !== currentFocus) {  // prevent dup calls for same focus
        currentFocus = ev.target;
        callback(ev);
      }
    };
    const blurHandler = function(ev) {
      hostEl.removeEventListener('blur', blurHandler, false);
      target.removeEventListener('focusin', focusinHandler, true);
      focusHandlerSet.delete(target);
    };

    // #3: add blur handler to host element
    hostEl.addEventListener('blur', blurHandler, false);

    // #4: add focus handler within shadow root, to observe changes
    target.addEventListener('focusin', focusinHandler, true);

    // #5: find next parent SR, do it again
    _internal(target.host, callback);
  }

  /**
   * @param {!FocusEvent} event to process
   */
  function shadowFocusHandler(event) {
    const target = (event.composedPath ? event.composedPath()[0] : null) || event.target;
    _internal(target, shadowFocusHandler);
    dispatch(target);
  }

  return shadowFocusHandler;
}());


export class ActionElement extends DomElement {
    _show_context_menu(event) {
        this.shadowRoot.querySelector("#app").classList.toggle("show_menu");
        event.stopPropagation();
        event.preventDefault();
        return false;
    }

    _hide_context_menu() {
        this.shadowRoot.querySelector("#app").classList.remove("show_menu");
    }

    _show_warning_message(msg) {
        return alert(msg);
    }

    _show_select_sheet_dropbox(sheet_names, cb) {
        var msg = "There are " + sheet_names.length + " sheets: ";
        for (let sheet_name of sheet_names) {
            msg += sheet_name + ", ";
        }
        msg += "Please select ingested sheet.";
        this._show_warning_message(msg);
        var num = Math.floor(Math.random() * sheet_names.length);
        cb(sheet_names[num]);
    }

    _toggle_config(event) {
        if (!event || event.button !== 2) {
            /*if (this._show_config) {
                this._config_button.classList.remove("side-panel-active");
                this._side_panel.style.display = "none";
                this._top_panel.style.display = "none";
                this._config_button.classList.remove("hidden");
                this.removeAttribute("settings");
            } else {
                this._config_button.classList.add("side-panel-active");
                this._side_panel.style.display = "flex";
                this._top_panel.style.display = "flex";
                this.setAttribute("settings", true);
            }
            this._show_config = !this._show_config;
            this._plugin._resize.call(this, true);
            this.update_status_bar_width();
            this._hide_context_menu();
            this.dispatchEvent(new CustomEvent("perspective-toggle-settings", {detail: this._show_config}));*/
            this._did_toggle_config();
        }
    }

    _did_toggle_config() {
        if (this._show_config) {
            this._search_container.classList.remove("side-panel-active");
            this._config_button.classList.remove("side-panel-active");
            this._cb_run_auto_query_tooltip.classList.remove("side-panel-active");

            this._side_panel.style.display = "none";
            this._top_panel.style.display = "none";
            this._config_button.classList.remove("hidden");
            this.removeAttribute("settings");
        } else {
            this._search_container.classList.add("side-panel-active");
            this._config_button.classList.add("side-panel-active");
            this._cb_run_auto_query_tooltip.classList.add("side-panel-active");

            this._side_panel.style.display = "flex";
            this._top_panel.style.display = "flex";
            this.setAttribute("settings", true);

            if (!this.resize_available_fields_percentage){
              this.resize_available_fields_percentage = 50;
              this.init_powers();
            }
        }
        if (this._search_container.classList.contains("hidden") === false){
          this._search_container.classList.add("keep-search-box");
        }
        this._show_config = !this._show_config;
        if(this._plugin._resize)
          this._plugin._resize.call(this, true);
        this.update_status_bar_width();
        this._hide_context_menu();
        this.dispatchEvent(new CustomEvent("perspective-toggle-settings", {detail: this._show_config}));
    }

    _toggle_config_newdesign(event){
      if(!event || event.button !== 2){
        if(this._sp_perspective.classList.contains("hidden")){
            this._sp_perspective.classList.remove("hidden");
        }else{
            this._sp_perspective.classList.add("hidden");
        }
      }
    }

    async _run_query(force = false) {
        if (force || this.AUTO_QUERY) {
            this._update_run_query_button(false);
            this._debounce_update();
        } else {
            // Update query structure
            this.set_request_structure("building", await this._build_request_structure());
            this._update_run_query_button(true);
        }
    }

    /**
     * Handle action: add action to manager and upate style for redo and undo
     * @param {*} type
     * @param {*} information
     */
    _handle_manage_action(type, row, options, undo_callback = undefined, redo_callback = undefined) {
        var information = this._build_action_information(type, row, options);
        let last_action = this.redo_undo_manager.get_last_action();
        if (type === perspective.ACTION_TYPE.change_column_width && last_action
            && last_action.can_update_change_width(information)) {
          last_action.update_change_width_information(information);
        } else {
          var action = new Action(type, information, this, undo_callback, redo_callback);
          this.redo_undo_manager.add(action);
          this._update_redo_undo_button();
        }
    }

    /**
     * Update pagination to view
     * @param {*} event
     */
    _update_pagination_setting() {
        if (this._can_change_dropdown()) {
            var pagination_setting = this._get_pagination_setting();
            // Update pagination to view config
            this._view.update_pagination_setting(pagination_setting.page_items, pagination_setting.page_number)
                .then(_ => {
                    // notify for plugin to update pagination
                    this._view_on_update(1);
                });
        }
    }



    // UI action
    _open_computed_column(event) {
        //const data = event.detail;
        event.stopImmediatePropagation();
        /*if (event.type === 'perspective-computed-column-edit') {
            this._computed_column._edit_computed_column(data);
        }*/
        this._computed_column.style.display = "flex";
        this._side_panel_actions.style.display = "none";
    }

    async _did_export_csv(event) {

        var csvContent = await this.hypergrid.behavior.dataModel.pspExport("CSV");
        var blob = new Blob([csvContent]);
        if (window.navigator && window.navigator.msSaveOrOpenBlob){  // IE hack; see http://msdn.microsoft.com/en-us/library/ie/hh779016.aspx
            window.navigator.msSaveBlob(blob, this._file_name + ".csv");
        }else{
            var link = window.document.createElement("a");
            link.href = window.URL.createObjectURL(blob, {type: "data:text/csv;charset=utf-8,"});
            link.download = this._file_name + ".csv";
            document.body.appendChild(link);
            link.click();  // IE: "Access is denied"; see: https://connect.microsoft.com/IE/feedback/details/797361/ie-10-treats-blob-url-as-cross-origin-and-denies-access
            document.body.removeChild(link);
        }

        /*
        var csvContent = await this.hypergrid.behavior.dataModel.pspExport("CSV");
        var encodedUri = encodeURI(csvContent);
        //window.open(encodedUri);
        const link = document.createElement('a');
        document.body.appendChild(link);
        link.download = this._file_name + ".csv";
        link.href = encodedUri;
        link.click();
        */
    }

    async _did_export_excel(event) {

        var computedXLS = await this.hypergrid.behavior.dataModel.pspExport("EXCEL");
        /*const xlsLink = window.URL.createObjectURL(computedXLS);
        const link = document.createElement('a');
        document.body.appendChild(link);
        link.download = "excel.xls";
        link.href = xlsLink;
        link.click();*/
    }

    async _did_export_json(event) {

        var jsonContent = await this.hypergrid.behavior.dataModel.pspExport("JSON");
        var blob = new Blob([jsonContent]);
        if (window.navigator && window.navigator.msSaveOrOpenBlob){
            window.navigator.msSaveBlob(blob, this._file_name + ".json");
        }else{
            var link = window.document.createElement("a");
            link.href = window.URL.createObjectURL(blob, {type: "data:text/json;charset=utf-8,"});
            link.download = this._file_name + ".json";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        /*
        var jsonContent = await this.hypergrid.behavior.dataModel.pspExport("JSON");
        const link = document.createElement('a');
        document.body.appendChild(link);
        link.download = this._file_name + ".json";
        link.href = jsonContent;
        link.click();
        */
    }

    _did_ingest_file(event){
        if (!this._show_grid_data){
          [...this._pivot_input_file.files].forEach(this.uploadFile.bind(this));
        }
    }

    _cancel_ingest_file(event){
        if (this._show_grid_data){
            this.cancelIngestingData();
        }
    }

    _cancel_querying(event) {
        this.cancelQueryingData();
    }

    _allow_drop_file(event){
      if (this._contains_row_dragging){
        // Perspective row-drag
      }else{
        event.stopPropagation();
        event.preventDefault();
      }
    }

    _drop_file(event){
      if (!this._show_grid_data){
        let dt = event.dataTransfer;
        let files = dt.files;
        if (files && files.length > 1){

          // Not allow multiple files
          this._pivot_drop_file_area_error.classList.remove("highlight");
          return;
        }

        [...files].forEach(this.uploadFile.bind(this));
      }
    }

    _path_to_array(path) {
      return path.split("/").filter(function(value) {
        return value && value.length;
      });
    }

    _get_file_type_svg_icon(type="folder",width=18, height=18){
      if (!width){
        width = 18;
      }
      if (!height){
        height = 18;
      }
      if (type === "folder"){
          return '<svg fill="#cccccc" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="'+width+'px" height="'+height+'px"><path d="M20,6h-8l-2-2H4C2.9,4,2,4.9,2,6v12c0,1.1,0.9,2,2,2h16c1.1,0,2-0.9,2-2V8C22,6.9,21.1,6,20,6z"/></svg>';
      }else if(type === "xls" || type === "xlsx"){
        return '<svg fill="#cccccc" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="'+width+'px" height="'+height+
        'px">    <path d="M 12 3 L 2 5 L 2 19 L 12 21 L 12 3 z M 14 5 L 14 7 L 16 7 L 16 9 L 14 9 L 14 11 L 16 11 L 16 13 L 14 13 L 14 15 L 16 15 L 16 17 L 14 17 L 14 19 L 22 19 L 22 5 L 14 5 z M 18 7 L 20 7 L 20 9 L 18 9 L 18 7 z M 4.1757812 8.296875 L 5.953125 8.296875 L 6.8769531 10.511719 C 6.9519531 10.692719 7.0084063 10.902625 7.0664062 11.140625 L 7.0917969 11.140625 C 7.1247969 10.997625 7.1919688 10.779141 7.2929688 10.494141 L 8.3222656 8.296875 L 9.9433594 8.296875 L 8.0078125 11.966797 L 10 15.703125 L 8.2714844 15.703125 L 7.1582031 13.289062 C 7.1162031 13.204062 7.0663906 13.032922 7.0253906 12.794922 L 7.0097656 12.794922 C 6.9847656 12.908922 6.934375 13.079594 6.859375 13.308594 L 5.7363281 15.703125 L 4 15.703125 L 6.0605469 11.996094 L 4.1757812 8.296875 z M 18 11 L 20 11 L 20 13 L 18 13 L 18 11 z M 18 15 L 20 15 L 20 17 L 18 17 L 18 15 z"/></svg>';
      }else if(type === "csv"){
        // Need a svg csv icon
        return '<svg fill="#cccccc" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="'+width+'px" height="'+height+'px">    <path d="M14,2H6C4.9,2,4,2.9,4,4v16c0,1.1,0.9,2,2,2h12c1.1,0,2-0.9,2-2V8L14,2z M18.5,9H13V3.5L18.5,9z"/></svg>';
      }else if(type === "zip"){
        // Need a svg archive icon
        //return '<svg fill="#cccccc" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="'+width+'px" height="'+height+'px"><path d="M20,6h-8l-2-2H4C2.9,4,2,4.9,2,6v12c0,1.1,0.9,2,2,2h16c1.1,0,2-0.9,2-2V8C22,6.9,21.1,6,20,6z"/></svg>';
        return '<svg fill="#cccccc" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="'+width+'px" height="'+height+'px"><title/><desc/><defs/><g fill="none" fill-rule="evenodd" id="Page-1" stroke="none" stroke-width="1"><g fill="#cccccc" id="icon-124-document-file-zip"><path d="M21,26 L21,28.0025781 C21,29.1090746 20.1057238,30 19.0025781,30 L3.99742191,30 C2.89092539,30 2,29.1012878 2,27.9926701 L2,5.00732994 C2,3.89833832 2.8992496,3 4.0085302,3 L14,3 L14,9.00189865 C14,10.1132936 14.8980806,11 16.0059191,11 L21,11 L21,13 L12.0068483,13 C10.3462119,13 9,14.3422643 9,15.9987856 L9,23.0012144 C9,24.6573979 10.3359915,26 12.0068483,26 L21,26 L21,26 Z M15,3 L15,8.99707067 C15,9.55097324 15.4509752,10 15.990778,10 L21,10 L15,3 L15,3 Z M11.9945615,14 C10.8929956,14 10,14.9001762 10,15.992017 L10,23.007983 C10,24.1081436 10.9023438,25 11.9945615,25 L29.0054385,25 C30.1070044,25 31,24.0998238 31,23.007983 L31,15.992017 C31,14.8918564 30.0976562,14 29.0054385,14 L11.9945615,14 L11.9945615,14 Z M14,22 L18,17 L18,16 L13,16 L13,17 L17,17 L13,22 L13,23 L18,23 L18,22 L14,22 L14,22 Z M20,17 L20,22 L19,22 L19,23 L22,23 L22,22 L21,22 L21,17 L22,17 L22,16 L19,16 L19,17 L20,17 L20,17 Z M23,18 L23,23 L24,23 L24,20 L25.9951185,20 C27.102384,20 28,19.1122704 28,18 C28,16.8954305 27.1061002,16 25.9951185,16 L23,16 L23,18 L23,18 Z M24,17 L24,19 L26.0010434,19 C26.5527519,19 27,18.5561352 27,18 C27,17.4477153 26.5573397,17 26.0010434,17 L24,17 L24,17 Z" id="document-file-zip"/></g></g></svg>';
      }

      // Unknown
      return "";
    }

    show_ingesting_popup(root_ext, selected_files = [], current_paths = [], folder_contents = []) {
      const arr_paths = this.did_format_zip_items(folder_contents);
      //let _this = this;
      // Clear the previous popup
      this._psp_popup_sheet_data.innerHTML = "";
      this._is_popup_openning = false;

      this._psp_popup_sheet_title.innerHTML = "Select the file to import";
      /*
      if (selected_files.length + current_paths.length > 0) {
        this._psp_popup_sheet_button_back.classList.remove("hidden");
      } else {
        this._psp_popup_sheet_button_back.classList.add("hidden");
      }
      var clone_node = this._psp_popup_sheet_button_back.cloneNode(true);
      this._psp_popup_sheet_button_back.parentNode.replaceChild(clone_node, this._psp_popup_sheet_button_back);
      this._psp_popup_sheet_button_back = clone_node;
      this._psp_popup_sheet_button_back.addEventListener("mousedown", (e)=>{
        if (selected_files.length + current_paths.length > 0) {
          let re_fectch = false;
          let new_current_paths = [...current_paths];
          let new_selected_files = [...selected_files];
          let new_sub_ext = root_ext;
          if (current_paths.length > 0) {
            new_current_paths = new_current_paths.slice(0, current_paths.length - 1);
            if (new_current_paths.length === 0) {
              if (new_selected_files.length > 0) {
                new_sub_ext = /[^.]+$/.exec(new_selected_files[new_selected_files.length - 1])[0];
              }
            } else {
              new_sub_ext = "folder";
            }
          } else {
            let latest_file = selected_files[selected_files.length - 1];
            let latest_path = _this._path_to_array(latest_file);
            new_selected_files = selected_files.slice(0, selected_files.length - 1);
            if (latest_path.length == 1) {
              new_current_paths = [];
              if (new_selected_files.length > 0) {
                new_sub_ext = /[^.]+$/.exec(new_selected_files[new_selected_files.length - 1])[0];
              }
            } else {
              new_sub_ext = "folder"
              new_current_paths = latest_path.slice(0, latest_path.length - 1);
              re_fectch = true;
            }
          }
          _this.ingest_file(undefined, root_ext, new_sub_ext, new_selected_files, new_current_paths, folder_contents, re_fectch);
        }
      });
      */
      const handle_button_back = function(e){
        if (selected_files.length + current_paths.length > 0) {
          let re_fectch = false;
          let new_current_paths = [...current_paths];
          let new_selected_files = [...selected_files];
          let new_sub_ext = root_ext;
          if (current_paths.length > 0) {
            new_current_paths = new_current_paths.slice(0, current_paths.length - 1);
            if (new_current_paths.length === 0) {
              if (new_selected_files.length > 0) {
                //new_sub_ext = /[^.]+$/.exec(new_selected_files[new_selected_files.length - 1])[0];
                new_sub_ext = perspective.RE_EXTENSION.exec(new_selected_files[new_selected_files.length - 1])[1];
              }
            } else {
              new_sub_ext = "folder";
            }
          } else {
            let latest_file = selected_files[selected_files.length - 1];
            let latest_path = this._path_to_array(latest_file);
            new_selected_files = selected_files.slice(0, selected_files.length - 1);
            if (latest_path.length == 1) {
              new_current_paths = [];
              if (new_selected_files.length > 0) {
                //new_sub_ext = /[^.]+$/.exec(new_selected_files[new_selected_files.length - 1])[0];
                new_sub_ext = perspective.RE_EXTENSION.exec(new_selected_files[new_selected_files.length - 1])[1];
              }
            } else {
              new_sub_ext = "folder"
              new_current_paths = latest_path.slice(0, latest_path.length - 1);
              re_fectch = true;
            }
          }
          this.ingest_file(undefined, root_ext, new_sub_ext, new_selected_files, new_current_paths, folder_contents, re_fectch);
        }
      }

      let zip_contain_only_one_folder = false;
      if (selected_files.length === 0 && current_paths.length === 1) {
        // Check if it only contains 1 folder
        zip_contain_only_one_folder = folder_contents.filter((arr_v)=>{
          if (arr_v && arr_v.length > 0){
            const ignore_file_index = arr_v.findIndex((v)=>{
              if (perspective.IGNORE_FILE_NAMES.includes(v)){
                return true;
              }
              return false;
            });

            if (ignore_file_index !== -1){
              return false;
            }

            return true;
          }
        }).every((arr_v)=> arr_v && arr_v.length > 1 && arr_v[0] === current_paths[0]);
      }

      this._psp_popup_sheet_back_container.innerHTML = "";
      if (selected_files.length + current_paths.length > 0 && !zip_contain_only_one_folder) {
        this._psp_popup_sheet_back_container.classList.remove("hidden");

        let div_btn_back_content = document.createElement("div");

        div_btn_back_content.setAttribute("class", "docs-icon inline-block");

        var div_btn_back = document.createElement("div");
        div_btn_back.setAttribute("class", "icon-img-container icon-img icon-img-back zip-btn-back");
        div_btn_back.addEventListener("click", handle_button_back.bind(this));

        div_btn_back_content.appendChild(div_btn_back);

        this._psp_popup_sheet_back_container.appendChild(div_btn_back_content);
      }else{
        this._psp_popup_sheet_back_container.classList.add("hidden");
      }

      var ul = document.createElement('ul');
      var fragment = document.createDocumentFragment();

      let current_files = [];
      let folders = [];
      for (let i = 0; i < folder_contents.length; i++) {
        let path_arr = folder_contents[i];
        let not_in_folder = false;
        for (let j = 0; j < current_paths.length; j++) {
          if (path_arr[j] !== current_paths[j]) {
            not_in_folder = true;
            break;;
          }
        }
        if (not_in_folder) {
          continue;
        }

        path_arr = path_arr.slice(current_paths.length, path_arr.length);
        if (path_arr.length > 0 && perspective.IGNORE_FILE_NAMES.includes(path_arr[0])){
          continue;
        }

        if (path_arr.length === 1) {
          //current_files.push(path_arr.join("/"));
          current_files.push(path_arr[0]); // No need to join as it has only one item
        } else if (path_arr.length > 1 && !current_files.includes(path_arr[0])) {
          current_files.push(path_arr[0]);
          folders.push(path_arr[0]);
        }
      }

      // Check if zip file contain only one folder
      let ignore_root_folder = false;
      if (selected_files.length === 0 && current_paths.length === 0
          && current_files.length === 1 && folders.length === 1) {
          ignore_root_folder = true;
      }
      if (ignore_root_folder) {
        this.ingest_file(undefined, root_ext, "folder", selected_files, folders, folder_contents || []);
        return;
      }

      // Auto ingest if it's only a file or one sheet
      if (current_files && current_files.length === 1 && (!selected_files || selected_files.length === 0)){
        // Check if it only contains 1 file
        const fc = folder_contents.filter((arr_v)=>{
          if (arr_v && arr_v.length > 0){
            const ignore_file_index = arr_v.findIndex((v)=>{
              if (perspective.IGNORE_FILE_NAMES.includes(v)){
                return true;
              }
              return false;
            });

            if (ignore_file_index !== -1){
              return false;
            }

            return true;
          }
        });

        if (fc && fc.length ===1 && root_ext === "zip"){
          const _ext = fc[0].length > 0 ? perspective.RE_EXTENSION.exec(fc[0][fc[0].length -1])[1]: undefined;
          if (_ext !== "zip"){
            this.ingest_file(undefined, root_ext, _ext, [fc[0].join("/")], [], folder_contents || []);
            return;
          }
        }
      }

      const handle_li_link = function(e){
        //var f_name = e.target.textContent;
        const f_name = e.target ? e.target.getAttribute("data"): undefined;
        if (!f_name || !current_files || current_files.length < 1){
          return false;
        }

        if (current_files.includes(f_name) === true){
            this._psp_popup_sheet.classList.add("hidden");
            this._is_popup_openning = false;
            this.ingestingNotification(true);
            let sub_ext = null;
            let new_selected_files = [...selected_files];
            let new_current_paths = [...current_paths];
            new_current_paths.push(f_name);
            if (folders.includes(f_name)) {
              sub_ext = "folder";
            } else {
              //sub_ext = /[^.]+$/.exec(f_name)[0];
              sub_ext = perspective.RE_EXTENSION.exec(f_name)[1];
              new_selected_files.push(new_current_paths.join("/"));
              new_current_paths = [];
            }
            this.ingest_file(undefined, root_ext, sub_ext, new_selected_files, new_current_paths, folder_contents || []);
        }
      }

      for (var i = 0; i < current_files.length; i++){
        var li = document.createElement('li');
        //li.textContent = current_files[i];
        li.setAttribute("data", current_files[i]);
        const type = folders.includes(current_files[i]) === true ? "folder" : perspective.RE_EXTENSION.exec(current_files[i])[1];
        let div = document.createElement("div");
        div.setAttribute("class", "sheet-row flex");
        div.setAttribute("data", current_files[i]);

        let div_icon = document.createElement("div");
        div_icon.setAttribute("class", "sheet-left-icon");
        div_icon.innerHTML = this._get_file_type_svg_icon(type);
        div_icon.setAttribute("data", current_files[i]);

        let div_content = document.createElement("div");
        div_content.setAttribute("class", "sheet-content");
        div_content.innerHTML = current_files[i];
        div_content.setAttribute("data", current_files[i]);

        div.appendChild(div_icon);
        div.appendChild(div_content);

        li.appendChild(div);
        /*
        li.addEventListener("mousedown", event => {
          var f_name = event.target.textContent;
          if (!f_name || !current_files || current_files.length < 1){
            return false;
          }

          if (current_files.includes(f_name) === true){
              _this._psp_popup_sheet.classList.add("hidden");
              _this._is_popup_openning = false;
              _this.ingestingNotification(true);
              let sub_ext = null;
              let new_selected_files = [...selected_files];
              let new_current_paths = [...current_paths];
              new_current_paths.push(f_name);
              if (folders.includes(f_name)) {
                sub_ext = "folder";
              } else {
                sub_ext = /[^.]+$/.exec(f_name)[0];
                new_selected_files.push(new_current_paths.join("/"));
                new_current_paths = [];
              }
              _this.ingest_file(undefined, root_ext, sub_ext, new_selected_files, new_current_paths, folder_contents || []);
          }

        });
        */
        li.addEventListener("click", handle_li_link.bind(this));
        fragment.appendChild(li);
      }
      ul.appendChild(fragment);

      // Add data
      this._psp_popup_sheet_data.appendChild(ul);
      ////this._pivot_ingesting_data_percentage.classList.add("hidden");
      ////this._pivot_querying_percentage.classList.add("hidden");
      this._psp_popup_sheet.classList.remove("hidden");
      ////this.handle_status_bar_text("select_sheets");

      this.sheetsNotification();
      this._is_popup_openning = true;
    }

    /**
     * Get folder contents from array of file name's path
     * @param {*} file_names 
     */
    _get_folder_contents(file_names = []) {
      let folder_contents = [];
      for (let i = 0; i < file_names.length; i++) {
        let arr_path = this._path_to_array(file_names[i]);
        const ignore_file_index = arr_path.findIndex((v)=>{
          if (perspective.IGNORE_FILE_NAMES.includes(v)){
            return true;
          }
          return false;
        });

        if (ignore_file_index !== -1){
          continue;
        }

        folder_contents.push(arr_path);
      }
      return folder_contents;
    }

    ingest_file(result, root_ext, extension, selected_files = [], current_paths = [], folder_contents = [], re_fectch = false) {
      let _this = this;
      var convert_file_cb = (file_data, selected_files, sheet_name) => {
        _this._begin_query_time = new Date().getTime();
        let convert_file_promise = _this.convert_file(file_data, selected_files, sheet_name, root_ext);
        convert_file_promise.then((result) => {
            // If the Arrow buffer size is above 224MB, enter in "Memory Pressure" mode
            // That is, we will no more keep the "previous view" when doing a query to reduce memory usage
            if (result.byteLength >= 234881024) {
                console.debug("Arrow buffer exceed 224MB");
                console.log("Entering memory pressure mode");
                //console.debug(result);
                _this.memory_pressure = true;
            }
            else {
                _this.memory_pressure = false;
            }
            _this.get_coumn_types().then(column_types => {
                var table = perspective.worker().table(result, {
                    column_types: column_types
                });

                _this.ingestedNotification();
                // Show no source for case ingest file error
                _this.load(table).then(function(){
                    _this.loadedNotification();
                    ////_this.handle_status_bar_text("running_query");
                    //_this.ingestedNotification();
                }).catch(function(err){
                    _this.loadErrors();
                });
            });
        }).catch(function(err){
            // Show no source for case ingest file error
            ////_this.handle_status_bar_text("no_source");
            if (err && err.code === 520){
                _this.ingestErrors(_this.ERR_FILE_PARSER);
            }else{
                _this.ingestErrors();
            }
        });
      };
      if (extension === "xls" || extension === "xlsx") {
        let probe_file_promise = this.probe_file(result, root_ext, selected_files);
        probe_file_promise.then((sheet_names) => {
            if (sheet_names.length == 0) {
                _this.ingestErrors();
            } else if (sheet_names.length == 1) {
                convert_file_cb(undefined, selected_files);
            } else {
              // Clear the previous popup
              _this._psp_popup_sheet_data.innerHTML = "";
              _this._is_popup_openning = false;

              _this._psp_popup_sheet_title.innerHTML = "Select the sheet to import";
              var ul = document.createElement('ul');
              var fragment = document.createDocumentFragment();
              /*
              if (selected_files.length > 0) {
                _this._psp_popup_sheet_button_back.classList.remove("hidden");
              } else {
                _this._psp_popup_sheet_button_back.classList.add("hidden");
              }
              var clone_node = _this._psp_popup_sheet_button_back.cloneNode(true);
              _this._psp_popup_sheet_button_back.parentNode.replaceChild(clone_node, _this._psp_popup_sheet_button_back);
              _this._psp_popup_sheet_button_back = clone_node;
              _this._psp_popup_sheet_button_back.addEventListener("mousedown", (e)=>{
                if (selected_files.length > 0) {
                  let latest_path = _this._path_to_array(selected_files[selected_files.length - 1]);
                  let new_sub_ext = root_ext;
                  let new_selected_files = selected_files.slice(0, selected_files.length - 1);
                  if (latest_path.length > 1) {
                    current_paths = latest_path.slice(0, latest_path.length - 1);
                    new_sub_ext = "folder";
                  } else {
                    if (new_selected_files.length > 0) {
                      new_sub_ext = /[^.]+$/.exec(new_selected_files[new_selected_files.length - 1])[0];
                    }
                  }
                  _this.ingest_file(undefined, root_ext, new_sub_ext, new_selected_files, current_paths, folder_contents);
                }
              });
              */
              const handle_button_back = function(e){
                if (selected_files.length > 0) {
                  let latest_path = _this._path_to_array(selected_files[selected_files.length - 1]);
                  let new_sub_ext = root_ext;
                  let new_selected_files = selected_files.slice(0, selected_files.length - 1);
                  if (latest_path.length > 1) {
                    current_paths = latest_path.slice(0, latest_path.length - 1);
                    new_sub_ext = "folder";
                  } else {
                    if (new_selected_files.length > 0) {
                      //new_sub_ext = /[^.]+$/.exec(new_selected_files[new_selected_files.length - 1])[0];
                      new_sub_ext = perspective.RE_EXTENSION.exec(new_selected_files[new_selected_files.length - 1])[1];
                    }
                  }
                  this.ingest_file(undefined, root_ext, new_sub_ext, new_selected_files, current_paths, folder_contents);
                }
              };

              this._psp_popup_sheet_back_container.innerHTML = "";
              let have_back_button = false;
              if (selected_files.length > 1) {
                have_back_button = true;
              } else if (selected_files.length === 1) {
                // Check if it only contains 1 file
                const fc = folder_contents.filter((arr_v)=>{
                  if (arr_v && arr_v.length > 0){
                    const ignore_file_index = arr_v.findIndex((v)=>{
                      if (perspective.IGNORE_FILE_NAMES.includes(v)){
                        return true;
                      }
                      return false;
                    });

                    if (ignore_file_index !== -1){
                      return false;
                    }

                    return true;
                  }
                });

                if (fc && fc.length > 1 && root_ext === "zip"){
                  have_back_button = true;
                }
              }
              if (have_back_button) {
                this._psp_popup_sheet_back_container.classList.remove("hidden");
                let div_btn_back_content = document.createElement("div");

                div_btn_back_content.setAttribute("class", "docs-icon inline-block");

                var div_btn_back = document.createElement("div");
                div_btn_back.setAttribute("class", "icon-img-container icon-img icon-img-back zip-btn-back");
                div_btn_back.addEventListener("click", handle_button_back.bind(_this));

                div_btn_back_content.appendChild(div_btn_back);

                this._psp_popup_sheet_back_container.appendChild(div_btn_back_content);
              }else{
                this._psp_popup_sheet_back_container.classList.add("hidden");
              }

              const handle_li_link = function(e){
                var s_name = e.target.textContent;
                if (!s_name || !sheet_names || sheet_names.length < 1){
                  return false;
                }

                if (sheet_names.includes(s_name) === true){

                    this._psp_popup_sheet.classList.add("hidden");
                    this._is_popup_openning = false;
                    this.ingestingNotification(true);
                    ////this.handle_status_bar_text("ingesting");
                    convert_file_cb(undefined, selected_files, s_name);
                }
              };

              for (var i = 0; i < sheet_names.length; i++){
                var li = document.createElement('li');
                li.textContent = sheet_names[i];
                li.setAttribute("data", sheet_names[i]);
                /*
                li.addEventListener("mousedown", event => {
                  var s_name = event.target.textContent;
                  if (!s_name || !sheet_names || sheet_names.length < 1){
                    return false;
                  }

                  if (sheet_names.includes(s_name) === true){

                      _this._psp_popup_sheet.classList.add("hidden");
                      _this._is_popup_openning = false;
                      _this.ingestingNotification(true);
                      ////this.handle_status_bar_text("ingesting");
                      convert_file_cb(undefined, selected_files, s_name);
                  }

                });
                */
                li.addEventListener("click", handle_li_link.bind(_this));
                fragment.appendChild(li);
              }
              ul.appendChild(fragment);

              // Add data
              this._psp_popup_sheet_data.appendChild(ul);
              ////this._pivot_ingesting_data_percentage.classList.add("hidden");
              ////this._pivot_querying_percentage.classList.add("hidden");
              this._psp_popup_sheet.classList.remove("hidden");
              ////this.handle_status_bar_text("select_sheets");

              this.sheetsNotification();
              this._is_popup_openning = true;
            }
        });
      } else if (extension === "zip") {
        let probe_compress_promise = this.probe_compress(result, root_ext, selected_files);
        probe_compress_promise.then((file_names) => {
          if (file_names.length == 0) {
              _this.ingestErrors();
          } else {
            let new_folder_contents = _this._get_folder_contents(file_names);
            if (new_folder_contents.length == 1 && (!selected_files || selected_files.length === 0)) {
                let file_path = new_folder_contents[0].join("/");
                //let new_sub_ext = /[^.]+$/.exec(file_path)[0];
                let new_sub_ext = perspective.RE_EXTENSION.exec(file_path)[1];
                if (new_sub_ext !== "zip") {
                  let new_selected_files = [...selected_files];
                  new_selected_files.push(file_path);
                  this.ingest_file(undefined, root_ext, new_sub_ext, new_selected_files, [], new_folder_contents);
                } else {
                  _this.show_ingesting_popup(root_ext, selected_files, current_paths, new_folder_contents);
                }
                //convert_file_cb(undefined, selected_files);
            } else {
              _this.show_ingesting_popup(root_ext, selected_files, current_paths, new_folder_contents);
            }
          }
        });
      } else if (extension === "folder") {
        if (re_fectch) {
          let probe_compress_promise = this.probe_compress(result, root_ext, selected_files);
          probe_compress_promise.then((file_names) => {
            let new_folder_contents = _this._get_folder_contents(file_names);
            _this.show_ingesting_popup(root_ext, selected_files, current_paths, new_folder_contents);
          });
        } else {
          _this.show_ingesting_popup(root_ext, selected_files, current_paths, folder_contents);
        }
      } else {
        convert_file_cb(result, selected_files);
      }
    }

    uploadFile(file) {
        var _this = this;
        this._pivot_drop_file_area_error.classList.remove("highlight");
        this.ingestingNotification(true);
        // Show status start convert data
        ////this.handle_status_bar_text("ingesting");
        this._file_name = (file && file.name) ? file.name.replace(/\.[^/.]+$/, ""): "";
        var extension = (file && file.name) ? /[^.]+$/.exec(file.name)[0]: "";
        let blob_to_array_buffer_promise = (new Response(file)).arrayBuffer();
        blob_to_array_buffer_promise.then((result) => {
          _this.ingest_file(result, extension, extension, []);
        });
    }

    _drop_file_highlight(event){

      if (!this._show_grid_data){
        this._pivot_drop_file_area_highlight.classList.add("highlight");
      }else{
        if (this._contains_row_dragging){
          // Perspective row move. Ignore this case
        }else{
          this._pivot_error_message_id.innerHTML = this.ERR_MULTIPLE_FILE;
          this._pivot_drop_file_area_error.classList.add("highlight");
        }
      }
    }

    /**
     * Remove class "highlight"
     * @param {*} event
     */
    _drop_file_unhighlight(event){
      if (!this._show_grid_data){
        this._pivot_drop_file_area_highlight.classList.remove("highlight");
      }
      else{
        this._pivot_drop_file_area_error.classList.remove("highlight");
      }
    }

    /**
     * Add class "highlight" to drop file area
     */
    _cancel_query_highlight() {
        this._pivot_error_message_id.innerHTML = this.ERR_CANCEL_QUERY;
        this._pivot_drop_file_area_error.classList.add("highlight");
    }

    /**
     * remove class "highlight" to drop file area
     */
    _cancel_query_unhighlight() {
        this._pivot_drop_file_area_error.classList.remove("highlight");
    }

    // edits state
    _set_computed_column_input(event) {
      console.log('-----_set_computed_column_input----', event);

        event.detail.target.appendChild(this._new_row(event.detail.column.name, event.detail.column.type, undefined, undefined, undefined, undefined, undefined, "computed_columns"));
        this._update_column_view();
    }

    _parse_input(text) {
      var expression = text;
      if (expression.length <= 1 && !expression.startsWith('=')) return;
      
      expression = expression.substr(1);
      if (expression.length === 0) return;

      try {
          // Use this just for validation. On anything short of a massive
          // expression, this should have no performance impact as we
          // share an instance of the parser throughout the viewer.
          this._parsed_expression = this._computed_expression_parser.parse(expression);
      } catch (e) {
        // Generate a list of tokens from the expression, cleaning out
        // whitespace tokens and without throwing any errors.
        const lex_result = this._computed_expression_parser.lex(expression);

        // Check if the expression has a fragment of a column name,
        // i.e. if it's been opened with a quote but not closed
        const name_fragments = expression.match(/(["'])[\s\w()]*?$/);
        const has_name_fragments = name_fragments && name_fragments.length > 0 && !/['"]\s/.test(name_fragments[0]);

        // Get the last non-whitespace token from the lexer result
        const last_token = this._computed_expression_parser.get_last_token(lex_result);
        let show_column_names = has_name_fragments;

        if (last_token) {
            // Check if the last token is a column name - if so, don't show
            // autocomplete as we don't want to show autocomplete after a
            // completed column name.
            const is_column_name = tokenMatcher(last_token, ColumnName);

            // Don't show if last token is a parenthesis, as that indicates
            // a closed logical block.
            const is_paren = tokenMatcher(last_token, RightParen);

            // And not if the last token is `as/AS`, as that indicates a
            // custom column name supplied by the user.
            const is_alias = tokenMatcher(last_token, As);

            // If the last token is an operator, force autocomplete to show.
            const is_operator = tokenMatcher(last_token, OperatorTokenType);

            // Show column names if the last token is an operator,
            // OR if the last input is a column name fragment and the
            // last token is not a column name, a paren, or an alias.
            show_column_names = is_operator || (show_column_names && !is_column_name && !is_paren && !is_alias);
        }

        // Get autocomplete suggestions from Chevrotain
        let suggestions = [];

        // Filter down those suggestions by an input type, if possible
        let input_types, match_types;

        // Go to the last function or operator token present in the
        // entire expression, and use it to calculate input types.
        const last_function_or_operator = this._computed_expression_parser.get_last_token_with_types([FunctionTokenType, OperatorTokenType], lex_result);

        if (last_function_or_operator) {
            input_types = last_function_or_operator.tokenType.input_types;
            match_types = true;
        } else if (last_token && tokenMatcher(last_token, ColumnName)) {
            // get functions and operators that take the column type
            // as input, but don't check whether return types match
            input_types = [this._get_type(last_token.payload)];
            match_types = false;
        }

        suggestions = this._computed_expression_parser.get_autocomplete_suggestions(expression, lex_result, input_types, match_types);

        console.log('suggestions---------', suggestions);
        if (show_column_names) {
            let column_names;

            if (last_function_or_operator) {
                // create a list of function/operator suggestions followed
                // by column names of the correct input type.
                column_names = this._get_view_column_names_by_types(input_types);
            } else {
                // Show all column names
                column_names = this._get_view_all_column_names();
            }

            // Convert list of names into objects with `label` and `value`
            let column_name_suggestions = this._make_column_name_suggestions(column_names);

            // Filter down by `startsWith` and `contains`, putting the
            // more exact matches first.
            if (has_name_fragments) {
                const fragment = name_fragments[0].substring(1);
                const exact_matches = [];
                const fuzzy_matches = [];

                for (const suggestion of column_name_suggestions) {
                    const column_name = suggestion.label.toLowerCase();
                    const partial = fragment.toLowerCase();

                    if (column_name.startsWith(partial)) {
                        exact_matches.push(suggestion);
                    } else if (column_name.includes(partial)) {
                        fuzzy_matches.push(suggestion);
                    }
                }

                column_name_suggestions = exact_matches.concat(fuzzy_matches);
            }

            if (last_function_or_operator) {
                suggestions = suggestions.concat(column_name_suggestions);
            } else {
                suggestions = column_name_suggestions;
            }

            // Render column names inside autocomplete
            // const markup = this.make_autocomplete_markup(suggestions);
            // this._autocomplete.render(markup);
            return;
        } else {
            if (suggestions.length > 0) {
                // Show autocomplete and not error box
                // const markup = this.make_autocomplete_markup(suggestions);
                // this._autocomplete.render(markup);
                return;
            } else if (last_token && tokenMatcher(last_token, As)) {
                // don't show error if last token is alias
                return;
            } else {
                // Expression is syntactically valid but unparsable
                const message = e.message ? e.message : JSON.stringify(e);
                // this._set_error(message, this._error);
                return;
            }
        }
      }
    }

    // edits state
    async _save_computed_expression(event) {
        console.log('-----_save_computed_expression----', event.detail);

        var expression = event.detail.expression;
        if (expression.length <= 1 && !expression.startsWith('=')) return;
        
        expression = expression.substr(1);
        if (expression.length === 0) return;

        let computed_columns = JSON.parse(this.getAttribute("computed-columns"));
        if (computed_columns === null) {
            computed_columns = [];
        }

        if (computed_columns.map(c => c.expression).includes(expression)) {
            console.log(`${expression} already exists.`);
            return;
        }

        // check new column or edited column
        const column_name = event.detail.input.event.columnProperties.colDef && event.detail.input.event.columnProperties.colDef.headerName;

        if (column_name) {
          for (const computed of computed_columns) {
            if (computed.column == column_name) {
              computed.expression = expression;
              break;
            }
          }
        }
        else {
          const cols = await this._table.columns();
          let computed_col_name = "NewColumn";
          let computed_col_idx = computed_columns.length + 1;
          while (cols.includes(computed_col_name + computed_col_idx)) computed_col_idx++;

          computed_columns.push({column: `${computed_col_name}${computed_col_idx}`, expression});
        }
        
        this.setAttribute("computed-columns", JSON.stringify(computed_columns));
    }

    async _type_check_computed_expression(event) {
      const parsed = event.detail.parsed_expression || [];
      if (parsed.length === 0) {
          this._formula_bar._type_check_expression({});
          return;
      }
      const functions = {};
      for (const col of parsed) {
          functions[col.column] = col.computed_function_name;
      }
      const schema = await this._table.computed_schema(parsed);
      // Look at the failing values, and get their expected types
      const expected_types = {};
      for (const key in functions) {
          if (!schema[key]) {
              expected_types[key] = await this._table.get_computation_input_types(functions[key]);
          }
      }

      this._formula_bar._type_check_expression(schema, expected_types);
    }

    // edits state, calls reload
    async _create_computed_column(event) {
      console.log('-----_create_computed_column----', event);

        const data = event.detail;
        let computed_column_name = data.column_name;

        const cols = await this._table.columns();
        const schema = await this._table.schema();
        // edit overwrites last column, otherwise avoid name collision
        if (cols.includes(computed_column_name)) {
            console.log(computed_column_name);
            computed_column_name += ` ${Math.round(Math.random() * 100)}`;
        }

        var input_type = data.computation.input_type;
        if (data.computation.input_type == 'any') {
            input_type = schema[data.input_columns[0].name];
        }

        var return_type = data.computation.return_type;
        if (data.computation.return_type == 'any') {
            return_type = schema[data.input_columns[0].name];
        }

        const params = [
            {
                computation: data.computation,
                column: computed_column_name,
                func: data.computation.func,
                inputs: data.input_columns.map(col => col.name),
                input_type: input_type,
                type: return_type
            }
        ];

        // const table = this._table.add_computed(params);
        // await this._load_table(table, true);
        this._update_column_view();
        this._run_query();
    }

    // create pivot computed column
    async _create_pivot_computed_column(data) {
        const inactive_columns = this._get_view_columns({active: false});
        const name = data.column_name;
        if (inactive_columns.includes(name)) return;
        const schema = await this._view.agg_custom_schema();
        const type = schema[name];
        const aggregate = "custom";
        const data_format = perspective.DATA_FORMAT_DEFAULTS[type];
        const row = this._new_row(name, type, aggregate, data_format, null, null, {is_pivot: data.is_pivot, ...data.computation}, "inactive_columns");
        this._pivotList.addInactiveRow(row, true);
    }

    /**
     * Action after visibility clicked
     * @param {*} is_active
     */
    _after_visibility_clicked(is_active = false, cols = null) {
        this._check_responsive_layout();
        if (!is_active){
          if (!this.shadowRoot.querySelector("#app").classList.contains("columns_horizontal")){
              //this._plugin._resize.call(this, true);
          }
        }
        //let cols = this._get_view_columns();
        cols = cols || this._get_view_column_base_names();

        //this._update_column_view(cols);
        if (this.is_cinfo_pivot(false)) {
            // add or remove combined column
            this._update_combined_column();

            this._update_column_view(cols);
        }else if(this.is_cinfo_search()){
            this.visibility_column_notification(false);
            this._update_column_view(cols);
        }else{
            this.visibility_column_notification(false);
            this._update_column_without_view(cols);
            this._plugin.notify_column_updates.call(this, this.get_cinfo(false));
        }
    }

    /**
     *
     * @param {*} row
     */
    _perform_hide_column(row) {
        var cols = this._get_view_column_base_names();
        var reset = false;
        var options = {};
        var _is_cinfo_pivot = this.is_cinfo_pivot(false);
        if (_is_cinfo_pivot) {
            let old_filters = JSON.parse(this.getAttribute("filters")) || [];
            let new_filters = [...old_filters];
            var name = row.getAttribute("name");
            let have_pivot_agg_level_on = false;

            // Remove filters with filter by isn't itself (remove having) and name is hide column name
            new_filters = new_filters.filter(f => f.n !== name || (!f.filter_by || f.filter_by === f.n));

            // Remove elements of column name in values
            var old_values = JSON.parse(this.getAttribute("value-pivots")) || [];
            var new_values = [];
            let filter_by_list = [];
            old_values.forEach(pivot => {
                if (name !== pivot.n) {
                    new_values.push(pivot);
                } else {
                    filter_by_list.push(this._get_disp_name_aggregate(pivot.n, pivot.agg, pivot.p, pivot.st || "default"));
                }
            });
            if (filter_by_list.length > 0) {
                new_filters = new_filters.filter(f => !filter_by_list.includes(f.filter_by));
            }

            // Remove items of tag in row area
            var row_pivots = JSON.parse(this.getAttribute("row-pivots")) || [];
            let index = row_pivots.findIndex(pivot => pivot.n === name && pivot.agg_l && pivot.agg_l !== "OFF");
            if (index !== -1) {
                have_pivot_agg_level_on = true;
            }
            //var new_row_pivots = row_pivots.filter(x => x !== name);
            var new_row_pivots = row_pivots.filter((v) => v.n !== name);
            if (row_pivots.length !== new_row_pivots.length) {
                options.row_pivots = {
                    new_value: new_row_pivots,
                    old_value: row_pivots
                };
            }

            // Remove items of tag in column area
            var column_pivots = JSON.parse(this.getAttribute("column-pivots")) || [];
            if (!have_pivot_agg_level_on) {
                index = column_pivots.findIndex(pivot => pivot.n === name && pivot.agg_l && pivot.agg_l !== "OFF");
                if (index !== -1) {
                    have_pivot_agg_level_on = true;
                }
            }
            //var new_column_pivots = column_pivots.filter(x => x !== name);
            var new_column_pivots = column_pivots.filter((v) => v.n !== name);
            if (column_pivots.length !== new_column_pivots.length) {
                options.column_pivots = {
                    new_value: new_column_pivots,
                    old_value: column_pivots
                };
            }

            var pivots = new_row_pivots.concat(new_column_pivots).concat(new_values);
            if ((pivots.length === 1 && pivots[0].n === perspective.COMBINED_NAME) || pivots.length === 0) {
                new_column_pivots = [];
                options.column_pivots = {
                    new_value: new_column_pivots,
                    old_value: column_pivots
                };
                new_row_pivots = [];
                options.row_pivots = {
                    new_value: new_row_pivots,
                    old_value: row_pivots
                };
                new_values = [];
                cols = this.c_info.filter(f => f["active"]).map(m => m["name"]);
                reset = true;
                options.active_cols = [];
                this._get_view_dom_columns("#value_pivots perspective-row").forEach(col => {
                    options.active_cols.push([col.getAttribute("name"), col.getAttribute("type"), col.getAttribute("aggregate"),
                            col.getAttribute("data_format"), col.getAttribute("computed"),
                            col.getAttribute("show_type")]);
                });
            }
            this.setAttribute("value-pivots", JSON.stringify(new_values));
            if (new_values.length !== old_values.length) {
                options.value_pivots = {
                    old_value: old_values,
                    new_value: new_values
                };
            }
            if (have_pivot_agg_level_on) {
                index = new_filters.findIndex(f => f.n === name);
                if (index !== -1) {
                    let filter = {...new_filters[index]};
                    filter.ignore_list = [];
                    filter.selected_list = [];
                    filter.unselected_all = false;
                    filter.search = "";
                    if (this._check_empty_filter(filter)) {
                        new_filters = new_filters.filter(f => f.n !== name);
                    } else {
                        new_filters[index] = filter;
                    }
                }
            }
            if (old_filters.length > new_filters.length) {
                options.viewer_attributes = [{
                    old_value: JSON.stringify(old_filters),
                    new_value: JSON.stringify(new_filters),
                    attribute: "filters"
                }]
                this.setAttribute("filters", JSON.stringify(new_filters));
            }
            this.setAttribute("row-pivots", JSON.stringify(new_row_pivots));
            this.setAttribute("column-pivots", JSON.stringify(new_column_pivots));
        }
        this._handle_manage_action(perspective.ACTION_TYPE.hide_column, row, options,
            _ => {
                if (reset){
                    this._update_checkall_fields_visibility(false);
                }
                this._after_visibility_clicked(false);
            },
            _ => {
                if (reset){
                  this._auto_mark_checkall_fields(this.c_info);
                  this._update_checkall_fields_visibility(true);
                }
                this._update_column_view(cols, reset);
            });

        if (_is_cinfo_pivot) {
            if (reset){
              this._auto_mark_checkall_fields(this.c_info);
              this._update_checkall_fields_visibility(true);
            }
            this._update_column_view(cols, reset);
        } else {
            this._after_visibility_clicked(false, cols);
        }
    }

    /**
     * check box clicked for visibility in active columns
     * @param {*} ev
     */
    _column_visibility_clicked(ev) {
        this.close_popup();
        let parent = ev.currentTarget;
        let is_active = parent.getAttribute('container') == "active_columns";
        if (is_active) {
            // Enable zero tags for left panel
            /*if (this._get_visible_column_count() === 1 && !parent.classList.contains("computed-pivot")) {
                return;
            }*/
            if (ev.detail.shiftKey) {
                for (let child of this._pivotList.getActiveCols()) {
                    if (child !== parent) {
                        this._pivotList.removeActiveRow(child);
                    }
                }
            } else {
                this._pivotList.removeActiveRow(parent);
                this._perform_hide_column(parent);
            }
            this._pivotList.refresh();
        } else {
            // check if we're manipulating computed column input
            if (ev.path && ev.path[1].classList.contains("psp-cc-computation__input-column")) {
                //  this._computed_column._register_inputs();
                this._computed_column.deselect_column(ev.currentTarget.getAttribute("name"));
                this._update_column_view();
                return;
            }
            if ((ev.detail.shiftKey && this._plugin.selectMode === "toggle") || (!ev.detail.shiftKey && this._plugin.selectMode === "select")) {
                for (let child of this._pivotList.getActiveCount()) {
                    this._pivotList.removeActiveRow(child);
                }
            }
            var aggregate = this._suggestion_aggregate(parent.getAttribute("name"), parent.getAttribute("type"),
                    parent.getAttribute("period") || "none", this._get_column_show_type(parent));

            var check_name = parent.getAttribute("name");
            if (this.is_cinfo_pivot(false)) {
                check_name = this._get_disp_name_aggregate(parent.getAttribute("name"), aggregate,
                                parent.getAttribute("period") || "none", "default");
            }
            // Check name unique
            if (!this._validate_active_name(check_name)) {
                this._show_warning_message("All field names must be unique!");
                return;
            }

            if (parent.classList.contains("computed-pivot")) {
                aggregate = "custom";
            }

            let row = this._new_row(parent.getAttribute("name"), parent.getAttribute("type"), aggregate, undefined, undefined, undefined, parent.getAttribute("computed_column"), "active_columns");
            var options = {};
            if (!this.is_cinfo_pivot(false)) {
                var c_name = parent.getAttribute("name");
                var c_active = this.did_active_columns(c_name);
                var c_index = c_active.indexOf(c_name);

                if (c_index == 0) {
                    // insert a new active row to hyper list at first.
                    this._pivotList.insertActiveRow(row, 0);
                } else if (c_index > 0) {
                    // insert a new active row to hyper list at c_index.
                    this._pivotList.insertActiveRow(row, c_index);
                } else {
                    // add a new active row to hyper list.
                    this._pivotList.addActiveRow(row, true);
                }
            }else{
                var type = parent.getAttribute("type");
                var name = parent.getAttribute("name");
                var data_format = parent.getAttribute("data_format") || perspective.DATA_FORMAT_DEFAULTS[type];//this._get_default_data_format(type);
                var show_type = parent.getAttribute("show_type") || "default";
                // Enable value for case pivot (rows or columns)
                const cols = this._get_view_column_base_names();
                // Check column name existed or not and add row if not exist
                if (!cols.includes(name)) {
                    this._pivotList.addActiveRow(row, false);
                }
                // Add to row for case type is string or boolean
                // We will add to row if it doesn't exist
                var old_row_pivots = JSON.parse(this.getAttribute("row-pivots")) || [];
                var old_column_pivots = JSON.parse(this.getAttribute("column-pivots")) || [];
                if (["string", "list_string", "boolean", "list_boolean"].includes(type) && !old_row_pivots.includes(name)) {
                    var old_sort = JSON.parse(this.getAttribute("sort")) || [];
                    var new_row_pivots = [...old_row_pivots];
                    var new_sort = [...old_sort];
                    //new_row_pivots.push(name);
                    new_row_pivots.push({n: name, t: type, df: data_format, drag_id: this._generage_drag_id(), subtotals: true});
                    new_sort.push([name]);
                    this.setAttribute("row-pivots", JSON.stringify(new_row_pivots));
                    this.setAttribute("sort", JSON.stringify(new_sort));

                    // Add options for redo/undo action
                    options["row_pivots"] = {
                        new_value: JSON.stringify(new_row_pivots),
                        old_value: JSON.stringify(old_row_pivots)
                    };
                    options["sort"] = {
                        new_value: JSON.stringify(new_sort),
                        old_value: JSON.stringify(old_sort)
                    };
                } else if (["datetime", "list_datetime", "date", "list_date", "duration", "list_duration"].includes(type)
                    && !old_column_pivots.includes(name)) {
                    var old_sort = JSON.parse(this.getAttribute("sort")) || [];
                    var new_column_pivots = [...old_column_pivots];
                    var new_sort = [...old_sort];
                    //new_column_pivots.push(name);
                    new_column_pivots.push({n: name, t: type, df: data_format, drag_id: this._generage_drag_id(), subtotals: true});
                    new_sort.push([name]);
                    this.setAttribute("column-pivots", JSON.stringify(new_column_pivots));
                    this.setAttribute("sort", JSON.stringify(new_sort));

                    // Add options for redo/undo action
                    options["column_pivots"] = {
                        new_value: JSON.stringify(new_column_pivots),
                        old_value: JSON.stringify(old_column_pivots)
                    };
                    options["sort"] = {
                        new_value: JSON.stringify(new_sort),
                        old_value: JSON.stringify(old_sort)
                    };
                } else {
                    // Create new row in Values area
                    var old_values = JSON.parse(this.getAttribute("value-pivots")) || [];
                    let vname = this._get_disp_name_aggregate(name, aggregate, undefined, show_type);
                    var new_values = old_values.concat([{
                        n: name,
                        t: type,
                        agg: aggregate,
                        df: data_format,
                        st: show_type || "default",
                        drag_id: this._generage_drag_id(),
                        dname: this._get_dname_name(vname)
                    }]);
                    this.setAttribute("value-pivots", JSON.stringify(new_values));

                    options["value_pivots"] = {
                        old_value: JSON.stringify(old_values),
                        new_value: JSON.stringify(new_values)
                    };
                }
            }
            this._handle_manage_action(perspective.ACTION_TYPE.show_column, row, options,
                _ => {
                    this._after_visibility_clicked(true);
                },
                _ => {
                    this._after_visibility_clicked(false);
                });
            //this._after_visibility_clicked(is_active);
        }
        this._after_visibility_clicked(is_active);
        this._auto_mark_checkall_fields();
    }

    // Select or De-select all fields
    _column_visibility_clicked_all(ev) {

      // Only apply for non-aggregations
      if (!this.is_cinfo_pivot(false)){
          var is_checked = this._checkall_fields.checked;

          var obj_cols = {};
          var cols = [];
          var available_cols = [];
          var c_info = this.get_cinfo(true);
          const lis = this._get_view_dom_columns("#inactive_columns perspective-row");
          if (is_checked === true){

            if (this._search_fields.value === ""){
              c_info.forEach((v, i)=>{
                if (v.name === "__rownum__" || v.name === "__count__"){
                    v.active = false;
                }else{
                    v.active = true;
                    cols.push(v.name);
                    obj_cols[v.name] = v;
                }
              });
            }else{

              // Get list of the available columns based on search
              for (let l of lis){
                if (l.classList.contains("hidden") === false){
                  available_cols.push(l.getAttribute("name"));
                }
              }

              c_info.forEach((v, i)=>{
                if (available_cols.includes(v.name) === true){
                  v.active = true;
                }

                if (v.active === true){
                  cols.push(v.name);
                }
              });
            }

            // Update c_info
            this.set_cinfo(c_info);

            // Create active columns
            for (var i = 0; i<cols.length; i++){
                var j = lis.findIndex((x)=>x.getAttribute("name") === cols[i]);
                if (j != -1){

                  var aggregate = this._suggestion_aggregate(lis[j].getAttribute("name"), lis[j].getAttribute("type"),
                    lis[j].getAttribute("period") || "none", this._get_column_show_type(lis[j]));
                  if (lis[j].classList.contains("computed-pivot")) {
                      aggregate = "custom";
                  }

                  let row = this._new_row(lis[j].getAttribute("name"), lis[j].getAttribute("type"), aggregate, undefined, undefined, undefined, lis[j].getAttribute("computed_column"), "active_columns");
                  this._pivotList.addActiveRow(row);
                }
            }
            this._pivotList.refresh();
          }else{
            if (this._search_fields.value === ""){
              c_info.forEach((v, i)=>{v.active = false;});
              this.set_cinfo(c_info);
              this._pivotList.clearActiveRows();
              cols = [];
            }else{

              // Get list of the available columns based on search
              for (let l of lis){
                if (l.classList.contains("hidden") === false){
                  available_cols.push(l.getAttribute("name"));
                }
              }

              c_info.forEach((v, i)=>{
                if (available_cols.includes(v.name) === true){
                  v.active = false;
                }

                if (v.active === true){
                  cols.push(v.name);
                }
              });
              this.set_cinfo(c_info);

              var a_cols = this._pivotList.getActiveCols();
              for (var i =0; i< a_cols.length; i++){
                if (available_cols.includes(a_cols[i].getAttribute("name")) === true){
                  this._pivotList.removeActiveRow(a_cols[i]);
                }
              }

              this._pivotList.refresh();

            }
          }

          //this.visibility_column_notification(false);
          this._plugin.notify_column_updates.call(this, this.get_cinfo(false));
          this._update_column_without_view(cols);
      }else{
        this._checkall_fields.checked = false;
        return false;
      }
    }

    _auto_mark_checkall_fields(c_info){
      if (!this.is_cinfo_pivot()){
        var c_info = c_info || this.get_cinfo();
        var is_checked = c_info.findIndex((v)=>v.name != "__rownum__" && v.name != "__count__" && !v.active) != -1 ? false: true;

        this._checkall_fields.checked = is_checked;
        if (is_checked){
          this._checkall_fields.indeterminate = false;
        }else{
            this._checkall_fields.indeterminate = c_info.findIndex((v)=>v.active === true) != -1 ? true: false;
        }
      }
    }

    _update_checkall_fields_visibility(pivot_to_unpivot){

        if (pivot_to_unpivot === "undefined"){
          return;
        }

        if (pivot_to_unpivot === true){
          this._checkall_fields_checkmark.classList.remove("disable-opacity");
        }else{
          this._checkall_fields.checked = false;
          this._checkall_fields.indeterminate = false;
          this._checkall_fields_checkmark.classList.add("disable-opacity");
        }
    }

    _update_change_dname(old_name, new_name, container) {
        let can_update_dname = false;
        if (container === "value_pivots") {
            let dname_pivots = JSON.parse(this.getAttribute("dname-pivots"));
            if (dname_pivots && dname_pivots[old_name]) {
                dname_pivots[new_name] = dname_pivots[old_name];
                delete dname_pivots[old_name];
                this.setAttribute("dname-pivots", JSON.stringify(dname_pivots));
                can_update_dname = true;
            }
        } else if (container === "row_pivots" || container === "column_pivots" || container === "active_columns")
        {
            // Update c_info
            for (let idx in this.c_info) {
                let info = this.c_info[idx];
                if (info.dname == old_name) {
                    this.c_info[idx].dname = new_name;
                    can_update_dname = true;
                    break;
                }
            }
        }
        if (can_update_dname) {
            this._view.update_dname_mapping(old_name, new_name);
        }

        // Update for computed column
        var column_map = {};
        column_map[old_name] = new_name;
        this._computed_column._update_rename_for_list(column_map);

        // Update for agg_custom
        this._update_agg_custom(old_name, new_name);
    }

    /**
     * Callback after change aggregate for active column in case redo/undo action
     * @param {*} row
     * @param {*} old_agg
     * @param {*} new_agg
     */
    _after_aggregate_clicked(row, old_agg, new_agg, container) {
        this._force_to_fetch_only = true;
        let aggregates = [];
        let drag_id = row.getAttribute("drag_id");
        let name = row.getAttribute("name");
        if (!this.is_cinfo_pivot(false)) {
            this.c_info.forEach(info => {
                aggregates.push({
                    column: info.name,
                    op: info.aggregate
                });
            });
            let new_aggregates = this._get_view_aggregates();
            for (let aggregate of aggregates) {
                let updated_agg = new_aggregates.find(x => x.column === aggregate.column);
                if (updated_agg) {
                    aggregate.op = updated_agg.op;
                }
            }
        }

        var old_name = this._get_disp_name_aggregate(name, old_agg,
                        row.getAttribute("period"), this._get_column_show_type(row));
        var new_name = this._get_disp_name_aggregate(name, new_agg,
                        row.getAttribute("period"), this._get_column_show_type(row));

        this._update_change_dname(old_name, new_name, container);

        if (!this.is_cinfo_pivot(false)) {
            for (let idx in this.c_info) {
                let info = this.c_info[idx];
                let index = aggregates.findIndex(aggregate => info.aggregate === aggregate.op);
                if (index !== -1) {
                    this.c_info[idx].aggregate = aggregates[index].op;
                }
            }
        } else if (container && container === "value_pivots" && name && drag_id){
            let dname_pivots = JSON.parse(this.getAttribute("dname-pivots")) || {};
            var value_pivots = JSON.parse(this.getAttribute("value-pivots")) || [];
            var index = value_pivots.findIndex((v)=>v.n === name && v.drag_id === drag_id);
            if (index != -1){
              value_pivots[index].agg = new_agg;
              value_pivots[index].base_name = new_name;
              value_pivots[index].dname = dname_pivots[new_name] || new_name
              this.setAttribute("value-pivots", JSON.stringify(value_pivots));
            }
        }
        this._update_column_view();
        this._force_to_fetch_only = false;
        this._run_query();
    }

    /**
     * Change aggregate for active column
     * @param {*} event
     */
    _column_aggregate_clicked(event) {
        /*if (event && event.detail && event.detail.row && event.detail.new_agg && event.detail.old_agg) {
            var row = event.detail.row;
            if (!this._valid_aggregate_period_show_type(row.getAttribute("name"), event.detail.new_agg, row)) {
                row.setAttribute("aggregate", event.detail.old_agg);
                this._show_warning_message("All field names must be unique!");
                return;
            }
            //row.setAttribute("aggregate", event.detail.new_agg);
        }
        var options = {
            old_value: event.detail.old_agg,
            new_value: event.detail.new_agg,
            attribute: "aggregate"
        };
        this._handle_manage_action(perspective.ACTION_TYPE.change_active_dropdown, row, options,
            _ => {
                this._after_aggregate_clicked(row, event.detail.new_agg, event.detail.old_agg);
            },
            _ => {
                this._after_aggregate_clicked(row, event.detail.old_agg, event.detail.new_agg);
            });
        this._after_aggregate_clicked(row, event.detail.old_agg, event.detail.new_agg);*/

        if (!event || !event.detail || !event.detail.row_settings || !event.detail.old_agg || !event.detail.new_agg){
          return;
        }

        var row_settings = event.detail.row_settings;
        var name = row_settings.getAttribute("name");
        var drag_id = row_settings.getAttribute("drag_id");
        var container = row_settings.getAttribute("container");

        var row = this._get_row(container, name, drag_id);

        if (!row){
          return;
        }

        var old_agg = event.detail.old_agg
        var new_agg = event.detail.new_agg;
        const period = this._visible_column_period() ? row.getAttribute("period") : "none";

        row.setAttribute("aggregate", new_agg);

        var options = {
            old_value: old_agg,
            new_value: new_agg,
            attribute: "aggregate"
        };

        if (container === "value_pivots") {
            let type = row.getAttribute("type");
            if (type === "float" || type === "integer" || perspective.STATISTIC_AGGREGATES.includes(new_agg) || new_agg !== "unique") {
                let old_show_type = row.getAttribute("show_type") || "default";
                let available_show_types = this._get_available_show_types(row);
                if (available_show_types.length > 0 && !available_show_types.includes(old_show_type)) {
                    let new_show_type = available_show_types[0];
                    options.dependency_attribute = [{
                        old_value: old_show_type,
                        new_value: new_show_type,
                        attribute: "show_type"
                    }];
                    row_settings.setAttribute("show_type", new_show_type);
                    row.setAttribute("show_type", new_show_type);
                }
            }
        }

        if (!this._valid_aggregate_period_show_type(name, new_agg, row)) {
            row_settings.setAttribute("aggregate", old_agg);
            row.setAttribute("aggregate", old_agg);
            this._show_warning_message("All field names must be unique!");
            return;
        }

        let old_base_name = row_settings.getAttribute("new_base_name");
        let old_dname = row.getAttribute("dname");
        let old_name = this._get_disp_name_aggregate(name, old_agg, period, this._get_column_show_type(row));
        let new_name = this._get_disp_name_aggregate(name, new_agg, period, this._get_column_show_type(row));
        row_settings.setAttribute("new_base_name", new_name);
        // Check we don't manual change dname and alias name
        if (old_base_name === old_dname) {
            let dname_pivots = JSON.parse(this.getAttribute("dname-pivots")) || {};
            row_settings.setAttribute("vname", dname_pivots[new_name] || new_name);
            row_settings.setAttribute("alias_name", dname_pivots[new_name] || new_name);
            row_settings.setAttribute("dname", dname_pivots[new_name] || new_name);
        }

        if (container === "value_pivots") {
            let pivot_type = this._get_display_as_pivot_type();
            let have_previous = this._get_display_as_has_previous(row);
            let disabled_list = this._get_display_as_disabled_list(row);
            row_settings._update_display_as_dropdown(pivot_type, have_previous, disabled_list);
            /*
            let span_title = this._psp_popup_title.querySelector(".sf-title-right >span");
            if (span_title){
              span_title.innerHTML = this._format_value_popup_title(new_name);
            }
            */
        }

        // Update filters for case change name of row
        // Remove all filter have filter_by = old_name (having)
        if (old_name !== new_name) {
            this._force_to_fetch_only = true;
            let filters = JSON.parse(this.getAttribute("filters")) || [];
            let new_filters = filters.filter(f => !(f.filter_by === old_name));
            if (filters.length > 0 && new_filters.length < filters.length) {
                options.viewer_attributes = [{
                    old_value: JSON.stringify(filters),
                    new_value: JSON.stringify(new_filters),
                    attribute: "filters"
                }];
                this.setAttribute("filters", JSON.stringify(new_filters));
            }
            this._force_to_fetch_only = false;
        }
        this._handle_manage_action(perspective.ACTION_TYPE.change_active_dropdown, row, options,
            _ => {
                this._after_aggregate_clicked(row, new_agg, old_agg, container);
            },
            _ => {
                this._after_aggregate_clicked(row, old_agg, new_agg, container);
            });
        this._after_aggregate_clicked(row, old_agg, new_agg, container);
    }

    _after_period_clicked(new_period, old_period, container, name, drag_id, row) {
        this._force_to_fetch_only = true;

        // Update dname component
        var old_name = this._get_disp_name_aggregate(row.getAttribute("name"), row.getAttribute("aggregate"),
                        old_period, this._get_column_show_type(row));
        var new_name = this._get_disp_name_aggregate(row.getAttribute("name"), row.getAttribute("aggregate"),
                        new_period, this._get_column_show_type(row));

        this._update_change_dname(old_name, new_name, container);

        if (container && container === "value_pivots" && name && drag_id){
            let dname_pivots = JSON.parse(this.getAttribute("dname-pivots")) || {};
            var value_pivots = JSON.parse(this.getAttribute("value-pivots")) || [];
            var index = value_pivots.findIndex((v)=>v.n === name && v.drag_id === drag_id);
            if (index != -1){
              value_pivots[index].p = new_period;
              value_pivots[index].base_name = new_name;
              value_pivots[index].dname = dname_pivots[new_name] || new_name
              this.setAttribute("value-pivots", JSON.stringify(value_pivots));
            }
        }

        this._update_column_view();
        this._force_to_fetch_only = false;
        this._run_query();
    }

    _column_period_clicked(event) {
        /*
        if (event && event.detail && event.detail.row && event.detail.new_period && event.detail.old_period) {
            var row = event.detail.row;
            if (!this._valid_aggregate_period_show_type(row.getAttribute("name"), row.getAttribute("aggregate"), row)) {
                row.setAttribute("period", event.detail.old_period);
                this._show_warning_message("All field names must be unique!");
                return;
            }
            var options = {
                old_value: event.detail.old_period,
                new_value: event.detail.new_period,
                attribute: "period"
            };
            this._handle_manage_action(perspective.ACTION_TYPE.change_active_dropdown, row, options,
                _ => {
                    this._after_period_clicked();
                },
                _ => {
                    this._after_period_clicked();
                });
            this._after_period_clicked();
        }
        */

        if (!event || !event.row_settings || !event.new_period || !event.old_period){
          return;
        }

        var row_settings = event.row_settings;
        var name = row_settings.getAttribute("name");
        var drag_id = row_settings.getAttribute("drag_id");
        var container = row_settings.getAttribute("container");

        var row = this._get_row(container, name, drag_id);

        if (!row){
          return;
        }

        var old_period = event.old_period;
        var new_period = event.new_period;
        var agg = row_settings.getAttribute("aggregate");

        row.setAttribute("period", new_period);

        if (!this._valid_aggregate_period_show_type(name, agg, row)) {
            row_settings.setAttribute("period", old_period);
            row.setAttribute("period", old_period);
            this._show_warning_message("All field names must be unique!");
            return;
        }

        let old_base_name = row_settings.getAttribute("new_base_name");
        let old_dname = row.getAttribute("dname");
        var new_name = this._get_disp_name_aggregate(name, agg, new_period, this._get_column_show_type(row));
        row_settings.setAttribute("new_base_name", new_name);
        // Check we don't manual change dname and alias name
        if (old_base_name === old_dname) {
            let dname_pivots = JSON.parse(this.getAttribute("dname-pivots")) || {};
            row_settings.setAttribute("vname", dname_pivots[new_name] || new_name);
            row_settings.setAttribute("alias_name", dname_pivots[new_name] || new_name);
            row_settings.setAttribute("dname", dname_pivots[new_name] || new_name);
        }

        if (container === "value_pivots") {
            let pivot_type = this._get_display_as_pivot_type();
            let have_previous = this._get_display_as_has_previous(row);
            let disabled_list = this._get_display_as_disabled_list(row);
            row_settings._update_display_as_dropdown(pivot_type, have_previous, disabled_list);
        }

        var options = {
            old_value: old_period,
            new_value: new_period,
            attribute: "period"
        };
        this._handle_manage_action(perspective.ACTION_TYPE.change_active_dropdown, row, options,
            _ => {
                this._after_period_clicked(old_period, new_period, container, name, drag_id, row);
            },
            _ => {
                this._after_period_clicked(new_period, old_period, container, name, drag_id, row);
            });
        this._after_period_clicked(new_period, old_period, container, name, drag_id, row);
    }

    _after_subtotals_clicked(subtotals, container, name, drag_id) {
        this._force_to_fetch_only = true;

        if (container && name && drag_id){
          if (container === "row_pivots"){
            var row_pivots = JSON.parse(this.getAttribute("row-pivots")) || [];
            var index = row_pivots.findIndex((v)=>v.n === name && v.drag_id === drag_id);
            if (index != -1){
              row_pivots[index].subtotals = subtotals;
              this.setAttribute("row-pivots", JSON.stringify(row_pivots));
            }
          }else if(container === "column_pivots"){
            var column_pivots = JSON.parse(this.getAttribute("column-pivots")) || [];
            var index = column_pivots.findIndex((v)=>v.n === name && v.drag_id === drag_id);
            if (index != -1){
              column_pivots[index].subtotals = subtotals;
              this.setAttribute("column-pivots", JSON.stringify(column_pivots));
            }
          }
        }
        this._force_to_fetch_only = false;

        //this._update_column_view();
        this._run_query();
    }

    _column_subtotals_clicked(event) {
        if (!event || !event.row_settings || event.new_subtotals === null || event.new_subtotals === undefined
            || event.old_subtotals === null || event.old_subtotals === undefined){
          return;
        }

        var row_settings = event.row_settings;
        var name = row_settings.getAttribute("name");
        var drag_id = row_settings.getAttribute("drag_id");
        var container = row_settings.getAttribute("container");

        var row = this._get_row(container, name, drag_id);

        if (!row){
          return;
        }

        var old_subtotals = event.old_subtotals;
        var new_subtotals = event.new_subtotals;

        row.setAttribute("subtotals", new_subtotals);
        var options = {
            old_value: old_subtotals,
            new_value: new_subtotals,
            attribute: "subtotals"
        };
        this._handle_manage_action(perspective.ACTION_TYPE.change_active_dropdown, row, options,
            _ => {
                this._after_subtotals_clicked(new_subtotals, container, name, drag_id);
            },
            _ => {
                this._after_subtotals_clicked(new_subtotals, container, name, drag_id);
            });
        this._after_subtotals_clicked(new_subtotals, container, name, drag_id);
    }

    _after_show_type_clicked(new_show_type, old_show_type, container, name, drag_id, row) {

        this._updating_dropdown = true;
        this._force_to_fetch_only = true;

        // Update dname component
        var old_name = this._get_disp_name_aggregate(row.getAttribute("name"), row.getAttribute("aggregate"),
                        row.getAttribute("period"), old_show_type);
        var new_name = this._get_disp_name_aggregate(row.getAttribute("name"), row.getAttribute("aggregate"),
                        row.getAttribute("period"), new_show_type);
        this._update_change_dname(old_name, new_name, container);
        /*
        let span_title = this._psp_popup_title.querySelector(".sf-title-right >span");
        if (span_title){
          span_title.innerHTML = this._format_value_popup_title(new_name);
        }
        */
        if (container && container === "value_pivots" && name && drag_id){
          var value_pivots = JSON.parse(this.getAttribute("value-pivots")) || [];
          let dname_pivots = JSON.parse(this.getAttribute("dname-pivots")) || {};
          var index = value_pivots.findIndex((v)=>v.n === name && v.drag_id === drag_id);
          if (index != -1){
            value_pivots[index].st = new_show_type;
            value_pivots[index].base_name = new_name;
            value_pivots[index].dname = dname_pivots[new_name] || new_name;
            this.setAttribute("value-pivots", JSON.stringify(value_pivots));
          }
        }

        this._update_column_view();

        this._updating_dropdown = false;
        this._force_to_fetch_only = false;

        if (this._can_change_dropdown() && this._current_contain_column(old_name)) {
            // Update show type to view config
            this._view.update_show_type(old_name, new_name, new_show_type).then(dname_map => {
                // Update new name to grid
                if (this._plugin.update_column_new_name) {
                    this._plugin.update_column_new_name.call(this, dname_map);
                }
                // notify for plugin to update show type
                this._view_on_update(1);
            });
        }

        this.update_current_request_structure_columns(old_name, new_name);
    }

    _column_show_type_clicked(event) {
        /*
        var row = event.detail.row;
        var options = {
            old_value: event.detail.old_show_type,
            new_value: event.detail.new_show_type,
            attribute: "show_type"
        };
        this._handle_manage_action(perspective.ACTION_TYPE.change_active_dropdown, row, options,
            _ => {
                this._after_show_type_clicked(event.detail.name, event.detail.old_show_type);
            },
            _ => {
                this._after_show_type_clicked(event.detail.name, event.detail.new_show_type);
            });
        this._after_show_type_clicked(event.detail.name, event.detail.new_show_type);
        */

        if (!event || !event.detail || !event.detail.row_settings){
          return;
        }

        var row_settings = event.detail.row_settings;
        var old_show_type = event.detail.old_show_type;
        var new_show_type = event.detail.new_show_type;
        var name = row_settings.getAttribute("name");
        var drag_id = row_settings.getAttribute("drag_id");
        var container = row_settings.getAttribute("container");

        var row = this._get_row(container, name, drag_id);

        if (!row){
          return;
        }

        let agg = row.getAttribute("aggregate");
        let period = row.getAttribute("period");

        row_settings.setAttribute("show_type", new_show_type);
        row.setAttribute("show_type", new_show_type);

        if (!this._valid_aggregate_period_show_type(name, agg, row)) {
            row_settings.setAttribute("show_type", old_show_type);
            row.setAttribute("show_type", old_show_type);
            this._show_warning_message("All field names must be unique!");
            return;
        }

        let new_base_name = event.detail.new_base_name;
        let old_dname = row.getAttribute("dname");

        var new_name = this._get_disp_name_aggregate(name, agg, period, this._get_column_show_type(row));
        row_settings.setAttribute("new_base_name", new_name);
        // Check we don't manual change dname and alias name
        if (new_base_name === old_dname) {
            let dname_pivots = JSON.parse(this.getAttribute("dname-pivots")) || {};
            row_settings.setAttribute("vname", dname_pivots[new_name] || new_name);
            row_settings.setAttribute("dname", dname_pivots[new_name] || new_name);
        }

        var options = {
            old_value: old_show_type,
            new_value: new_show_type,
            attribute: "show_type"
        };
        this._handle_manage_action(perspective.ACTION_TYPE.change_active_dropdown, row, options,
            _ => {
                this._after_show_type_clicked(old_show_type, new_show_type, container, name, drag_id, row);
            },
            _ => {
                this._after_show_type_clicked(new_show_type, old_show_type, container, name, drag_id, row);
            });
        this._after_show_type_clicked(new_show_type, old_show_type, container, name, drag_id, row);
    }

    _after_data_format_clicked(new_base_name, data_format, container, name, drag_id) {
        container = container ? container: "active_columns";
        this._updating_dropdown = true;
        this._force_to_fetch_only = true && container !== "column_pivots";
        let new_data_formats;

        var key = "columns";
        if (container === "row_pivots"){
          key = "row_pivots";
          new_data_formats = this._get_view_data_formats("#row_pivots perspective-row");
          if (name && drag_id){
            var row_pivots = JSON.parse(this.getAttribute("row-pivots")) || [];
            var index = row_pivots.findIndex((v)=>v.n === name && v.drag_id === drag_id);
            if (index != -1){
              row_pivots[index].df = data_format;
              this.setAttribute("row-pivots", JSON.stringify(row_pivots));
            }
          }
        }else if(container === "column_pivots"){
          key = "column_pivots";
          new_data_formats = this._get_view_data_formats("#column_pivots perspective-row");
          if (name && drag_id){
            var column_pivots = JSON.parse(this.getAttribute("column-pivots")) || [];
            var index = column_pivots.findIndex((v)=>v.n === name && v.drag_id === drag_id);
            if (index != -1){
              column_pivots[index].df = data_format;
              this.setAttribute("column-pivots", JSON.stringify(column_pivots));
            }
          }
        }else if(container === "value_pivots"){
          new_data_formats = this._get_view_data_formats("#value_pivots perspective-row");
          if (name && drag_id){
            var value_pivots = JSON.parse(this.getAttribute("value-pivots")) || [];
            var index = value_pivots.findIndex((v)=>v.n === name && v.drag_id === drag_id);
            if (index != -1){
              value_pivots[index].df = data_format;
              this.setAttribute("value-pivots", JSON.stringify(value_pivots));
            }
          }
        }else{
          new_data_formats = this._get_view_data_formats("#active_columns perspective-row");
        }

        for (let idx in this.c_info) {
            let info = this.c_info[idx];
            let updated_data_format = new_data_formats.find(x => x.column === info.name);
            if (updated_data_format) {
                this.c_info[idx].data_format = updated_data_format.format;
            }
        }

        this._update_column_view();
        this._updating_dropdown = false;
        this._force_to_fetch_only = false;

        if (this._can_change_dropdown() && this._current_contain_column(new_base_name, key) && key !== "column_pivots") {
            // Update data format to view config
            this._view.update_data_format(new_base_name, data_format).then(_ => {
                // notify for plugin to update data format
                this._view_on_update(1);
            });
        }
    }

    _column_data_format_clicked(event) {
        if (!event || !event.detail || !event.detail.row_settings){
          return;
        }

        var row_settings = event.detail.row_settings;
        var name = row_settings.getAttribute("name");
        var drag_id = row_settings.getAttribute("drag_id");
        var container = row_settings.getAttribute("container");

        var row = this._get_row(container, name, drag_id);

        if (!row){
          return;
        }

        var old_data_format = event.detail.old_data_format;
        var new_data_format = event.detail.new_data_format;
        var new_base_name = event.detail.new_base_name;

        row.setAttribute("data_format", new_data_format);

        var options = {
            old_value: old_data_format,
            new_value: new_data_format,
            attribute: "data_format"
        };
        this._handle_manage_action(perspective.ACTION_TYPE.change_active_dropdown, row, options,
            _ => {
                this._after_data_format_clicked(new_base_name, old_data_format, container, name, drag_id);
            },
            _ => {
                this._after_data_format_clicked(new_base_name, new_data_format, container, name, drag_id);
            });
        this._after_data_format_clicked(new_base_name, new_data_format, container, name, drag_id);
    }

    _after_column_data_formats_update(data_formats, updated_data_formats) {
        this._updating_dropdown = true;
        this._force_to_fetch_only = true;
        if (!this.is_cinfo_pivot(false)) {
            for (let idx in this.c_info) {
                let info = this.c_info[idx];
                this.c_info[idx].data_format = data_formats[info.name] || info.data_format;
            }
        }
        this._update_column_view();
        this._updating_dropdown = false;
        this._force_to_fetch_only = false;

        if (this._can_change_dropdown()) {
            // Update data format to view config
            this._view.update_data_formats(updated_data_formats).then(_ => {
                // notify for plugin to update data format
                this._view_on_update(1);
            });
        }
    }

    _column_data_formats_update(data_formats) {
        var old_data_formats = {};
        var new_data_formats = {};
        var pre_data_format = {};
        var is_pivot = this.is_cinfo_pivot(false);
        var attr_name = is_pivot ? "new_base_name" : "name";
        if (is_pivot) {
            this._get_aggregate_data_formats().forEach(df => {
                old_data_formats[df.column] = df.format;
            });
        } else {
            this.c_info.forEach(info => {
                old_data_formats[info.name] = info.data_format;
            });
        }
        // Update attribute data format for each column
        var selector = is_pivot ? "#value_pivots perspective-row" : "#active_columns perspective-row";
        this._get_view_dom_columns(selector, col => {
            var name = col.getAttribute(attr_name);
            if (data_formats[name]) {
                col.setAttribute("data_format", data_formats[name]);
            }
        });

        for (var name in old_data_formats) {
            if (data_formats[name]) {
                new_data_formats[name] = data_formats[name];
                pre_data_format[name] = old_data_formats[name];
            } else {
                new_data_formats[name] = old_data_formats[name];
            }
        }
        var options = {
            old_value: old_data_formats,
            new_value: new_data_formats,
            name_attr: attr_name,
            container: is_pivot ? "value_pivots" : "active_columns"
        };
        this._handle_manage_action(perspective.ACTION_TYPE.change_data_formats, undefined, options,
            _ => {
                this._after_column_data_formats_update(old_data_formats, pre_data_format);
            },
            _ => {
                this._after_column_data_formats_update(new_data_formats, data_formats);
            });
        this._after_column_data_formats_update(new_data_formats, data_formats);
    }

    _after_binning_updated(binning, container, name, drag_id) {
        this._force_to_fetch_only = true;

        if (container && name && drag_id){
          if (container === "row_pivots"){
            var row_pivots = JSON.parse(this.getAttribute("row-pivots")) || [];
            var index = row_pivots.findIndex((v)=>v.n === name && v.drag_id === drag_id);
            if (index != -1){
              row_pivots[index].b = binning;
              this.setAttribute("row-pivots", JSON.stringify(row_pivots));
            }
          }else if(container === "column_pivots"){
            var column_pivots = JSON.parse(this.getAttribute("column-pivots")) || [];
            var index = column_pivots.findIndex((v)=>v.n === name && v.drag_id === drag_id);
            if (index != -1){
              column_pivots[index].b = binning;
              this.setAttribute("column-pivots", JSON.stringify(column_pivots));
            }
          }
        }
        this._force_to_fetch_only = false;
        this._run_query();
    }

    // Update action for row binning
    _column_binning_updated(event) {
        if (!event || !event.detail || !event.detail.row_settings){
            return;
        }

        var row_settings = event.detail.row_settings;
        var name = row_settings.getAttribute("name");
        var drag_id = row_settings.getAttribute("drag_id");
        var container = row_settings.getAttribute("container");

        var row = this._get_row(container, name, drag_id);

        if (!row){
            return;
        }

        var old_binning = event.detail.old_binning;
        var new_binning = event.detail.new_binning;
        var name = event.detail.name;

        row.setAttribute("binning", new_binning);

        var options = {
            old_value: old_binning,
            new_value: new_binning,
            attribute: "binning"
        };
        if (old_binning != new_binning) {
          let filters = JSON.parse(this.getAttribute("filters")) || [];
          let new_filters = [];
          for (let filter of filters) {
            if (filter.n !== name) {
              new_filters.push(filter);
            }
          }
          if (filters.length !== new_filters.length) {
            options.viewer_attributes = [{
              new_value: JSON.stringify(new_filters),
              old_value: this.getAttribute("filters"),
              attribute: "filters"
            }];
            this.setAttribute("filters", JSON.stringify(new_filters));
          }
        }
        this._handle_manage_action(perspective.ACTION_TYPE.change_active_dropdown, row, options,
            _ => {
                this._after_binning_updated(old_binning, container, name, drag_id);
            },
            _ => {
                this._after_binning_updated(new_binning, container, name, drag_id);
            });
        this._after_binning_updated(new_binning, container, name, drag_id);
    }

    _after_filter_by_clicked(filter_by, row, update_filter_func) {
        if (row && this.is_cinfo_pivot(false)) {
            /*var aggregate = "any";
            //var type = row.getAttribute("type");
            var type = this._get_type_column("#inactive_columns perspective-row", row.getAttribute("name"));
            if (filter_by !== row.getAttribute("name")) {
                var view_aggregates = this._get_view_aggregates();
                for (const a of view_aggregates) {
                    if (a.new_base_name === filter_by) {
                        aggregate = a.op;
                        if (perspective.STATISTIC_AGGREGATES.indexOf(aggregate) !== -1) {
                            type = "integer";
                        } else {
                            type = a.type;
                        }
                    }
                }
            }
            row.setAttribute("aggregate", aggregate);
            row.setAttribute("type", type);*/
            if (update_filter_func) {
                update_filter_func.call(row);
            }
            setTimeout(this._after_column_filter_clicked.bind(this, row.getAttribute("container")), 50);
        } else {
            this._after_column_filter_clicked(row.getAttribute("container"));
        }
    }

    _column_filter_by_clicked(event) {
        if (!event || !event.row_settings){
            return;
        }

        var row_settings = event.row_settings;
        var name = row_settings.getAttribute("name");
        var drag_id = row_settings.getAttribute("drag_id");
        var container = row_settings.getAttribute("container");

        var row = this._get_row(container, name, drag_id);

        if (!row){
            return;
        }
        let old_filter_by = event.old_filter_by;
        let new_filter_by = event.new_filter_by;

        var options = {
            old_value: old_filter_by,
            new_value: new_filter_by,
            attribute: "filter_by"
        };
        row.setAttribute("filter_by", new_filter_by);
        this._handle_manage_action(perspective.ACTION_TYPE.change_filter, row, options,
            _ => {
                this._after_filter_by_clicked(event.old_filter_by, row, event.update_filter_func);
            },
            _ => {
                this._after_filter_by_clicked(event.old_filter_by, row, event.update_filter_func);
            });
        this._after_filter_by_clicked(event.old_filter_by, row, event.update_filter_func);
    }

    _after_filter_subtotal_clicked(row, update_filter_func) {
        if (row && this.is_cinfo_pivot(false)) {
            if (update_filter_func) {
                update_filter_func.call(row);
            }
            setTimeout(this._after_column_filter_clicked.bind(this, row.getAttribute("container")), 50);
        } else {
            this._after_column_filter_clicked(row.getAttribute("container"));
        }
    }

    _column_filter_subtotal_clicked(event) {
        if (!event || !event.row_settings){
            return;
        }

        var row_settings = event.row_settings;
        var name = row_settings.getAttribute("name");
        var drag_id = row_settings.getAttribute("drag_id");
        var container = row_settings.getAttribute("container");

        var row = this._get_row(container, name, drag_id);

        if (!row){
            return;
        }
        let old_filter_subtotal = event.old_filter_subtotal;
        let new_filter_subtotal = event.new_filter_subtotal;

        var options = {
            old_value: old_filter_subtotal,
            new_value: new_filter_subtotal,
            attribute: "filter_subtotal"
        };
        row.setAttribute("filter_subtotal", new_filter_subtotal);
        this._handle_manage_action(perspective.ACTION_TYPE.change_filter, row, options,
            _ => {
                this._after_filter_subtotal_clicked(row, event.update_filter_func);
            },
            _ => {
                this._after_filter_subtotal_clicked(row, event.update_filter_func);
            });
        this._after_filter_subtotal_clicked(row, event.update_filter_func);
    }

    _update_sort_filter_elements() {
        var column_pivots = this._get_view_column_pivots();
        var row_pivots = this._get_view_row_pivots();
        var sort_elems = this._get_view_dom_columns("#sort perspective-row").concat(this._get_view_dom_columns("#row_pivots perspective-row"))
                .concat(this._get_view_dom_columns("#column_pivots perspective-row"));
        var view_aggregates = this._get_view_aggregates();
        sort_elems.forEach(elem => {
            const name = elem.getAttribute("name");
            if (column_pivots.indexOf(name) != -1) {
                elem.shadowRoot.querySelector("#limit_group").style.display = "none";
                elem.shadowRoot.querySelector("#sort_subtotal_group").style.display = "none";
            } else {
                elem.shadowRoot.querySelector("#limit_group").style.display = "inline";
            }
            var columns = [{n:name,dname:this._get_dname_name(name)}].concat(view_aggregates.map(x => {
              return {
                  n: x.new_base_name,
                  dname: this._get_dname_name(x.new_base_name)
              }
            }));
            elem.setAttribute("sort_by_list", JSON.stringify(columns));
            elem.setAttribute("subtotal_list", JSON.stringify(this.SUB_TOTAL_LIST));
        });
        var filter_elems = this._get_view_dom_columns("#filters perspective-row").concat(this._get_view_dom_columns("#row_pivots perspective-row"))
            .concat(this._get_view_dom_columns("#column_pivots perspective-row"));;
        filter_elems.forEach(elem => {
            const name = elem.getAttribute("name");
            if (row_pivots.indexOf(name) === -1) {
                elem.shadowRoot.querySelector("#filter_group").style.display = "none";
            } else {
                elem.shadowRoot.querySelector("#filter_group").style.display = "inline";
                if (column_pivots.length > 0) {
                    elem.shadowRoot.querySelector("#filter_subtotal_group").style.display = "inline";
                } else {
                    elem.shadowRoot.querySelector("#filter_subtotal_group").style.display = "none";
                }
            }
            let columns = [{n:name,t:elem.getAttribute("type"),dname:this._get_dname_name(name)}]
                        .concat(view_aggregates.map(x => {
                            return {
                                n: x.new_base_name,
                                t: perspective.STATISTIC_AGGREGATES.includes(x.op) ? "float" : x.type,
                                dname: this._get_dname_name(x.new_base_name)
                            }
                        }));
            elem.setAttribute("filter_by_list", JSON.stringify(columns));
            elem.setAttribute("filter_sublist", JSON.stringify(this.SUB_TOTAL_LIST));
        });
    }

    _after_column_filter_clicked(container, name, filter, force_filters = undefined) {
        if (container === "filters") {
            this._force_to_fetch_only = true;
            if (force_filters) {
              this.setAttribute("filters", JSON.stringify(force_filters));
            } else {
              let new_filters = this._get_view_filters();
              this.setAttribute("filters", JSON.stringify(new_filters));
            }
            this._force_to_fetch_only = false;
            this._update_column_view();
        } else if (name) {
            this._force_to_fetch_only = true;
            let filters = JSON.parse(this.getAttribute("filters")) || [];
            let new_filters = [];
            let new_filter = JSON.parse(filter);
            if (this._check_empty_filter(new_filter)) {
                new_filters = filters.filter(f => f.n !== name);
            } else {
                new_filter.n = name;
                let contain_filter = false;
                for (let f of filters) {
                    if (f.n === name) {
                        contain_filter = true;
                        new_filters.push(new_filter);
                    } else {
                        new_filters.push(f);
                    }
                }
                if (!contain_filter) {
                    new_filters.push(new_filter);
                }
            }
            this.setAttribute("filters", JSON.stringify(new_filters));
            this._force_to_fetch_only = false;
        }
        this._run_query();
    }

    _group_filter_clicked(event){
      if (!event || !event.detail || !event.detail.row_settings){
          return;
      }

      var row_settings = event.detail.row_settings;
      var name = row_settings.getAttribute("name");
      var drag_id = row_settings.getAttribute("drag_id");
      var container = row_settings.getAttribute("container");

      var row = this._get_row(container, name, drag_id);

      if (!row){
          return;
      }

      var old_filter = event.detail.old_filter;
      var new_filter = event.detail.new_filter;

      var options = {};
      let updated_row;
      if (container === "filters") {
          row.setAttribute("filter", new_filter);
          options = {
              old_value: old_filter,
              new_value: new_filter,
              attribute: "filter"
          };
          updated_row = row;
      }
      this._handle_manage_action(perspective.ACTION_TYPE.change_filter, updated_row, options,
          _ => {
              this._after_column_filter_clicked(container, name, old_filter);
          },
          _ => {
              this._after_column_filter_clicked(container, name, new_filter);
          });
      this._after_column_filter_clicked(container, name, new_filter);
    }

    _column_change_filter_clicked(event) {
        if (!event || !event.detail || !event.detail.row_settings){
            return;
        }

        var row_settings = event.detail.row_settings;
        var name = row_settings.getAttribute("name");
        var drag_id = row_settings.getAttribute("drag_id");
        var container = row_settings.getAttribute("container");

        var row = this._get_row(container, name, drag_id);

        if (!row){
            return;
        }

        var old_filter = event.detail.old_filter;
        var new_filter = event.detail.new_filter;

        var options = {};
        let updated_row = undefined;
        let old_filters;
        if (container === "filters") {
            row.setAttribute("filter", new_filter);
            options = {
                old_value: old_filter,
                new_value: new_filter,
                attribute: "filter"
            };
            old_filters = JSON.parse(this.getAttribute("filters")) || [];
            updated_row = row;
        }
        this._handle_manage_action(perspective.ACTION_TYPE.change_filter, updated_row, options,
            _ => {
                this._after_column_filter_clicked(container, name, old_filter, old_filters);
            },
            _ => {
                this._after_column_filter_clicked(container, name, new_filter);
            });
        this._after_column_filter_clicked(container, name, new_filter);
    }

    _column_change_suggestion_filter_search(event) {
        if (!event || !event.detail || !event.detail.row_settings){
            return;
        }
        var row_settings = event.detail.row_settings;
        var name = row_settings.getAttribute("name");
        var search_text = event.detail.search_text;
        this._update_suggestion_list_attribute(row_settings, name, search_text, undefined);
    }

    /**
     * set attribute auto query for row.
     * @param {*} event
     */
    _column_auto_query_checked(event) {
        if (!event || !event.detail || !event.detail.row_settings) {
            return;
        }

        var row_settings = event.detail.row_settings;
        var name = row_settings.getAttribute("name");
        var drag_id = row_settings.getAttribute("drag_id");
        var container = row_settings.getAttribute("container");

        var row = this._get_row(container, name, drag_id);

        if (!row) {
            return;
        }
        row.setAttribute("auto_query", event.detail.new_auto_query);
    }

    _after_excute_quick_sort_filter(options, container, name, drag_id) {
        this._force_to_fetch_only = true;
        if ("sort_order" in options) {
            if (container && drag_id){
                if (container === "row_pivots"){
                  var row_pivots = JSON.parse(this.getAttribute("row-pivots")) || [];
                  var index = row_pivots.findIndex((v)=>v.n === name && v.drag_id === drag_id);
                  if (index != -1){
                    row_pivots[index].sort_o = options.sort_order;
                    this.setAttribute("row-pivots", JSON.stringify(row_pivots));
                  }
                }else if(container === "column_pivots"){
                  var column_pivots = JSON.parse(this.getAttribute("column-pivots")) || [];
                  var index = column_pivots.findIndex((v)=>v.n === name && v.drag_id === drag_id);
                  if (index != -1){
                    column_pivots[index].sort_o = options.sort_order;
                    this.setAttribute("column-pivots", JSON.stringify(column_pivots));
                  }
                }
              }
        }
        if ("filter" in options) {
            if (container === "filters") {
                let new_filters = this._get_view_filters();
                this._updating_filter = true;
                this.setAttribute("filters", JSON.stringify(new_filters));
                this._updating_filter = false;
                this._update_column_view();
            } else {
                this._force_to_fetch_only = true;
                let filters = JSON.parse(this.getAttribute("filters")) || [];
                let new_filters = [];
                let new_filter = JSON.parse(options.filter);
                if (this._check_empty_filter(new_filter)) {
                    new_filters = filters.filter(f => f.n !== name);
                } else {
                    new_filter.n = name;
                    let contain_filter = false;
                    for (let f of filters) {
                        if (f.n === name) {
                            contain_filter = true;
                            new_filters.push(new_filter);
                        } else {
                            new_filters.push(f);
                        }
                    }
                    if (!contain_filter) {
                        new_filters.push(new_filter);
                    }
                }
                this.setAttribute("filters", JSON.stringify(new_filters));
                this._force_to_fetch_only = false;
            }
        }
        this._force_to_fetch_only = false;

        this._run_query();
    }

    /**
     * excute quick filter sort in case auto query is false
     * @param {*} event
     */
    _column_excute_quick_sort_filter(event) {
        if (!event || !event.detail || !event.detail.row_settings || !event.detail.sort_filter_query) {
            return;
        }

        var row_settings = event.detail.row_settings;
        var sort_filter_query = event.detail.sort_filter_query;
        var name = row_settings.getAttribute("name");
        var drag_id = row_settings.getAttribute("drag_id");
        var container = row_settings.getAttribute("container");

        var row = this._get_row(container, name, drag_id);

        if (!row) {
            return;
        }

        // information for redo/undo action
        var options = {
            dependency_attribute: []
        };
        var new_options = {};
        var old_options = {};
        if (sort_filter_query.sort_order) {
            var old_sort_order = row.getAttribute("sort_order");
            var new_sort_order = sort_filter_query.sort_order.new_value;
            options.dependency_attribute.push({
                old_value: old_sort_order,
                new_value: new_sort_order,
                attribute: "sort_order"
            });
            new_options.sort_order = new_sort_order;
            old_options.sort_order = old_sort_order;
            row.setAttribute("sort_order", new_sort_order);
        }

        if (sort_filter_query.sort_num && sort_filter_query.sort_num.old_value !== sort_filter_query.sort_num.new_value
            && (container === "active_columns" || container === "row_pivots")) {
            var new_sort_num = sort_filter_query.sort_num.new_value;
            var old_sort_num = row.getAttribute("sort_num");
            options.dependency_attribute.push({
                old_value: old_sort_num,
                new_value: new_sort_num,
                attribute: "sort_num"
            });
            var clear_sort = new_sort_num !== 1;
            var dependency_elems = [];
            let row_name = row.getAttribute("name");
            let children = this._pivotList.getActiveCols();
            if (container === "row_pivots") {
                children = this._row_pivots.getElementsByTagName("perspective-row");
            }
            Array.prototype.slice.call(children).map(col => {
                let col_name = col.getAttribute("name");
                let sort_num = col.getAttribute("sort_num");
                if (col_name !== row_name && sort_num && sort_num !== "null"  && sort_num !== "undefined") {
                    if (clear_sort) {
                        if (Number(sort_num) > Number(old_sort_num)) {
                            dependency_elems.push({
                                row: [col.getAttribute("name"), col.getAttribute("drag_id"), col.getAttribute("container")],
                                attributes: [{
                                    old_value: sort_num,
                                    new_value: Number(sort_num) - 1,
                                    attribute: "sort_num"
                                }]
                            });
                            col.setAttribute("sort_num", Number(sort_num) - 1);
                        }
                    } else {
                        if (!old_sort_num || old_sort_num === "null" || old_sort_num === "undefined" || (Number(sort_num) < Number(old_sort_num))) {
                            dependency_elems.push({
                                row: [col.getAttribute("name"), col.getAttribute("drag_id"), col.getAttribute("container")],
                                attributes: [{
                                    old_value: sort_num,
                                    new_value: Number(sort_num) + 1,
                                    attribute: "sort_num"
                                }]
                            });
                            col.setAttribute("sort_num", Number(sort_num) + 1);
                        }
                    }
                }
            });
            if (dependency_elems.length > 0) {
                options.dependency_elems = dependency_elems;
            }
            row.setAttribute("sort_num", new_sort_num);
        }

        if ("filter" in sort_filter_query) {
            var old_filter = sort_filter_query.filter.old_value;
            var new_filter = sort_filter_query.filter.new_value;
            if (container === "filters") {
                options.dependency_attribute.push({
                    old_value: old_filter,
                    new_value: new_filter,
                    attribute: "filter"
                });
                row.setAttribute("filter", new_filter);
            }
            new_options.filter = new_filter;
            old_options.filter = old_filter;
        }

        if ("sort_by" in sort_filter_query) {
            var old_sort_by = sort_filter_query.sort_by.old_value;
            var new_sort_by = sort_filter_query.sort_by.new_value;
            options.dependency_attribute.push({
                old_value: old_sort_by,
                new_value: new_sort_by,
                attribute: "sort_by"
            });
            row.setAttribute("sort_by", new_sort_by);
        }

        if ("subtotal" in sort_filter_query) {
            var old_subtotal = sort_filter_query.subtotal.old_value;
            var new_subtotal = sort_filter_query.subtotal.new_value;
            options.dependency_attribute.push({
                old_value: old_subtotal,
                new_value: new_subtotal,
                attribute: "subtotal"
            });
            row.setAttribute("subtotal", new_subtotal);
        }

        this._handle_manage_action(perspective.ACTION_TYPE.change_active_dropdown, row, options,
            _ => {
                this._after_excute_quick_sort_filter(old_options, container, name, drag_id);
            },
            _ => {
                this._after_excute_quick_sort_filter(new_options, container, name, drag_id);
            });
        this._after_excute_quick_sort_filter(new_options, container, name, drag_id);

        if (event.detail.close_after_excute) {
            //this._psp_popup.classList.add("hidden");
            //this._is_popup_openning = false;
            this.close_popup();
        }
    }

    _column_popup_close(event) {
        if (!event || !event.detail || !event.detail.row_settings) {
            return;
        }

        var row_settings = event.detail.row_settings;
        var name = row_settings.getAttribute("name");
        var drag_id = row_settings.getAttribute("drag_id");
        var container = row_settings.getAttribute("container");

        var row = this._get_row(container, name, drag_id);

        if (!row) {
            return;
        }

        //this._psp_popup.classList.add("hidden");
        //this._is_popup_openning = false;
        this.close_popup();
    }

    _after_column_searchs_changed(searchs) {
        this._force_to_fetch_only = true;
        //let search_text = (searchs) ? searchs.text : "";
        let search_text = searchs;
        let filters = JSON.parse(this.getAttribute("filters")) || [];
        let index = filters.findIndex((v)=>v.n === perspective.__FILTER_SEARCH__);

        // Search text is blank
        if ((!search_text || search_text === "")
          //&& this._psp_popup.classList.contains("hidden") // Only remove search tag if the popup is not opened.
          ) {
            if (index !== -1) {
                filters.splice(index, 1);
            }
        }
        // Search text is not blank
        else {
            if (index !== -1) {
                filters[index].site_search = search_text;
            } else {
                filters.unshift({n:perspective.__FILTER_SEARCH__,site_search:search_text/*, drag_id: perspective.__FILTER_SEARCH__ + Math.random()*/});
            }
        }

        this.setAttribute("filters", JSON.stringify(filters));

        this._force_to_fetch_only = false;
    }

    // Force to create the search tag in FILTERS although the site search text is empty
    _create_search_row_in_filters(searchs) {
        this._force_to_fetch_only = true;

        let search_text = this.getAttribute("searchs") || "";
        let filters = JSON.parse(this.getAttribute("filters")) || [];
        let index = filters.findIndex((v)=>v.n === perspective.__FILTER_SEARCH__);

        if (index !== -1) {
            filters[index].site_search = search_text;
        } else {
            filters.unshift({n:perspective.__FILTER_SEARCH__,site_search:search_text/*, drag_id: perspective.__FILTER_SEARCH__ + Math.random()*/});
        }
        this.setAttribute("filters", JSON.stringify(filters));

        this._force_to_fetch_only = false;
    }

    _column_searchs_changed(event) {
        var old_searchs = this.getAttribute("searchs") || "";
        let new_searchs = this._get_view_searchs();
        this.setAttribute("searchs", new_searchs);

        var options = {
            old_value: old_searchs,
            new_value: new_searchs,
            attribute: "searchs"
        }
        this._handle_manage_action(perspective.ACTION_TYPE.change_viewer_attribute, undefined, options,
            _ => {
                this._after_column_searchs_changed(old_searchs);
            },
            _ => {
                this._after_column_searchs_changed(new_searchs);
            });
        this._after_column_searchs_changed(new_searchs);
    }

    _site_search_type_changed(event){
      if (!event || !event.row_settings){
        return;
      }

      const column_name = event.column_name;
      const old_search_type = event.old_search_type;
      const new_search_type = event.new_search_type;

      if (column_name !== undefined && old_search_type !== undefined || new_search_type !== undefined){
        const i = this.c_info.findIndex((v)=>v.name === column_name);
        if (i !== -1){
          this.c_info[i].search_type = new_search_type;

          let options = {
            column_name: column_name,
            old_search_type: old_search_type,
            new_search_type: new_search_type
          };

          // Perform query, undo/redo here
          this._handle_manage_action(perspective.ACTION_TYPE.change_site_search, null, options,
            _ => {
                this._run_query();
            },
            _ => {
                this._run_query();
            });
          this._run_query();
        }
      }
    }

    _updates_site_search_placehoder(n, selected_all){

      let placeholder = "Search across all fields";
      if (selected_all === true){
        // Search across all fields
      }else{
        if (n === 1){
          placeholder = "Search across " + n + " field";
        }else{
          placeholder = "Search across " + n + " fields";
        }
      }
      this._search_input_id.setAttribute("placeholder", placeholder);
    }

    _site_search_changed(event) {
        if (!event || !event.row_settings){
          return;
        }

        var row_settings = event.row_settings;
        var name = row_settings.getAttribute("name");
        var drag_id = row_settings.getAttribute("drag_id");
        var container = row_settings.getAttribute("container");

        //var old_selected_fields = event.old_selected_fields || [];
        var new_selected_fields = event.new_selected_fields || [];
        const selected_all = event.selected_all || false;
        let old_search_selected_map = {};
        let new_search_selected_map = {};
        let old_site_search_obj = {...this._site_search_obj};

        // In the future, the search input text will be added into the popup. It means that the search will contain the selected fields and search text.
        var old_search_text = event.old_search_text;
        var new_search_text = event.new_search_text;

        if (old_search_text === new_search_text){
          // Text search doesn't change
        }

        const new_site_search_af = event.new_site_search_af ? event.new_site_search_af: false;

        if (this._site_search_obj.site_search_af !== new_site_search_af){
          // Only search within visible fields is changed
          this._site_search_obj.site_search_af = new_site_search_af;

          //let new_filter = JSON.parse(row.getAttribute("filter") || "{}");
          //new_filter.site_search_af = new_site_search_af;
          //row.setAttribute("filter", JSON.stringify(new_filter));
        }

        this._updates_site_search_placehoder(new_selected_fields.length, selected_all);

        // Check if the user doesn't select any fields
        const unselected_all = new_selected_fields.length === 0 && !selected_all;

        // Update the selected list into c_info. we can move the code below to anywhere we need to handle undo/redo
        this.c_info.forEach((v)=>{
          old_search_selected_map[v.name] = v.is_search_selected;
          if (selected_all === true){
            // Default search all fields
            v.is_search_selected = undefined;
          }else if (new_selected_fields.length === 0) {
            v.is_search_selected = false;
          } else if (new_selected_fields.includes(v.name) === true){
            v.is_search_selected = true;
          }else{
            v.is_search_selected = false;
          }
          new_search_selected_map[v.name] = v.is_search_selected;
        });

        this._site_search_obj.unselected_all = unselected_all;

        let options = {
            old_search_selected_map: old_search_selected_map,
            new_search_selected_map: new_search_selected_map,
            old_site_search_obj: old_site_search_obj,
            new_site_search_obj: {...this._site_search_obj}
        };

        var row = this._get_row(container, name, drag_id);

        if (!row){
            // No need to perform query if the search tag is not in the Filters
            return;
        }

        // Handle search
        this._handle_manage_action(perspective.ACTION_TYPE.change_site_search, null, options,
            _ => {
                this._run_query();
            },
            _ => {
                this._run_query();
            });
        this._run_query();
    }

    _increment_sort(sort, column_sorting, abs_sorting) {
        /*let sort_orders = ["asc", "desc"];
        if (column_sorting) {
            sort_orders.push("col asc", "col desc");
        }*/
        let sort_orders = [];
        if (column_sorting) {
            sort_orders.push("col asc", "col desc");
        } else {
            sort_orders = ["asc", "desc"];
        }
        if (abs_sorting) {
            sort_orders = sort_orders.map(x => `${x} abs`);
        }
        //sort_orders.push("none");
        return sort_orders[(sort_orders.indexOf(sort) + 1) % sort_orders.length];
    }

    _after_sort_order_clicked() {
        let is_cinfo_pivot = this.is_cinfo_pivot(false);
        let sort = JSON.parse(this.getAttribute("sort"));
        let new_sort = this._get_view_sorts();
        for (let s of sort) {
            let updated_sort = new_sort.find(x => x[0] === s[0]);
            if (updated_sort) {
                s[1] = updated_sort[1];
                if (is_cinfo_pivot) {
                    s[2] = updated_sort[2];
                    s[3] = updated_sort[3];
                }
                s[4] = updated_sort[4];
                s[5] = updated_sort[5];
            }
        }
        this.setAttribute("sort", JSON.stringify(sort));
    }

    _sort_order_clicked(event) {
        const row = event.target;
        const old_sort_order = row.getAttribute("sort_order");
        const abs_sorting = event.detail.shiftKey && row.getAttribute("type") !== "string";
        //const new_sort_order = this._increment_sort(row.getAttribute("sort_order"), this._get_view_column_pivots().length > 0, abs_sorting);
        const new_sort_order = this._increment_sort(row.getAttribute("sort_order"),
            this._get_view_column_pivots().indexOf(row.getAttribute("name")) !== -1, abs_sorting);
        row.setAttribute("sort_order", new_sort_order);

        var options = {
            old_value: old_sort_order,
            new_value: new_sort_order,
            attribute: "sort_order"
        };
        this._handle_manage_action(perspective.ACTION_TYPE.change_sort, row, options,
            _ => {
                this._after_sort_order_clicked();
            },
            _ => {
                this._after_sort_order_clicked();
            });
        this._after_sort_order_clicked();
    }

    _validate_column_name(event) {
        if (!event.detail || !event.detail.row) {
            return;
        }
        let new_name = event.detail.new_name;
        let row = event.detail.row;

        if (new_name === "") {
            row._rename_exclamation.hidden = true;
        }
        if (this._validate_new_name(row.getAttribute("new_base_name"), new_name)) {
            row._rename_exclamation.hidden = true;
        } else {
            row._rename_exclamation.hidden = false;
        }
    }

    _update_agg_custom(old_name, new_name) {
        var agg_custom = JSON.parse(this.getAttribute("agg-custom"));
        if (agg_custom) {
            var new_agg_custom = [];
            var can_update_agg_custom = false;
            agg_custom.forEach((agg, _) => {
                if (agg.name == old_name) {
                    agg.name = new_name;
                    can_update_agg_custom = true;
                }

                if (agg.inputs.includes(old_name)) {
                    can_update_agg_custom = true;
                    for (var idx in agg.inputs) {
                        if (agg.inputs[idx] == old_name) {
                            agg.inputs[idx] = new_name;
                        }
                    }
                }
                new_agg_custom.push(agg);
            });
            if (can_update_agg_custom) {
                this.setAttribute("agg-custom", JSON.stringify(new_agg_custom));
            }
        }
    }

    /**
     * call back after change colum name
     * @param {*} name
     * @param {*} new_base_name
     * @param {*} dname
     */
    _after_change_column_name(name, new_base_name, dname, container, drag_id) {
        /*if (dname && dname !== new_base_name) {
            this._update_name_mapping(new_base_name, dname, false, container);

            this._force_to_fetch_only = true;
            // Will create a function later
            if (container && name && drag_id){
              if (container === "row_pivots"){
                var row_pivots = JSON.parse(this.getAttribute("row-pivots")) || [];
                var index = row_pivots.findIndex((v)=>v.n === name && v.drag_id === drag_id);
                if (index != -1){
                  row_pivots[index].dname = dname;
                  this.setAttribute("row-pivots", JSON.stringify(row_pivots));
                }
              }else if(container === "column_pivots"){
                var column_pivots = JSON.parse(this.getAttribute("column-pivots")) || [];
                var index = column_pivots.findIndex((v)=>v.n === name && v.drag_id === drag_id);
                if (index != -1){
                  column_pivots[index].dname = dname;
                  this.setAttribute("column-pivots", JSON.stringify(column_pivots));
                }
              }
            }
            this._force_to_fetch_only = false;

        } else {
            this._clear_name_mapping(new_base_name, false);
        }*/

        this._force_to_fetch_only = true;
        // Will create a function later
        if (container && name && drag_id){
            if (container === "row_pivots"){
            var row_pivots = JSON.parse(this.getAttribute("row-pivots")) || [];
            var index = row_pivots.findIndex((v)=> {
              if (name === perspective.COMBINED_NAME) {
                return v.n === name;
              }
              return v.n === name && v.drag_id === drag_id;
            });
            if (index != -1){
                row_pivots[index].dname = dname;
                this.setAttribute("row-pivots", JSON.stringify(row_pivots));
            }
            }else if(container === "column_pivots"){
            var column_pivots = JSON.parse(this.getAttribute("column-pivots")) || [];
            var index = column_pivots.findIndex((v)=> {
              if (name === perspective.COMBINED_NAME) {
                return v.n === name;
              }
              return v.n === name && v.drag_id === drag_id;
            });
            if (index != -1){
                column_pivots[index].dname = dname;
                this.setAttribute("column-pivots", JSON.stringify(column_pivots));
            }
            }else if(container === "value_pivots"){
              var value_pivots = JSON.parse(this.getAttribute("value-pivots") || "[]");

              var index = value_pivots.findIndex((v)=>v.base_name === new_base_name && v.drag_id === drag_id);
              if (index != -1){
                  value_pivots[index].dname = dname;
                  this.setAttribute("value-pivots", JSON.stringify(value_pivots));
              }
            }
        }
        this._force_to_fetch_only = false;

        this._update_name_mapping(new_base_name, dname, false, container);

        this.sync_cinfo_dname(name, dname, false);
    }

    /**
     * Change column name
     * @param {*} event
     */
    _change_column_name(event) {

        if (!event || !event.detail || !event.detail.row_settings) {
            return;
        }

        if (event.detail.row){
          let new_name = event.detail.new_name;
          let row = event.detail.row;
          let new_base_name = row.getAttribute("new_base_name");
          var name = row.getAttribute("name");
          var old_alias_name = row.getAttribute("alias_name");
          if (this._validate_new_name(new_base_name, new_name)) {
              var old_name = this.getAttribute("dname");

              // update dname name
              row.setAttribute("dname", new_name);
              row.setAttribute("alias_name", new_name);

              var options = {
                  new_dname_value: new_name,
                  old_dname_value: old_name || new_base_name,
                  new_alias_value: new_name,
                  old_alias_value: old_alias_name
              }
              this._handle_manage_action(perspective.ACTION_TYPE.change_column_name, row, options,
                  _ => {
                      this._after_change_column_name(name, new_base_name, old_name);
                  },
                  _ => {
                      this._after_change_column_name(name, new_base_name, new_name);
                  });
              this._after_change_column_name(name, new_base_name, new_name);
          }
        }else if(event.detail.row_settings){

          let new_name = event.detail.new_name;
          let row_settings = event.detail.row_settings;
          let new_base_name = row_settings.getAttribute("new_base_name");
          var name = row_settings.getAttribute("name");
          var drag_id = row_settings.getAttribute("drag_id");
          var container = row_settings.getAttribute("container");
          var old_alias_name = row_settings.getAttribute("alias_name");

          var prows = [];
          if (container === "row_pivots"){
              prows = this._row_pivots.getElementsByTagName("perspective-row");
          }else if(container === "column_pivots"){
              prows = this._column_pivots.getElementsByTagName("perspective-row");
          }else if(container === "value_pivots"){
              prows = this._value_pivots.getElementsByTagName("perspective-row");
          }

          var index = Array.prototype.slice.call(prows).findIndex((v)=>v.getAttribute("name") === name && v.getAttribute("drag_id") === drag_id);
          if (index != -1){
            var row = prows[index];
            if (this._validate_new_name(new_base_name, new_name)) {
                var old_name = row.getAttribute("dname");

                // update to row_settings
                row_settings.setAttribute("dname", new_name);
                row_settings.setAttribute("alias_name", new_name);

                // update to row
                row.setAttribute("dname", new_name);
                row.setAttribute("alias_name", new_name);

                if (container === "value_pivots"){
                  row_settings.setAttribute("vname", new_name);
                  row.setAttribute("vname", new_name);
                }

                var options = {
                    new_dname_value: new_name,
                    old_dname_value: old_name || new_base_name,
                    new_alias_value: new_name,
                    old_alias_value: old_alias_name
                }
                this._handle_manage_action(perspective.ACTION_TYPE.change_column_name, row, options,
                    _ => {
                        this._after_change_column_name(name, new_base_name, old_name, container, drag_id);
                    },
                    _ => {
                        this._after_change_column_name(name, new_base_name, new_name, container, drag_id);
                    });
                this._after_change_column_name(name, new_base_name, new_name, container, drag_id);
            }
          }
        }
    }

    /**
     * Update for column name
     * @param {*} new_base_name
     * @param {*} new_name
     * @param {*} current
     */
    _update_name_mapping(new_base_name, new_name, current = true, container = undefined) {
        // update dname name in perspective-viewer
        var dname_pivots = JSON.parse(this.getAttribute("dname-pivots"));
        var can_update_name = false;
        var new_dname_pivots = {};
        if (!dname_pivots) {
            dname_pivots = {};
        }
        for (var dname in dname_pivots) {
            if (dname == new_base_name) {
                if (dname !== new_name) {
                    new_dname_pivots[dname] = new_name;
                } else {
                    delete new_dname_pivots[dname];
                }
                can_update_name = true;
            } else {
                new_dname_pivots[dname] = dname_pivots[dname];
            }
        }

        const is_stack_header = (this.get_column_pivots() || []).length > 1 ? true: false;

        // If the pivot or search is not enabled, we will update alias to cinfo.
        // In the future, we can expand this feature in case flatten aggregated results
        if (container && container === "value_pivots"){

          if (is_stack_header === true
            || (!this.is_row_pivot(true) && this.is_column_pivot(true)) // Values show in Rows/Cols labels
            || this.is_row_combined(true) === true // ROWS pivots contain the "Values"
            ){
            // Need to update the alias to stackheaders
            this._plugin.update_value_pivot_displayname.call(this, new_base_name, new_name);
          }else if(this.is_cinfo_pivot(false)){
            var c_index = (this.c_info_pivot || []).findIndex((v)=>v.name === new_base_name);

            if(c_index != -1){
              this.c_info_pivot[c_index].dname = new_name;
            }
          }
        }else if (this.is_cinfo_pivot(false) && (!container || container === "value_pivots")) {

            if (container === "value_pivots" && is_stack_header === true){

              // Need to update the alias to stackheaders
              this._plugin.update_value_pivot_displayname.call(this, new_base_name, new_name);

            }else{
              var c_index = (this.c_info_pivot || []).findIndex((v)=>v.name === new_base_name);

              if(c_index != -1){
                this.c_info_pivot[c_index].dname = new_name;
              }
            }

        }else if(this.is_cinfo_search(false)){

            var c_index = (this.c_info_search || []).findIndex((v)=>v.name === new_base_name);

            if(c_index != -1){
              this.c_info_search[c_index].dname = new_name;
            }

        }else{
            var c_index = this.c_info.findIndex((v)=>v.name === new_base_name);

            if(c_index != -1){
                if (this.c_info[c_index].dname && this.c_info[c_index].dname !== this.c_info[c_index].name) {
                    can_update_name = true;
                }
              this.c_info[c_index].dname = new_name;
            }
        }

        if (!can_update_name) {
            if (!this.is_cinfo_pivot(current)){
              this.update_column_alias(new_base_name, new_name);
            }
            if (container && container === "value_pivots") {
                new_dname_pivots[new_base_name] = new_name;
            }
        }
        this.setAttribute("dname-pivots", JSON.stringify(new_dname_pivots));
        this._update_sort_filter_elements();
        var update_column_displayname = function(column_map) {
            if (this._plugin.update_column_displayname) {
                this._plugin.update_column_displayname.call(this, column_map);
            }
        };
        if (container === "row_pivots" || container === "column_pivots") {
            // Update name for active columns
            Array.prototype.slice.call(this._pivotList.getActiveCols()).map(col => {
                if (col.getAttribute("name") === new_base_name) {
                    col.setAttribute("dname", new_name);
                    col.setAttribute("alias_name", new_name);
                }
            });
        }
        if (this.is_column_pivot(current)) {
            if (new_base_name === new_name) {
                this._view.clear_dname_mapping(new_base_name).then(mapping => {
                    // notify for plugin to update new dname
                    update_column_displayname.call(this, mapping);
                });
            } else {
                this._view.set_dname_mapping(new_base_name, new_name).then(mapping => {
                    // notify for plugin to update new dname
                    update_column_displayname.call(this, mapping);
                });
            }
        } else {
            if (this._can_change_dropdown()) {
                var column_map = {};
                if (new_base_name === new_name) {
                    this._view.clear_dname_mapping(new_base_name);
                } else {
                    this._view.set_dname_mapping(new_base_name, new_name);
                }
                column_map[new_base_name] = new_name;
                update_column_displayname.call(this, column_map);
            } else {
                this._table.set_dname_mapping(new_base_name, new_name);
            }
        }
    }

    /**
     * Clear name mapping for display name
     * @param {*} new_base_name
     * @param {*} current
     */
    _clear_name_mapping(new_base_name, current = true) {
        // update dname name in perspective-viewer
        var dname_pivots = JSON.parse(this.getAttribute("dname-pivots"));
        var new_dname_pivots = {};
        if (!dname_pivots) {
            dname_pivots = {};
        }
        for (var dname in dname_pivots) {
            if (dname !== new_base_name) {
                new_dname_pivots[dname] = dname_pivots[dname];
            }
        }
        this.setAttribute("dname-pivots", JSON.stringify(new_dname_pivots));
        var update_column_displayname = function(column_map) {
            if (this._plugin.update_column_displayname) {
                this._plugin.update_column_displayname.call(this, column_map);
            }
        };
        if (this.is_column_pivot(current)) {
            this._view.clear_dname_mapping(new_base_name).then(mapping => {
                // notify for plugin to update new dname
                update_column_displayname.call(this, mapping);
            });
        } else {
            if (this._can_change_dropdown()) {
                this._view.clear_dname_mapping(new_base_name);
                var column_map = {};
                column_map[new_base_name] = new_base_name;
                update_column_displayname.call(this, column_map);
            } else {
                this._table.clear_dname_mapping(new_base_name);
            }
        }
    }

    _after_agg_level_clicked(agg_level, container, name, drag_id) {
        this._update_disabled_aggregate_level(name);
        this._force_to_fetch_only = true;
        if (container && drag_id){
          if (container === "row_pivots"){
            var row_pivots = JSON.parse(this.getAttribute("row-pivots")) || [];
            var index = row_pivots.findIndex((v)=>v.n === name && v.drag_id === drag_id);
            if (index != -1){
              row_pivots[index].agg_l = agg_level;
              this.setAttribute("row-pivots", JSON.stringify(row_pivots));
            }
          }else if(container === "column_pivots"){
            var column_pivots = JSON.parse(this.getAttribute("column-pivots")) || [];
            var index = column_pivots.findIndex((v)=>v.n === name && v.drag_id === drag_id);
            if (index != -1){
              column_pivots[index].agg_l = agg_level;
              this.setAttribute("column-pivots", JSON.stringify(column_pivots));
            }
          }
        }
        this._force_to_fetch_only = false;

        this._run_query();
    }

    _column_agg_level_clicked(event) {

        if (!event /*|| !event.detail || !event.detail.row_settings*/){
          return;
        }

        var row_settings = event.row || event.row_settings;

        if (!row_settings){
          return
        }

        var name = row_settings.getAttribute("name");
        var drag_id = row_settings.getAttribute("drag_id");
        var container = row_settings.getAttribute("container");

        var row = event.row || this._get_row(container, name, drag_id);

        if (!row){
          return;
        }

        var old_agg_level = event.old_agg_level;
        var new_agg_level = event.new_agg_level;

        if (!event.row){
          row.setAttribute("agg_level", new_agg_level);
        }


        // Check validate aggregate level
        if (!this._validate_agg_level(name, new_agg_level, row)) {
            this._show_warning_message("Aggregate level must be unique!");
            if (!event.row){
              row_settings.setAttribute("agg_level", old_agg_level);
            }
            row.setAttribute("agg_level", old_agg_level);
            return;
        }

        var options = {
            old_value: old_agg_level,
            new_value: new_agg_level,
            attribute: "agg_level"
        };

        let filters = JSON.parse(this.getAttribute("filters")) || [];
        let index = filters.findIndex(f => f.n === name);
        if (index !== -1) {
            let filter = {...filters[index]};
            filter.ignore_list = [];
            filter.selected_list = [];
            filter.unselected_all = false;
            filter.search = "";
            let new_filters = [];
            if (this._check_empty_filter(filter)) {
                new_filters = filters.filter(f => f.n !== name);
            } else {
                new_filters = [...filters];
                new_filters[index] = filter;
            }
            options.viewer_attributes = [{
                attribute: "filters",
                old_value: this.getAttribute("filters"),
                new_value: JSON.stringify(new_filters)
            }];
            this._force_to_fetch_only = true;
            this.setAttribute("filters", JSON.stringify(new_filters));
            this._force_to_fetch_only = false;
        }

        this._handle_manage_action(perspective.ACTION_TYPE.change_group_by_dropdown, row, options,
            _ => {
                this._after_agg_level_clicked(old_agg_level, container, name, drag_id);
            },
            _ => {
                this._after_agg_level_clicked(new_agg_level, container, name, drag_id);
            });
        this._after_agg_level_clicked(new_agg_level, container, name, drag_id);

        /*
        if (event.row){
          var row = event.row;

          // Check validate aggregate level
          if (!this._validate_agg_level(row.getAttribute("name"), event.new_agg_level, row)) {
              this._show_warning_message("Aggregate level must be unique!");
              row.setAttribute("agg_level", event.old_agg_level);
              return;
          }

          var old_agg_level = event.old_agg_level;
          var new_agg_level = event.new_agg_level;

          var options = {
              old_value: old_agg_level,
              new_value: new_agg_level,
              attribute: "agg_level"
          };

          var name = row.getAttribute("name");
          var drag_id = row.getAttribute("drag_id");
          var container = row.getAttribute("container");

          this._handle_manage_action(perspective.ACTION_TYPE.change_group_by_dropdown, row, options,
              _ => {
                  this._after_agg_level_clicked(new_agg_level, container, name, drag_id);
              },
              _ => {
                  this._after_agg_level_clicked(new_agg_level, container, name, drag_id);
              });
          this._after_agg_level_clicked(new_agg_level, container, name, drag_id);
        }else if(event.row_settings){

          var row_settings = event.row_settings;

          var name = row_settings.getAttribute("name");
          var drag_id = row_settings.getAttribute("drag_id");
          var container = row_settings.getAttribute("container");

          var prows = [];
          if (container === "row_pivots"){
              prows = this._row_pivots.getElementsByTagName("perspective-row");
          }else if(container === "column_pivots"){
              prows = this._column_pivots.getElementsByTagName("perspective-row");
          }else if(container === "value_pivots"){
              prows = this._value_pivots.getElementsByTagName("perspective-row");
          }

          var index = Array.prototype.slice.call(prows).findIndex((v)=>v.getAttribute("name") === name && v.getAttribute("drag_id") === drag_id);
          if (index != -1){
            var row = prows[index];

            row.setAttribute("agg_level", new_agg_level);

            // Check validate aggregate level
            if (!this._validate_agg_level(name, event.new_agg_level, row)) {
                this._show_warning_message("Aggregate level must be unique!");
                row_settings.setAttribute("agg_level", event.old_agg_level);
                row.setAttribute("agg_level", event.old_agg_level);
                return;
            }

            var old_agg_level = event.old_agg_level;
            var new_agg_level = event.new_agg_level;


            var options = {
                old_value: old_agg_level,
                new_value: new_agg_level,
                attribute: "agg_level"
            };

            this._handle_manage_action(perspective.ACTION_TYPE.change_group_by_dropdown, row, options,
                _ => {
                    this._after_agg_level_clicked(new_agg_level, container, name, drag_id);
                },
                _ => {
                    this._after_agg_level_clicked(new_agg_level, container, name, drag_id);
                });
            this._after_agg_level_clicked(new_agg_level, container, name, drag_id);
          }
        }
        */
    }

    _after_limit_select_clicked(limit, container, name, drag_id) {
        if (!this.is_cinfo_pivot(false)) {
            this._run_query();
        } else {

            this._force_to_fetch_only = true;
            if (container && drag_id){
              if (container === "row_pivots"){
                var row_pivots = JSON.parse(this.getAttribute("row-pivots")) || [];
                var index = row_pivots.findIndex((v)=>v.n === name && v.drag_id === drag_id);
                if (index != -1){
                  row_pivots[index].limit = limit;
                  this.setAttribute("row-pivots", JSON.stringify(row_pivots));
                }
              }else if(container === "column_pivots"){
                var column_pivots = JSON.parse(this.getAttribute("column-pivots")) || [];
                var index = column_pivots.findIndex((v)=>v.n === name && v.drag_id === drag_id);
                if (index != -1){
                  column_pivots[index].limit = limit;
                  this.setAttribute("column-pivots", JSON.stringify(column_pivots));
                }
              }
            }
            this._force_to_fetch_only = false;

            //this._column_sort_options_clicked();
            this._run_query();
        }
    }

    _column_limit_select_clicked(event) {
        if (!event /*|| !event.detail || !event.detail.row_settings*/){
            return;
        }

        var row_settings = event.row || event.row_settings;

        if (!row_settings){
            return
        }

        var name = row_settings.getAttribute("name");
        var drag_id = row_settings.getAttribute("drag_id");
        var container = row_settings.getAttribute("container");

        var row = event.row || this._get_row(container, name, drag_id);

        if (!row){
            return;
        }
        var old_limit = event.old_limit;
        var new_limit = event.new_limit;

        // Update limit for all columns
        let dependency_elems = [];
        if (container === "active_columns") {
            Array.prototype.slice.call(this._pivotList.getActiveCols()).map(col => {
                if (col !== row) {
                    let sort_limit = col.getAttribute("limit");
                    dependency_elems.push({
                        row: [col.getAttribute("name"), col.getAttribute("drag_id"), col.getAttribute("container")],
                        attributes: [{
                            old_value: sort_limit,
                            new_value: new_limit,
                            attribute: "limit"
                        }]
                    });
                    col.setAttribute("limit", new_limit);
                }
            });
        }

        row.setAttribute("limit", new_limit);
        var options = {
            old_value: old_limit,
            new_value: new_limit,
            attribute: "limit"
        };
        if (dependency_elems.length > 0) {
            options.dependency_elems = dependency_elems;
        }

        this._handle_manage_action(perspective.ACTION_TYPE.change_sort, row, options,
            _ => {
                this._after_limit_select_clicked(old_limit, container, name, drag_id);
            },
            _ => {
                this._after_limit_select_clicked(new_limit, container, name, drag_id);
            });
        this._after_limit_select_clicked(new_limit, container, name, drag_id);
    }

    _after_limit_type_selected(limit_type, limit, container, name, drag_id) {
        if (!this.is_cinfo_pivot(false)) {
            this._run_query();
        } else {

          this._force_to_fetch_only = true;
          if (container && drag_id){
            if (container === "row_pivots"){
              var row_pivots = JSON.parse(this.getAttribute("row-pivots")) || [];
              var index = row_pivots.findIndex((v)=>v.n === name && v.drag_id === drag_id);
              if (index != -1){
                row_pivots[index].limit_t = limit_type;
                row_pivots[index].limit = limit;
                this.setAttribute("row-pivots", JSON.stringify(row_pivots));
              }
            }else if(container === "column_pivots"){
              var column_pivots = JSON.parse(this.getAttribute("column-pivots")) || [];
              var index = column_pivots.findIndex((v)=>v.n === name && v.drag_id === drag_id);
              if (index != -1){
                column_pivots[index].limit_t = limit_type;
                column_pivots[index].limit = limit;
                this.setAttribute("column-pivots", JSON.stringify(column_pivots));
              }
            }
          }
          this._force_to_fetch_only = false;

            this._run_query();
            //this._column_sort_options_clicked();
        }
    }

    _column_limit_type_selected(event) {
        if (!event /*|| !event.detail || !event.detail.row_settings*/){
            return;
        }

        var row_settings = event.row || event.row_settings;

        if (!row_settings){
            return
        }

        var name = row_settings.getAttribute("name");
        var drag_id = row_settings.getAttribute("drag_id");
        var container = row_settings.getAttribute("container");

        var row = event.row || this._get_row(container, name, drag_id);

        if (!row){
            return;
        }
        let old_limit = row.getAttribute("limit");

        var old_limit_type = event.old_limit_type;
        var new_limit_type = event.new_limit_type;

        // Update limit for all columns
        let dependency_elems = [];
        if (container === "active_columns") {
            Array.prototype.slice.call(this._pivotList.getActiveCols()).map(col => {
                if (col !== row) {
                    let sort_limit = col.getAttribute("limit");
                    let sort_limit_type = col.getAttribute("limit_type");
                    dependency_elems.push({
                        row: [col.getAttribute("name"), col.getAttribute("drag_id"), col.getAttribute("container")],
                        attributes: [{
                            old_value: sort_limit_type,
                            new_value: new_limit_type,
                            attribute: "limit_type"
                        },
                        {
                            old_value: sort_limit,
                            new_value: "none",
                            attribute: "limit"
                        }]
                    });
                    col.setAttribute("limit_type", new_limit_type);
                    col.setAttribute("limit", "none");
                }
            });
        }

        row.setAttribute("limit_type", new_limit_type);
        //Reset limit when change limit type
        row.setAttribute("limit", "none");
        var options = {
            old_value: old_limit_type,
            new_value: new_limit_type,
            attribute: "limit_type",
            dependency_attribute: [{
                old_value: old_limit,
                new_value: "none",
                attribute: "limit"
            }]
        };

        if (dependency_elems.length > 0) {
            options.dependency_elems = dependency_elems;
        }

        this._handle_manage_action(perspective.ACTION_TYPE.change_sort, row, options,
            _ => {
                this._after_limit_type_selected(old_limit_type, old_limit, container, name, drag_id);
            },
            _ => {
                this._after_limit_type_selected(new_limit_type, "none", container, name, drag_id);
            });
        this._after_limit_type_selected(new_limit_type, "none", container, name, drag_id);
    }

    _after_column_sort_order_clicked(sort_order, container, name, drag_id) {

        this._force_to_fetch_only = true;
        if (container && drag_id){
          if (container === "row_pivots"){
            var row_pivots = JSON.parse(this.getAttribute("row-pivots")) || [];
            var index = row_pivots.findIndex((v)=>v.n === name && v.drag_id === drag_id);
            if (index != -1){
              row_pivots[index].sort_o = sort_order;
              this.setAttribute("row-pivots", JSON.stringify(row_pivots));
            }
          }else if(container === "column_pivots"){
            var column_pivots = JSON.parse(this.getAttribute("column-pivots")) || [];
            var index = column_pivots.findIndex((v)=>v.n === name && v.drag_id === drag_id);
            if (index != -1){
              column_pivots[index].sort_o = sort_order;
              this.setAttribute("column-pivots", JSON.stringify(column_pivots));
            }
          }
        }
        this._force_to_fetch_only = false;

        this._run_query();
    }

    _column_sort_order_clicked(event) {
        if (!event || !event.detail || !event.detail.row_settings){
            return;
          }

          let is_pivot = this.is_cinfo_pivot(false);
          var row_settings = event.detail.row_settings;
          var name = row_settings.getAttribute("name");
          var drag_id = row_settings.getAttribute("drag_id");
          var container = row_settings.getAttribute("container");

          var row = this._get_row(container, name, drag_id);

          if (!row){
            return;
          }

          var old_sort_order = event.detail.old_sort_order;
          var new_sort_order = event.detail.new_sort_order;

          row.setAttribute("sort_order", new_sort_order);

          let c_index = this.c_info.findIndex(f => name === f.name);
          if (!is_pivot && c_index !== -1) {
             this.c_info[c_index].sort_order = (new_sort_order && new_sort_order !== "null" && new_sort_order !== "undefined") ? new_sort_order : undefined;
          }

          var options = {
              old_value: old_sort_order,
              new_value: new_sort_order,
              attribute: "sort_order"
          };

          // Change other sort num
          if (event.detail.new_sort_num !== event.detail.old_sort_num && (container === "active_columns" || container === "row_pivots")) {
            var dependency_elems = [];
            let old_sort_num = row.getAttribute("sort_num");
            let new_sort_num = (event.detail.new_sort_num && event.new_sort_num !== "null" && event.detail.new_sort_num !== "undefined")
                                ? event.detail.new_sort_num : undefined;
            let children = this._pivotList.getActiveCols();
            let clear_sort = event.detail.new_sort_num !== 1;
            if (container === "row_pivots") {
                children = this._row_pivots.getElementsByTagName("perspective-row");
            }
            Array.prototype.slice.call(children).map(col => {
                let col_name = col.getAttribute("name");
                let sort_num = col.getAttribute("sort_num");
                if (col_name !== name && sort_num && sort_num !== "null" && sort_num !== "undefined") {
                    let col_c_index = this.c_info.findIndex(f => col_name === f.name);
                    if (clear_sort) {
                        if ((Number(sort_num) > Number(old_sort_num))) {
                            dependency_elems.push({
                                row: [col.getAttribute("name"), col.getAttribute("drag_id"), col.getAttribute("container")],
                                attributes: [{
                                    old_value: sort_num,
                                    new_value: Number(sort_num) - 1,
                                    attribute: "sort_num"
                                }]
                            });
                            col.setAttribute("sort_num", Number(sort_num) - 1);
                            if (!is_pivot && col_c_index !== -1) {
                                this.c_info[col_c_index].sort_num = Number(sort_num) - 1;
                            }
                        }
                    } else {
                        if (!old_sort_num || old_sort_num === "null" || old_sort_num === "undefined" || (Number(sort_num) < Number(old_sort_num))) {
                            dependency_elems.push({
                                row: [col.getAttribute("name"), col.getAttribute("drag_id"), col.getAttribute("container")],
                                attributes: [{
                                    old_value: sort_num,
                                    new_value: Number(sort_num) + 1,
                                    attribute: "sort_num"
                                }]
                            });
                            col.setAttribute("sort_num", Number(sort_num) + 1);
                            if (!is_pivot && col_c_index !== -1) {
                                this.c_info[col_c_index].sort_num = Number(sort_num) + 1;
                            }
                        }
                    }
                }
            });
            options.dependency_attribute = [{
                old_value: old_sort_num,
                new_value: new_sort_num,
                attribute: "sort_num"
            }];
            if (dependency_elems.length > 0) {
                options.dependency_elems = dependency_elems;
            }
            row.setAttribute("sort_num", new_sort_num);
            if (!is_pivot && c_index !== -1) {
                this.c_info[c_index].sort_num = new_sort_num;
            }
          }
          this._handle_manage_action(perspective.ACTION_TYPE.change_active_dropdown, row, options,
              _ => {
                  this._after_column_sort_order_clicked(old_sort_order, container, name, drag_id);
              },
              _ => {
                  this._after_column_sort_order_clicked(new_sort_order, container, name, drag_id);
              });
          this._after_column_sort_order_clicked(new_sort_order, container, name, drag_id);
    }

    _after_sort_by_clicked(sort_by, container, name, drag_id) {
        if (!this.is_cinfo_pivot(false)) {
            this._column_sort_options_clicked();
        } else {

          this._force_to_fetch_only = true;
          if (container && drag_id){
            if (container === "row_pivots"){
              var row_pivots = JSON.parse(this.getAttribute("row-pivots")) || [];
              var index = row_pivots.findIndex((v)=>v.n === name && v.drag_id === drag_id);
              if (index != -1){
                row_pivots[index].sort_by = sort_by;
                this.setAttribute("row-pivots", JSON.stringify(row_pivots));
              }
            }else if(container === "column_pivots"){
              var column_pivots = JSON.parse(this.getAttribute("column-pivots")) || [];
              var index = column_pivots.findIndex((v)=>v.n === name && v.drag_id === drag_id);
              if (index != -1){
                column_pivots[index].sort_by = sort_by;
                this.setAttribute("column-pivots", JSON.stringify(column_pivots));
              }
            }
          }
          this._force_to_fetch_only = false;

            this._run_query();
        }
    }

    _column_sort_by_clicked(event) {
        if (!event /*|| !event.detail || !event.detail.row_settings*/){
            return;
        }

        var row_settings = event.row || event.row_settings;

        if (!row_settings){
            return
        }

        var name = row_settings.getAttribute("name");
        var drag_id = row_settings.getAttribute("drag_id");
        var container = row_settings.getAttribute("container");

        var row = event.row || this._get_row(container, name, drag_id);

        if (!row){
            return;
        }

        var old_sort_by = event.old_sort_by;
        var new_sort_by = event.new_sort_by;

        row.setAttribute("sort_by", new_sort_by);
        var options = {
            old_value: old_sort_by,
            new_value: new_sort_by,
            attribute: "sort_by"
        };

        this._handle_manage_action(perspective.ACTION_TYPE.change_sort, row, options,
            _ => {
                this._after_sort_by_clicked(old_sort_by, container, name, drag_id);
            },
            _ => {
                this._after_sort_by_clicked(new_sort_by, container, name, drag_id);
            });
        this._after_sort_by_clicked(new_sort_by, container, name, drag_id);
    }

    _after_sort_order_by_clicked(sort_order, sort_by, container, name, drag_id) {
        if (!this.is_cinfo_pivot(false)) {
            this._column_sort_options_clicked();
        } else {
          this._force_to_fetch_only = true;
          if (container && drag_id){
            if (container === "row_pivots"){
              var row_pivots = JSON.parse(this.getAttribute("row-pivots")) || [];
              var index = row_pivots.findIndex((v)=>v.n === name && v.drag_id === drag_id);
              if (index != -1){
                row_pivots[index].sort_by = sort_by;
                row_pivots[index].sort_order = sort_order;
                this.setAttribute("row-pivots", JSON.stringify(row_pivots));
              }
            }else if(container === "column_pivots"){
              var column_pivots = JSON.parse(this.getAttribute("column-pivots")) || [];
              var index = column_pivots.findIndex((v)=>v.n === name && v.drag_id === drag_id);
              if (index != -1){
                column_pivots[index].sort_by = sort_by;
                column_pivots[index].sort_order = sort_order;
                this.setAttribute("column-pivots", JSON.stringify(column_pivots));
              }
            }
          }
          this._force_to_fetch_only = false;

            this._run_query();
        }
    }

    _column_sort_order_by_clicked(event) {
        if (!event) {
            return;
        }

        let row_settings = event.row || event.row_settings;

        if (!row_settings){
            return
        }

        var name = row_settings.getAttribute("name");
        var drag_id = row_settings.getAttribute("drag_id");
        var container = row_settings.getAttribute("container");

        var row = event.row || this._get_row(container, name, drag_id);

        if (!row){
            return;
        }

        var old_sort_by = event.old_sort_by;
        var new_sort_by = event.new_sort_by;
        var old_sort_order = event.old_sort_order;
        var new_sort_order = event.new_sort_order;

        row.setAttribute("sort_by", new_sort_by);
        row.setAttribute("sort_order", new_sort_order);
        var options = {
            old_value: old_sort_by,
            new_value: new_sort_by,
            attribute: "sort_by",
            dependency_attribute: [{
                old_value: old_sort_order,
                new_value: new_sort_order,
                attribute: "sort_order"
            }]
        };

        this._handle_manage_action(perspective.ACTION_TYPE.change_sort, row, options,
            _ => {
                this._after_sort_order_by_clicked(old_sort_order, old_sort_by, container, name, drag_id);
            },
            _ => {
                this._after_sort_order_by_clicked(new_sort_order, new_sort_by, container, name, drag_id);
            });
        this._after_sort_order_by_clicked(new_sort_order, new_sort_by, container, name, drag_id);
    }

    _after_sort_subtotal_clicked(sort_sub, container, name, drag_id) {
        if (!this.is_cinfo_pivot(false)) {
            this._column_sort_options_clicked();
        } else {

            this._force_to_fetch_only = true;
            if (container && drag_id){
              if (container === "row_pivots"){
                var row_pivots = JSON.parse(this.getAttribute("row-pivots")) || [];
                var index = row_pivots.findIndex((v)=>v.n === name && v.drag_id === drag_id);
                if (index != -1){
                  row_pivots[index].sort_sub = sort_sub;
                  this.setAttribute("row-pivots", JSON.stringify(row_pivots));
                }
              }else if(container === "column_pivots"){
                var column_pivots = JSON.parse(this.getAttribute("column-pivots")) || [];
                var index = column_pivots.findIndex((v)=>v.n === name && v.drag_id === drag_id);
                if (index != -1){
                  column_pivots[index].sort_sub = sort_sub;
                  this.setAttribute("column-pivots", JSON.stringify(column_pivots));
                }
              }
            }
            this._force_to_fetch_only = false;

            this._run_query();
        }
    }

    _column_sort_subtotal_clicked(event) {
        if (!event /*|| !event.detail || !event.detail.row_settings*/){
            return;
        }

        var row_settings = event.row || event.row_settings;

        if (!row_settings){
            return
        }

        var name = row_settings.getAttribute("name");
        var drag_id = row_settings.getAttribute("drag_id");
        var container = row_settings.getAttribute("container");

        var row = event.row || this._get_row(container, name, drag_id);

        if (!row){
            return;
        }
        var old_sort_sub = event.old_subtotal;
        var new_sort_sub = event.new_subtotal;

        row.setAttribute("subtotal", new_sort_sub);
        var options = {
            old_value: old_sort_sub,
            new_value: new_sort_sub,
            attribute: "subtotal"
        };

        this._handle_manage_action(perspective.ACTION_TYPE.change_sort, row, options,
            _ => {
                this._after_sort_subtotal_clicked(old_sort_sub, container, name, drag_id);
            },
            _ => {
                this._after_sort_subtotal_clicked(new_sort_sub, container, name, drag_id);
            });
        this._after_sort_subtotal_clicked(new_sort_sub, container, name, drag_id);
    }

    _after_sort_dropdown_clicked(sort_dropdown, container, name, drag_id) {
        if (!this.is_cinfo_pivot(false)) {
            this._column_sort_options_clicked();
        } else {

            this._force_to_fetch_only = true;
            if (container && drag_id){
              if (container === "row_pivots"){
                var row_pivots = JSON.parse(this.getAttribute("row-pivots")) || [];
                var index = row_pivots.findIndex((v)=>v.n === name && v.drag_id === drag_id);
                if (index != -1){
                  row_pivots[index].sort_by = sort_dropdown.sort_by;
                  if ("subtotal" in sort_dropdown) {
                    row_pivots[index].sort_sub = sort_dropdown.subtotal;
                  }
                  if ("sort_order" in sort_dropdown) {
                    row_pivots[index].sort_o = sort_dropdown.sort_order;
                  }
                  this.setAttribute("row-pivots", JSON.stringify(row_pivots));
                }
              }else if(container === "column_pivots"){
                var column_pivots = JSON.parse(this.getAttribute("column-pivots")) || [];
                var index = column_pivots.findIndex((v)=>v.n === name && v.drag_id === drag_id);
                if (index != -1){
                  column_pivots[index].sort_by = sort_dropdown.sort_by;
                  if ("subtotal" in sort_dropdown) {
                    column_pivots[index].sort_sub = sort_dropdown.subtotal;
                  }
                  if ("sort_order" in sort_dropdown) {
                    column_pivots[index].sort_o = sort_dropdown.sort_order;
                  }
                  this.setAttribute("column-pivots", JSON.stringify(column_pivots));
                }
              }
            }
            this._force_to_fetch_only = false;

            this._run_query();
        }
    }

    _column_sort_dropdown_clicked(event) {
        if (!event /*|| !event.detail || !event.detail.row_settings*/){
            return;
        }

        var row_settings = event.row || event.row_settings;

        if (!row_settings){
            return
        }

        var name = row_settings.getAttribute("name");
        var drag_id = row_settings.getAttribute("drag_id");
        var container = row_settings.getAttribute("container");

        var row = event.row || this._get_row(container, name, drag_id);

        if (!row){
            return;
        }

        var old_sort_by = event.old_sort_by;
        var new_sort_by = event.new_sort_by;

        row.setAttribute("sort_by", new_sort_by);
        var options = {
            old_value: old_sort_by,
            new_value: new_sort_by,
            attribute: "sort_by",
            dependency_attribute: []
        };
        let new_dropdown = {
            sort_by: new_sort_by
        };
        let old_dropdown = {
            sort_by: old_sort_by
        };

        let dependency_attribute = [];
        if ("new_subtotal" in event) {
            dependency_attribute.push({
                old_value: event.old_subtotal,
                new_value: event.new_subtotal,
                attribute: "subtotal"
            });
            row.setAttribute("subtotal", event.new_subtotal);
            new_dropdown["subtotal"] = event.new_subtotal;
            old_dropdown["subtotal"] = event.old_subtotal;
        }

        if ("new_sort_order" in event) {
            dependency_attribute.push({
                old_value: event.old_sort_order,
                new_value: event.new_sort_order,
                attribute: "sort_order"
            });
            row.setAttribute("sort_order", event.new_sort_order);
            new_dropdown["sort_order"] = event.new_sort_order;
            old_dropdown["sort_order"] = event.old_sort_order;
        }

        // Change other sort num
        if (event.new_sort_num !== event.old_sort_num && (container === "active_columns" || container === "row_pivots")) {
            let dependency_elems = [];
            let old_sort_num = row.getAttribute("sort_num");
            let row_name = row.getAttribute("name");
            let children = this._pivotList.getActiveCols();
            let clear_sort = event.new_sort_num !== 1;
            if (container === "row_pivots") {
                children = this._row_pivots.getElementsByTagName("perspective-row");
            }
            Array.prototype.slice.call(children).map(col => {
                let col_name = col.getAttribute("name");
                let sort_num = col.getAttribute("sort_num");
                if (col_name !== row_name && sort_num && sort_num !== "null" && sort_num !== "undefined") {
                    if (clear_sort) {
                        if ((Number(sort_num) > Number(old_sort_num))) {
                            dependency_elems.push({
                                row: [col.getAttribute("name"), col.getAttribute("drag_id"), col.getAttribute("container")],
                                attributes: [{
                                    old_value: sort_num,
                                    new_value: Number(sort_num) - 1,
                                    attribute: "sort_num"
                                }]
                            });
                            col.setAttribute("sort_num", Number(sort_num) - 1);
                        }
                    } else {
                        if (!old_sort_num || old_sort_num === "null" || old_sort_num === "undefined" || (Number(sort_num) < Number(old_sort_num))) {
                            dependency_elems.push({
                                row: [col.getAttribute("name"), col.getAttribute("drag_id"), col.getAttribute("container")],
                                attributes: [{
                                    old_value: sort_num,
                                    new_value: Number(sort_num) + 1,
                                    attribute: "sort_num"
                                }]
                            });
                            col.setAttribute("sort_num", Number(sort_num) + 1);
                        }
                    }
                }
            });
            dependency_attribute.push({
                old_value: old_sort_num,
                new_value: event.new_sort_num,
                attribute: "sort_num"
            });
            if (dependency_elems.length > 0) {
                options.dependency_elems = dependency_elems;
            }
            row.setAttribute("sort_num", event.new_sort_num);
        }

        if (dependency_attribute.length > 0) {
            options["dependency_attribute"] = dependency_attribute;
        }

        this._handle_manage_action(perspective.ACTION_TYPE.change_sort, row, options,
            _ => {
                this._after_sort_dropdown_clicked(old_dropdown, container, name, drag_id);
            },
            _ => {
                this._after_sort_dropdown_clicked(new_dropdown, container, name, drag_id);
            });
        this._after_sort_dropdown_clicked(new_dropdown, container, name, drag_id);
    }

    _column_sort_options_clicked(event) {
        let sort = JSON.parse(this.getAttribute("sort"));
        let new_sort = this._get_view_sorts();
        let is_cinfo_pivot = this.is_cinfo_pivot(false);
        for (let s of sort) {
            let updated_sort = new_sort.find(x => x[0] === s[0]);
            if (updated_sort) {
                s[1] = updated_sort[1];
                if (is_cinfo_pivot) {
                    s[2] = updated_sort[2];
                    s[3] = updated_sort[3];
                }
                s[4] = updated_sort[4];
                s[5] = updated_sort[5];
            }
        }
        this.setAttribute("sort", JSON.stringify(sort));
    }

    /**
     * Handle update all sort base on selected columns and sort order type
     * @param {*} columns
     * @param {*} direction
     */
    _column_sort_update(columns, direction) {
        if (!columns || columns.length === 0 || !direction) {
            return;
        }
        var is_pivot = this.is_cinfo_pivot(false);
        // Case: in non-aggregation mode: don't have any tag in row_pivots, column_pivots or value_pivots
        if (!is_pivot) {
            let column_names = columns.map(column => column.n);
            let dependency_elems = [];
            let change_elems = [];
            for (let child of Array.prototype.slice.call(this._pivotList.getActiveCols())) {
                let name = child.getAttribute("name");
                let old_sort_num = child.getAttribute("sort_num");
                let index = column_names.indexOf(name);
                if (index !== -1) {
                    let old_sort_order = child.getAttribute("sort_order");
                    let dependency_elem = {
                        row: [child.getAttribute("name"), child.getAttribute("drag_id"), child.getAttribute("container")],
                        attributes : [{
                            old_value: old_sort_order,
                            new_value: direction,
                            attribute: "sort_order"
                        },
                        {
                            old_value: old_sort_num,
                            new_value: index + 1,
                            attribute: "sort_num"
                        }]
                    };
                    child.setAttribute("sort_order", direction);
                    child.setAttribute("sort_num", index + 1);
                    let c_index = this.c_info.findIndex(info => name === info.name);
                    if (c_index !== -1) {
                        this.c_info[c_index].sort_order = direction;
                        this.c_info[c_index].sort_num = index + 1;
                    }
                    dependency_elems.push(dependency_elem);
                } else if (old_sort_num && old_sort_num !== "null" && old_sort_num !== "undefined") {
                    change_elems.push(child);
                }
            }
            if (change_elems.length > 0) {
                change_elems.sort((elem1, elem2) => Number(elem1.getAttribute("sort_num")) - Number(elem2.getAttribute("sort_num")));
                let cur_sort_num = column_names.length + 1;
                for(let child of change_elems) {
                    let name = child.getAttribute("name");
                    dependency_elems.push({
                        row: [name, child.getAttribute("drag_id"), child.getAttribute("container")],
                        attributes : [{
                            old_value: child.getAttribute("sort_num"),
                            new_value: cur_sort_num,
                            attribute: "sort_num"
                        }]
                    });
                    child.setAttribute("sort_num", cur_sort_num);
                    let c_index = this.c_info.findIndex(info => name === info.name);
                    if (c_index !== -1) {
                        this.c_info[c_index].sort_num = cur_sort_num;
                    }
                    cur_sort_num++;
                }
            }
            let options = {
                dependency_elems: dependency_elems
            };

            this._handle_manage_action(perspective.ACTION_TYPE.change_active_dropdown, null, options,
                _ => {
                    this._run_query();
                },
                _ => {
                    this._run_query();
                });
            this._run_query();
        } else {
            var row_pivot_elems = this._get_view_dom_columns("#row_pivots perspective-row");
            var column_pivot_elems = this._get_view_dom_columns("#column_pivots perspective-row");
            let is_row_pivot = this.is_row_pivot(false);
            let is_column_pivot = this.is_column_pivot(false);
            let is_row_combined = this.is_row_combined(false);
            var order_values = false;
            var options = {
                items: {}
            };
            let dependency_elems = [];

            /**
             * Function to reorder tag in value_pivots with comparison value and direction
             * @param {*} comparison_values
             */
            var order_value_pivots = comparison_values => {
                var old_value = this.getAttribute("value-pivots");
                var value_pivots = [];
                var value_elems = this._get_view_dom_columns("#value_pivots perspective-row");
                var sort_by_comparison_values = (order, values) => {
                    return (elem1, elem2) => {
                        let comp1 = values[elem1.getAttribute("vname")];
                        let comp2 = values[elem2.getAttribute("vname")];
                        let comparison = 0;
                        if (comp1 > comp2) {
                          comparison = 1;
                        } else if (comp1 < comp2) {
                          comparison = -1;
                        }
                        return (
                          (order === 'desc') ? (comparison * -1) : comparison
                        );
                      };
                };
                value_elems.sort(sort_by_comparison_values(direction, comparison_values));
                value_elems.forEach(col => {
                    value_pivots.push({
                        n: col.getAttribute("name"),
                        t: col.getAttribute("type"),
                        agg: col.getAttribute("aggregate"),
                        df: col.getAttribute("data_format"),
                        st: col.getAttribute("show_type") || "default",
                        p: col.getAttribute("period") || "none",
                        drag_id: col.getAttribute("drag_id"),
                        dname: col.getAttribute("dname")
                    });
                });
                let new_value = JSON.stringify(value_pivots);
                var options = {
                    old_value: old_value,
                    new_value: new_value,
                    attribute: "value-pivots"
                }
                this._handle_manage_action(perspective.ACTION_TYPE.change_viewer_attribute, undefined, options);
                this.setAttribute("value-pivots", new_value);
            };

            /**
             * Function set attribute "sort_order", "sort_by" or "subtotal" for tags in "row_pivots" or "column_pivots"
             * @param {*} elem
             * @param {*} column
             * @param {*} dir
             */
            var sort_value_elem = (elem, column, dir) => {
                var name = elem.getAttribute("name");
                var item = {
                    "sort_by": {
                        old_value: elem.getAttribute("sort_by") || name,
                        new_value: column.sort_by
                    },
                    "sort_order": {
                        old_value: elem.getAttribute("sort_order") || "asc",
                        new_value: dir
                    }
                };
                elem.setAttribute("sort_by", column.sort_by);
                elem.setAttribute("sort_order", dir);
                if (column.subtotal) {
                    var old_subtotal = elem.getAttribute("subtotal") || this.SUB_TOTAL_LIST[0];
                    elem.setAttribute("subtotal", column.subtotal);
                    item["subtotal"] = {
                        old_value: old_subtotal,
                        new_value: column.subtotal
                    };
                }
                return item;
            };
            for (let column of columns) {
                if (!column.in_pivot) {
                    continue;
                }
                var name = null;
                var drag_id = null;
                var item = null;
                //Case: click to area in row_pivots
                if (column.in_pivot === "row_pivots") {
                    if (column.level === undefined || column.level === null || column.level < 0) {
                        continue;
                    }
                    var elem = row_pivot_elems[column.level];
                    if (!elem) {
                        continue;
                    }
                    // Sub case: click to combined field ("Values") in row pivots
                    // will reorder tags in "value_pivots"
                    else if (elem.getAttribute("name") === perspective.COMBINED_NAME) {
                        order_values = true;
                        var comparison_values = {};
                        var value_elems = this._get_view_dom_columns("#value_pivots perspective-row");
                        for (let idx in value_elems) {
                            let vname = value_elems[idx].getAttribute("vname");
                            comparison_values[vname] = vname;
                        }
                        order_value_pivots.call(this, comparison_values);
                        break;
                    } else {
                        // Sub case: click to other field in row pivots,
                        // set attribute for this tag
                        name = elem.getAttribute("name");
                        drag_id = elem.getAttribute("drag_id");
                        item = sort_value_elem.call(this, elem, {sort_by: name}, direction);
                        let row_name = elem.getAttribute("name");
                        let old_sort_num = elem.getAttribute("sort_num");
                        item.sort_num = {
                            old_value: elem.getAttribute("sort_num"),
                            new_value: 1
                        };
                        elem.setAttribute("sort_num", 1);
                        for (let col of row_pivot_elems) {
                            let col_name = col.getAttribute("name");
                            let sort_num = col.getAttribute("sort_num");
                            if (col_name !== row_name && sort_num && sort_num !== "null" && sort_num !== "undefined") {
                                if (!old_sort_num || old_sort_num === "null" || old_sort_num === "undefined" || (Number(sort_num) < Number(old_sort_num))) {
                                    dependency_elems.push({
                                        row: [col.getAttribute("name"), col.getAttribute("drag_id"), col.getAttribute("container")],
                                        attributes: [{
                                            old_value: sort_num,
                                            new_value: Number(sort_num) + 1,
                                            attribute: "sort_num"
                                        }]
                                    });
                                    col.setAttribute("sort_num", Number(sort_num) + 1);
                                }
                            }
                        }
                    }
                }
                // Case: Click to title in stack header
                else if (column.in_pivot === "column_pivots") {
                    if (column.level === undefined || column.level === null || column.level < 0) {
                        continue;
                    }
                    var elem = column_pivot_elems[column.level];
                    if (!elem) {
                        continue;
                    }
                    // Sub case: Click to stack header at position of combined field ("Values") in column_pivots
                    // will reorder tags in value_pivots
                    else if (elem.getAttribute("name") === perspective.COMBINED_NAME) {
                        order_values = true;
                        var comparison_values = {};
                        var value_elems = this._get_view_dom_columns("#value_pivots perspective-row");
                        for (let idx in value_elems) {
                            let vname = value_elems[idx].getAttribute("vname");
                            comparison_values[vname] = vname;
                        }
                        order_value_pivots.call(this, comparison_values);
                        break;
                    } else {
                        // Sub case: click to other field in column pivots
                        // set attributes for this tag
                        name = elem.getAttribute("name");
                        drag_id = elem.getAttribute("drag_id");
                        item = sort_value_elem.call(this, elem, {sort_by: name}, direction);
                    }
                }
                // Case: Click to values area in grid
                else if (column.in_pivot === "value_pivots") {
                    // Sub case: have tag (except "Values") in column pivots area
                    if (is_column_pivot) {
                        // sub case: have tag (except "Values") in row pivots area
                        // set attributes for tag in row_pivots base on subtotal and sort by
                        if (is_row_pivot) {
                            if (column.level === undefined || column.level === null || column.level < 0) {
                                continue;
                            }
                            var elem = row_pivot_elems[column.level];
                            if (!elem) {
                                continue;
                            }
                            name = elem.getAttribute("name");
                            drag_id = elem.getAttribute("drag_id");
                            var sort_params = {
                                sort_by: column.sort_by || name
                            };
                            if (column.subtotal) {
                                sort_params.subtotal = column.subtotal;
                            }
                            item = sort_value_elem.call(this, elem, sort_params, direction);
                        }
                        // sub case: don't have tag (except "Values") in row_pivots area
                        else {
                            // sub case: tag "Values" in row_pivots
                            // get values from cpp and order tags in value_pivots base on values
                            if (is_row_combined) {
                                if (column.original_index === null || column.original_index === undefined || column.original_index < 0) {
                                    continue;
                                }
                                order_values = true;
                                let old_value_pivots = this.get_value_pivots(false);
                                var range = {
                                    start_row: 0,
                                    end_row: old_value_pivots.length,
                                    start_col: 0,
                                    end_col: 1,
                                    index_map: {
                                        0: 0,
                                        1: column.original_index
                                    }
                                };
                                this._view.to_columns(range).then(json => {
                                    var comparison_values = {};
                                    let keys = Object.keys(json);
                                    if (keys.length != 2) {
                                        return;
                                    }
                                    let key = keys[1];
                                    for (let idx in json["__ROW_PATH__"]) {
                                        comparison_values[json["__ROW_PATH__"][idx]["value"][0]] = json[key][idx];
                                    }
                                    order_value_pivots.call(this, comparison_values);
                                });
                                break;
                            }
                            // sub case: tag "Values" in column pivots or don't have tag "Values"
                            // set attributes for tag in column pivots
                            else {
                                if (column.level === undefined || column.level === null || column.level < 0) {
                                    continue;
                                }
                                var elem = column_pivot_elems[column.level];
                                if (!elem) {
                                    continue;
                                }
                                name = elem.getAttribute("name");
                                drag_id = elem.getAttribute("drag_id");
                                item = sort_value_elem.call(this, elem, {sort_by: column.sort_by}, direction);
                            }
                        }
                    }
                    // Sub case: have tag in row_pivots (except "Values") and don't have any tag in column_pivots (except "Values")
                    // set attributes of element in row_pivots
                    else if (is_row_pivot) {
                        if (column.level === undefined || column.level === null || column.level < 0) {
                            continue;
                        }
                        var elem = row_pivot_elems[column.level];
                        if (!elem) {
                            continue;
                        }
                        name = elem.getAttribute("name");
                        drag_id = elem.getAttribute("drag_id");
                        item = sort_value_elem.call(this, elem, {sort_by: column.sort_by || column.n}, direction);
                    }
                    // Sub case: don't have any tag in both row_pivots and column_pivots (except "Values")
                    // and have tag in value_pivots
                    // reorder tag in value_pivots base on value
                    else {
                        let old_value_pivots = this.get_value_pivots(false);
                        const window = {
                            start_row: 0,
                            end_row: Math.max(is_row_combined ? old_value_pivots.length : 1)
                        };
                        order_values = true;
                        this._view.to_columns(window).then(json => {
                            var comparison_values = {};
                            if (is_row_combined) {
                                for (let idx in json["__ROW_PATH__"]) {
                                    comparison_values[json["__ROW_PATH__"][idx]["value"][0]] = json["Values"][idx];
                                }
                            } else {
                                var value_elems = this._get_view_dom_columns("#value_pivots perspective-row");
                                for (let elem of value_elems) {
                                    let vname = elem.getAttribute("vname");
                                    comparison_values[vname] = json[vname][0];
                                }
                            }
                            order_value_pivots.call(this, comparison_values);
                        });
                        break;
                    }
                }
                if (item && name && drag_id) {
                    options["items"][name + drag_id] = item;
                }
            }
            if (!order_values) {
                if (dependency_elems.length > 0) {
                    options.dependency_elems = dependency_elems;
                }
                this._handle_manage_action(perspective.ACTION_TYPE.change_multiple_sorts, undefined, options,
                    _ => {
                        this._run_query();
                    },
                    _ => {
                        this._run_query();
                    });
                this._run_query();
            }
        }
    }

    _update_value_pivot_view() {
        var column_pivots = JSON.parse(this.getAttribute("column-pivots"));
        var row_pivots = JSON.parse(this.getAttribute("row-pivots"));
        if (this.is_flat_pivot(false)) {
            //this.setAttribute("column-pivots", JSON.stringify(column_pivots.filter(x => x !== perspective.COMBINED_NAME)));
            this.setAttribute("column-pivots", JSON.stringify(column_pivots.filter((v) => v.n !== perspective.COMBINED_NAME)));
            //this._transpose_button.style.pointerEvents = "none";
        } else {
            //this._transpose_button.style.pointerEvents = "auto";
            //var new_column_pivots = column_pivots.filter(x => x !== perspective.COMBINED_NAME);
            var new_column_pivots = column_pivots.filter((v) => v.n !== perspective.COMBINED_NAME);
            if (this._get_view_dom_columns("#value_pivots perspective-row").length > 1) {
                new_column_pivots.push({
                    n: perspective.COMBINED_NAME,
                    dname: this._get_dname_name(perspective.COMBINED_NAME),
                    drag_id: this._generage_drag_id()
                });
            }
            this.setAttribute("column-pivots", JSON.stringify(new_column_pivots));
        }
        //this.setAttribute("row-pivots", JSON.stringify(row_pivots.filter(x => x !== perspective.COMBINED_NAME)));
        this.setAttribute("row-pivots", JSON.stringify(row_pivots.filter((v) => v.n !== perspective.COMBINED_NAME)));
    }

    filter_available_fields() {

        var search_text = this._search_fields.value || "";
        search_text = search_text.toUpperCase().trim();

        var a_rows = this._pivotList.getActiveCols(false);
        for (var i = 0; i < a_rows.length; i++) {
            var name = a_rows[i].getAttribute("new_base_name");
            if (!search_text || name.toUpperCase().indexOf(search_text) > -1) {
                //a_rows[i].style.display = "";
                a_rows[i].classList.remove("hidden");
            } else {
                //a_rows[i].style.display = "none";
                a_rows[i].classList.add("hidden");
            }
        }

        var i_rows = this._pivotList.getInactiveCols(false);
        for (var i = 0; i < i_rows.length; i++) {
            //if (i_rows[i].classList.contains("active")){
            //  continue;
            //}

            var name = i_rows[i].getAttribute("new_base_name");
            if (!search_text || name.toUpperCase().indexOf(search_text) > -1) {
                i_rows[i].classList.remove("hidden");
            } else {
                i_rows[i].classList.add("hidden");
            }
        }
        // after filter, should refresh hyperlist.
        this._pivotList.refresh();
    }
    /*
    * set pagination group with page number
    * set hightlight and disabled for back and forward button
    */
    _set_pagination_group(page_number) {
        if (page_number <= 1) {
            this._pagination_back_button.classList.remove("hightlight");
            this._pagination_back_button.disabled = true;
        } else {
            this._pagination_back_button.classList.add("hightlight");
            this._pagination_back_button.disabled = false;
        }
        this._pagination_forward_button.classList.add("hightlight");
        this._pagination_forward_button.disabled = false;
    }

    /**
     * Update items per page dropdown style
     */
    _update_items_per_page() {
        if (this._can_show_items_per_page()) {
            this._page_item_group.style.display = "inline-block";
        } else {
            this._page_item_group.style.display = "none";
        }
        this._update_pagination();
    }


    /**
     * Update pagination page style
     */
    _update_pagination() {
        var value = this._vis_page_item.value;
        if (value == "--" || !this._can_show_items_per_page()) {
            this._pagination_group.style.display = "none";
        } else {
            this._pagination_group.style.display = "inline-block";
        }
    }

    // edits state
    _transpose() {
        let row_pivots = this.getAttribute("row-pivots");
        let row_pivot_cols = (JSON.parse(row_pivots) || []).map(r => r.n);
        let column_pivots = this.getAttribute("column-pivots");
        let old_sorts = this.getAttribute("sort");
        let old_filters = this.getAttribute("filters");
        let old_filters_obj = JSON.parse(old_filters) || [];
        this.setAttribute("row-pivots", column_pivots);
        this.setAttribute("column-pivots", row_pivots);
        /*let row_pivot_size = JSON.parse(row_pivots).length;
        let column_pivot_size = JSON.parse(column_pivots).length;
        if (row_pivot_size != 0 && column_pivot_size == 0) {
            this._update_column_view(this.c_info.filter(f => f["active"]).map(m => m["name"]), true);
        } else if (row_pivot_size == 0 && column_pivot_size != 0) {
            this._active_columns.innerHTML = "";
            this._update_column_view();
        } else {
            this._update_column_view();
        }*/
        let new_sorts = this.getAttribute("sort");
        let new_filters = this.getAttribute("filters");
        if (row_pivot_cols.length > 0) {
            let new_filters_obj = old_filters_obj.filter(f => !row_pivot_cols.includes(f.n) || !f.filter_by || f.filter_by === f.n);
            if (new_filters_obj.length < old_filters_obj.length) {
                new_filters = JSON.stringify(new_filters_obj);
                this.setAttribute("filters", new_filters);
            }
        }
        var options = {
            target: {
                attribute: "row-pivots",
                new_value: column_pivots,
                old_value: row_pivots,
                new_filters: new_filters,
                new_sorts: new_sorts,
                old_filters: old_filters,
                old_sorts: old_sorts
            },
            source: {
                attribute: "column-pivots",
                new_value: row_pivots,
                old_value: column_pivots
            }
        };
        this._handle_manage_action(perspective.ACTION_TYPE.add_tag, undefined, options);
        this._update_column_view();
    }

    // No need to show the `display as` in source/settings title. Eg: (running total)
    _format_value_popup_title(new_base_name){
      if (new_base_name){
        const i = new_base_name.indexOf("(");
        const last_i = new_base_name.indexOf(")");
        if (i > 0 && last_i > 0){
          new_base_name = new_base_name.substr(0, i);
        }
      }
      return new_base_name
    }

    _create_rsettings(name, container, drag_id, prows){

        if (!name || !container){
          return;
        }

        if (!prows){
          if (container === "row_pivots"){
              prows = this._row_pivots.getElementsByTagName("perspective-row");
          }else if(container === "column_pivots"){
              prows = this._column_pivots.getElementsByTagName("perspective-row");
          }else if(container === "value_pivots"){
              prows = this._value_pivots.getElementsByTagName("perspective-row");
          }else if(container === "filters"){
              prows = this._filters.getElementsByTagName("perspective-row");
          }
        }

        var index = Array.prototype.slice.call(prows).findIndex((v)=>v.getAttribute("name") === name && (v.getAttribute("drag_id") === drag_id || name === perspective.__FILTER_SEARCH__));
        var _prow;
        if (index !== -1){
          _prow = prows[index];
        }else if(name === perspective.__FILTER_SEARCH__){
          _prow = this._new_row(perspective.__FILTER_SEARCH__, "string", undefined, undefined, undefined, undefined, undefined, "filters");
        }

        if (!_prow){
          return;
        }

        let prow_settings = document.createElement("perspective-row-settings");

        // Enable prev value if we have at least the date aggregation or the date filter
        var show_prev_value = false;
        if(container === "value_pivots"){
          var row_pivots = JSON.parse(this.getAttribute("row-pivots") || "[]");
          var column_pivots = JSON.parse(this.getAttribute("column-pivots") || "[]");
          var filters = JSON.parse(this.getAttribute("filters") || "[]");
          //var row_date_index = row_pivots.findIndex((v)=>perspective.AGGREGATE_LEVEL_LIST.includes(v.t));
          //var column_date_index = column_pivots.findIndex((v)=>perspective.AGGREGATE_LEVEL_LIST.includes(v.t));
          var _this = this;
          var filter_date_index = filters.findIndex((v)=>{
            var type;
            var index = _this.c_info.findIndex((c)=>c.name === v.n);
            if (index !== -1){
              type = _this.c_info[index].type;
            }
            if (!type){
              return false;
            }
            return perspective.AGGREGATE_LEVEL_LIST.includes(type);
          });

          if (/*row_date_index != -1 || column_date_index != -1 || filter_date_index != -1*/
              this._visible_column_period()){
            show_prev_value = true;
          }
        }

        // Filter SEARCH popup
        let is_filter_search = false;

        // Group filter tag
        let is_group_filter = false;
        if(container === "filters"){
          if (_prow.getAttribute("name") === perspective.__FILTER_SEARCH__){
            is_filter_search = true;
          }else if (_prow.getAttribute("name") === perspective.GROUP_FILTER_NAME){
            is_group_filter = true;
          }
        }

        let attr_filter_key;
        let attr_filter_value;

        // Update attributes
        var prow_node = _prow.cloneNode(true);
        var atts = prow_node.attributes;
        if (atts && atts.length > 0){
          for (var i = 0; i < atts.length; i++){
            if (atts[i].nodeName === 'style' ||
              atts[i].nodeName === 'class' ||
              atts[i].nodeName === 'id') {
                continue;
            }

            if (container === "filters" && atts[i].nodeName === "filter"){
              attr_filter_key = "filter";
              attr_filter_value = atts[i].nodeValue;
            }else{
              prow_settings.setAttribute(atts[i].nodeName, atts[i].nodeValue);
            }

            if (atts[i].nodeName === "container" && atts[i].nodeValue === "value_pivots"){
              prow_settings.setAttribute("enable_prev_value", show_prev_value);
            }
          }
        }

        /*
        // Add suggestion values for row settings
        if (!event.detail.filter_datalist) {
          this._get_filter_datalist(name, values => {
              prow_settings.setAttribute("filter_datalist", JSON.stringify(values));
          });
        }
        */

        if (container === "filters"){
          if (is_filter_search){
            prow_settings.setAttribute("advanced_feature", perspective.__FILTER_SEARCH__);
          }else if (is_group_filter){
            prow_settings.setAttribute("advanced_feature", perspective.GROUP_FILTER_NAME);

            //prow_settings.addEventListener("group-filter-selected", event => this._group_filter_clicked.call(this, event));
          }else{
            prow_settings.setAttribute("advanced_feature", "FILTER");
          }
        }


        if (is_filter_search){

          //prow_settings.setAttribute("specificied_field", perspective.__FILTER_SEARCH__);
          prow_settings.setAttribute("advanced_feature", perspective.__FILTER_SEARCH__);
          prow_settings.setAttribute("site_search_af", this._site_search_obj.site_search_af || false);
          prow_settings.setAttribute("fields_datalist", JSON.stringify(this.get_default_cinfo()));

          prow_settings.addEventListener("updates-search-fields", event => this._site_search_changed.call(this, event.detail));
          prow_settings.addEventListener("updates-search-type", event => this._site_search_type_changed.call(this, event.detail));

        }

        // Add events
        prow_settings.addEventListener("aggregate-selected", event => this._column_aggregate_clicked.call(this, event.detail));
        prow_settings.addEventListener("period-selected", event => this._column_period_clicked.call(this, event.detail));
        prow_settings.addEventListener("show-as-selected", event => this._column_show_type_clicked.call(this, event.detail));

        prow_settings.addEventListener("data-format-selected", event => this._column_data_format_clicked.call(this, event.detail));
        prow_settings.addEventListener("close-clicked", event => undrag.call(this, event.detail));
        prow_settings.addEventListener("column-validate-name", this._validate_column_name.bind(this));
        prow_settings.addEventListener("column-change-name", this._change_column_name.bind(this));
        prow_settings.addEventListener("aggregate-level-selected", event => this._column_agg_level_clicked.call(this, event.detail));

        prow_settings.addEventListener("subtotals-clicked", event => this._column_subtotals_clicked.call(this, event.detail));
        prow_settings.addEventListener("binning-updated", event => this._column_binning_updated.call(this, event.detail));

        // events for sort
        prow_settings.addEventListener("sort_order-selected", event => this._column_sort_order_clicked.call(this, event.detail));
        prow_settings.addEventListener("limit-group-selected", event => this._column_limit_select_clicked.call(this, event.detail));
        prow_settings.addEventListener("limit-type-selected", event => this._column_limit_type_selected.call(this, event.detail));
        prow_settings.addEventListener("sort-by-selected", event => this._column_sort_by_clicked.call(this, event.detail));
        prow_settings.addEventListener("sort-subtotal-selected", event => this._column_sort_subtotal_clicked.call(this, event.detail));
        prow_settings.addEventListener("sort-order-by-selected", event => this._column_sort_order_by_clicked.call(this, event.detail));

        // events for filters
        prow_settings.addEventListener("filter-selected", event => this._column_change_filter_clicked.call(this, event));

        prow_settings.addEventListener("column-popup-close", event => this._column_popup_close.call(this, event));
        prow_settings.addEventListener("column-excute-quick-sort-filter", event => this._column_excute_quick_sort_filter.call(this, event));
        prow_settings.addEventListener("column-auto-query-checked", event => this._column_auto_query_checked.call(this, event));

        // Clear the previous popup
        this._psp_popup_data.innerHTML = "";

        // Add perspective row settings
        this._psp_popup_data.appendChild(prow_settings);

        var t = prow_settings.getAttribute("type");
        var is_date = perspective.AGGREGATE_LEVEL_LIST.includes(t);
        if (is_date && container === "row_pivots" || container === "column_pivots") {
            this._update_disabled_aggregate_level(name);
        }

        if (["float", "integer", "date", "datetime", "list_float", "list_integer", "list_date", "list_datetime"].includes(t)
              && (container === "row_pivots" || container === "column_pivots")) {
          // Call auto-fill binning value for case binning type is AUTO
          this._update_default_binning_params(name, prow_settings);
        }

        if (container === "value_pivots") {
            // Update for display as dropdown
            let pivot_type = this._get_display_as_pivot_type();
            let have_previous = this._get_display_as_has_previous(_prow);
            let disabled_list = this._get_display_as_disabled_list(_prow);
            const col_in_pivot = this._row_col_pivots_has_column(name);
            prow_settings._update_display_as_dropdown(pivot_type, have_previous, disabled_list);
            prow_settings._update_show_type_checkbox_text(this._visible_column_period());
            prow_settings._update_aggregate_dropdown(col_in_pivot);
        }else if(container === "filters"){

          if (is_filter_search){
            // Do nothing
          }else if(is_group_filter === true){
            // Set filter attribute
            prow_settings.setAttribute(attr_filter_key, attr_filter_value);
          }else{
            prow_settings.setAttribute("is_multiple_filters_applied", false);
            let filter = attr_filter_value ? JSON.parse(attr_filter_value): undefined;
            let search_text = (filter && filter.search !== undefined && filter.search !== "" && filter.datalist_contains_all === false) ? filter.search : "";
            this._update_suggestion_list_attribute(prow_settings, name, search_text, attr_filter_value, false, perspective.MAX_FILTER_OPTIONS + 1);
            this._update_filter_dropdown(prow_settings, name, filter);
          }
        }

        return prow_settings;
    }

    // Clicking on the row info icon of each perspective-row to open the row's settings popup
    _open_row_settings(event){

        event.preventDefault();

        var data = event.data;

        if (!data){
          // Nothing to do if the data is not provided
          return;
        }

        var name = data.name;
        var container = data.container;
        var drag_id = data.drag_id;

        let f_prow_will_open;
        if (container === "filters" && !drag_id){
          let f_prows = this._filters.getElementsByTagName("perspective-row");

          // Find drag_id in the filter tag
          const f_tag_index = Array.prototype.slice.call(f_prows).findIndex((tag)=>tag.getAttribute("name") === name);
          if (f_tag_index !== -1){
            drag_id = f_prows[f_tag_index].getAttribute("drag_id");
            f_prow_will_open = f_prows[f_tag_index];
          }
        }

        let is_filter_search = false;
        var title = "";
        if (container === "row_pivots"){
            title = "Row settings";
        }else if(container === "column_pivots"){
            title = "Column settings";
        }else if(container === "value_pivots"){
            title = "Value settings";
        }else if(container === "filters"){
          if (name === perspective.__FILTER_SEARCH__){
            is_filter_search = true;
            title = "Search fields";
          }else{
            title = "Filter";
          }
        }

        // Header title name
        let div_header_left = document.createElement("div");
        div_header_left.classList.add("sf-title-left");
        div_header_left.classList.add("field-title");
        div_header_left.innerHTML = is_filter_search ? title : title + ":";

        // Header title value - Field name or Field list
        let div_header_right = document.createElement("div");
        div_header_right.classList.add("sf-title-right");
        let div_selection = document.createElement("select");

        // Clear the previous popup
        this._psp_popup_data.innerHTML = "";
        this.reset_popup();
        this._is_popup_openning = false;

        // Create perspective row data
        let prow_settings = this._create_rsettings(name, container, drag_id);

        if (!prow_settings){
          //this._psp_popup.classList.add("hidden");
          //this._is_popup_openning = false;
          this.close_popup();
          return;
        }

        // Build custom header title
        if (container === "filters"){ // In case the tag is in FILTERS
          if (is_filter_search){
            if (event && event.target && event.target.getAttribute("data") === "three-dots"){
              // The search box is still opening
            }else{
              this.open_search_box();
            }
          }else{
            /*
            const filters = (JSON.parse(this.getAttribute("filters") || "[]") || []).filter((fv)=>fv.n !== perspective.__FILTER_SEARCH__);
            if (filters && filters.length > 1){
              div_header_right.classList.add("sf-title-right");
              let div_selection = document.createElement("select");

              div_selection.innerHTML = filters.map(op =>{
                const val = JSON.stringify({n: op.n, drag_id: op.drag_id});
                if (op.n === name){
                  return `<option value='${val}' selected>${op.dname || op.n}</option>`;
                }else{
                  return `<option value='${val}'>${op.dname || op.n}</option>`;
                }
              }).join("");

              div_selection.addEventListener("change", event =>{
                var selected_value = div_selection.value && div_selection.value !== "" ? JSON.parse(div_selection.value) : {};
                var _drag_id = selected_value.drag_id;

                // Need to find drag_id in filter tag element
                if (!_drag_id){
                  var _prs = this._filters.getElementsByTagName("perspective-row");
                  const _pr_index = Array.prototype.slice.call(_prs).findIndex((_v)=>_v.getAttribute("name") === selected_value.n);
                  if (_pr_index !== -1){
                    _drag_id = _prs[_pr_index].getAttribute("drag_id");
                  }
                }

                // Clear the previous popup
                this._psp_popup_data.innerHTML = "";
                let prow_settings = this._create_rsettings.call(this, selected_value.n, container, _drag_id);
              });

              div_header_right.classList.add("select-dropdown");
              div_header_right.appendChild(div_selection);

            }else{
              //div_header_right.classList.add("sf-title-right");
              div_header_right.innerHTML = "<span>" + prow_settings.getAttribute("dname") + "</span>";
            }
            */
            div_header_right.innerHTML = "<span>" + prow_settings.getAttribute("dname") + "</span>";
            this.close_search_box();
          }
        }else{ // In case the tag is in ROWS, COLUMNS or VALUES
          //div_header_right.classList.add("sf-title-right");
          if (container === "value_pivots"){
            // Source field
            //div_header_right.innerHTML = "<span>" + this._format_value_popup_title(prow_settings.getAttribute("new_base_name")) + "</span>";
            const c_info = this.get_default_cinfo();
            const vi = c_info.findIndex((vc)=>vc.name === prow_settings.getAttribute("name"));
            if (vi !== -1){
              div_header_right.innerHTML = "<span>" + (c_info[vi].dname || c_info[vi].dname) + "</span>";
            }

          }else{
            div_header_right.innerHTML = "<span>" + prow_settings.getAttribute("dname") + "</span>";
          }
          this.close_search_box();
        }

        /*
        if (is_filter_search){
          if (event && event.target && event.target.getAttribute("data") === "three-dots"){
            // The search box is still opening
          }else{
            this.open_search_box();
          }
        }else{

          const filters = JSON.parse(this.getAttribute("filters") || "[]") || [];
          if (container === "filters" && filters && filters.length > 1){
            div_header_right.classList.add("sf-title-right");
            let div_selection = document.createElement("select");

            div_selection.innerHTML = filters.map(op =>{
              const val = JSON.stringify({n: op.n, drag_id: op.drag_id});
              return `<option value='${val}'>${op.dname || op.n}</option>`;
            }).join("");

            div_selection.addEventListener("change", event =>{

            });

            div_header_right.classList.add("select-dropdown");
            div_header_right.appendChild(div_selection);

          }else{
            div_header_right.classList.add("sf-title-right");

            div_header_right.innerHTML = "<span>" + prow_settings.getAttribute("dname") + "</span>";
          }

          this._psp_popup_title.appendChild(div_header_left);
          this._psp_popup_title.appendChild(div_header_right);
          this.close_search_box();
        }
        */

        this._psp_popup_title.innerHTML = "";
        this._psp_popup_title.appendChild(div_header_left);
        this._psp_popup_title.appendChild(div_header_right);

        // Add perspective row settings
        //this._psp_popup_data.appendChild(prow_settings);

        var t = prow_settings.getAttribute("type");

        // Update the popup's positions
        const w = 349;
        var h = 297;
        if (["row_pivots", "column_pivots"].includes(container) == true){

          if (t === "string" || t === "list_string"){
            h = 197;
          }else if (["float", "integer", "decimal", "list_integer", "list_float"].includes(t) === true){
            h = 297;
          }else{
            h = 297;
          }
        }else if(container === "filters"){
          h = 293;
        }else if(container === "value_pivots"){
          if (t === "string" || t === "list_string"){
            h = 195;
          }else{
            h = 240;
          }
        }

        h = h + 25;

        let clicked_icon_bounds;
        let hosted_icon_bounds;
        if (data.clicked_icon_bounds){
          clicked_icon_bounds = data.clicked_icon_bounds;
        }

        if (data.hosted_icon_bounds){
          hosted_icon_bounds = data.hosted_icon_bounds;
        }

        // Auto open the filter tag when a new item is dragged into the FILTERS
        if (!clicked_icon_bounds){
          if (!hosted_icon_bounds && f_prow_will_open){
            hosted_icon_bounds = f_prow_will_open.getBoundingClientRect();

            let ri_info = f_prow_will_open.shadowRoot ? f_prow_will_open.shadowRoot.querySelector("#row_icon_info") : undefined;

            if (ri_info){
              clicked_icon_bounds = ri_info.getBoundingClientRect();
            }
          }
        }

        var clientX = event.clientX;
        var clientY = event.clientY + 5;

        // LEFT
        //var left = clientX - (w + 25);
        var left = clicked_icon_bounds ? clicked_icon_bounds.right : clientX - 25;

        // RIGHT
        //var right = window.innerWidth - (left + w);
        var right = window.innerWidth - left;

        // TOP
        //var top = clientY;
        var top = clicked_icon_bounds ? clicked_icon_bounds.bottom + 5 : clientY;

        // Show in LEFT icon if we don't have enough space to show under icon i
        var iHView = window.innerHeight - 10;
        if (iHView - clientY < h){
            top = iHView - h;
            left = clicked_icon_bounds ? clicked_icon_bounds.left - 5 : clientX - 25;
            right = window.innerWidth - left;
        }

        if (is_filter_search){
          top = 104;
          //right = 349 + 10 + 20;

          if (this._search_container.classList.contains("side-panel-active")){
            right = 349 + 10 + 20;
          }else{
            right = 10 + 56;
          }

          //this._psp_popup.style.top = top + "px";
          //this._psp_popup.style.right = right + "px";

          // Not allow to move the popup in case the search tag
          this._psp_popup.classList.remove("moveable");
        }else{
          //this._psp_popup.style.top = "calc(50vH - 175px)";
          //this._psp_popup.style.right = "calc(50vW - 175px)";

          this._psp_popup.classList.add("moveable");
          this._psp_popup_header_container.addEventListener('mousedown', this.popup_mousedown.bind(this));
        }

        this._psp_popup.style.top = top + "px";
        this._psp_popup.style.left = "unset";
        this._psp_popup.style.right = right + "px";
        this._psp_popup.style.bottom = "unset";

        //this._psp_popup_button_x_container.classList.remove("hidden");
        this._psp_popup.classList.remove("quick-fsort");
        this._psp_popup.classList.remove("hidden");
        this._psp_popup_outbound.classList.remove("hidden");
        var _this = this;

        setTimeout(function(){
          _this._is_popup_openning = true;
        }, 400);
    }

    // Requires the filter tag for each field is unique
    _get_attr_filter_obj(name){
      const filters = JSON.parse(this.getAttribute("filters") || "[]") || [];
      const i = filters.findIndex((v)=>v.n === name);
      if (i !== -1){
        return filters[i];
      }else{
        return;
      }
    }

    _update_suggestion_list_attribute(row_settings, name, search_text = "", filter_value = undefined, require_exec_query = false, limit = 1000, reset_filter = false) {
        if (!name || !row_settings) {
            return;
        }

        //let filter = JSON.parse(row_settings.getAttribute("filter"));
        if (reset_filter) {
            //let old_filter_obj = JSON.parse(row_settings.getAttribute("filter"));
            let old_filter_obj = this._get_attr_filter_obj(name);
            filter_value = JSON.stringify({
                datalist_contains_all: old_filter_obj ? old_filter_obj.datalist_contains_all : false,
                search: ""
            });
        }
        let filter;
        if (filter_value === undefined){
            //filter_value = row_settings.getAttribute("filter");
            filter = this._get_attr_filter_obj(name);
        } else {
            filter = JSON.parse(filter_value);
        }

        if (!filter) {
            filter = {};
        }

        // Get agg level for quick sort filter or filter well
        let agg_level = "OFF";
        let binning_info = {type: "OFF"};
        let data_format = "none";
        if (this.is_cinfo_pivot(false)) {
            let row_pivots = JSON.parse(this.getAttribute("row-pivots")) || [];
            let index = row_pivots.findIndex(p => p.n === name);
            if (index !== -1) {
                agg_level = row_pivots[index].agg_l;
                binning_info = (row_pivots[index].b) ? JSON.parse(row_pivots[index].b) : {type: "OFF"};
                data_format = row_pivots[index].df;
            } else {
                let column_pivots = JSON.parse(this.getAttribute("column-pivots")) || [];
                index = column_pivots.findIndex(p => p.n === name);
                if (index !== -1) {
                    agg_level = column_pivots[index].agg_l;
                    binning_info = (column_pivots[index].b) ? JSON.parse(column_pivots[index].b) : {type: "OFF"};
                    data_format = column_pivots[index].df;
                }
            }
        }

        // Add suggestion values for row settings
        this._get_filter_datalist(name, agg_level, binning_info, data_format, search_text, limit, values => {
            if (search_text === "") {
                let datalist_contains_all = true;
                if (values.length === limit) {
                    datalist_contains_all = false;
                }

                filter.datalist_contains_all = datalist_contains_all;
                //filter.search = search_text;
                //row_settings.setAttribute("filter", JSON.stringify(filter));
                //values.unshift("__SELECT_ALL__");
            }

            if (search_text !== undefined && search_text !== null){
              filter.search = search_text;
            }

            // Add this when it's the first page
            //values.unshift("__SELECT_ALL__");
            row_settings.setAttribute("filter_datalist", JSON.stringify(values));

            /*
            if (filter){
              row_settings.setAttribute("filter", JSON.stringify(filter));
            }

            if (auto_query === true){
              row_settings.setAttribute("exec_query", JSON.stringify({"old_filter": old_filter}));
            }
            */


            // Set filter when the popup is created the first time
            if (!require_exec_query && filter){
              row_settings.setAttribute("filter", JSON.stringify(filter));
            }

            // Need to set exec_query in order to handle undo/redo.
            if (require_exec_query === true) {
                let exec_obj = {"reset_filter": reset_filter, refresh_time: new Date().getTime()};
                exec_obj.search = (search_text !== undefined && search_text !== null) ? search_text: "";
                row_settings.setAttribute("exec_query", JSON.stringify(exec_obj));
            }

        });
    }

    _update_filter_dropdown(row_settings, name, filter) {
        let show_by_sub = false;
        if (this.is_cinfo_pivot(false)) {
            let row_pivots = JSON.parse(this.getAttribute("row-pivots")) || [];
            show_by_sub = row_pivots.some(p => p.n === name);
        }

        row_settings.update_filter_dropdown_visibility(show_by_sub);

        let operator = (filter && filter.operator) ? filter.operator : undefined;
        let filter_by = (filter && filter.filter_by) ? filter.filter_by : undefined;
        row_settings.update_filter_operator_dropdown.call(row_settings, filter_by, operator);
    }

    _filter_search_datalist(event){
      if (!event || !event.detail){
          return;
      }

      var row_settings = event.detail.row_settings;

      if (!row_settings){
          return
      }

      var name = row_settings.getAttribute("name");
      var drag_id = row_settings.getAttribute("drag_id");
      var container = row_settings.getAttribute("container");

      //var row = this._get_row(container, name, drag_id);

      //if (!row){
      //    return;
      //}

      var search_text = event.detail.search_text;
      const reset_filter = event.detail.reset_filter;
      this._update_suggestion_list_attribute(row_settings, name, search_text, undefined, true, perspective.MAX_FILTER_OPTIONS + 1, reset_filter);
    }

    _create_prsettings(name, container, drag_id, prows){

      if (!name || !container){
        return undefined;
      }

      if (!prows){
        if(container === "active_columns"){
            prows = this._pivotList.getActiveCols();
        }else if(container === "row_pivots"){
            prows = this._row_pivots.getElementsByTagName("perspective-row");
        }else if(container === "column_pivots"){
            prows = this._column_pivots.getElementsByTagName("perspective-row");
        }else if(container === "value_pivots"){
            prows = this._value_pivots.getElementsByTagName("perspective-row");
        }
      }

      var index = Array.prototype.slice.call(prows).findIndex((v)=>v.getAttribute("name") === name && (drag_id === undefined || v.getAttribute("drag_id") === drag_id));
      if (index == -1){
        return undefined;
      }

      let prow_settings = document.createElement("perspective-row-settings");

      // Update attributes
      var prow_node = prows[index].cloneNode(true);
      var atts = prow_node.attributes;
      if (atts && atts.length > 0){
        for (var i = 0; i < atts.length; i++){
          if (atts[i].nodeName === 'style' ||
            atts[i].nodeName === 'class' ||
            atts[i].nodeName === 'id') {
              continue;
          }
          if (atts[i].nodeName !== "filter"){
            prow_settings.setAttribute(atts[i].nodeName, atts[i].nodeValue);
          }
        }
      }

      // Set the flatten aggregated results attribute
      prow_settings.setAttribute("is_flat_pivot", this.is_flat_pivot());

      //let filter = JSON.parse(prow_settings.getAttribute("filter"));
      let filter = this._get_attr_filter_obj(name); // Use this instead
      let search_text = (filter && filter.search !== undefined && filter.search !== "" && filter.datalist_contains_all === false) ? filter.search : "";
      this._update_suggestion_list_attribute(prow_settings, name, search_text, JSON.stringify(filter), false, perspective.MAX_FILTER_OPTIONS + 1);

      // Update filter operator dropdown
      setTimeout(function(){
        let operator = (filter && filter.operator) ? filter.operator : undefined;
        let filter_by = (filter && filter.filter_by) ? filter.filter_by : undefined;
        prow_settings.update_filter_operator_dropdown.call(prow_settings, filter_by, operator);
      }, 200);

      // Add events
      // events for sort
      prow_settings.addEventListener("sort_order-selected", event => this._column_sort_order_clicked.call(this, event.detail));
      prow_settings.addEventListener("sort-by-selected", event => this._column_sort_by_clicked.call(this, event.detail));
      prow_settings.addEventListener("limit-group-selected", event => this._column_limit_select_clicked.call(this, event.detail));
      prow_settings.addEventListener("limit-type-selected", event => this._column_limit_type_selected.call(this, event.detail));
      prow_settings.addEventListener("filter-selected", event => this._column_change_filter_clicked.call(this, event));
      prow_settings.addEventListener("change-suggestion-filter-search", event => this._column_change_suggestion_filter_search.call(this, event));
      prow_settings.addEventListener("sort-dropdown-selected", event => this._column_sort_dropdown_clicked.call(this, event.detail));
      prow_settings.addEventListener("sort-subtotal-selected", event => this._column_sort_subtotal_clicked.call(this, event.detail));
      prow_settings.addEventListener("column-auto-query-checked", event => this._column_auto_query_checked.call(this, event));
      prow_settings.addEventListener("column-excute-quick-sort-filter", event => this._column_excute_quick_sort_filter.call(this, event));
      prow_settings.addEventListener("column-popup-close", event => this._column_popup_close.call(this, event));
      prow_settings.addEventListener("filter-search-datalist", event => this._filter_search_datalist.call(this, event));

      return prow_settings;
    }

    // item_index: is the index of ROWS, COLUMNS
    _open_quick_sf(event, original_name, container, item_index){

        if (original_name === undefined || !original_name){
          return;
        }

        const contains_row_path = original_name === "__ROW_PATH__" ? true : false;
        let arr_row_pivots = contains_row_path === true ? this.get_row_pivots(false) : [];
        let arr_col_pivots = [];
        let contains_col_label_in_2nd_column = false;
        if (/*contains_row_path &&*/ container === "column_pivots"){
          arr_col_pivots = this.get_column_pivots(false) || [];
          if (!contains_row_path && arr_col_pivots.length > 0){
            contains_col_label_in_2nd_column = true;
          }
        }

        if ((contains_row_path || contains_col_label_in_2nd_column) && arr_row_pivots.length === 0 && arr_col_pivots.length === 0){
          return;
        }

        if (container === undefined || !container){
          container = contains_row_path === true ? "row_pivots": "active_columns";
        }

        // Header title name
        let div_header_left = document.createElement("div");
        div_header_left.classList.add("sf-title-left");
        div_header_left.classList.add("field-title");
        div_header_left.innerHTML = "Field:";

        // Header title value - Field name or Field list
        let div_header_right = document.createElement("div");
        div_header_right.classList.add("sf-title-right");
        let div_selection = document.createElement("select");

        const is_flat_pivot = this.is_flat_pivot();
        let drag_id;
        if (is_flat_pivot && container === "row_pivots"){
          // Pass - No need a dropdown
        }else if (contains_row_path || contains_col_label_in_2nd_column){
          if (container === "column_pivots"){

            // Not allow to open the combined name "__values__" in the quick filter
            arr_col_pivots = arr_col_pivots.filter((av)=>av.n !== perspective.COMBINED_NAME);

            if (arr_col_pivots.length === 0){
              return;
            }

            // Default field selection
            original_name = arr_col_pivots[0].n;
            drag_id = arr_col_pivots[0].drag_id;

            div_selection.innerHTML = arr_col_pivots.map(op =>{
              const val = JSON.stringify({n: op.n, drag_id: op.drag_id});
              return `<option value='${val}'>${op.dname || op.n}</option>`;
            }).join("");
          }else{

            // Not allow to open the combined name "__values__" in the quick filter
            arr_row_pivots = arr_row_pivots.filter((av)=>av.n !== perspective.COMBINED_NAME);

            if (arr_row_pivots.length === 0){
              return;
            }

            // Default field selection
            original_name = arr_row_pivots[0].n;
            drag_id = arr_row_pivots[0].drag_id;

            div_selection.innerHTML = arr_row_pivots.map(op =>{
              const val = JSON.stringify({n: op.n, drag_id: op.drag_id});
              return `<option value='${val}'>${op.dname || op.n}</option>`;
            }).join("");
          }
        }

        const popup_field = this._psp_popup.getAttribute("pf_field");

        if (popup_field !== undefined && popup_field === original_name && this._is_popup_openning === true){
          // Auto close the popup
          //this._psp_popup.classList.add("hidden");
          //this._is_popup_openning = false;
          this.close_popup();
          return;
        }

        // Create perspective row data
        let prow_settings = this._create_prsettings(original_name, container, drag_id);

        if (!prow_settings){
          //this._psp_popup.classList.add("hidden");
          //this._is_popup_openning = false;
          this.close_popup();
          return;
        }

        // Clear the previous popup
        this._psp_popup_data.innerHTML = "";
        this.reset_popup();
        this._is_popup_openning = false;

        var _this = this;
        if ((is_flat_pivot && container === "row_pivots")
          || (container === "row_pivots" && arr_row_pivots.length <= 1)
          || (container === "column_pivots" && arr_col_pivots.length <= 1)){
          div_header_right.innerHTML = "<span>" + prow_settings.getAttribute("dname") + "</span>";
        }else if (contains_row_path || contains_col_label_in_2nd_column){
          div_selection.addEventListener("change", event =>{
            var selected_value = div_selection.value && div_selection.value !== "" ? JSON.parse(div_selection.value) : {};
            let prow_settings = _this._create_prsettings.call(_this, selected_value.n, container, selected_value.drag_id);

            // Quick sort & filter
            prow_settings.setAttribute("advanced_feature", "QUICK_FILTER");

            // Clear the previous popup
            this._psp_popup_data.innerHTML = "";

            // Add perspective row settings
            this._psp_popup_data.appendChild(prow_settings);
          });

          div_header_right.classList.add("select-dropdown");
          div_header_right.appendChild(div_selection);
        }else{
          div_header_right.innerHTML = "<span>" + prow_settings.getAttribute("dname") + "</span>";
        }

        // Header
        this._psp_popup_title.innerHTML = "";
        this._psp_popup.classList.add("moveable");
        if (arr_row_pivots.length > 1 || arr_col_pivots.length > 1){
          //div_header_left.classList.add("hidden");
          //this._psp_popup_button_x_container.classList.add("hidden");
          this._psp_popup.classList.add("quick-fsort");
        }else{
          //this._psp_popup_button_x_container.classList.remove("hidden");
          this._psp_popup.classList.remove("quick-fsort");
        }
        this._psp_popup_title.appendChild(div_header_left);
        this._psp_popup_title.appendChild(div_header_right);

        // Quick sort & filter
        prow_settings.setAttribute("advanced_feature", "QUICK_FILTER");


        // Add perspective row settings
        this._psp_popup_data.appendChild(prow_settings);

        // Update the popup's positions
        const w = 349;
        var h = 380;

        //let bounds = event._bounds;
        //let bound_w = bounds ? bounds.width : 0;

        const client_point = event.clientPoint;
        const bounds = event._bounds;
        const grid_padding_left = 10;
        const grid_top = 50 + 10;
        const ratio = this.get_current_zoom_ratio();
        var left = (bounds.x + bounds.width) * ratio + grid_padding_left + 1;// - w; //client_point.x;
        var top = (bounds.y + bounds.height) * ratio + grid_top + 1; //client_point.y + 5;
        const w_width = window.innerWidth;// - 25;
        //if (w_width - left < w){
        //    left = w_width - w;
        //}
        if (left + w > w_width){
          left = left - w;
        }else if (left < grid_padding_left){
          left = grid_padding_left;
        }
        this._psp_popup.style.top = top + "px";
        this._psp_popup.style.left = left + "px";
        this._psp_popup.style.right = "unset";
        this._psp_popup.style.bottom = "unset";
        //this._psp_popup.style.position = "absolute";

        this._psp_popup.setAttribute("pf_field", original_name);
        this._psp_popup.classList.remove("hidden");
        this._psp_popup_outbound.classList.remove("hidden");

        //this._psp_popup_header_container.addEventListener('click', this.popup_click.bind(this));
        this._psp_popup_header_container.addEventListener('mousedown', this.popup_mousedown.bind(this));
        //this._psp_popup_header_container.addEventListener('mouseup', this.popup_mouseup.bind(this));
        //this._psp_popup_header_container.addEventListener('mouseout', this.popup_mouseout.bind(this));
        //this._psp_popup_header_container.addEventListener('mousemove', this.popup_mousemove.bind(this));

        //setTimeout(function(){
          _this._is_popup_openning = true;
        //}, 400);

    }

    reset_popup(){
      this._is_popup_openning = false;
      this._psp_popup.classList.remove("moveable");
      this._psp_popup.classList.remove("quick-fsort");
      //this._psp_popup_button_x_container.classList.remove("hidden");

      this._psp_popup.style.top = "unset";
      this._psp_popup.style.left = "unset";
      this._psp_popup.style.right = "unset";
      this._psp_popup.style.bottom = "unset";
      this._psp_popup.style.position = "fixed";

      this._popup_dragging = false;
    }

    close_popup(){
      if (this._is_popup_openning){

        // Remove the filter tag if none of filter is applied
        var pr_settings = this._get_view_dom_columns("#psp_popup_data perspective-row-settings") || [];
        if (pr_settings && pr_settings.length > 0){
          var row_settings = pr_settings[0];

          let name = row_settings.getAttribute("name");
          let drag_id = row_settings.getAttribute("drag_id");
          let container = row_settings.getAttribute("container");
          let advanced_feature = row_settings.getAttribute("advanced_feature");

          if ((container === "filters" || advanced_feature === "QUICK_FILTER") && name !== perspective.__FILTER_SEARCH__){
            let filters = JSON.parse(this.getAttribute("filters") || "[]");
            let new_filters = [];
            let changed_filter = false;
            for (let ft of filters){

              // Not include the search tag
              if (ft.n === name && ft.n !== perspective.__FILTER_SEARCH__){
                const is_custom_filter = this._is_custom_filter_applied(ft);
                const is_auto_filter = this._is_auto_filter_applied(ft);
                const is_group_filter = this._is_group_filter_applied(ft);
                if (is_custom_filter === false && is_auto_filter === false && is_group_filter === false){
                  changed_filter = true;
                  // Remove it
                  continue;
                }
              }

              new_filters.push(ft);
            }

            if (changed_filter === true){
              this._force_to_fetch_only = true;
              this.setAttribute("filters", JSON.stringify(new_filters));
              this._force_to_fetch_only = false;
            }
            /*
            let row = this._get_row(container, name, drag_id);
            if (row){
              const filter = JSON.parse(row.getAttribute("filter") || "{}");

              const is_custom_filter = this._is_custom_filter_applied();
              const is_auto_filter = this._is_auto_filter_applied();

              if (is_custom_filter === false && is_auto_filter === false){

              }
            }
            */
          }
        }

        this._is_popup_openning = false;
        this._psp_popup.classList.add("hidden");
        this._popup_dragging = false;
        this._psp_popup_outbound.classList.add("hidden");
      }
    }

    close_search_box(){
      this._search_container.classList.add("hidden");
      this._search_container.classList.remove("keep-search-box");
    }

    open_search_box(event){
      if (event){
        event.preventDefault();
        event.stopPropagation();
      }else{
        this._search_container.classList.add("keep-search-box");
      }
      this._search_container.classList.remove("hidden");
      this._search_input_id.focus();
      this._search_input_id.select();
    }

    close_all(){
      this.close_popup();
      this.close_search_box();
    }

    popup_returns_event(event){
      if (event.stopPropagation)
        event.stopPropagation();
      if (event.preventDefault)
        event.preventDefault();
      else {
        event.returnValue = false;
        return false;
      }
    }

    popup_click(event){
      this._popup_dragging = false;
      return this.popup_returns_event(event);
    }

    popup_get_offset(){
      const rect = this._psp_popup.getBoundingClientRect(),
        offsetX = window.scrollX || document.documentElement.scrollLeft,
        offsetY = window.scrollY || document.documentElement.scrollTop;
      return {
        left: rect.left + offsetX,
        top: rect.top + offsetY,
        right: rect.right + offsetX,
        bottom: rect.bottom + offsetY
      }
    }

    popup_mousedown(event){
      event = event || window.event;

      if (event.target === this._psp_popup_header_container || event.target === this._psp_popup_header_content
        || event.target === this._psp_popup_title || (event.target && event.target.parentElement === this._psp_popup_title)
        || (event.target && event.target.tagName !== "SELECT" && event.target.parentElement && event.target.parentElement.parentElement === this._psp_popup_title)){

          this._popup_offset.x = event.clientX - this._psp_popup.offsetLeft;
          this._popup_offset.y = event.clientY - this._psp_popup.offsetTop;

          const rect = this.popup_get_offset();
          this._popup_max_x = Math.max(
            document.documentElement["clientWidth"],
            document.body["scrollWidth"],
            document.documentElement["scrollWidth"],
            document.body["offsetWidth"],
            document.documentElement["offsetWidth"]
          );
          this._popup_max_y = Math.max(
            document.documentElement["clientHeight"],
            document.body["scrollHeight"],
            document.documentElement["scrollHeight"],
            document.body["offsetHeight"],
            document.documentElement["offsetHeight"]
          );

          if (rect.right > this._popup_max_x){
            this._popup_max_x = rect.right;
          }

          if (rect.bottom > this._popup_max_y){
            this._popup_max_y = rect.bottom;
          }
          this._popup_start_x = event.pageX;
          this._popup_start_y = event.pageY;
          this._popup_start_w = this._psp_popup.clientWidth;
          this._popup_start_h = this._psp_popup.clientHeight;
          this._popup_left_pos = rect.left;
          this._popup_top_pos = rect.top;

          this._popup_dragging = true;

          // Close the date picker if opened
          var pr_settings = this._get_view_dom_columns("#psp_popup_data perspective-row-settings") || [];
          if (pr_settings && pr_settings.length > 0){
            pr_settings[0].setAttribute("hide_calendar", JSON.stringify({status: 0, time: new Date().getTime()}));
          }

          return this.popup_returns_event(event);
      }
    }



    tooltip_mousemove(event){

      if (this._tooltip && !this._psp_tooltip.classList.contains("hidden")){

        const is_cursor_outside = this._tooltip.is_cursor_outside_interactive_border(event);

        const is_cursor_inside = this._tooltip.is_cursor_inside_reference(event) || this._tooltip.is_cursor_inside_tooltip(event) || this._tooltip.is_cursor_between_reference_and_popper(event);

        if (is_cursor_outside === true){
          this._tooltip.close();
        }
      }
    }

    popup_mousemove(event){
      // Close tooltip if any
      this.tooltip_mousemove(event);

      /*
      // The powers move
      const path = event.path || (event.composedPath && event.composedPath()) || [];
      if (this._moved_avaiable_fields === true && path.length > 0 && path[0] == this._powers){
        const p_client_rect = this._powers.getBoundingClientRect();
        const increment_h = event.clientY - p_client_rect.top - 12;
        this._available_fields_content.style.height = this._available_fields_content.offsetHeight + increment_h  + "px";
      }
      */
      if (!(event.target === this._psp_popup_header_container || event.target === this._psp_popup_header_content || event.target === this._psp_popup_title
          || (event.target && event.target.parentElement === this._psp_popup_title)
          || (event.target && event.target.tagName !== "SELECT" && event.target.parentElement && event.target.parentElement.parentElement === this._psp_popup_title)
        ) && !this._popup_dragging){
          return;
      }

      if (this._popup_dragging === true && this._psp_popup.classList.contains("moveable")){
        /*
        var top = event.clientY - this._popup_offset.y;
        var left = event.clientX - this._popup_offset.x;
        //this._psp_popup.style.position = 'absolute';
        this._psp_popup.style.top = top + 'px';
        this._psp_popup.style.left = left + 'px';
        */
        let dx = this._popup_start_x - event.pageX;
        let dy = this._popup_start_y - event.pageY;
        let left = this._popup_left_pos - dx;
        let top = this._popup_top_pos - dy;
        if (dx < 0) {
        	if (left + this._popup_start_w > this._popup_max_x)
        		left = this._popup_max_x - this._popup_start_w;
        }
        if (dx > 0) {
          if (left < 0){
            left = 0;
          }
        }
        if (dy < 0) {
          if (top + this._popup_start_h > this._popup_max_y){
            top = this._popup_max_y - this._popup_start_h;
          }
        }
        if (dy > 0) {
          if (top < 0){
            top = 0;
          }
        }

        this._psp_popup.style.top = top + 'px';
        this._psp_popup.style.left = left + 'px';
      }
    }

    popup_mouseup(event){
      this._moved_avaiable_fields = false;
      this._resize_panel_shield.classList.add("hidden");

      /*
      // The powers release
      const path = event.path || (event.composedPath && event.composedPath()) || [];
      if (this._moved_avaiable_fields === true && path.length > 0 && path[0] == this._powers){
        this._moved_avaiable_fields === false;
      }
      */
      if (!(event.target === this._psp_popup_header_container || event.target === this._psp_popup_header_content || event.target === this._psp_popup_title
          || (event.target && event.target.parentElement === this._psp_popup_title)
          || (event.target && event.target.tagName !== "SELECT" && event.target.parentElement && event.target.parentElement.parentElement === this._psp_popup_title)
        ) && !this._popup_dragging){
          return;
      }

			if (this._popup_dragging) {
				this._popup_dragging = false;
        this._popup_offset = { x: 0, y: 0 };
			}
    }
    /*
    popup_mouseout(event){
      if (event.target === this._psp_popup_header_container){
        this._popup_offset = { x: 0, y: 0 };
        this._popup_dragging = false;
      }
    }
    */

    popup_mousedown_outside(event){
      event = event || window.event;

      if (event.target === this._psp_popup_outbound){
        this.close_all();
      }
    }

    popup_event_outside(e){
      var path = e.path || (e.composedPath && e.composedPath()) || [];

      // Out of screen
      var clicked_inside_popup = false;
      for (var i = 0; i < path.length; i++){
        if (path[i] == this._psp_popup){
            clicked_inside_popup = true;
            break;
        }
      }

      if (!this._is_popup_openning
        || (
          (e.pageY && (e.pageY <= 0 || e.pageY >= window.innerHeight))
          || (e.pageX && (e.pageX <= 0 || e.pageX >= window.innerWidth)))){
        // Nothing to do
      }else{
        // Close the setting popup if the user clicks outside the popup
        if (!clicked_inside_popup && !this._psp_popup.classList.contains("not-auto-close")){
            //this._psp_popup.classList.add("hidden");

            // Keep the popup still open if the query is running.
            if (this._pivot_querying_percentage.classList.contains("show-percentage")){
            }else{
              this.close_popup();
            }
        }
      }

      // Auto close search box in top
      let clicked_inside_search_box = false;
      for (var i = 0; i < path.length; i++){
        if (path[i] == this._search_container){
            clicked_inside_search_box = true;
            break;
        }
      }

      if (!clicked_inside_search_box
        && !clicked_inside_popup // Keep the search box if the user has some actions in the popup.
        ){
        if (this._search_container.classList.contains("keep-search-box") === true){
          // Force to keep the search box
        }else{
          this._search_container.classList.add("hidden");
        }
      }
      this._search_container.classList.remove("keep-search-box");
    }

    async show_warning_sections() {
        const warning_sections = await this.get_warning_sections();
        let arr_w_containers = [];
        if (warning_sections && warning_sections.length > 0){
          for (let section of warning_sections){
            if (!section){
              continue;
            }

            if (section.container === "row_pivots"){
              this._row_pivot_caution.setAttribute("tooltip-title", section.title || "");
              this._row_pivot_caution.setAttribute("tooltip-data", section.msg);
              this._row_pivot_caution.classList.remove("hidden");
              arr_w_containers.push(section.container);
            }else if (section.container === "column_pivots"){
              this._column_pivot_caution.setAttribute("tooltip-title", section.title || "");
              this._column_pivot_caution.setAttribute("tooltip-data", section.msg);
              this._column_pivot_caution.classList.remove("hidden");
              arr_w_containers.push(section.container);
            }else if (section.container === "value_pivots"){
              this._value_pivot_caution.setAttribute("tooltip-title", section.title || "");
              this._value_pivot_caution.setAttribute("tooltip-data", section.msg);
              this._value_pivot_caution.classList.remove("hidden");
              arr_w_containers.push(section.container);
            }else if (section.container === "filters"){
              this._filter_caution.setAttribute("tooltip-title", section.title || "");
              this._filter_caution.setAttribute("tooltip-data", section.msg);
              this._filter_caution.classList.remove("hidden");
              arr_w_containers.push(section.container);
            }
          }
        }

        // Need to hide the warning icons that don't include any warning messages.
        if (!arr_w_containers.includes("row_pivots")){
          this._row_pivot_caution.classList.add("hidden");
        }

        if(!arr_w_containers.includes("column_pivots")){
          this._column_pivot_caution.classList.add("hidden");
        }

        if(!arr_w_containers.includes("value_pivots")){
          this._value_pivot_caution.classList.add("hidden");
        }

        if(!arr_w_containers.includes("filters")){
          this._filter_caution.classList.add("hidden");
        }
    }

    powers_dragstart(e) {
      e.preventDefault();
      this._moved_avaiable_fields = true;
      //var main = document.getElementById("ifcontainer");
    }

    powers_dragmove(e) {
      /*
      if (this.powers_dragging)
      {
        document.getElementById("shield").style.display = "block";
        if (stack != " horizontal") {
          var percentage = (e.pageX / window.innerWidth) * 100;
          if (percentage > 5 && percentage < 98) {
            var mainPercentage = 100-percentage;
            this._powers_top_container.style.width = percentage + "%";
            this._powers_bottom_container.style.width = mainPercentage + "%";
            //fixDragBtn();
          }
        } else {
          var containertop = Number(getStyleValue(document.getElementById("container"), "top").replace("px", ""));
          var percentage = ((e.pageY - containertop + 20) / (window.innerHeight - containertop + 20)) * 100;
          if (percentage > 5 && percentage < 98) {
            var mainPercentage = 100-percentage;
            this._powers_top_container.style.height = percentage + "%";
            this._powers_bottom_container.style.height = mainPercentage + "%";
            //fixDragBtn();
          }
        }
        //showFrameSize();
      }

      if (this._moved_avaiable_fields === true){
          var p_client_rect = this._powers.getBoundingClientRect();
          var increment_h = e.clientY - p_client_rect.top - 12;
          var height = this._available_fields_container.offsetHeight + increment_h;
          height = Math.min(Math.max(height, 50), window.innerHeight - (335 + 5 + 5)); // 335 + padding
          this._available_fields_container.style.height = height + "px";
      }
      */

      if (this._moved_avaiable_fields === true){
        let container_top = Number(this.get_style_value(this._resize_panel_container, "top").replace("px", ""));

        let percentage = ((e.pageY - container_top - 14) / (window.innerHeight - container_top)) * 100;
        if (percentage > 5 && percentage < 98) {
          let main_percentage = 100 - percentage;

          const full_height = this._resize_panel_container.clientHeight;
          let bottom_height = full_height * (100 - percentage) / 100;
          if (bottom_height < 170 && full_height > bottom_height){
            bottom_height = 170;
            percentage = ((full_height - bottom_height) / full_height) * 100;
            main_percentage = 100 - percentage;
          }

          this._available_fields_container.style.height = percentage + "%";
          this._resize_panel_bottom_content.style.height = main_percentage + "%";

          this.resize_available_fields_percentage = percentage;

          const client_height = this._resize_panel_bottom_content.clientHeight;

          const half_height = (client_height - (5 + 18) - 30 - 20 - 75) / 2;
          this._row_col_blocks.style.height = half_height + "px";

          this._value_filter_blocks.style.height = half_height + "px";
        }

      }
    }
    powers_dragend() {
      document.getElementById("shield").style.display = "none";
      this._moved_avaiable_fields = false;
    }

    fix_powers_dragbar(){
      let container_top = Number(this.get_style_value(this._resize_panel_container, "top").replace("px", ""));
      container_top += 12;

      let available_fields_height;
      let available_fields_top_padding;
      let powers_bottom_height;

      let powers_top;

      if (window.getComputedStyle) {
          available_fields_height = window.getComputedStyle(this._available_fields_columns,null).getPropertyValue("height");
          available_fields_top_padding = window.getComputedStyle(this._available_fields_container,null).getPropertyValue("padding-top");
          powers_bottom_height = window.getComputedStyle(this._powers,null).getPropertyValue("height");
      } else {
          powers_top = this._available_fields_container.currentStyle["height"];
      }
      available_fields_height = Number(available_fields_height.replace("px", ""));
      available_fields_top_padding = Number(available_fields_top_padding .replace("px", ""));
      powers_bottom_height = Number(powers_bottom_height .replace("px", ""));
      powers_top = container_top + available_fields_height + available_fields_top_padding + (available_fields_top_padding / 2);
      this._powers.style.top = powers_top + "px";
    }

    init_powers(){
      let container_top = Number(this.get_style_value(this._resize_panel_container, "top").replace("px", ""));

      let percentage = this.resize_available_fields_percentage || 50;
      if (percentage > 2 && percentage < 98) {
        let main_percentage = 100 - percentage;

        const full_height = this._resize_panel_container.clientHeight;
        let bottom_height = full_height * (100 - percentage) / 100;
        if (bottom_height < 170 && full_height > bottom_height){
          bottom_height = 170;
          percentage = ((full_height - bottom_height) / full_height) * 100;
          main_percentage = 100 - percentage;
        }

        this._available_fields_container.style.height = percentage + "%";
        this._resize_panel_bottom_content.style.height = main_percentage + "%";

        const client_height = this._resize_panel_bottom_content.clientHeight;

        const half_height = (client_height - (5 + 18) - 30 - 20 - 75) / 2;
        this._row_col_blocks.style.height = half_height + "px";

        this._value_filter_blocks.style.height = half_height + "px";
      }
    }

    get_style_value(elmnt,style) {
        if (window.getComputedStyle) {
            return window.getComputedStyle(elmnt,null).getPropertyValue(style);
        } else {
            return elmnt.currentStyle[style];
        }
    }

    // most of these are drag and drop handlers - how to clean up?
    _register_callbacks() {
        this._sort.addEventListener("drop", drop.bind(this));
        this._sort.addEventListener("dragend", undrag.bind(this));
        this._sort.addEventListener("dragenter", drag_enter.bind(this));
        this._sort.addEventListener("dragover", allow_drop.bind(this));
        this._sort.addEventListener("dragleave", disallow_drop.bind(this));
        this._row_pivots.addEventListener("drop", drop.bind(this));
        this._row_pivots.addEventListener("dragend", undrag.bind(this));
        this._row_pivots.addEventListener("dragenter", drag_enter.bind(this));
        this._row_pivots.addEventListener("dragover", dragover.bind(this));
        this._row_pivots.addEventListener("dragleave", dragleave.bind(this));
        this._column_pivots.addEventListener("drop", drop.bind(this));
        this._column_pivots.addEventListener("dragend", undrag.bind(this));
        this._column_pivots.addEventListener("dragenter", drag_enter.bind(this));
        this._column_pivots.addEventListener("dragover", dragover.bind(this));
        this._column_pivots.addEventListener("dragleave", dragleave.bind(this));
        this._filters.addEventListener("drop", drop.bind(this));
        this._filters.addEventListener("dragend", undrag.bind(this));
        this._filters.addEventListener("dragenter", drag_enter.bind(this));
        this._filters.addEventListener("dragover", dragover.bind(this));
        this._filters.addEventListener("dragleave", dragleave.bind(this));
        //this._searchs.addEventListener("input", this._column_searchs_changed.bind(this));
        this._searchs.addEventListener("input", _.debounce(this._column_searchs_changed, 400).bind(this));
        //this._search_fields.addEventListener("input", _.debounce(this.filter_available_fields, 400).bind(this));
        this._search_fields.addEventListener("input", this.filter_available_fields.bind(this));
        this._pivotList.addEventListener("drop", column_drop.bind(this));
        this._pivotList.addEventListener("dragenter", drag_enter.bind(this));
        this._pivotList.addEventListener("dragend", column_undrag.bind(this));
        this._pivotList.addEventListener("dragover", column_dragover.bind(this));
        this._pivotList.addEventListener("dragleave", column_dragleave.bind(this));

        this._value_pivots.addEventListener("drop", drop.bind(this));
        this._value_pivots.addEventListener("dragend", undrag.bind(this));
        this._value_pivots.addEventListener("dragenter", drag_enter.bind(this));
        this._value_pivots.addEventListener("dragover", dragover.bind(this));
        this._value_pivots.addEventListener("dragleave", dragleave.bind(this));
        /*this._value_pivots.addEventListener("drop", column_drop.bind(this));
        this._value_pivots.addEventListener("dragend", column_undrag.bind(this));
        this._value_pivots.addEventListener("dragenter", drag_enter.bind(this));
        this._value_pivots.addEventListener("dragover", column_dragover.bind(this));
        this._value_pivots.addEventListener("dragleave", column_dragleave.bind(this));*/
        this._add_computed_column.addEventListener("click", this._open_computed_column.bind(this));
        this._add_export_csv.addEventListener("click", this._did_export_csv.bind(this));
        this._add_export_excel.addEventListener("click", this._did_export_excel.bind(this));
        this._add_export_json.addEventListener("click", this._did_export_json.bind(this));
        this._formula_bar.addEventListener("perspective-computed-expression-save", this._save_computed_expression.bind(this));
        this._formula_bar.addEventListener("perspective-computed-expression-type-check", this._type_check_computed_expression.bind(this));
        // this._computed_column.addEventListener("perspective-computed-column-update", this._set_computed_column_input.bind(this));
        this._config_button.addEventListener("mousedown", this._toggle_config.bind(this));
        this._config_button.addEventListener("contextmenu", this._show_context_menu.bind(this));
        this._config_button_container.addEventListener("mouseover", ()=>{
            this._config_button_container.classList.add("aT5-aOt-I-JW");
            this._config_button_tooltip.classList.remove("hidden");
        });
        this._config_button_container.addEventListener("mouseout", ()=>{
            this._config_button_container.classList.remove("aT5-aOt-I-JW");
            this._config_button_tooltip.classList.add("hidden");
        });

        this._powers.addEventListener("mousedown", ()=>{
          this._moved_avaiable_fields = true;
          this._resize_panel_shield.classList.remove("hidden");
        });
        /*
        this._powers.addEventListener("mousemove", (e)=>{
            if (this._moved_avaiable_fields === true){
                var p_client_rect = this._powers.getBoundingClientRect();
                var increment_h = e.clientY - p_client_rect.top - 12;
                var height = this._available_fields_container.offsetHeight + increment_h;
                height = Math.min(Math.max(height, 50), window.innerHeight - (335 + 5 + 5)); // 335 + padding
                this._available_fields_container.style.height = height + "px";
            }
        });
        */
        this._powers.addEventListener("mouseup", ()=>{
          this._moved_avaiable_fields = false;
          this._resize_panel_shield.classList.add("hidden");
        });
        //this._powers.addEventListener("mouseout", ()=>{this._moved_avaiable_fields = false;});
        /*
        this._resize_panel_shield.addEventListener("mousemove", (e)=>{
            if (this._moved_avaiable_fields === true){
                var p_client_rect = this._powers.getBoundingClientRect();
                var increment_h = e.clientY - p_client_rect.top - 12;
                var height = this._available_fields_container.offsetHeight + increment_h;
                height = Math.min(Math.max(height, 50), window.innerHeight - (335 + 5 + 5)); // 335 + padding
                this._available_fields_container.style.height = height + "px";
            }
        });
        */
        this._resize_panel_shield.addEventListener("mousemove", this.powers_dragmove.bind(this));

        this._psp_popup_button_x.addEventListener("mousedown", (e)=>{
          if (this._search_container.classList.contains("hidden") === false){
            this._search_container.classList.add("keep-search-box");
          }

          //this._psp_popup.classList.add("hidden");
          //this._is_popup_openning = false;
          this.close_popup();
        });

        this._psp_popup_sheet_button_x.addEventListener("mousedown", (e)=>{
          this._psp_popup_sheet.classList.add("hidden");
          this._is_popup_openning = false;
          this.cancelIngestingData();
        });

        this._config_button_x.addEventListener("mousedown", this._toggle_config.bind(this));
        this._config_button_newdesign.addEventListener("mousedown", this._toggle_config_newdesign.bind(this));
        this._reset_button.addEventListener("click", this.reset.bind(this));
        this._copy_button.addEventListener("click", event => this.copy(event.shiftKey));
        this._download_button.addEventListener("click", event => this.download(event.shiftKey));
        this._transpose_button.addEventListener("click", this._transpose.bind(this));
        this._drop_target.addEventListener("dragover", allow_drop.bind(this));

        this._vis_selector.addEventListener("change", () => {
            this.setAttribute("view", this._vis_selector.value);
            this._run_query();
        });

        this._plugin_information_action.addEventListener("click", () => {
            this._debounce_update({ignore_size_check: true});
            this._plugin_information.classList.add("hidden");
        });
        this._plugin_information_dismiss.addEventListener("click", () => {
            this._debounce_update({ignore_size_check: true});
            this._plugin_information.classList.add("hidden");
            this._show_warnings = false;
        });

        this._pivot_input_file.addEventListener("change", this._did_ingest_file.bind(this));
        this._pivot_drop_file_area.addEventListener("dragenter", this._allow_drop_file.bind(this), false);
        this._pivot_drop_file_area.addEventListener("dragleave", this._allow_drop_file.bind(this), false);
        this._pivot_drop_file_area.addEventListener("dragover", this._allow_drop_file.bind(this), false);
        this._pivot_drop_file_area.addEventListener("drop", this._allow_drop_file.bind(this), false);
        var _this = this;
        ["dragenter", "dragover"].forEach(function(eventName) {
            _this._pivot_drop_file_area.addEventListener(eventName, _this._drop_file_highlight.bind(_this), false);
        });
        ["dragleave", "drop"].forEach(function(eventName) {
            _this._pivot_drop_file_area.addEventListener(eventName, _this._drop_file_unhighlight.bind(_this), false);
        });

        this._pivot_drop_file_area.addEventListener("drop", this._drop_file.bind(this), false);
        this._pivot_loading_data_cancel.addEventListener("click", this._cancel_ingest_file.bind(this));

        this._pivot_querying_cancel.addEventListener("click", this._cancel_querying.bind(this));

        // Available Fields
        this._search_fields_icon.addEventListener("click", function (e){
          _this._search_fields.focus();
        });
        this._search_fields_icon.addEventListener("mousedown", function (e){
          e.preventDefault();
        });

        // Search box at top content
        this._search_icon.addEventListener("click", function (e){
          e.preventDefault();
          e.stopPropagation();
          _this._search_input_id.focus();
        });
        this._search_input_id.addEventListener("mousedown", function (e){
          //e.preventDefault();
        });
        this._search_input_id.addEventListener("click", function (e){
          e.preventDefault();
          e.stopPropagation();
        });
        this._search_option_icon.addEventListener("click", function (e){
          /*
          if (_this._search_input_id.value === ""){
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          */
          let filters = JSON.parse(_this.getAttribute("filters")) || [];
          let index = filters.findIndex((v)=>v.n === perspective.__FILTER_SEARCH__);

          /*
          if (index === -1){
            _this._create_search_row_in_filters();
            filters = JSON.parse(_this.getAttribute("filters")) || [];
            index = filters.findIndex((v)=>v.n === perspective.__FILTER_SEARCH__);
          }

          if (index !== -1){
            //_this.close_search_box();
            e.data = {name: filters[index].n, container: "filters"};
            _this._open_row_settings(e);
          }
          */
          const name = (filters && index !== -1) ? filters[index].n: perspective.__FILTER_SEARCH__;
          e.data = {name: name, container: "filters"/*, drag_id: filters[index].drag_id*/};
          _this._open_row_settings(e);

        });

        this._row_pivot_caution.addEventListener("mouseenter", (event)=>{
          var tooltip = this.create_tooltip.call(this);
          if (!tooltip.is_open(this._row_pivot_caution)){
            tooltip.add_placement("right");
            tooltip.add_reference(this._row_pivot_caution);
            tooltip.add_title(this._row_pivot_caution.getAttribute("tooltip-title") || "Warning");
            tooltip.add_data(this._row_pivot_caution.getAttribute("tooltip-data"));
            tooltip.open(event);
          }
        });
        this._row_pivot_caution.addEventListener("mouseleave", (event)=>{
          if (this._tooltip){
            //this._tooltip.close();
          }
        });
        this._row_pivot_caution.addEventListener("mousemove", (event)=>{
            event.preventDefault();
            event.stopPropagation();
        });
        this._row_pivot_caution.addEventListener("click", (event)=>{
          var tooltip = this.create_tooltip.call(this);
          if (!tooltip.is_open(this._row_pivot_caution)){
            tooltip.add_placement("right");
            tooltip.add_reference(this._row_pivot_caution);
            tooltip.add_title(this._row_pivot_caution.getAttribute("tooltip-title") || "Warning");
            tooltip.add_data(this._row_pivot_caution.getAttribute("tooltip-data"));
            tooltip.open(event);
          }
        });

        this._column_pivot_caution.addEventListener("mouseenter", (event)=>{
          var tooltip = this.create_tooltip.call(this);
          if (!tooltip.is_open(this._column_pivot_caution)){
            tooltip.add_placement("left");
            tooltip.add_reference(this._column_pivot_caution);
            tooltip.add_title(this._column_pivot_caution.getAttribute("tooltip-title") || "Warning");
            tooltip.add_data(this._column_pivot_caution.getAttribute("tooltip-data"));
            tooltip.open(event);
          }
        });
        this._column_pivot_caution.addEventListener("mouseleave", (event)=>{
          if (this._tooltip){
            //this._tooltip.close();
          }
        });
        this._column_pivot_caution.addEventListener("mousemove", (event)=>{
            event.preventDefault();
            event.stopPropagation();
        });
        this._column_pivot_caution.addEventListener("click", (event)=>{
          var tooltip = this.create_tooltip.call(this);
          if (!tooltip.is_open(this._column_pivot_caution)){
            tooltip.add_placement("left");
            tooltip.add_reference(this._column_pivot_caution);
            tooltip.add_title(this._column_pivot_caution.getAttribute("tooltip-title") || "Warning");
            tooltip.add_data(this._column_pivot_caution.getAttribute("tooltip-data"));
            tooltip.open(event);
          }
        });

        this._value_pivot_caution.addEventListener("mouseenter", (event)=>{
          var tooltip = this.create_tooltip.call(this);
          if (!tooltip.is_open(this._value_pivot_caution)){
            tooltip.add_placement("right");
            tooltip.add_reference(this._value_pivot_caution);
            tooltip.add_title(this._value_pivot_caution.getAttribute("tooltip-title") || "Warning");
            tooltip.add_data(this._value_pivot_caution.getAttribute("tooltip-data"));
            tooltip.open(event);
          }
        });
        this._value_pivot_caution.addEventListener("mouseleave", (event)=>{

            if (this._tooltip){
              //this._tooltip.close();
            }
        });
        this._value_pivot_caution.addEventListener("mousemove", (event)=>{
            event.preventDefault();
            event.stopPropagation();
        });
        this._value_pivot_caution.addEventListener("click", (event)=>{
          var tooltip = this.create_tooltip.call(this);
          if (!tooltip.is_open(this._value_pivot_caution)){
            tooltip.add_placement("right");
            tooltip.add_reference(this._value_pivot_caution);
            tooltip.add_title(this._value_pivot_caution.getAttribute("tooltip-title") || "Warning");
            tooltip.add_data(this._value_pivot_caution.getAttribute("tooltip-data"));
            tooltip.open(event);
          }
        });

        this._filter_caution.addEventListener("mouseenter", (event)=>{
          var tooltip = this.create_tooltip.call(this);
          if (!tooltip.is_open(this._filter_caution)){
            tooltip.add_placement("left");
            tooltip.add_reference(this._filter_caution);
            tooltip.add_title(this._filter_caution.getAttribute("tooltip-title") || "Warning");
            tooltip.add_data(this._filter_caution.getAttribute("tooltip-data"));
            tooltip.open(event);
          }
        });
        this._filter_caution.addEventListener("mouseleave", (event)=>{
          if (this._tooltip){
            this._tooltip.close();
          }
        });
        this._filter_caution.addEventListener("mousemove", (event)=>{
            event.preventDefault();
            event.stopPropagation();
        });
        this._filter_caution.addEventListener("click", (event)=>{
          var tooltip = this.create_tooltip.call(this);
          if (!tooltip.is_open(this._filter_caution)){
            tooltip.add_placement("left");
            tooltip.add_reference(this._filter_caution);
            tooltip.add_title(this._filter_caution.getAttribute("tooltip-title") || "Warning");
            tooltip.add_data(this._filter_caution.getAttribute("tooltip-data"));
            tooltip.open(event);
          }
        });

        window.addEventListener("keydown",function (e) {

            if ((e.ctrlKey && e.keyCode === 70) || (e.metaKey && e.keyCode === 70)) {
                if (_this._show_grid_data && _this._first_load_grid_data){
                    //if (!_this._show_config){
                    //  _this._toggle_config(e);
                    //}
                    _this._search_container.classList.remove("hidden");
                    _this._search_input_id.focus();
                    _this._search_input_id.select();
                }
                e.preventDefault();
            }
            // Ctrl + Z or Command + Z
            if ((!e.shiftKey && e.ctrlKey && e.keyCode === 90) || (!e.shiftKey && e.metaKey && e.keyCode === 90)) {
                _this._vis_undo_button.click();
                e.preventDefault();
            }
            // Shift + Ctrl + Z or Shift + Command + Z
            if ((e.shiftKey && e.ctrlKey && e.keyCode === 90) || (e.shiftKey && e.metaKey && e.keyCode === 90)) {
                _this._vis_redo_button.click();
                e.preventDefault();
            }
        });

        window.addEventListener('focus', shadowFocusHandler, true);
        window.addEventListener('-shadow-focus', function(ev) {
          //console.info('shadow-focus: ', ev.detail, ev.target);
        });
        /*
        window.addEventListener("click",function (e) {

          var path = e.path || (e.composedPath && e.composedPath()) || [];

          // Out of screen
          var clicked_inside_popup = false;
          for (var i = 0; i < path.length; i++){
            if (path[i] == _this._psp_popup){
                clicked_inside_popup = true;
                break;
            }
          }

          if (!_this._is_popup_openning
            || (
              (e.pageY && (e.pageY <= 0 || e.pageY >= window.innerHeight))
              || (e.pageX && (e.pageX <= 0 || e.pageX >= window.innerWidth)))){
            // Nothing to do
          }else{
            // Close the setting popup if the user clicks outside the popup
            if (!clicked_inside_popup && !_this._psp_popup.classList.contains("not-auto-close")){
                //_this._psp_popup.classList.add("hidden");

                // Keep the popup still open if the query is running.
                if (_this._pivot_querying_percentage.classList.contains("show-percentage")){
                }else{
                  _this.close_popup();
                }
            }
          }

          // Auto close search box in top
          let clicked_inside_search_box = false;
          for (var i = 0; i < path.length; i++){
            if (path[i] == _this._search_container){
                clicked_inside_search_box = true;
                break;
            }
          }

          if (!clicked_inside_search_box
            && !clicked_inside_popup // Keep the search box if the user has some actions in the popup.
            ){
            if (_this._search_container.classList.contains("keep-search-box") === true){
              // Force to keep the search box
            }else{
              _this._search_container.classList.add("hidden");
            }
          }
          _this._search_container.classList.remove("keep-search-box");

        });
        */
        window.addEventListener("click", this.popup_event_outside.bind(this));
        window.addEventListener("mousemove", this.popup_mousemove.bind(this));
        window.addEventListener("mouseup", this.popup_mouseup.bind(this));
        window.addEventListener("mousedown", this.popup_event_outside.bind(this));

        window.addEventListener("resize", this.init_powers.bind(this));

        /*this._vis_run_query.addEventListener("click", () => {
            if (!this.AUTO_QUERY) {
                if (!this.is_cinfo_pivot(true)) {
                    this.is_hidding_rows = true;
                }
                this._run_query(true);
            }
        });

        this._vis_auto_query.addEventListener("change", () => {
            if (this._vis_auto_query.value == "on") {
                this.AUTO_QUERY = true;
                this._vis_run_query.disabled = true;
                if (this._can_request_building()) {
                    if (!this.is_cinfo_pivot(true)) {
                        this.is_hidding_rows = true;
                    }
                    this.set_request_structure("building", {});
                    this._update_run_query_button(false);
                    this._run_query(true);
                }
            } else {
                this.AUTO_QUERY = false;
                this._vis_run_query.disabled = false;
            }
        });*/

        // listener for max col dropdown, add redo/undo action and run query
        this._vis_max_col.addEventListener("change", () => {
            var old_max_col = this.getAttribute("max_col") || 1000;
            var new_max_col = this._vis_max_col.value;
            this.setAttribute("max_col", new_max_col);
            var options = {
                new_value: new_max_col,
                old_value: old_max_col,
                attribute: "max_col"
            }

            this._handle_manage_action(perspective.ACTION_TYPE.change_viewer_attribute, undefined, options,
                _ => {
                    this._run_query();
                },
                _ => {
                    this._run_query();
                });
            this._run_query();
        });

        // listener for max row dropdown, add redo/undo action and run query
        this._vis_max_row.addEventListener("change", () => {
            var old_max_row = this.getAttribute("max_row") || "0";
            var new_max_row = this._vis_max_row.value;
            this.setAttribute("max_row", new_max_row);
            var options = {
                new_value: new_max_row,
                old_value: old_max_row,
                attribute: "max_row"
            }

            this._handle_manage_action(perspective.ACTION_TYPE.change_viewer_attribute, undefined, options,
                _ => {
                    this._run_query();
                },
                _ => {
                    this._run_query();
                });
            this._run_query();
        });

        // listener for pivot view mode dropdown, add redo/undo action and run query
        /*this._vis_pivot_view.addEventListener("change", () => {
            var old_pivot_view_mode = this.getAttribute("pivot_view_mode") || "0";
            var new_pivot_view_mode = this._vis_pivot_view.value;
            this.setAttribute("pivot_view_mode", new_pivot_view_mode);
            var options = {
                new_value: new_pivot_view_mode,
                old_value: old_pivot_view_mode,
                attribute: "pivot_view_mode"
            }

            this._handle_manage_action(perspective.ACTION_TYPE.change_viewer_attribute, undefined, options,
                _ => {
                    this._run_query();
                },
                _ => {
                    this._run_query();
                });
            this._run_query();
        });*/

        // Add listener for items per page dropdown
        // Show/Hide for pagination group
        this._vis_page_item.addEventListener("change", () => {
            var page_item = this._vis_page_item.value;
            if (page_item == "--") {
                page_item = 0;
            }
            page_item = Number(page_item);
            var old_pagination = this._get_pagination_setting();
            var new_pagination = {
                page_items: page_item,
                page_number: 1
            };
            this.setAttribute("pagination", JSON.stringify(new_pagination));

            var options = {
                new_value: JSON.stringify(new_pagination),
                old_value: JSON.stringify(old_pagination),
                attribute: "pagination"
            }

            this._handle_manage_action(perspective.ACTION_TYPE.change_viewer_attribute, undefined, options,
                _ => {
                    this._update_pagination_setting();
                },
                _ => {
                    this._update_pagination_setting();
                });
            this._update_pagination_setting();
        });

        // Back button for page number
        this._pagination_back_button.addEventListener("click", () => {
            var old_pagination = this._get_pagination_setting();
            if (old_pagination.page_number <= 1) {
                return;
            }
            var new_pagination = {
                page_items: old_pagination.page_items,
                page_number: old_pagination.page_number - 1
            };
            this.setAttribute("pagination", JSON.stringify(new_pagination));

            var options = {
                new_value: JSON.stringify(new_pagination),
                old_value: JSON.stringify(old_pagination),
                attribute: "pagination"
            }

            this._handle_manage_action(perspective.ACTION_TYPE.change_viewer_attribute, undefined, options,
                _ => {
                    this._update_pagination_setting();
                },
                _ => {
                    this._update_pagination_setting();
                });
            this._update_pagination_setting();
        });

        // Forward button for page number
        this._pagination_forward_button.addEventListener("click", () => {
            var old_pagination = this._get_pagination_setting();
            var new_pagination = {
                page_items: old_pagination.page_items,
                page_number: old_pagination.page_number + 1
            };
            this.setAttribute("pagination", JSON.stringify(new_pagination));

            var options = {
                new_value: JSON.stringify(new_pagination),
                old_value: JSON.stringify(old_pagination),
                attribute: "pagination"
            }

            this._handle_manage_action(perspective.ACTION_TYPE.change_viewer_attribute, undefined, options,
                _ => {
                    this._update_pagination_setting();
                },
                _ => {
                    this._update_pagination_setting();
                });
            this._update_pagination_setting();
        });

        this._auto_query_checkbox.addEventListener("click", () => {

            var is_checked = this._auto_query_checkbox.checked;

            //if (this._vis_auto_query.value == "on") {
            if (is_checked){
                this.AUTO_QUERY = true;
                //this._vis_run_query.disabled = true;
                this._run_auto_query.classList.add("hidden");
                this._run_auto_query.classList.remove("inactive");

                this._cb_run_auto_query.classList.add("hidden");
                this._cb_run_auto_query.classList.remove("inactive");

                if (this._can_request_building()) {
                    if (!this.is_cinfo_pivot(true)) {
                        this.is_hidding_rows = true;
                    }
                    this.set_request_structure("building", {});
                    this._update_run_query_button(false);
                    this._run_query(true);
                }
            } else {
                this.AUTO_QUERY = false;
                //this._vis_run_query.disabled = false;
                this._run_auto_query.classList.remove("hidden");
                this._run_auto_query.classList.remove("inactive");

                this._cb_run_auto_query.classList.remove("hidden");
                this._cb_run_auto_query.classList.remove("inactive");
            }
            this.handle_status_bar_autoquery();
        });

        this._run_auto_query.addEventListener("click", () => {
            if (this._run_auto_query.classList.contains("inactive") === true){
                // Not allow to run query
                return false;
            }

            if (!this.AUTO_QUERY) {
                if (!this.is_cinfo_pivot(true)) {
                    this.is_hidding_rows = true;
                }
                this._run_query(true);
            }
        });

        this._cb_run_auto_query.addEventListener("click", () => {
            if (this._run_auto_query.classList.contains("inactive") === true){
                // Not allow to run query
                return false;
            }

            if (!this.AUTO_QUERY) {
                if (!this.is_cinfo_pivot(true)) {
                    this.is_hidding_rows = true;
                }
                this._run_query(true);
            }
        });

        this._flatten_agg_view.addEventListener("click", () => {
          var old_flatten_agg_mode = this.getAttribute("pivot_view_mode") || "0";
          var new_flatten_agg_mode = this._flatten_agg_view.checked === true ? 1: 0;
          this.setAttribute("pivot_view_mode", new_flatten_agg_mode);
          var options = {
              new_value: new_flatten_agg_mode,
              old_value: old_flatten_agg_mode,
              attribute: "pivot_view_mode"
          }
          if (new_flatten_agg_mode) {
            let old_row_pivots = JSON.parse(this.getAttribute("row-pivots")) || [];
            let have_group_warning = false;
            let prev_pivot_columns = [];
            let new_row_pivots = [];
            for (let p of old_row_pivots) {
              if (prev_pivot_columns.includes(p.n)) {
                  have_group_warning = true;
                  continue;
              }
              new_row_pivots.push(p);
              prev_pivot_columns.push(p.n);
            }
            if (have_group_warning) {
              this._show_multiple_date_aggregate_warning = true;
              options.dependencies = [{
                  old_value: JSON.stringify(old_row_pivots),
                  new_value: JSON.stringify(new_row_pivots),
                  attribute: "row-pivots"
              }];
              this.setAttribute("row-pivots", JSON.stringify(new_row_pivots));
            } else {
              this._show_multiple_date_aggregate_warning = false;
            }
          } else {
            this._show_multiple_date_aggregate_warning = false;
          }

          // Only allow to run query when the Rows or Columns Pivot is enabled
          if (this.is_cinfo_pivot(false)){
            this._handle_manage_action(perspective.ACTION_TYPE.change_viewer_attribute, undefined, options,
                _ => {
                    this._run_query();
                },
                _ => {
                    this._run_query();
                });
            this._run_query();
          }
        });

        this._checkall_fields.addEventListener("click", this._column_visibility_clicked_all.bind(this));

        // Redo button listener
        this._vis_redo_button.addEventListener("click", () => {
            this.redo_undo_manager.redo();
        });

        // Undo button listener
        this._vis_undo_button.addEventListener("click", () => {
            this.redo_undo_manager.undo();
        });

        this._psp_popup_outbound.addEventListener("mousedown", this.popup_mousedown_outside.bind(this));

        this._pivot_zoom_in_btn.addEventListener("click", () => {
          if (!this._current_zoom) {
            this._current_zoom = 1;
          }
          this._current_zoom += 0.1;
          this._current_zoom = Math.min(this._current_zoom, 2);
          this.updateZoomerPercent();
          this.updateZommerSlider();
          if (this._plugin.update_zoom_ratio) {
            this._plugin.update_zoom_ratio.call(this, this._current_zoom);
          }
        });

        this._pivot_zoom_out_btn.addEventListener("click", () => {
          if (!this._current_zoom) {
            this._current_zoom = 1;
          }
          this._current_zoom -= 0.1;
          this._current_zoom = Math.max(this._current_zoom, 0.5);
          this.updateZoomerPercent();
          this.updateZommerSlider();
          if (this._plugin.update_zoom_ratio) {
            this._plugin.update_zoom_ratio.call(this, this._current_zoom);
          }
        });

        this._zoomer.addEventListener("input", () => {
          this._current_zoom = parseFloat(this._zoomer.value);
          this.updateZoomerPercent();
          if (this._plugin.update_zoom_ratio) {
            this._plugin.update_zoom_ratio.call(this, this._current_zoom);
          }
        });

        // this._formula_input_box.addEventListener("input", (e) => {
        //   console.log("_formula_input_box---", this._formula_input_box.innerText);
        //   this._parse_input(this._formula_input_box.innerText);
        // });
    }
}
