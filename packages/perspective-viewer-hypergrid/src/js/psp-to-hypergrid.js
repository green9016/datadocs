/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

const COLUMN_SEPARATOR_STRING = "|";

const TREE_COLUMN_INDEX = require("fin-hypergrid/src/behaviors/Behavior").prototype.treeColumnIndex;

function page2hypergrid(data, row_pivots, columns, c_mapping, contains_rowpath, is_flat_pivot = false, values_obj = {}, contains_rowpath_in_firstcolumn) {
    var data_columns = Object.keys(data);
    const firstcol = data_columns.length > 0 ? data_columns[0] : undefined;
    const row_path_position = data_columns.indexOf("__ROW_PATH__");
    if (row_path_position > 0) {
        data_columns.splice(row_path_position, 1);
        data_columns = ["__ROW_PATH__"].concat(data_columns);
    }
    if (columns.length === 0 || data[firstcol] === undefined || data[firstcol].length === 0) {
        return [];
    }
    const is_tree = is_flat_pivot === true
      ? (contains_rowpath_in_firstcolumn === true ? true: false)//false
      : !!row_pivots.length || contains_rowpath || row_path_position !== -1;
    //const flat_columns = row_pivots.length ? columns.slice(1) : columns;
    //const flat_columns = row_pivots.length ? columns.filter(function(value){return value != '__ROW_PATH__';}) : columns;
    //const data_indices = data_columns.map(x => flat_columns.indexOf(x));
    //const data_indices = data_columns.map(x => (is_tree && !contains_rowpath) ? flat_columns.indexOf(x) + 1: flat_columns.indexOf(x));
    //c_mapping = row_pivots.length ? c_mapping.filter(function(item){return item.name != '__ROW_PATH__';}) : c_mapping;
    if ((!is_flat_pivot && row_pivots.length)
      || (is_flat_pivot === true && is_tree === true)){
        c_mapping = c_mapping.filter(function(item){return item.name != '__ROW_PATH__';}).map(function (v){
            v.index -= 1;
            return v;
        });
    }
    const data_indices = data_columns.map(x => {
        var c_i = c_mapping.findIndex(function(item){
            return item.name === x;
        });

        if (c_i == -1){
            return -1;
        }

        return (is_tree && !contains_rowpath) ? c_mapping[c_i].index + 1: c_mapping[c_i].index;
    });

    const rows = [];
    //var max_depth = Math.max(!is_flat_pivot && row_pivots.length ? row_pivots.length - 1: 0, 0);
    var max_depth = Math.max(
        !is_flat_pivot && row_pivots.length
          ? row_pivots.length - 1
          : (is_flat_pivot === true && is_tree === true ? 1: 0)
        , 0);

    let needs_alias = false; //values_obj && values_obj.needs_alias !== undefined ? values_obj.needs_alias : false;
    let value_position_in_rowpivots = -1; //values_obj && values_obj.value_position_in_rowpivots !== undefined ? values_obj.value_position_in_rowpivots: -1;
    let value_pivots = [];//values_obj && values_obj.value_pivots !== undefined ? values_obj.value_pivots: [];

    if (values_obj){
      if (values_obj.needs_alias){
        needs_alias = values_obj.needs_alias;
      }

      if (values_obj.value_position_in_rowpivots !== undefined){
        value_position_in_rowpivots = values_obj.value_position_in_rowpivots;
      }

      if (values_obj.value_pivots !== undefined){
        value_pivots = values_obj.value_pivots;
      }
    }

    for (let ridx = 0; ridx < data[firstcol].length; ridx++) {
        const dataRow = {};

        for (const cidx in data_columns) {
            const columnName = data_columns[cidx];
            dataRow[data_indices[cidx]] = data[columnName][ridx];
        }

        if (is_tree) {
            if (data["__ROW_PATH__"][ridx] === undefined) {
                //data["__ROW_PATH__"][ridx] = [];
                data["__ROW_PATH__"][ridx] = {};
                data["__ROW_PATH__"][ridx]["value"] = [];
            }else if((data["__ROW_PATH__"][ridx]["value"] === undefined || data["__ROW_PATH__"][ridx]["value"].length == 0)){
                data["__ROW_PATH__"][ridx]["value"] = [];
            }

            let name = data["__ROW_PATH__"][ridx]["value"][data["__ROW_PATH__"][ridx]["value"].length - 1];
            if (name === "__ROW_TOTAL__") {
                name = "Total";
                dataRow[TREE_COLUMN_INDEX] = {
                    rollup: name,
                    rowPath: [].concat(data["__ROW_PATH__"][ridx]["value"]),
                    isLeaf: true,
                    outside_of_tree: false,
                    max_depth: max_depth,
                    contains_out_of_tree: false,
                    always_expand: false
                };
            }else{
                var is_leaf = data["__ROW_PATH__"][ridx]["is_leaf"] || data["__ROW_PATH__"][ridx]["value"].length >= row_pivots.length;
                var outside_of_tree = data["__ROW_PATH__"][ridx]["outside_of_tree"] || false;
                var contains_out_of_tree = undefined;
                var always_expand = data["__ROW_PATH__"][ridx]["always_expand"] || false;

                if (!is_leaf && !outside_of_tree && ridx + 1 < data[firstcol].length){
                    var next_ridx = ridx + 1;
                    var next_outside_of_tree = data["__ROW_PATH__"][next_ridx]["outside_of_tree"] || false;
                    if (next_outside_of_tree){
                        contains_out_of_tree = true;
                    }
                }

                dataRow[TREE_COLUMN_INDEX] = {
                    rollup: name,
                    rowPath: [].concat(data["__ROW_PATH__"][ridx]["value"]),
                    //isLeaf: data["__ROW_PATH__"][ridx].length >= row_pivots.length,
                    isLeaf: is_leaf,//data["__ROW_PATH__"][ridx]["is_leaf"] || data["__ROW_PATH__"][ridx]["value"].length >= row_pivots.length,
                    outside_of_tree: outside_of_tree,//data["__ROW_PATH__"][ridx]["outside_of_tree"] || false,
                    max_depth: max_depth,
                    contains_out_of_tree: contains_out_of_tree,
                    always_expand: always_expand
                };

                // Handle display names of value pivots in case they are shown in ROW_PATH
                if ( needs_alias === true){ //|| (value_position_in_rowpivots !== undefined && value_position_in_rowpivots >= 0) // ROWS pivots contain the "Values"

                  const _rowPath = dataRow[TREE_COLUMN_INDEX]["rowPath"] || [];
                  const compare_name = _rowPath[_rowPath.length -1] !== undefined ? _rowPath[_rowPath.length -1]: name;
                  const ri = value_pivots.findIndex((rv)=>rv.base_name === compare_name);
                  if (ri != -1){
                    dataRow[TREE_COLUMN_INDEX].rollup = value_pivots[ri].dname;
                  }else{
                    //const i2 = Math.max(0, value_position_in_rowpivots -1); // +1 -2
                    if (typeof compare_name === "string"){
                      const ri2 = value_pivots.findIndex((rv)=>{
                        const last_index = compare_name.lastIndexOf(rv.base_name);
                        return last_index !== -1 && name.length - last_index === rv.base_name.length;
                      });

                      if (ri2 !== -1){
                        const start_last_index = compare_name.lastIndexOf(value_pivots[ri2].base_name);
                        dataRow[TREE_COLUMN_INDEX].rollup = compare_name.substr(0, start_last_index) + value_pivots[ri2].dname;
                      }
                    }
                  }

                }
            }
        }

        rows.push(dataRow);
    }

    return rows;
}

function psp2hypergrid(data, schema, tschema, row_pivots, columns) {
    const firstcol = Object.keys(data).length > 0 ? Object.keys(data)[0] : undefined;
    if (columns.length === 0 || data[firstcol].length === 0) {
        const columns = Object.keys(schema);
        return {
            rows: [],
            isTree: false,
            configuration: {},
            columnPaths: columns.map(col => [col]),
            columnTypes: columns.map(col => schema[col])
        };
    }

    const flat_columns = row_pivots.length ? columns.slice(1) : columns;
    const columnPaths = flat_columns.map(row => row.split(COLUMN_SEPARATOR_STRING));
    const is_tree = !!row_pivots.length;
    const rows = page2hypergrid(data, row_pivots, columns);

    return {
        rows: rows,
        isTree: is_tree,
        configuration: {},
        rowPivots: row_pivots,
        columnPaths: (is_tree ? [[" "]] : []).concat(columnPaths),
        columnTypes: (is_tree ? [row_pivots.map(x => tschema[x])] : []).concat(columnPaths.map(col => schema[col[col.length - 1]]))
    };
}

module.exports = {psp2hypergrid, page2hypergrid};
