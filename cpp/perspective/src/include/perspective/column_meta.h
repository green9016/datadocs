#include <algorithm> // std::fill
#include <cstdint>
#include <cstdlib>
#include <memory> // std::unique_ptr
#include <sstream>

namespace perspective {
enum class t_column_prop { MIXED = 0, NO_MATCH, ALL_MATCH };

inline void
set_column_prop(t_column_prop& self, bool value, bool is_first_element) noexcept {
    if (is_first_element) {
        self = value ? t_column_prop::ALL_MATCH : t_column_prop::NO_MATCH;
    } else if (value) {
        if (self == t_column_prop::NO_MATCH)
            self = t_column_prop::MIXED;
    } else {
        if (self == t_column_prop::ALL_MATCH)
            self = t_column_prop::MIXED;
    }
}

inline const char*
get_column_prop_name(t_column_prop v) noexcept {
    if (v == t_column_prop::MIXED)
        return "MIXED";
    if (v == t_column_prop::NO_MATCH)
        return "NO_MATCH";
    return "ALL_MATCH";
}

struct t_column_meta {
    bool has_word_starts_with[256]; // Only for strings and string lists
    t_column_prop is_integer = t_column_prop::ALL_MATCH;
    t_column_prop is_unsigned = t_column_prop::ALL_MATCH;
    t_column_prop is_double = t_column_prop::ALL_MATCH;
    t_column_prop is_date = t_column_prop::ALL_MATCH;
    t_column_prop contains_multiple_words = t_column_prop::ALL_MATCH;
    t_column_prop contains_digits = t_column_prop::ALL_MATCH;
    double min_double = std::numeric_limits<double>::infinity();
    double max_double = std::numeric_limits<double>::infinity() * -1.0;

    std::unique_ptr<int32_t> min_length, max_length;

    t_column_meta() noexcept {
        min_length.reset(new int32_t(INT32_MAX));
        max_length.reset(new int32_t(-1));
        std::fill(has_word_starts_with, has_word_starts_with + 256,
            false);
    }

    std::string
    to_string() const noexcept {
        std::stringstream ss;

        ss << "has_word_starts_with=[";
        size_t n = 256;
        for (size_t i = 0; i < n; ++i) {
            if (i != 0 && has_word_starts_with[i] != 0) {
				ss << ", ";
				ss << char(i);
			}
        }
        ss << "]" << std::endl;

        ss << "is_integer=" << get_column_prop_name(is_integer) << std::endl;
        ss << "is_unsigned=" << get_column_prop_name(is_unsigned) << std::endl;
        ss << "is_double=" << get_column_prop_name(is_double) << std::endl;
        ss << "is_date=" << get_column_prop_name(is_date) << std::endl;
        ss << "contains_multiple_words=" << get_column_prop_name(contains_multiple_words)
           << std::endl;
        ss << "contains_digits=" << get_column_prop_name(contains_digits) << std::endl;
        ss << "min_double=" << min_double << std::endl;
        ss << "max_double=" << max_double << std::endl;
        ss << "min_length="
           << (min_length ? std::to_string(*min_length) : (std::string) "UNKNOWN") << std::endl;
        ss << "max_length="
           << (max_length ? std::to_string(*max_length) : (std::string) "UNKNOWN") << std::endl;
		return ss.str();
    }
};
} // namespace perspective