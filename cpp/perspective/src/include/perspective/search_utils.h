#pragma once
#include <perspective/first.h>
#include <perspective/config.h>
#include <perspective/table.h>
#include <perspective/mask.h>
#include <string>
#include <sstream>
#include <algorithm>
#include <iterator>

namespace perspective {

inline t_mask
search_table_for_config(const t_table& tbl, t_config& config) {
    if (config.has_search()) {
        return tbl.search_cpp(config.get_search_types(), config.get_sterms(), config);
    } else {
        t_mask msk(tbl.size());
        for (t_uindex idx = 0, loop_end = tbl.size(); idx < loop_end; ++idx) {
            msk.set(idx, true);
        }
        return msk;
    }
}

template <class Container>
void split1(const std::string& str, Container& cont)
{
    std::istringstream iss(str);
    std::copy(std::istream_iterator<std::string>(iss),
         std::istream_iterator<std::string>(),
         std::back_inserter(cont));
}

} // end namespace perspective