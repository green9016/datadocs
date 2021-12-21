/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

#include <perspective/first.h>
#include <perspective/pagination.h>

namespace perspective {

t_paginationspec::t_paginationspec()
    : m_items_per_page(0)
    , m_page_num(0) {}

t_paginationspec::~t_paginationspec() {}

t_paginationspec::t_paginationspec(const t_paginationspec_recipe& v) {
    m_items_per_page = v.m_items_per_page;
    m_page_num = v.m_page_num;
}

t_paginationspec::t_paginationspec(t_index items_per_page, t_index page_num)
    : m_items_per_page(items_per_page)
    , m_page_num(page_num) {}

t_index
t_paginationspec::get_items_per_page() const {
    return m_items_per_page;
}

t_index
t_paginationspec::get_page_num() const {
    return m_page_num;
}

bool
t_paginationspec::enable_pagination() const {
    return m_items_per_page > 0;
}

t_paginationspec_recipe
t_paginationspec::get_recipe() const {
    t_paginationspec_recipe rv;

    rv.m_items_per_page = m_items_per_page;
    rv.m_page_num = m_page_num;

    return rv;
}

} // end namespace perspective