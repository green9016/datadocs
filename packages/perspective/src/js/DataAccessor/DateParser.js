/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

import moment from "moment";

const FILTER_OP_LAST_7_DAYS = 25;
const FILTER_OP_LAST_10_DAYS = 26;
const FILTER_OP_LAST_30_DAYS = 27;
const FILTER_OP_TODAY = 28;
const FILTER_OP_YESTERDAY = 29;
const FILTER_OP_THIS_WEEK = 30;
const FILTER_OP_LAST_WEEK = 31;
const FILTER_OP_THIS_MONTH = 32;
const FILTER_OP_LAST_MONTH = 33;
const FILTER_OP_THIS_QUARTER = 34;
const FILTER_OP_LAST_QUARTER = 35;
const FILTER_OP_THIS_YEAR = 36;
const FILTER_OP_LAST_YEAR = 37;
const FILTER_OP_YEAR_TO_DATE = 38;
const FILTER_OP_RELATIVE_DATE = 43;

const FILTER_PERIOD_PREVIOUS = 1;
const FILTER_PERIOD_THIS = 2;
const FILTER_PERIOD_NEXT = 3;

const FILTER_DATE_UNIT_DAY = 1;
const FILTER_DATE_UNIT_WEEK = 2;
const FILTER_DATE_UNIT_MONTH = 3;
const FILTER_DATE_UNIT_QUARTER = 4;
const FILTER_DATE_UNIT_YEAR = 5;

//export const DATE_PARSE_CANDIDATES = [moment.ISO_8601, moment.RFC_2822, "YYYY-MM-DD\\DHH:mm:ss.SSSS", "MM-DD-YYYY", "MM/DD/YYYY", "M/D/YYYY", "M/D/YY", "DD MMM YYYY", "HH:mm:ss.SSS"];
export const DATE_TIME_PARSE_CANDIDATES = [moment.ISO_8601, moment.RFC_2822, "YYYY-MM-DD\\DHH:mm:ss.SSSS", "MM-DD-YYYY", "MM/DD/YYYY", "M/D/YYYY", "M/D/YY", "DD MMM YYYY",
    "HH:mm:ss.SSS", "H:mm:ss.SSS", "HH:mm:ss", "H:mm:ss", "HH:mm", "H:mm", "M/D/YY H:mm", "M/D/YY H:mm:ss", "M/D/YY HH:mm:ss", "M/DD/YY HH:mm:ss", "MM/DD/YY HH:mm:ss", "M/D/YY HH:mm",
    "MMM D, YYYY HH:mm:ss", "MMM DD, YYYY HH:mm:ss", "MMM D, YYYY HH:mm", "MMM DD, YYYY HH:mm", "MMM D, YYYY H:mm", "MMM DD, YYYY H:mm", "MMM D, YYYY H:mm:ss", "MMM DD, YYYY H:mm:ss",
    "MMM D, YYYY", "MMM DD, YYYY", "YYYY-MM-DD HH:mm:ss", "YYYY-MM-DD H:mm:ss"];
export const TIME_PARSE_CANDIDATES = [moment.ISO_8601, moment.RFC_2822, "HH:mm:ss.SSS", "H:mm:ss.SSS", "HH:mm:ss", "H:mm:ss", "HH:mm", "H:mm"];
export const DATE_PARSE_CANDIDATES = [moment.ISO_8601, moment.RFC_2822, "MM-DD-YYYY", "MM/DD/YYYY", "M/D/YYYY", "M/D/YY", "DD MMM YYYY", "MMM D, YYYY", "MMM DD, YYYY"];

/**
 *
 *
 * @export
 * @param {string} x
 * @returns
 */
export function is_valid_date(x) {
    return moment(x, DATE_PARSE_CANDIDATES, true).isValid();
}

export function is_valid_time(x) {
    return moment(x, TIME_PARSE_CANDIDATES, true).isValid();
}

export function is_valid_date_time(x) {
    return moment(x, DATE_TIME_PARSE_CANDIDATES, true).isValid();
}

