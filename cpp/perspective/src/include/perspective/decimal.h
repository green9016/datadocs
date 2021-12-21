#pragma once
#include <perspective/first.h>
#include <perspective/raw_types.h>
#include <perspective/base.h>
#include <perspective/utils.h>
#include <perspective/exports.h>
#include <boost/functional/hash.hpp>
#include <sstream>
#include <string>
#include <algorithm>

namespace perspective {
// Example program

/* decContext */
typedef struct {
    int32_t  digits;               /* working precision               */
    int32_t  emax;                 /* maximum positive exponent       */
    int32_t  emin;                 /* minimum negative exponent       */
    //enum     rounding round;       /* rounding mode                   */
    uint32_t traps;                /* trap-enabler flags              */
    uint32_t status;               /* status flags                    */
    uint8_t  clamp;                /* flag: apply IEEE exponent clamp */
} decContext;

/* End decContext */

typedef struct {
    int32_t digits;      /* Count of digits in the coefficient; >0    */
    int32_t exponent;    /* Unadjusted exponent, unbiased, in         */
                         /* range: -1999999997 through 999999999      */
    uint8_t bits;        /* Indicator bits (see above)                */
                         /* Coefficient, from least significant unit  */
    //uint16_t *lsu;
    std::pair<uint64_t, uint64_t> m_number;
} decNumber;

#define D2UTABLE {0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,6,  \
                    6,6,6,7,7,7,7,8,8,8,8,9,9,9,9,10,10,10,10,11, \
                    11,11,11,12,12,12,12,13}

const uint8_t d2utable[49+1]=D2UTABLE;

#define D2U(d) ((unsigned)((d)<=49?d2utable[d]:((d)+3)>>2))
#define X10(i)  (((i)<<1)+((i)<<3))

class PERSPECTIVE_EXPORT t_decimal {
    public:
        t_decimal();
        explicit t_decimal(std::string str);
        explicit t_decimal(decNumber num);

        //std::string to_string() const;
        operator bool() const;
        decNumber* decNumberFromString(decNumber *dn, const char chars[], decContext *set);
        std::string decNumberToString() const;
        double decNumberToDouble() const;

        t_decimal add(t_decimal other);
        bool equals(const t_decimal &other);

        t_decimal& operator=(const t_decimal &other);
        friend t_decimal operator+(t_decimal b1, const t_decimal &b2);
        friend t_decimal operator+(t_decimal b1, const long long &b2);
        friend double operator+(double b1, const t_decimal &b2);
        double divide(t_decimal other);
        double dividell(const long long &other);

        friend bool operator>(t_decimal b1, const t_decimal &b2);
        friend bool operator<(t_decimal b1, const t_decimal &b2);
        friend bool operator==(t_decimal b1, const t_decimal &b2);
        friend bool operator!=(t_decimal b1, const t_decimal &b2);
        friend double operator/(t_decimal b1, const t_decimal &b2);
        friend double operator/(t_decimal b1, const long long &b2);
        friend double operator/(t_decimal b1, const double &b2);
        //friend t_decimal operator/(t_decimal b1, const std::string &b2);

        operator double() const {
            return decNumberToDouble();
        }
    private:
        decNumber number;
};
}

namespace std {
std::ostream& operator<<(std::ostream& os, const perspective::t_decimal& t);
}