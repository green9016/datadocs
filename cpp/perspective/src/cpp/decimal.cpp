#include <perspective/first.h>
#include <perspective/decimal.h>
#include <math.h>
#include <stdio.h>
#include <string.h>

namespace perspective {

t_decimal::t_decimal() {}

t_decimal::t_decimal(std::string str) {
    PSP_TRACE_SENTINEL();
    LOG_CONSTRUCTOR("t_decimal");

    decContext set;                  // working context

    set.traps=0;                     // no traps, thank you
    set.digits=34;         // set precision
    decNumberFromString(&number, str.c_str(), &set);
    /*std::size_t found = number.find(".");
    if (found == std::string::npos) {
        m_e = 0;
    } else {
        number.replace(found, 1, "");
        m_e = found;
    }
    m_number_string = number;*/
}

t_decimal::t_decimal(decNumber num)
: number(num) {
    PSP_TRACE_SENTINEL();
    LOG_CONSTRUCTOR("t_decimal");
}

/*std::string
t_decimal::to_string() const {
    return "";
} */

t_decimal::operator bool() const {
    return bool(decNumberToDouble());
}

decNumber *
t_decimal::decNumberFromString(decNumber *dn, const char chars[],
                                decContext *set){
    if (strlen(chars) == 0) {
        dn->bits=0;
        dn->exponent=0;
        dn->digits=0;
        dn->m_number.first = 0;
        dn->m_number.second = 0;
        return dn;
    }
    int32_t   exponent=0;                // working exponent [assume 0]
    uint8_t bits=0;                    // working flags [assume +ve]
    //uint16_t  *res;                      // where result will be built
    //uint32_t  resbuff[SD2U(DECBUFFER+9)];// local buffer in case need temporary
                                    // [+9 allows for ln() constants]
    //uint32_t  *allocres=NULL;            // -> allocated result, iff allocated
    int32_t   d=0;                       // count of digits found in decimal part
    const char *dotchar=NULL;        // where dot was found
    const char *cfirst=chars;        // -> first character of decimal part
    const char *last=NULL;           // -> last digit of decimal part
    const char *c;                   // work
    //uint16_t  *up;                       // ..
    uint64_t out;
    //int   cut;                  // ..
    //int   residue;                   // rounding residue
    //int  status=0;                  // error code

    do {                             // status & malloc protection
        for (c=chars;; c++) {          // -> input character
            if (*c>='0' && *c<='9') {    // test for Arabic digit
                last=c;
                d++;                       // count of real digits
                continue;                  // still in decimal part
                }
            if (*c=='.' && dotchar==NULL) { // first '.'
                dotchar=c;                 // record offset into decimal part
                if (c==cfirst) cfirst++;   // first digit must follow
                continue;}
            if (c==chars) {              // first in string...
                if (*c=='-') {             // valid - sign
                cfirst++;
                bits=1;
                continue;}
                if (*c=='+') {             // valid + sign
                cfirst++;
                continue;}
                }
            // *c is not a digit, or a valid +, -, or '.'
            break;
        } // c

        if (last==NULL) {              // no digits yet
        
        } // last==NULL
        else if (*c!='\0') {          // more to process...
        // had some digits; exponent is only valid sequence now
        } // stuff after digits

        // Here when whole string has been inspected; syntax is good
        // cfirst->first digit (never dot), last->last digit (ditto)

        // strip leading zeros/dot [leave final 0 if all 0's]
        /*if (*cfirst=='0') {                 // [cfirst has stepped over .]
            for (c=cfirst; c<last; c++, cfirst++) {
                if (*c=='.') continue;          // ignore dots
                if (*c!='0') break;             // non-zero found
                d--;                            // 0 stripped
            } */ // c
            /*#if DECSUBSET
            // make a rapid exit for easy zeros if !extended
            if (*cfirst=='0' && !set->extended) {
                decNumberZero(dn);              // clean result
                break;                          // [could be return]
                }
            #endif*/
        //}  // at least one leading 0

        // Handle decimal point...
        if (dotchar!=NULL && dotchar<last)  // non-trailing '.' found?
            exponent-=(last-dotchar);         // adjust exponent
        // [we can now ignore the .]
        // OK, the digits string is good.  Assemble in the decNumber, or in
        // a temporary units array if rounding is needed
        /*if (d<=set->digits){
            res=dn->lsu;    // fits into supplied decNumber
        }
        else {                             // rounding needed
        }
        // res now -> number lsu, buffer, or allocated storage for Unit array
        // Place the coefficient into the selected Unit array
        // [this is often 70% of the cost of this function when DECDPUN>1]
        out=0;                         // accumulator
        up=res+D2U(d)-1;               // -> msu
        cut=d-(up-res)*4;        // digits in top unit
        for (c=cfirst;; c++) {         // along the digits
            if (*c=='.') continue;       // ignore '.' [don't decrement cut]
            out=X10(out)+(int32_t)*c-(int32_t)'0';
            if (c==last) break;          // done [never get to trailing '.']
            cut--;
            if (cut>0) continue;         // more for this unit
            *up=(uint16_t)out;               // write unit
            up--;                        // prepare for unit below..
            cut=4;                 // ..
            out=0;                       // ..
        } // c
        *up=(uint16_t)out;                 // write lsu
         */
        if (d == 0) {
            dn->bits=0;
            dn->exponent=0;
            dn->digits=0;
            dn->m_number.first = 0;
            dn->m_number.second = 0;
            return dn;
        }
        out=0;
        std::pair<uint64_t, uint64_t> v;
        bool have_first = false;
        for (c=cfirst;; c++) {         // along the digits
            if (*c=='.') {
                have_first = true;
                v.first = (uint64_t)out;               // write unit
                out=0;                       // ..
                continue;       // ignore '.' [don't decrement cut]
            }
            out=X10(out)+(int64_t)*c-(int64_t)'0';
            if (c==last) {
                if (have_first) {
                    v.second = (uint64_t)out;
                } else {
                    v.first = (uint64_t)out;
                }
                break;          // done [never get to trailing '.']
            }
        }

        dn->bits=bits;
        dn->exponent=exponent;
        dn->digits=d;
        dn->m_number = v;

        // decNumberShow(dn);
    } while(0);                         // [for break]

    return dn;
}

std::string
t_decimal::decNumberToString() const {
    if (number.digits == 0) {
        return "";
    }
    std::string value = "";
    if (number.bits) {
        value = value + "-";
    }
    value = value + std::to_string(number.m_number.first);
    std::string second_val = std::to_string(number.m_number.second);
    std::string extern_zero = "";
    while (extern_zero.length() + second_val.length() < std::abs(number.exponent)) {
        extern_zero = extern_zero + "0";
    }
    value = value + "." + extern_zero + second_val;
    
    return value;
}

double
t_decimal::decNumberToDouble() const {
    /*double value = (number.bits > 0 ? -1 : 1)*((double)number.m_number.first + (double)number.m_number.second*pow(10, number.exponent));*/
    return atof(decNumberToString().c_str());
}

t_decimal t_decimal::add(t_decimal other) {
    t_decimal b1 = other > *this ? other : *this;
    t_decimal b2 = other > *this ? *this : other;
    double result = b1.decNumberToDouble() + b2.decNumberToDouble();
    std::string results = std::to_string(result);
    t_decimal v(results);
    return v;
}

bool t_decimal::equals(const t_decimal &other) {
    t_decimal b1 = other > *this ? other : *this;
    t_decimal b2 = other > *this ? *this : other;
    return b1.decNumberToDouble() == b2.decNumberToDouble();
}

double t_decimal::divide(t_decimal other) {
    return this->decNumberToDouble()/other.decNumberToDouble();
}

double t_decimal::dividell(const long long &other) {
    return this->divide(t_decimal(std::to_string(other)));
}

t_decimal& t_decimal::operator=(const t_decimal &other) {
    memcpy(&number, &(other.number), sizeof(decNumber));
    return *this;
}

t_decimal operator+(t_decimal b1, const t_decimal &b2) {
    return b1.add(b2);
}

t_decimal operator+(t_decimal b1, const long long &b2) {
    return b1;
}

double operator+(double b1, const t_decimal &b2) {
    return b1 + b2.decNumberToDouble();
}

bool operator>(t_decimal b1, const t_decimal &b2) {
    return b1.decNumberToDouble() > b2.decNumberToDouble();
}

bool operator<(t_decimal b1, const t_decimal &b2) {
    return !(b1 == b2) && !(b1 > b2);
}

bool operator==(t_decimal b1, const t_decimal &b2) {
    return b1.equals(b2);
}

bool operator!=(t_decimal b1, const t_decimal &b2) {
    return !b1.equals(b2);
}

double operator/(t_decimal b1, const t_decimal &b2) {
    return b1.divide(b2);
}

double operator/(t_decimal b1, const long long &b2) {
    return b1.dividell(b2);
}

double operator/(t_decimal b1, const double &b2) {
    return b1.dividell(b2);
}

}