function get_start_date_of_week(date) {
    var curr = new Date(date);
    var first = curr.getDate() - curr.getDay();
    return new Date(date.setDate(first));
}

function get_date_of_quarter(type, index, period = undefined, unit = 0) {
    var d = new Date();
    var quarter = Math.floor((d.getMonth() / 3));
    switch (type) {
        case FILTER_OP_THIS_QUARTER:
            if (index === 0) {
                return new Date(d.getFullYear(), quarter * 3, 1);
            } else {
                var firstDate = new Date(d.getFullYear(), quarter * 3, 1);
                return new Date(firstDate.getFullYear(), firstDate.getMonth() + 3, 1);
            }
        case FILTER_OP_LAST_QUARTER:
            if (index === 0) {
                return new Date(d.getFullYear(), quarter * 3 - 3, 1);
            } else {
                var firstDate = new Date(d.getFullYear(), quarter * 3 - 3, 1);
                return new Date(firstDate.getFullYear(), firstDate.getMonth() + 3, 1);
            }
        case FILTER_OP_RELATIVE_DATE:
            if (period === FILTER_PERIOD_THIS) {
                if (index === 0) {
                    return new Date(d.getFullYear(), quarter * 3, 1);
                } else {
                    var firstDate = new Date(d.getFullYear(), quarter * 3, 1);
                    return new Date(firstDate.getFullYear(), firstDate.getMonth() + 3, 1);
                }
            } else if (period === FILTER_PERIOD_NEXT) {
                var firstDate = new Date(d.getFullYear(), quarter * 3, 1);
                return new Date(firstDate.getFullYear(), firstDate.getMonth() + 3 * (1 + unit * index), 1);
            } else if (period === FILTER_PERIOD_PREVIOUS) {
                var firstDate = new Date(d.getFullYear(), quarter * 3, 1);
                return new Date(firstDate.getFullYear(), firstDate.getMonth() - 3 * unit * (1 - index), 1);
            }
    }
}

function get_start_date_of_year(date) {
    var curr = new Date(date);
    curr.setDate(1);
    curr.setMonth(0);
    return new Date(curr);
}

/**
 *
 *
 * @export
 * @class DateParser
 */
export class DateParser {
    constructor() {
        this.date_types = [];
        this.date_candidates = DATE_TIME_PARSE_CANDIDATES.slice();
        this.date_exclusions = [];
        this.date_validator = val => is_valid_date(val);
        this.time_validator = val => is_valid_time(val);
        this.date_time_validator = val => is_valid_date_time(val);
    }

    parse(input) {
        if (!input || this.date_exclusions.indexOf(input) > -1) {
            return null;
        } else {
            let val = input;
            const type = typeof val;
            if (val.getMonth) {
                return val;
            } else if (type === "string") {
                val = moment(input, this.date_types, true);
                if (!val.isValid() || this.date_types.length === 0) {
                    for (let candidate of this.date_candidates) {
                        val = moment(input, candidate, true);
                        if (val.isValid()) {
                            this.date_types.push(candidate);
                            this.date_candidates.splice(this.date_candidates.indexOf(candidate), 1);
                            return val.toDate();
                        }
                    }
                    this.date_exclusions.push(input);
                    return null;
                }
                return val.toDate();
            } else if (type === "number") {
                return new Date(val);
            }
            throw new Error(`Unparseable date ${val}`);
        }
    }

