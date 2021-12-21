/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

#pragma once
#include <perspective/first.h>
#include <perspective/base.h>

namespace perspective {

struct PERSPECTIVE_EXPORT t_paginationspec_recipe {
    t_paginationspec_recipe() {}
    t_index m_items_per_page;
    t_index m_page_num;
};

class PERSPECTIVE_EXPORT t_paginationspec {
public:
    t_paginationspec();

    ~t_paginationspec();

    t_paginationspec(const t_paginationspec_recipe& v);

    t_paginationspec(t_index items_per_page, t_index page_num);

    t_index get_items_per_page() const;

    t_index get_page_num() const;

    bool enable_pagination() const;

    t_paginationspec_recipe get_recipe() const;

private:
    t_index m_items_per_page;
    t_index m_page_num;
};

}
// end namespace perspective