    get_date_range(type, index, period = undefined, date_unit = undefined, unit = 0) {
        var result_date = new Date();
        result_date.setHours(0);
        result_date.setMinutes(0);
        result_date.setSeconds(0);
        result_date.setMilliseconds(0);
        if (type === FILTER_OP_LAST_7_DAYS) {
            result_date.setDate(result_date.getDate() - 7);
        } else if (type === FILTER_OP_LAST_10_DAYS) {
            result_date.setDate(result_date.getDate() - 10);
        } else if (type === FILTER_OP_LAST_30_DAYS) {
            result_date.setDate(result_date.getDate() - 30);
        } else if (type === FILTER_OP_TODAY) {
            if (index == 1) {
                result_date.setDate(result_date.getDate() + 1);
            }
        } else if (type === FILTER_OP_YESTERDAY) {
            if (index == 0) {
                result_date.setDate(result_date.getDate() - 1);
            }
        } else if (type === FILTER_OP_THIS_WEEK) {
            if (index == 0) {
                result_date = get_start_date_of_week(result_date);
            } else {
                result_date = get_start_date_of_week(result_date);
                result_date.setDate(result_date.getDate() + 7);
            }
        } else if (type === FILTER_OP_LAST_WEEK) {
            if (index == 0) {
                result_date = get_start_date_of_week(result_date);
                result_date.setDate(result_date.getDate() - 7);
            } else {
                result_date = get_start_date_of_week(result_date);
            }
        } else if (type === FILTER_OP_THIS_MONTH) {
            if (index == 0) {
                result_date.setDate(1);
            } else {
                result_date.setDate(1);
                result_date.setMonth(result_date.getMonth() + 1);
            }
        } else if (type === FILTER_OP_LAST_MONTH) {
            if (index == 0) {
                result_date.setDate(1);
                result_date.setMonth(result_date.getMonth() - 1);
            } else {
                result_date.setDate(1);
            }
        } else if (type === FILTER_OP_THIS_QUARTER || type === FILTER_OP_LAST_QUARTER) {
            result_date = get_date_of_quarter(type, index);
        } else if (type === FILTER_OP_THIS_YEAR) {
            if (index == 0) {
                result_date = get_start_date_of_year(result_date);
            } else if (index == 1) {
                result_date = get_start_date_of_year(result_date);
                result_date.setFullYear(result_date.getFullYear() + 1);
            }
        } else if (type === FILTER_OP_LAST_YEAR) {
            if (index == 0) {
                result_date = get_start_date_of_year(result_date);
                result_date.setFullYear(result_date.getFullYear() - 1);
            } else if (index == 1) {
                result_date = get_start_date_of_year(result_date);
            }
        } else if (type === FILTER_OP_YEAR_TO_DATE) {
            if (index == 0) {
                result_date = get_start_date_of_year(result_date);
            } else if (index == 1) {
                result_date.setDate(result_date.getDate() + 1);
            }
        } else if (type === FILTER_OP_RELATIVE_DATE) {
            if (period === FILTER_PERIOD_THIS) {
                if (date_unit === FILTER_DATE_UNIT_DAY) {
                    if (index == 1) {
                        result_date.setDate(result_date.getDate() + 1);
                    }
                } else if (date_unit === FILTER_DATE_UNIT_WEEK) {
                    if (index == 0) {
                        result_date = get_start_date_of_week(result_date);
                    } else {
                        result_date = get_start_date_of_week(result_date);
                        result_date.setDate(result_date.getDate() + 7);
                    }
                } else if (date_unit === FILTER_DATE_UNIT_MONTH) {
                    if (index == 0) {
                        result_date.setDate(1);
                    } else {
                        result_date.setDate(1);
                        result_date.setMonth(result_date.getMonth() + 1);
                    }
                } else if (date_unit === FILTER_DATE_UNIT_QUARTER) {
                    result_date = get_date_of_quarter(type, index, period);
                } else if (date_unit === FILTER_DATE_UNIT_YEAR) {
                    if (index == 0) {
                        result_date = get_start_date_of_year(result_date);
                    } else if (index == 1) {
                        result_date = get_start_date_of_year(result_date);
                        result_date.setFullYear(result_date.getFullYear() + 1);
                    }
                }
            } else if (period === FILTER_PERIOD_NEXT) {
                if (date_unit === FILTER_DATE_UNIT_DAY) {
                    result_date.setDate(result_date.getDate() + unit * index + 1);
                } else if (date_unit === FILTER_DATE_UNIT_WEEK) {
                    result_date = get_start_date_of_week(result_date);
                    result_date.setDate(result_date.getDate() + (unit * index + 1) * 7);
                } else if (date_unit === FILTER_DATE_UNIT_MONTH) {
                    result_date.setDate(1);
                    result_date.setMonth(result_date.getMonth() + 1 + unit * index);
                } else if (date_unit === FILTER_DATE_UNIT_QUARTER) {
                    result_date = get_date_of_quarter(type, index, period, unit);
                } else if (date_unit === FILTER_DATE_UNIT_YEAR) {
                    result_date = get_start_date_of_year(result_date);
                    result_date.setFullYear(result_date.getFullYear() + 1 + unit * index);
                }
            } else if (period === FILTER_PERIOD_PREVIOUS) {
                if (date_unit === FILTER_DATE_UNIT_DAY) {
                    result_date.setDate(result_date.getDate() - unit * (1 - index));
                } else if (date_unit === FILTER_DATE_UNIT_WEEK) {
                    result_date = get_start_date_of_week(result_date);
                    result_date.setDate(result_date.getDate() - 7 * unit * (1 - index));
                } else if (date_unit === FILTER_DATE_UNIT_MONTH) {
                    result_date.setDate(1);
                    result_date.setMonth(result_date.getMonth() - unit * (1 - index));
                } else if (date_unit === FILTER_DATE_UNIT_QUARTER) {
                    result_date = get_date_of_quarter(type, index, period, unit);
                } else if (date_unit === FILTER_DATE_UNIT_YEAR) {
                    result_date = get_start_date_of_year(result_date);
                    result_date.setFullYear(result_date.getFullYear() - unit * (1 - index));
                }
            }
        }
        return result_date;
    }

    get_previous_date_range(type, index) {
        var result_date = new Date();
        result_date.setHours(0);
        result_date.setMinutes(0);
        result_date.setSeconds(0);
        result_date.setMilliseconds(0);
        if (type === FILTER_OP_LAST_7_DAYS) {
            result_date.setDate(result_date.getDate() - 14);
        } else if (type === FILTER_OP_LAST_10_DAYS) {
            result_date.setDate(result_date.getDate() - 20);
        } else if (type === FILTER_OP_LAST_30_DAYS) {
            result_date.setDate(result_date.getDate() - 60);
        } else if (type === FILTER_OP_TODAY) {
            result_date.setDate(result_date.getDate() - 1);
        } else if (type === FILTER_OP_YESTERDAY) {
            result_date.setDate(result_date.getDate() - 2);
        } else if (type === FILTER_OP_THIS_WEEK) {
            var start_date = get_start_date_of_week(result_date);
            result_date.setDate(start_date.getDate() - 7);
        } else if (type === FILTER_OP_LAST_WEEK) {
            var start_date = get_start_date_of_week(result_date);
            result_date.setDate(start_date.getDate() - 14);
        } else if (type === FILTER_OP_THIS_MONTH) {
            result_date.setDate(1);
            result_date.setMonth(result_date.getMonth() - 1);
        } else if (type === FILTER_OP_LAST_MONTH) {
            result_date.setDate(1);
            result_date.setMonth(result_date.getMonth() - 2);
        } else if (type === FILTER_OP_THIS_QUARTER) {
            result_date = get_date_of_quarter(type, 0);
            result_date.setMonth(result_date.getMonth() - 3);
        } else if (type === FILTER_OP_LAST_QUARTER) {
            result_date = get_date_of_quarter(type, 0);
            result_date.setMonth(result_date.getMonth() - 3);
        } else if (type === FILTER_OP_THIS_YEAR || type === FILTER_OP_YEAR_TO_DATE) {
            result_date = get_start_date_of_year(result_date);
            result_date.setFullYear(result_date.getFullYear() - 1);
        } else if (type === FILTER_OP_LAST_YEAR) {
            result_date = get_start_date_of_year(result_date);
            result_date.setFullYear(result_date.getFullYear() - 2);
        }
        
        return result_date;
    }
}
