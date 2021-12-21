#include <perspective/base.h>
#include <perspective/config.h>
#include <perspective/table.h>
#include <perspective/date.h>
#include <perspective/time.h>
#include <perspective/duration.h>
#include <perspective/decimal.h>
#include <perspective/test_utils.h>
#include <perspective/search.h>
#include <perspective/context_base.h>
#include <perspective/context_one.h>
#include <perspective/context_two.h>
#include <perspective/context_zero.h>
#include <perspective/context_grouped_pkey.h>
#include <perspective/node_processor.h>
#include <perspective/storage.h>
#include <perspective/none.h>
#include <perspective/gnode.h>
#include <perspective/sym_table.h>
#include <gtest/gtest.h>
#include <random>
#include <limits>
#include <cmath>
#include <cstdint>
#include <sstream>

using namespace perspective;

t_tscalar iop = mktscalar<std::uint8_t>(OP_INSERT);
t_tscalar t_s = mktscalar<bool>(true);
t_tscalar f_s = mktscalar<bool>(false);

#define SELF static_cast<T*>(this)

template <typename T, typename CTX_T>
class CtxTest : public ::testing::Test
{

public:
    using t_tbldata = std::vector<std::vector<t_tscalar>>;
    using t_stepdata = std::pair<t_tbldata, std::vector<t_tscalar>>;
    using t_testdata = std::vector<t_stepdata>;
    CtxTest()
    {
        this->m_ischema = SELF->get_ischema();
        t_gnode_options options;
        options.m_gnode_type = GNODE_TYPE_PKEYED;
        options.m_port_schema = this->m_ischema;
        this->m_g = t_gnode::build(options);
        m_ctx = CTX_T::build(this->m_ischema, SELF->get_config());
        this->m_g->register_context("ctx", m_ctx);
    }

    std::vector<t_tscalar>
    get_data()
    {
        return m_ctx->get_table();
    }

    void
    run(const t_testdata& d)
    {
        for (const auto& sd : d)
        {
            t_table itbl(m_ischema, sd.first);
            this->m_g->_send_and_process(itbl);
            EXPECT_EQ(this->m_ctx->get_data(), sd.second);
        }
    }

protected:
    std::shared_ptr<CTX_T> m_ctx;
    t_schema m_ischema;
    std::shared_ptr<t_gnode> m_g;
};

class BoolCtx0NullSearchTest : public CtxTest<BoolCtx0NullSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "b"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_BOOL}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("true");
        return t_config{{"b"}, FILTER_OP_AND, {}, {term}, {{"b", SEARCHTYPE_NULL}}, {}};
    }
};

TEST_F(BoolCtx0NullSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, t_s}, {iop, 1_ts, f_s}, {iop, 2_ts, f_s}, {iop, 3_ts, t_s}},
            {}
        }
    };

    run(data);
}

class BoolCtx0EQTrueSearchTest : public CtxTest<BoolCtx0EQTrueSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "b"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_BOOL}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("true");
        return t_config{{"b"}, FILTER_OP_AND, {}, {term}, {{"b", SEARCHTYPE_EQUALS}}, {}};
    }
};

TEST_F(BoolCtx0EQTrueSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, t_s}, {iop, 1_ts, f_s}, {iop, 2_ts, f_s}, {iop, 3_ts, t_s}},
            {t_s, t_s}
        }
    };

    run(data);
}

TEST_F(BoolCtx0EQTrueSearchTest, test_2) {
    t_testdata data{
        {{{iop, 0_ts, f_s}, {iop, 1_ts, f_s}},
            {}
        }
    };

    run(data);
}

class BoolCtx0ContainsTrueSearchTest : public CtxTest<BoolCtx0ContainsTrueSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "b"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_BOOL}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("ru");
        return t_config{{"b"}, FILTER_OP_AND, {}, {term}, {{"b", SEARCHTYPE_CONTAINS}}, {}};
    }
};

TEST_F(BoolCtx0ContainsTrueSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, t_s}, {iop, 1_ts, f_s}, {iop, 2_ts, f_s}, {iop, 3_ts, t_s}},
            {t_s, t_s}
        }
    };

    run(data);
}

TEST_F(BoolCtx0ContainsTrueSearchTest, test_2) {
    t_testdata data{
        {{{iop, 0_ts, f_s}, {iop, 1_ts, f_s}},
            {}
        }
    };

    run(data);
}

class BoolCtx0EdgeTrueSearchTest : public CtxTest<BoolCtx0EdgeTrueSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "b"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_BOOL}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("tr");
        return t_config{{"b"}, FILTER_OP_AND, {}, {term}, {{"b", SEARCHTYPE_EDGE}}, {}};
    }
};

TEST_F(BoolCtx0EdgeTrueSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, t_s}, {iop, 1_ts, f_s}, {iop, 2_ts, f_s}, {iop, 3_ts, t_s}},
            {t_s, t_s}
        }
    };

    run(data);
}

TEST_F(BoolCtx0EdgeTrueSearchTest, test_2) {
    t_testdata data{
        {{{iop, 0_ts, f_s}, {iop, 1_ts, f_s}},
            {}
        }
    };

    run(data);
}

class BoolCtx0StartWithTrueSearchTest : public CtxTest<BoolCtx0StartWithTrueSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "b"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_BOOL}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("tr");
        return t_config{{"b"}, FILTER_OP_AND, {}, {term}, {{"b", SEARCHTYPE_STARTS_WITH}}, {}};
    }
};

TEST_F(BoolCtx0StartWithTrueSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, t_s}, {iop, 1_ts, f_s}, {iop, 2_ts, f_s}, {iop, 3_ts, t_s}},
            {t_s, t_s}
        }
    };

    run(data);
}

TEST_F(BoolCtx0StartWithTrueSearchTest, test_2) {
    t_testdata data{
        {{{iop, 0_ts, f_s}, {iop, 1_ts, f_s}},
            {}
        }
    };

    run(data);
}

class BoolCtx0EQFalseSearchTest : public CtxTest<BoolCtx0EQFalseSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "b"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_BOOL}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("false");
        return t_config{{"b"}, FILTER_OP_AND, {}, {term}, {{"b", SEARCHTYPE_EQUALS}}, {}};
    }
};

TEST_F(BoolCtx0EQFalseSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, t_s}, {iop, 1_ts, f_s}, {iop, 2_ts, f_s}, {iop, 3_ts, t_s}},
            {f_s, f_s}
        }
    };

    run(data);
}

TEST_F(BoolCtx0EQFalseSearchTest, test_2) {
    t_testdata data{
        {{{iop, 0_ts, t_s}, {iop, 1_ts, t_s}},
            {}
        }
    };

    run(data);
}

class BoolCtx0ContainsFalseSearchTest : public CtxTest<BoolCtx0ContainsFalseSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "b"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_BOOL}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("al");
        return t_config{{"b"}, FILTER_OP_AND, {}, {term}, {{"b", SEARCHTYPE_CONTAINS}}, {}};
    }
};

TEST_F(BoolCtx0ContainsFalseSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, t_s}, {iop, 1_ts, f_s}, {iop, 2_ts, f_s}, {iop, 3_ts, t_s}},
            {f_s, f_s}
        }
    };

    run(data);
}

TEST_F(BoolCtx0ContainsFalseSearchTest, test_2) {
    t_testdata data{
        {{{iop, 0_ts, t_s}, {iop, 1_ts, t_s}},
            {}
        }
    };

    run(data);
}

class BoolCtx0EdgeFalseSearchTest : public CtxTest<BoolCtx0EdgeFalseSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "b"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_BOOL}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("fa");
        return t_config{{"b"}, FILTER_OP_AND, {}, {term}, {{"b", SEARCHTYPE_EDGE}}, {}};
    }
};

TEST_F(BoolCtx0EdgeFalseSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, t_s}, {iop, 1_ts, f_s}, {iop, 2_ts, f_s}, {iop, 3_ts, t_s}},
            {f_s, f_s}
        }
    };

    run(data);
}

TEST_F(BoolCtx0EdgeFalseSearchTest, test_2) {
    t_testdata data{
        {{{iop, 0_ts, t_s}, {iop, 1_ts, t_s}},
            {}
        }
    };

    run(data);
}

class BoolCtx0StartWithFalseSearchTest : public CtxTest<BoolCtx0StartWithFalseSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "b"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_BOOL}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("fa");
        return t_config{{"b"}, FILTER_OP_AND, {}, {term}, {{"b", SEARCHTYPE_STARTS_WITH}}, {}};
    }
};

TEST_F(BoolCtx0StartWithFalseSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, t_s}, {iop, 1_ts, f_s}, {iop, 2_ts, f_s}, {iop, 3_ts, t_s}},
            {f_s, f_s}
        }
    };

    run(data);
}

TEST_F(BoolCtx0StartWithFalseSearchTest, test_2) {
    t_testdata data{
        {{{iop, 0_ts, t_s}, {iop, 1_ts, t_s}},
            {}
        }
    };

    run(data);
}

class StringCtx0NullSearchTest : public CtxTest<StringCtx0NullSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "s"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_STR}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("3YTIQ7TAFGPIF6TIR3RYZCVVJ0XOR1");
        return t_config{{"s"}, FILTER_OP_AND, {}, {term}, {{"s", SEARCHTYPE_NULL}}, {}};
    }
};

TEST_F(StringCtx0NullSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, "3RP64CUV275DPZNL10GBM8FCINGCKA"_ts},
          {iop, 1_ts, "3YTIQ7TAFGPIF6TIR3RYZCVVJ0XOR1"_ts},
          {iop, 2_ts, "3EU8AFIIJY2GE1IMHDGE7KDMBGOJ0F"_ts},
          {iop, 3_ts, "3Q50YLAWPFUPMDD72FYGCUP9VXBGT7"_ts}},
          {}
        }
    };

    run(data);
}

class StringCtx0EQSearchTest : public CtxTest<StringCtx0EQSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "s"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_STR}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("3YTIQ7TAFGPIF6TIR3RYZCVVJ0XOR1");
        return t_config{{"s"}, FILTER_OP_AND, {}, {term}, {{"s", SEARCHTYPE_EQUALS}}, {}};
    }
};

TEST_F(StringCtx0EQSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, "3RP64CUV275DPZNL10GBM8FCINGCKA"_ts},
          {iop, 1_ts, "3YTIQ7TAFGPIF6TIR3RYZCVVJ0XOR1"_ts},
          {iop, 2_ts, "3EU8AFIIJY2GE1IMHDGE7KDMBGOJ0F"_ts},
          {iop, 3_ts, "3Q50YLAWPFUPMDD72FYGCUP9VXBGT7"_ts}},
          {"3YTIQ7TAFGPIF6TIR3RYZCVVJ0XOR1"_ts}
        }
    };

    run(data);
}

TEST_F(StringCtx0EQSearchTest, test_2) {
    t_testdata data{
        {{{iop, 0_ts, "3RP64CUV275DPZNL10GBM8FCINGCKA"_ts},
          {iop, 1_ts, "3EU8AFIIJY2GE1IMHDGE7KDMBGOJ0F"_ts},
          {iop, 2_ts, "3Q50YLAWPFUPMDD72FYGCUP9VXBGT7"_ts}},
          {}
        }
    };

    run(data);
}

TEST_F(StringCtx0EQSearchTest, test_3) {
    t_testdata data{
        {{{iop, 0_ts, "3RP64CUV275DPZNL10GBM8FCINGCKA"_ts},
          {iop, 1_ts, "3YTIQ7TAFGPIF6TIR3RYZCVVJ0XOR1 ADS"_ts},
          {iop, 2_ts, "3EU8AFIIJY2GE1IMHDGE7KDMBGOJ0F"_ts},
          {iop, 3_ts, "3Q50YLAWPFUPMDD72FYGCUP9VXBGT7"_ts}},
          {}
        }
    };

    run(data);
}

class StringCtx0ContainsSearchTest : public CtxTest<StringCtx0ContainsSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "s"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_STR}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("FGPIF6TIR3RYZCVV");
        return t_config{{"s"}, FILTER_OP_AND, {}, {term}, {{"s", SEARCHTYPE_CONTAINS}}, {}};
    }
};

TEST_F(StringCtx0ContainsSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, "3RP64CUV275DPZNL10GBM8FCINGCKA"_ts},
          {iop, 1_ts, "3YTIQ7TAFGPIF6TIR3RYZCVVJ0XOR1"_ts},
          {iop, 2_ts, "3EUFGPIF6TIR3RYZCVVMHDGE7KDJ0F"_ts},
          {iop, 3_ts, "3Q50YLAWPFUPMDD72FYGCUP9VXBGT7"_ts}},
          {"3YTIQ7TAFGPIF6TIR3RYZCVVJ0XOR1"_ts, "3EUFGPIF6TIR3RYZCVVMHDGE7KDJ0F"_ts}
        }
    };

    run(data);
}

TEST_F(StringCtx0ContainsSearchTest, test_2) {
    t_testdata data{
        {{{iop, 0_ts, "3RP64CUV275DPZNL10GBM8FCINGCKA"_ts},
          {iop, 1_ts, "3EU8AFIIJY2GE1IMHDGE7KDMBGOJ0F"_ts},
          {iop, 2_ts, "3Q50YLAWPFUPMDD72FYGCUP9VXBGT7"_ts}},
          {}
        }
    };

    run(data);
}

TEST_F(StringCtx0ContainsSearchTest, test_3) {
    t_testdata data{
        {{{iop, 0_ts, "3RP64CUV275DPZNL10GBM8FCINGCKA"_ts},
          {iop, 1_ts, "3YTIQ7TAFGPIF6TIR3RYZCVVJ0XOR1 ADS"_ts},
          {iop, 2_ts, "3EU8AFIIJY2GE1IMHDGE7KDMBGOJ0F"_ts},
          {iop, 3_ts, "3Q50YLAWPFFGPIF6TIR3RYZCVVCUP9VX7"_ts}},
          {"3YTIQ7TAFGPIF6TIR3RYZCVVJ0XOR1 ADS"_ts, "3Q50YLAWPFFGPIF6TIR3RYZCVVCUP9VX7"_ts}
        }
    };

    run(data);
}

class StringCtx0EdgeSearchTest : public CtxTest<StringCtx0EdgeSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "s"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_STR}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term1("FGPIF6TI");
        t_sterm term2("R3RYZCVV");
        return t_config{{"s"}, FILTER_OP_AND, {}, {term1, term2}, {{"s", SEARCHTYPE_EDGE}}, {}};
    }
};

TEST_F(StringCtx0EdgeSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, "3RP64CUV275DPZNL10GBM8FCINGCKA"_ts},
          {iop, 1_ts, "3YTIQ7TA FGPIF6TI R3RYZCVVJ0XOR1"_ts},
          {iop, 2_ts, "3E UFGPIF6TI R3RYZCVVMHDGE7KDJ0F"_ts},
          {iop, 3_ts, "3Q50YLAWPFUPMDD72FYGCUP9VXBGT7"_ts}},
          {"3YTIQ7TA FGPIF6TI R3RYZCVVJ0XOR1"_ts}
        }
    };

    run(data);
}

TEST_F(StringCtx0EdgeSearchTest, test_2) {
    t_testdata data{
        {{{iop, 0_ts, "3RP64CUV275DPZ FGPIF6TI BM8FCINGCKA"_ts},
          {iop, 1_ts, "3EU8AFIIJY2GE1IMHDGE7KDMBGOJ0F"_ts},
          {iop, 2_ts, "3Q50YLAWPFUPMDD72FYGCUP9VXBGT7"_ts}},
          {}
        }
    };

    run(data);
}

TEST_F(StringCtx0EdgeSearchTest, test_3) {
    t_testdata data{
        {{{iop, 0_ts, "3RP64CUV275DPZNL10GBM8FCINGCKA"_ts},
          {iop, 1_ts, "3YTIQ7TA FGPIF6TI J0XOR1 R3RYZCVV ADS"_ts},
          {iop, 2_ts, "3EU8AFIIJY2GE1IMHDGE7KDMBGOJ0F"_ts},
          {iop, 3_ts, "3Q50YLAWPF FGPIF6TIR3RYZCVVCUP9VX7"_ts}},
          {"3YTIQ7TA FGPIF6TI J0XOR1 R3RYZCVV ADS"_ts}
        }
    };

    run(data);
}

class StringCtx0StartWithSearchTest : public CtxTest<StringCtx0StartWithSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "s"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_STR}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("FGPIF 6TI");
        return t_config{{"s"}, FILTER_OP_AND, {}, {term}, {{"s", SEARCHTYPE_STARTS_WITH}}, {}};
    }
};

TEST_F(StringCtx0StartWithSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, "FGPIF 6TIV275DPZNL10GBM8FCINGCKA"_ts},
          {iop, 1_ts, "3YTIQ7TA FGPIF 6TI R3RYZCVVJ0XOR1"_ts},
          {iop, 2_ts, "3E UFGPIF 6TI R3RYZCVVMHDGE7KDJ0F"_ts},
          {iop, 3_ts, "3Q50YLAWPFUPMDD72FYGCUP9VXBGT7"_ts},
          {iop, 3_ts, "FGPIF 6TI 3Q50YLAWPFUPMDD72FYT7"_ts}},
          {"FGPIF 6TIV275DPZNL10GBM8FCINGCKA"_ts, "FGPIF 6TI 3Q50YLAWPFUPMDD72FYT7"_ts}
        }
    };

    run(data);
}

TEST_F(StringCtx0StartWithSearchTest, test_2) {
    t_testdata data{
        {{{iop, 0_ts, "3RP64CUV275DPZ FGPIF 6TI BM8FCINGCKA"_ts},
          {iop, 1_ts, "3EU8AFIIJY2GE1IMHDGE7KDMBGOJ0F"_ts},
          {iop, 2_ts, "3Q50YLAWPFUPMDD72FYGCUP9VXBGT7"_ts}},
          {}
        }
    };

    run(data);
}

class I64Ctx0NullSearchTest : public CtxTest<I64Ctx0NullSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "i"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_INT64}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("123");
        return t_config{{"i"}, FILTER_OP_AND, {}, {term}, {{"i", SEARCHTYPE_NULL}}, {}};
    }
};

TEST_F(I64Ctx0NullSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, 123_ts},
          {iop, 1_ts, 2_ts},
          {iop, 2_ts, 44_ts},
          {iop, 3_ts, 123_ts},
          {iop, 4_ts, 342434_ts}},
          {}
        }
    };

    run(data);
}

class I64Ctx0EQSearchTest : public CtxTest<I64Ctx0EQSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "i"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_INT64}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("123");
        return t_config{{"i"}, FILTER_OP_AND, {}, {term}, {{"i", SEARCHTYPE_EQUALS}}, {}};
    }
};

TEST_F(I64Ctx0EQSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, 123_ts},
          {iop, 1_ts, 2_ts},
          {iop, 2_ts, 44_ts},
          {iop, 3_ts, 123_ts},
          {iop, 4_ts, 342434_ts}},
          {123_ts, 123_ts}
        }
    };

    run(data);
}

TEST_F(I64Ctx0EQSearchTest, test_2) {
    t_testdata data{
        {{{iop, 0_ts, 2_ts},
          {iop, 1_ts, 44_ts},
          {iop, 2_ts, 342434_ts}},
          {}
        }
    };

    run(data);
}

TEST_F(I64Ctx0EQSearchTest, test_3) {
    t_testdata data{
        {{{iop, 0_ts, 2_ts},
          {iop, 1_ts, 44_ts},
          {iop, 2_ts, 1223_ts},
          {iop, 3_ts, 342434_ts}},
          {}
        }
    };

    run(data);
}

class I64Ctx0ContainsSearchTest : public CtxTest<I64Ctx0ContainsSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "i"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_INT64}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("12");
        return t_config{{"i"}, FILTER_OP_AND, {}, {term}, {{"i", SEARCHTYPE_CONTAINS}}, {}};
    }
};

TEST_F(I64Ctx0ContainsSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, 123_ts},
          {iop, 1_ts, 2_ts},
          {iop, 2_ts, 44_ts},
          {iop, 3_ts, 2312_ts},
          {iop, 4_ts, 342434_ts}},
          {123_ts, 2312_ts}
        }
    };

    run(data);
}

TEST_F(I64Ctx0ContainsSearchTest, test_2) {
    t_testdata data{
        {{{iop, 0_ts, 2_ts},
          {iop, 1_ts, 44_ts},
          {iop, 2_ts, 342434_ts}},
          {}
        }
    };

    run(data);
}

TEST_F(I64Ctx0ContainsSearchTest, test_3) {
    t_testdata data{
        {{{iop, 0_ts, 2_ts},
          {iop, 1_ts, 44_ts},
          {iop, 2_ts, 1223_ts},
          {iop, 3_ts, 342434_ts}},
          {1223_ts}
        }
    };

    run(data);
}

class I64Ctx0EdgeSearchTest : public CtxTest<I64Ctx0EdgeSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "i"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_INT64}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("23");
        return t_config{{"i"}, FILTER_OP_AND, {}, {term}, {{"i", SEARCHTYPE_EDGE}}, {}};
    }
};

TEST_F(I64Ctx0EdgeSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, 123_ts},
          {iop, 1_ts, 2_ts},
          {iop, 2_ts, 2333333_ts},
          {iop, 3_ts, 23_ts},
          {iop, 4_ts, 342434_ts}},
          {2333333_ts, 23_ts}
        }
    };

    run(data);
}

TEST_F(I64Ctx0EdgeSearchTest, test_2) {
    t_testdata data{
        {{{iop, 0_ts, 2_ts},
          {iop, 1_ts, 123_ts},
          {iop, 2_ts, 342434_ts}},
          {}
        }
    };

    run(data);
}

TEST_F(I64Ctx0EdgeSearchTest, test_3) {
    t_testdata data{
        {{{iop, 0_ts, 2_ts},
          {iop, 1_ts, 44_ts},
          {iop, 2_ts, 1223_ts},
          {iop, 3_ts, 342434_ts}},
          {}
        }
    };

    run(data);
}

class I64Ctx0StartWithSearchTest : public CtxTest<I64Ctx0StartWithSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "i"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_INT64}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("23");
        return t_config{{"i"}, FILTER_OP_AND, {}, {term}, {{"i", SEARCHTYPE_STARTS_WITH}}, {}};
    }
};

TEST_F(I64Ctx0StartWithSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, 123_ts},
          {iop, 1_ts, 2_ts},
          {iop, 2_ts, 2333333_ts},
          {iop, 3_ts, 23_ts},
          {iop, 4_ts, 342434_ts}},
          {2333333_ts, 23_ts}
        }
    };

    run(data);
}

TEST_F(I64Ctx0StartWithSearchTest, test_2) {
    t_testdata data{
        {{{iop, 0_ts, 2_ts},
          {iop, 1_ts, 123_ts},
          {iop, 2_ts, 342434_ts}},
          {}
        }
    };

    run(data);
}

TEST_F(I64Ctx0StartWithSearchTest, test_3) {
    t_testdata data{
        {{{iop, 0_ts, 2_ts},
          {iop, 1_ts, 44_ts},
          {iop, 2_ts, 1223_ts},
          {iop, 3_ts, 342434_ts}},
          {}
        }
    };

    run(data);
}

class F64Ctx0NullSearchTest : public CtxTest<F64Ctx0NullSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "f"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_FLOAT64}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("123.24");
        return t_config{{"f"}, FILTER_OP_AND, {}, {term}, {{"f", SEARCHTYPE_NULL}}, {}};
    }
};

TEST_F(F64Ctx0NullSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, 123.24_ts},
          {iop, 1_ts, 2.32_ts},
          {iop, 2_ts, 4400.78_ts},
          {iop, 4_ts, 123.12_ts},
          {iop, 5_ts, 342434.001_ts}},
          {}
        }
    };

    run(data);
}

class F64Ctx0EQSearchTest : public CtxTest<F64Ctx0EQSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "f"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_FLOAT64}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("123.24");
        return t_config{{"f"}, FILTER_OP_AND, {}, {term}, {{"f", SEARCHTYPE_EQUALS}}, {}};
    }
};

TEST_F(F64Ctx0EQSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, 123.24_ts},
          {iop, 1_ts, 2.32_ts},
          {iop, 2_ts, 4400.78_ts},
          {iop, 4_ts, 123.12_ts},
          {iop, 5_ts, 342434.001_ts}},
          {123.24_ts}
        }
    };

    run(data);
}

TEST_F(F64Ctx0EQSearchTest, test_2) {
    t_testdata data{
        {{{iop, 0_ts, 2.32_ts},
          {iop, 1_ts, 4400.78_ts},
          {iop, 2_ts, 342434.001_ts}},
          {}
        }
    };

    run(data);
}

TEST_F(F64Ctx0EQSearchTest, test_3) {
    t_testdata data{
        {{{iop, 0_ts, 2.222_ts},
          {iop, 1_ts, 4400.72_ts},
          {iop, 2_ts, 1223_ts}},
          {}
        }
    };

    run(data);
}

class F64Ctx0ContainsSearchTest : public CtxTest<F64Ctx0ContainsSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "f"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_FLOAT64}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("3.2");
        return t_config{{"f"}, FILTER_OP_AND, {}, {term}, {{"f", SEARCHTYPE_CONTAINS}}, {}};
    }
};

TEST_F(F64Ctx0ContainsSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, 123.24_ts},
          {iop, 1_ts, 2.32_ts},
          {iop, 2_ts, 4400.78_ts},
          {iop, 4_ts, 123.22_ts},
          {iop, 5_ts, 342434.001_ts}},
          {123.24_ts, 123.22_ts}
        }
    };

    run(data);
}

TEST_F(F64Ctx0ContainsSearchTest, test_2) {
    t_testdata data{
        {{{iop, 0_ts, 2.32_ts},
          {iop, 1_ts, 4400.78_ts},
          {iop, 2_ts, 342434.001_ts}},
          {}
        }
    };

    run(data);
}

TEST_F(F64Ctx0ContainsSearchTest, test_3) {
    t_testdata data{
        {{{iop, 0_ts, 2.222_ts},
          {iop, 1_ts, 4403.272_ts},
          {iop, 2_ts, 1223_ts}},
          {4403.272_ts}
        }
    };

    run(data);
}

class F64Ctx0EdgeSearchTest : public CtxTest<F64Ctx0EdgeSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "f"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_FLOAT64}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("3.2");
        return t_config{{"f"}, FILTER_OP_AND, {}, {term}, {{"f", SEARCHTYPE_EDGE}}, {}};
    }
};

TEST_F(F64Ctx0EdgeSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, 123.24_ts},
          {iop, 1_ts, 3.22_ts},
          {iop, 2_ts, 4400.78_ts},
          {iop, 4_ts, 3.243_ts},
          {iop, 5_ts, 342434.001_ts}},
          {3.22_ts, 3.243_ts}
        }
    };

    run(data);
}

TEST_F(F64Ctx0EdgeSearchTest, test_2) {
    t_testdata data{
        {{{iop, 0_ts, 2.32_ts},
          {iop, 1_ts, 4400.78_ts},
          {iop, 2_ts, 342434.001_ts}},
          {}
        }
    };

    run(data);
}

TEST_F(F64Ctx0EdgeSearchTest, test_3) {
    t_testdata data{
        {{{iop, 0_ts, 2.222_ts},
          {iop, 1_ts, 4403.272_ts},
          {iop, 2_ts, 1223_ts}},
          {}
        }
    };

    run(data);
}

class F64Ctx0StartWithSearchTest : public CtxTest<F64Ctx0StartWithSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "f"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_FLOAT64}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("3.2");
        return t_config{{"f"}, FILTER_OP_AND, {}, {term}, {{"f", SEARCHTYPE_STARTS_WITH}}, {}};
    }
};

TEST_F(F64Ctx0StartWithSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, 123.24_ts},
          {iop, 1_ts, 3.22_ts},
          {iop, 2_ts, 4400.78_ts},
          {iop, 4_ts, 3.243_ts},
          {iop, 5_ts, 342434.001_ts}},
          {3.22_ts, 3.243_ts}
        }
    };

    run(data);
}

TEST_F(F64Ctx0StartWithSearchTest, test_2) {
    t_testdata data{
        {{{iop, 0_ts, 2.32_ts},
          {iop, 1_ts, 4400.78_ts},
          {iop, 2_ts, 342434.001_ts}},
          {}
        }
    };

    run(data);
}

TEST_F(F64Ctx0StartWithSearchTest, test_3) {
    t_testdata data{
        {{{iop, 0_ts, 2.222_ts},
          {iop, 1_ts, 4403.272_ts},
          {iop, 2_ts, 1223_ts}},
          {}
        }
    };

    run(data);
}

class DateCtx0NullSearchTest : public CtxTest<DateCtx0NullSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "d"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_DATE}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("2015-03-05");
        return t_config{{"d"}, FILTER_OP_AND, {}, {term}, {{"d", SEARCHTYPE_NULL}}, {}};
    }
};

TEST_F(DateCtx0NullSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar<t_date>(t_date(2015, 3, 5))},
          {iop, 1_ts, mktscalar<t_date>(t_date(2016, 10, 4))},
          {iop, 2_ts, mktscalar<t_date>(t_date(2015, 3, 5))},
          {iop, 3_ts, mktscalar<t_date>(t_date(2015, 8, 25))},
          {iop, 4_ts, mktscalar<t_date>(t_date(2013, 3, 5))}},
          {}
        }
    };

    run(data);
}

class DateCtx0EQSearchTest : public CtxTest<DateCtx0EQSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "d"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_DATE}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("Mar 5, 2015");
        return t_config{{"d"}, FILTER_OP_AND, {}, {term}, {{"d", SEARCHTYPE_EQUALS}}, {}};
    }
};

TEST_F(DateCtx0EQSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar<t_date>(t_date(2015, 3, 5))},
          {iop, 1_ts, mktscalar<t_date>(t_date(2016, 10, 4))},
          {iop, 2_ts, mktscalar<t_date>(t_date(2015, 3, 5))},
          {iop, 3_ts, mktscalar<t_date>(t_date(2015, 8, 25))},
          {iop, 4_ts, mktscalar<t_date>(t_date(2013, 3, 5))}},
          {mktscalar<t_date>(t_date(2015, 3, 5)), mktscalar<t_date>(t_date(2015, 3, 5))}
        }
    };

    run(data);
}

TEST_F(DateCtx0EQSearchTest, test_2) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar<t_date>(t_date(2016, 10, 4))},
          {iop, 1_ts, mktscalar<t_date>(t_date(2015, 4, 4))},
          {iop, 2_ts, mktscalar<t_date>(t_date(2013, 3, 4))}},
          {}
        }
    };

    run(data);
}

class DateCtx0ContainsSearchTest : public CtxTest<DateCtx0ContainsSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "d"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_DATE}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("mar");
        return t_config{{"d"}, FILTER_OP_AND, {}, {term}, {{"d", SEARCHTYPE_CONTAINS}}, {}};
    }
};

TEST_F(DateCtx0ContainsSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar<t_date>(t_date(2015, 3, 5))},
          {iop, 1_ts, mktscalar<t_date>(t_date(2016, 10, 4))},
          {iop, 2_ts, mktscalar<t_date>(t_date(2015, 3, 12))},
          {iop, 3_ts, mktscalar<t_date>(t_date(2015, 8, 25))},
          {iop, 4_ts, mktscalar<t_date>(t_date(2013, 3, 5))}},
          {mktscalar<t_date>(t_date(2015, 3, 5)), mktscalar<t_date>(t_date(2015, 3, 12)), mktscalar<t_date>(t_date(2013, 3, 5))}
        }
    };

    run(data);
}

TEST_F(DateCtx0ContainsSearchTest, test_2) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar<t_date>(t_date(2016, 10, 4))},
          {iop, 1_ts, mktscalar<t_date>(t_date(2015, 4, 4))},
          {iop, 2_ts, mktscalar<t_date>(t_date(2013, 12, 4))}},
          {}
        }
    };

    run(data);
}

class DateCtx0EdgeSearchTest : public CtxTest<DateCtx0EdgeSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "d"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_DATE}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term1("mar");
        t_sterm term2("5,");
        return t_config{{"d"}, FILTER_OP_AND, {}, {term1, term2}, {{"d", SEARCHTYPE_EDGE}}, {}};
    }
};

TEST_F(DateCtx0EdgeSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar<t_date>(t_date(2015, 3, 5))},
          {iop, 1_ts, mktscalar<t_date>(t_date(2016, 10, 4))},
          {iop, 2_ts, mktscalar<t_date>(t_date(2015, 3, 12))},
          {iop, 3_ts, mktscalar<t_date>(t_date(2015, 8, 25))},
          {iop, 4_ts, mktscalar<t_date>(t_date(2013, 3, 5))}},
          {mktscalar<t_date>(t_date(2015, 3, 5)), mktscalar<t_date>(t_date(2013, 3, 5))}
        }
    };

    run(data);
}

TEST_F(DateCtx0EdgeSearchTest, test_2) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar<t_date>(t_date(2016, 10, 4))},
          {iop, 1_ts, mktscalar<t_date>(t_date(2015, 4, 4))},
          {iop, 2_ts, mktscalar<t_date>(t_date(2013, 12, 4))}},
          {}
        }
    };

    run(data);
}

class DateCtx0StartWithSearchTest : public CtxTest<DateCtx0StartWithSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "d"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_DATE}, {DATA_FORMAT_NUMBER, DATA_FORMAT_NUMBER, DATA_FORMAT_DATE_V1}};
    }

    t_config
    get_config()
    {
        t_sterm term("Mar");
        return t_config{{"d"}, FILTER_OP_AND, {}, {term}, {{"d", SEARCHTYPE_STARTS_WITH}}, {}};
    }
};

TEST_F(DateCtx0StartWithSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar<t_date>(t_date(2015, 3, 5))},
          {iop, 1_ts, mktscalar<t_date>(t_date(2016, 10, 4))},
          {iop, 2_ts, mktscalar<t_date>(t_date(2015, 3, 12))},
          {iop, 3_ts, mktscalar<t_date>(t_date(2015, 8, 25))},
          {iop, 4_ts, mktscalar<t_date>(t_date(2013, 6, 5))}},
          {mktscalar<t_date>(t_date(2015, 3, 5)), mktscalar<t_date>(t_date(2015, 3, 12))}
        }
    };

    run(data);
}

TEST_F(DateCtx0StartWithSearchTest, test_2) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar<t_date>(t_date(2016, 10, 4))},
          {iop, 1_ts, mktscalar<t_date>(t_date(2015, 3, 4))},
          {iop, 2_ts, mktscalar<t_date>(t_date(2013, 12, 4))}},
          {mktscalar<t_date>(t_date(2015, 3, 4))}
        }
    };

    run(data);
}

class TimeCtx0NullSearchTest : public CtxTest<TimeCtx0NullSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "t"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_TIME}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("2015-03-05 01:12:00");
        return t_config{{"t"}, FILTER_OP_AND, {}, {term}, {{"t", SEARCHTYPE_NULL}}, {}};
    }
};

TEST_F(TimeCtx0NullSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar<t_time>(t_time(2015, 3, 5, 1, 12, 1))},
          {iop, 1_ts, mktscalar<t_time>(t_time(2016, 10, 4, 1, 12, 0))},
          {iop, 2_ts, mktscalar<t_time>(t_time(2015, 3, 5, 1, 12, 0))},
          {iop, 3_ts, mktscalar<t_time>(t_time(2015, 8, 25, 1, 12, 0))},
          {iop, 4_ts, mktscalar<t_time>(t_time(2013, 3, 5, 1, 12, 0))}},
          {}
        }
    };

    run(data);
}

class TimeCtx0EQSearchTest : public CtxTest<TimeCtx0EQSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "t"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_TIME}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("2015-03-05 01:12:00");
        return t_config{{"t"}, FILTER_OP_AND, {}, {term}, {{"t", SEARCHTYPE_EQUALS}}, {}};
    }
};

TEST_F(TimeCtx0EQSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar<t_time>(t_time(2015, 3, 5, 1, 12, 1))},
          {iop, 1_ts, mktscalar<t_time>(t_time(2016, 10, 4, 1, 12, 0))},
          {iop, 2_ts, mktscalar<t_time>(t_time(2015, 3, 5, 1, 12, 0))},
          {iop, 3_ts, mktscalar<t_time>(t_time(2015, 8, 25, 1, 12, 0))},
          {iop, 4_ts, mktscalar<t_time>(t_time(2013, 3, 5, 1, 12, 0))}},
          {mktscalar<t_time>(t_time(2015, 3, 5, 1, 12, 0))}
        }
    };

    run(data);
}

TEST_F(TimeCtx0EQSearchTest, test_2) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar<t_time>(t_time(2015, 3, 5, 1, 12, 1))},
          {iop, 1_ts, mktscalar<t_time>(t_time(2015, 4, 4, 1, 12, 0))},
          {iop, 2_ts, mktscalar<t_time>(t_time(2013, 3, 4, 1, 12, 23))}},
          {}
        }
    };

    run(data);
}

class TimeCtx0ContainsSearchTest : public CtxTest<TimeCtx0ContainsSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "t"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_TIME}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("03-05 01");
        return t_config{{"t"}, FILTER_OP_AND, {}, {term}, {{"t", SEARCHTYPE_CONTAINS}}, {}};
    }
};

TEST_F(TimeCtx0ContainsSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar<t_time>(t_time(2015, 3, 5, 1, 12, 1))},
          {iop, 1_ts, mktscalar<t_time>(t_time(2016, 10, 4, 1, 12, 0))},
          {iop, 2_ts, mktscalar<t_time>(t_time(2015, 3, 5, 1, 12, 0))},
          {iop, 3_ts, mktscalar<t_time>(t_time(2015, 8, 25, 1, 12, 0))},
          {iop, 4_ts, mktscalar<t_time>(t_time(2013, 3, 5, 1, 12, 0))}},
          {
              mktscalar<t_time>(t_time(2015, 3, 5, 1, 12, 1)),
              mktscalar<t_time>(t_time(2015, 3, 5, 1, 12, 0)),
              mktscalar<t_time>(t_time(2013, 3, 5, 1, 12, 0))
          }
        }
    };

    run(data);
}

TEST_F(TimeCtx0ContainsSearchTest, test_2) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar<t_time>(t_time(2015, 3, 5, 12, 12, 1))},
          {iop, 1_ts, mktscalar<t_time>(t_time(2015, 4, 4, 1, 12, 0))},
          {iop, 2_ts, mktscalar<t_time>(t_time(2013, 3, 4, 1, 12, 23))}},
          {}
        }
    };

    run(data);
}

class TimeCtx0EdgeSearchTest : public CtxTest<TimeCtx0EdgeSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "t"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_TIME}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("2015");
        return t_config{{"t"}, FILTER_OP_AND, {}, {term}, {{"t", SEARCHTYPE_EDGE}}, {}};
    }
};

TEST_F(TimeCtx0EdgeSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar<t_time>(t_time(2015, 3, 5, 1, 12, 1))},
          {iop, 1_ts, mktscalar<t_time>(t_time(2016, 10, 4, 1, 12, 0))},
          {iop, 2_ts, mktscalar<t_time>(t_time(2019, 3, 5, 10, 12, 0))},
          {iop, 3_ts, mktscalar<t_time>(t_time(2015, 8, 25, 1, 12, 0))},
          {iop, 4_ts, mktscalar<t_time>(t_time(2013, 3, 5, 1, 52, 0))}},
          {
              mktscalar<t_time>(t_time(2015, 3, 5, 1, 12, 1)),
              mktscalar<t_time>(t_time(2015, 8, 25, 1, 12, 0))
          }
        }
    };

    run(data);
}

TEST_F(TimeCtx0EdgeSearchTest, test_2) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar<t_time>(t_time(2015, 3, 5, 12, 12, 1))},
          {iop, 1_ts, mktscalar<t_time>(t_time(2015, 4, 4, 1, 12, 0))},
          {iop, 2_ts, mktscalar<t_time>(t_time(2013, 3, 4, 5, 12, 23))}},
          {}
        }
    };

    run(data);
}

class TimeCtx0StartWithSearchTest : public CtxTest<TimeCtx0StartWithSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "t"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_TIME}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("2015-");
        return t_config{{"t"}, FILTER_OP_AND, {}, {term}, {{"t", SEARCHTYPE_STARTS_WITH}}, {}};
    }
};

TEST_F(TimeCtx0StartWithSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar<t_time>(t_time(2015, 3, 5, 1, 12, 1))},
          {iop, 1_ts, mktscalar<t_time>(t_time(2016, 10, 4, 1, 12, 0))},
          {iop, 2_ts, mktscalar<t_time>(t_time(2015, 3, 5, 10, 12, 0))},
          {iop, 3_ts, mktscalar<t_time>(t_time(2019, 8, 25, 1, 12, 0))},
          {iop, 4_ts, mktscalar<t_time>(t_time(2013, 3, 5, 1, 52, 0))}},
          {
              mktscalar<t_time>(t_time(2015, 3, 5, 1, 12, 1)),
              mktscalar<t_time>(t_time(2015, 3, 5, 10, 12, 0))
          }
        }
    };

    run(data);
}

TEST_F(TimeCtx0StartWithSearchTest, test_2) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar<t_time>(t_time(2016, 3, 5, 12, 12, 1))},
          {iop, 1_ts, mktscalar<t_time>(t_time(2015, 4, 4, 1, 12, 0))},
          {iop, 2_ts, mktscalar<t_time>(t_time(2013, 3, 4, 5, 12, 23))}},
          {}
        }
    };

    run(data);
}

class DurationCtx0NullSearchTest : public CtxTest<DurationCtx0NullSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "d"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_DURATION}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("1:12:00");
        return t_config{{"d"}, FILTER_OP_AND, {}, {term}, {{"d", SEARCHTYPE_NULL}}, {}};
    }
};

TEST_F(DurationCtx0NullSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar<t_duration>(t_duration(1, 12, 1))},
          {iop, 1_ts, mktscalar<t_duration>(t_duration(1, 12, 0))},
          {iop, 2_ts, mktscalar<t_duration>(t_duration(21, 12, 0))},
          {iop, 3_ts, mktscalar<t_duration>(t_duration(1, 32, 0))},
          {iop, 4_ts, mktscalar<t_duration>(t_duration(1, 12, 0))}},
          {}
        }
    };

    run(data);
}

class DurationCtx0EQSearchTest : public CtxTest<DurationCtx0EQSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "d"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_DURATION}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("01:12:10");
        return t_config{{"d"}, FILTER_OP_AND, {}, {term}, {{"d", SEARCHTYPE_EQUALS}}, {}};
    }
};

TEST_F(DurationCtx0EQSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar<t_duration>(t_duration(1, 12, 1))},
          {iop, 1_ts, mktscalar<t_duration>(t_duration(1, 12, 10))},
          {iop, 2_ts, mktscalar<t_duration>(t_duration(21, 12, 0))},
          {iop, 3_ts, mktscalar<t_duration>(t_duration(1, 32, 0))},
          {iop, 4_ts, mktscalar<t_duration>(t_duration(1, 12, 0))}},
          {mktscalar<t_duration>(t_duration(1, 12, 0))}
        }
    };

    run(data);
}

TEST_F(DurationCtx0EQSearchTest, test_2) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar<t_duration>(t_duration(12, 12, 1))},
          {iop, 1_ts, mktscalar<t_duration>(t_duration(1, 12, 54))},
          {iop, 2_ts, mktscalar<t_duration>(t_duration(1, 12, 23))}},
          {}
        }
    };

    run(data);
}

class DurationCtx0ContainsSearchTest : public CtxTest<DurationCtx0ContainsSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "d"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_DURATION}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term(":12:");
        return t_config{{"d"}, FILTER_OP_AND, {}, {term}, {{"d", SEARCHTYPE_CONTAINS}}, {}};
    }
};

TEST_F(DurationCtx0ContainsSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar<t_duration>(t_duration(1, 12, 1))},
          {iop, 1_ts, mktscalar<t_duration>(t_duration(1, 22, 0))},
          {iop, 2_ts, mktscalar<t_duration>(t_duration(21, 32, 0))},
          {iop, 3_ts, mktscalar<t_duration>(t_duration(1, 32, 0))},
          {iop, 4_ts, mktscalar<t_duration>(t_duration(14, 12, 54))}},
          {mktscalar<t_duration>(t_duration(1, 12, 1)), mktscalar<t_duration>(t_duration(14, 12, 54))}
        }
    };

    run(data);
}

TEST_F(DurationCtx0ContainsSearchTest, test_2) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar<t_duration>(t_duration(12, 2, 1))},
          {iop, 1_ts, mktscalar<t_duration>(t_duration(1, 36, 54))},
          {iop, 2_ts, mktscalar<t_duration>(t_duration(14, 21, 23))}},
          {}
        }
    };

    run(data);
}

class DurationCtx0EdgeSearchTest : public CtxTest<DurationCtx0EdgeSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "d"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_DURATION}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("13:");
        return t_config{{"d"}, FILTER_OP_AND, {}, {term}, {{"d", SEARCHTYPE_EDGE}}, {}};
    }
};

TEST_F(DurationCtx0EdgeSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar<t_duration>(t_duration(1, 12, 1))},
          {iop, 1_ts, mktscalar<t_duration>(t_duration(1, 22, 0))},
          {iop, 2_ts, mktscalar<t_duration>(t_duration(21, 32, 0))},
          {iop, 3_ts, mktscalar<t_duration>(t_duration(13, 32, 0))},
          {iop, 4_ts, mktscalar<t_duration>(t_duration(14, 12, 54))}},
          {mktscalar<t_duration>(t_duration(13, 32, 0))}
        }
    };

    run(data);
}

TEST_F(DurationCtx0EdgeSearchTest, test_2) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar<t_duration>(t_duration(23, 2, 1))},
          {iop, 1_ts, mktscalar<t_duration>(t_duration(1, 36, 54))},
          {iop, 2_ts, mktscalar<t_duration>(t_duration(14, 21, 23))}},
          {}
        }
    };

    run(data);
}

class DurationCtx0StartWithSearchTest : public CtxTest<DurationCtx0StartWithSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "d"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_DURATION}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("12:");
        return t_config{{"d"}, FILTER_OP_AND, {}, {term}, {{"d", SEARCHTYPE_STARTS_WITH}}, {}};
    }
};

TEST_F(DurationCtx0StartWithSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar<t_duration>(t_duration(1, 12, 1))},
          {iop, 1_ts, mktscalar<t_duration>(t_duration(1, 22, 0))},
          {iop, 2_ts, mktscalar<t_duration>(t_duration(21, 32, 0))},
          {iop, 3_ts, mktscalar<t_duration>(t_duration(12, 32, 0))},
          {iop, 4_ts, mktscalar<t_duration>(t_duration(14, 12, 54))}},
          {mktscalar<t_duration>(t_duration(12, 32, 0))}
        }
    };

    run(data);
}

TEST_F(DurationCtx0StartWithSearchTest, test_2) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar<t_duration>(t_duration(23, 12, 1))},
          {iop, 1_ts, mktscalar<t_duration>(t_duration(1, 36, 54))},
          {iop, 2_ts, mktscalar<t_duration>(t_duration(14, 21, 12))}},
          {}
        }
    };

    run(data);
}

class ListBoolCtx0NullSearchTest : public CtxTest<ListBoolCtx0NullSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "lb"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_LIST_BOOL}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("true");
        return t_config{{"lb"}, FILTER_OP_AND, {}, {term}, {{"lb", SEARCHTYPE_NULL}}, {}};
    }
};

TEST_F(ListBoolCtx0NullSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar(std::vector<bool>{true, false})},
          {iop, 1_ts, mktscalar(std::vector<bool>{false})},
          {iop, 2_ts, mktscalar(std::vector<bool>{false, false, true})},
          {iop, 3_ts, mktscalar(std::vector<bool>{false, false, false})},
          {iop, 4_ts, mktscalar(std::vector<bool>{true, true, true})}},
          {}
        }
    };

    run(data);
}

class ListBoolCtx0EQSearchTest : public CtxTest<ListBoolCtx0EQSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "lb"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_LIST_BOOL}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("true");
        return t_config{{"lb"}, FILTER_OP_AND, {}, {term}, {{"lb", SEARCHTYPE_EQUALS}}, {}};
    }
};

TEST_F(ListBoolCtx0EQSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar(std::vector<bool>{true, false})},
          {iop, 1_ts, mktscalar(std::vector<bool>{false})},
          {iop, 2_ts, mktscalar(std::vector<bool>{false, false, true})},
          {iop, 3_ts, mktscalar(std::vector<bool>{false, false, false})},
          {iop, 4_ts, mktscalar(std::vector<bool>{true, true, true})}},
          {
              mktscalar(std::vector<bool>{true, false}),
              mktscalar(std::vector<bool>{false, false, true}),
              mktscalar(std::vector<bool>{true, true, true})
          }
        }
    };

    run(data);
}

class ListBoolCtx0ContainsSearchTest : public CtxTest<ListBoolCtx0ContainsSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "lb"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_LIST_BOOL}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("ru");
        return t_config{{"lb"}, FILTER_OP_AND, {}, {term}, {{"lb", SEARCHTYPE_CONTAINS}}, {}};
    }
};

TEST_F(ListBoolCtx0ContainsSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar(std::vector<bool>{true, false})},
          {iop, 1_ts, mktscalar(std::vector<bool>{false})},
          {iop, 2_ts, mktscalar(std::vector<bool>{false, false, true})},
          {iop, 3_ts, mktscalar(std::vector<bool>{false, false, false})},
          {iop, 4_ts, mktscalar(std::vector<bool>{true, true, true})}},
          {
              mktscalar(std::vector<bool>{true, false}),
              mktscalar(std::vector<bool>{false, false, true}),
              mktscalar(std::vector<bool>{true, true, true})
          }
        }
    };

    run(data);
}

class ListBoolCtx0EdgeSearchTest : public CtxTest<ListBoolCtx0EdgeSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "lb"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_LIST_BOOL}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("tr");
        return t_config{{"lb"}, FILTER_OP_AND, {}, {term}, {{"lb", SEARCHTYPE_EDGE}}, {}};
    }
};

TEST_F(ListBoolCtx0EdgeSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar(std::vector<bool>{true, false})},
          {iop, 1_ts, mktscalar(std::vector<bool>{false})},
          {iop, 2_ts, mktscalar(std::vector<bool>{false, false, true})},
          {iop, 3_ts, mktscalar(std::vector<bool>{false, false, false})},
          {iop, 4_ts, mktscalar(std::vector<bool>{true, true, true})}},
          {
              mktscalar(std::vector<bool>{true, false}),
              mktscalar(std::vector<bool>{false, false, true}),
              mktscalar(std::vector<bool>{true, true, true})
          }
        }
    };

    run(data);
}

class ListBoolCtx0StartWithSearchTest : public CtxTest<ListBoolCtx0StartWithSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "lb"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_LIST_BOOL}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term1("tr");
        t_sterm term2("fals");
        return t_config{{"lb"}, FILTER_OP_AND, {}, {term1, term2}, {{"lb", SEARCHTYPE_STARTS_WITH}}, {}};
    }
};

TEST_F(ListBoolCtx0StartWithSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar(std::vector<bool>{true, false})},
          {iop, 1_ts, mktscalar(std::vector<bool>{false})},
          {iop, 2_ts, mktscalar(std::vector<bool>{false, false, true})},
          {iop, 3_ts, mktscalar(std::vector<bool>{false, false, false})},
          {iop, 4_ts, mktscalar(std::vector<bool>{true, true, true})}},
          {
              mktscalar(std::vector<bool>{true, false}),
              mktscalar(std::vector<bool>{false, false, true})
          }
        }
    };

    run(data);
}

class ListStringCtx0NullSearchTest : public CtxTest<ListStringCtx0NullSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "ls"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_LIST_STR}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("3RP64CUV275DPZNL10GBM8FCINGCKA");
        return t_config{{"ls"}, FILTER_OP_AND, {}, {term}, {{"ls", SEARCHTYPE_NULL}}, {}};
    }
};

TEST_F(ListStringCtx0NullSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar(std::vector<std::string>{"3RP64CUV275DPZNL10GBM8FCINGCKA", "3YTIQ7TAFGPIF6TIR3RYZCVVJ0XOR1"})},
          {iop, 1_ts, mktscalar(std::vector<std::string>{"3YTIQ7TAFGPIF6TIR3RYZCVVJ0XOR1"})},
          {iop, 2_ts, mktscalar(std::vector<std::string>{"3HKHGGG7TGX8JKIFT8ETFFZ97RZRIA", "33ZVMC10IH23QDZSYCI984SJMQUMG9", "3RP64CUV275DPZNL10GBM8FCINGCKA"})},
          {iop, 3_ts, mktscalar(std::vector<std::string>{"33ZVMC10IH23QDZSYCI984SJMQUMG9", "3EU8AFIIJY2GE1IMHDGE7KDMBGOJ0F", "3HKHGGG7TGX8JKIFT8ETFFZ97RZRIA"})},
          {iop, 4_ts, mktscalar(std::vector<std::string>{"3RP64CUV275DPZNL10GBM8FCINGCKA"})}},
          {}
        }
    };

    run(data);
}

class ListStringCtx0EQSearchTest : public CtxTest<ListStringCtx0EQSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "ls"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_LIST_STR}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("3RP64CUV275DPZNL10GBM8FCINGCKA");
        return t_config{{"ls"}, FILTER_OP_AND, {}, {term}, {{"ls", SEARCHTYPE_EQUALS}}, {}};
    }
};

TEST_F(ListStringCtx0EQSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar(std::vector<std::string>{"3RP64CUV275DPZNL10GBM8FCINGCKA", "3YTIQ7TAFGPIF6TIR3RYZCVVJ0XOR1"})},
          {iop, 1_ts, mktscalar(std::vector<std::string>{"3YTIQ7TAFGPIF6TIR3RYZCVVJ0XOR1"})},
          {iop, 2_ts, mktscalar(std::vector<std::string>{"3HKHGGG7TGX8JKIFT8ETFFZ97RZRIA", "33ZVMC10IH23QDZSYCI984SJMQUMG9", "3RP64CUV275DPZNL10GBM8FCINGCKA"})},
          {iop, 3_ts, mktscalar(std::vector<std::string>{"33ZVMC10IH23QDZSYCI984SJMQUMG9", "3EU8AFIIJY2GE1IMHDGE7KDMBGOJ0F", "3HKHGGG7TGX8JKIFT8ETFFZ97RZRIA"})},
          {iop, 4_ts, mktscalar(std::vector<std::string>{"3RP64CUV275DPZNL10GBM8FCINGCKA"})}},
          {
              mktscalar(std::vector<std::string>{"3RP64CUV275DPZNL10GBM8FCINGCKA", "3YTIQ7TAFGPIF6TIR3RYZCVVJ0XOR1"}),
              mktscalar(std::vector<std::string>{"3HKHGGG7TGX8JKIFT8ETFFZ97RZRIA", "33ZVMC10IH23QDZSYCI984SJMQUMG9", "3RP64CUV275DPZNL10GBM8FCINGCKA"}),
              mktscalar(std::vector<std::string>{"3RP64CUV275DPZNL10GBM8FCINGCKA"})
          }
        }
    };

    run(data);
}

class ListStringCtx0ContainsSearchTest : public CtxTest<ListStringCtx0ContainsSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "ls"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_LIST_STR}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("DPZNL10GBM8FC");
        return t_config{{"ls"}, FILTER_OP_AND, {}, {term}, {{"ls", SEARCHTYPE_CONTAINS}}, {}};
    }
};

TEST_F(ListStringCtx0ContainsSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar(std::vector<std::string>{"3RP64CUV275DPZNL10GBM8FCINGCKA", "3YTIQ7TAFGPIF6TIR3RYZCVVJ0XOR1"})},
          {iop, 1_ts, mktscalar(std::vector<std::string>{"3YTIQ7TAFGPIF6TIR3RYZCVVJ0XOR1"})},
          {iop, 2_ts, mktscalar(std::vector<std::string>{"3HKHGGG7TGX8JKIFT8ETFFZ97RZRIA", "33ZVMC10IH23QDZSYCI984SJMQUMG9", "3RP64CUV275DPZNVL10GBM8FCINGCKA"})},
          {iop, 3_ts, mktscalar(std::vector<std::string>{"33ZVMC10IHDPZNL1M0GBM8FC23QDZSYCI984SJMQUMG9", "3EU8AFIIJY2GE1IMHDGE7KDMBGOJ0F", "3HKHGGG7TGX8JKIFT8ETFFZ97RZRIA"})},
          {iop, 4_ts, mktscalar(std::vector<std::string>{"3RP64CUV275DPZNL10GBM8FCINGCKA 3HKHGGG7TGX8JKIFT8ETFFZ97RZRIA"})}},
          {
              mktscalar(std::vector<std::string>{"3RP64CUV275DPZNL10GBM8FCINGCKA", "3YTIQ7TAFGPIF6TIR3RYZCVVJ0XOR1"}),
              mktscalar(std::vector<std::string>{"3RP64CUV275DPZNL10GBM8FCINGCKA 3HKHGGG7TGX8JKIFT8ETFFZ97RZRIA"})
          }
        }
    };

    run(data);
}

class ListStringCtx0EdgeSearchTest : public CtxTest<ListStringCtx0EdgeSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "ls"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_LIST_STR}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term1("DPZNL1");
        t_sterm term2("0GBM8FC");
        return t_config{{"ls"}, FILTER_OP_AND, {}, {term1, term2}, {{"ls", SEARCHTYPE_EDGE}}, {}};
    }
};

TEST_F(ListStringCtx0EdgeSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar(std::vector<std::string>{"3RP64CUV275 DPZNL1 INGCKA", "3YTIQ7TAFGPIF6TI 0GBM8FCR3RYZCVVJ0XOR1"})},
          {iop, 1_ts, mktscalar(std::vector<std::string>{"3YTIQ7TAFGPIF6TIR3RYZCVVJ0XOR1"})},
          {iop, 2_ts, mktscalar(std::vector<std::string>{"3HKHGGG7TGX8JKIFT8ETFFZ97RZRIA", "33ZVMC10IH23QDZSYCI984SJMQUMG9", "3RP64CUV275DPZNVL10GBM8FCINGCKA"})},
          {iop, 3_ts, mktscalar(std::vector<std::string>{"33ZVMC10I HDPZNL1M23QDZSYCI984SJMQUMG9", "3EU8AFIIJY 0GBM8FC 2GE1IMHDGE7KDMBGOJ0F", "3HKHGGG7TGX8JKIFT8ETFFZ97RZRIA"})},
          {iop, 4_ts, mktscalar(std::vector<std::string>{"3RP64CUV275 DPZNL10GBM8FCINGCKA 3HKHGGG7TGX8JKIFT8ETFFZ97RZRIA"})}},
          {
              mktscalar(std::vector<std::string>{"3RP64CUV275 DPZNL1 INGCKA", "3YTIQ7TAFGPIF6TI 0GBM8FCR3RYZCVVJ0XOR1"})
          }
        }
    };

    run(data);
}

class ListStringCtx0StartWithSearchTest : public CtxTest<ListStringCtx0StartWithSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "ls"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_LIST_STR}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term1("DPZNL1");
        t_sterm term2("0GBM8FC");
        return t_config{{"ls"}, FILTER_OP_AND, {}, {term1, term2}, {{"ls", SEARCHTYPE_STARTS_WITH}}, {}};
    }
};

TEST_F(ListStringCtx0StartWithSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar(std::vector<std::string>{"3RP64CUV275 DPZNL1 INGCKA", "3YTIQ7TAFGPIF6TI 0GBM8FCR3RYZCVVJ0XOR1"})},
          {iop, 1_ts, mktscalar(std::vector<std::string>{"DPZNL1 3YTIQ", "0GBM8FC"})},
          {iop, 2_ts, mktscalar(std::vector<std::string>{"3HKHGGG7TGX8JKIFT8ETFFZ97RZRIA", "DPZNL1 33ZVMC10IH2 3QDZSYCI984SJMQUMG9", "3RP64CUV275DPZNVL1 0GBM8FCINGCKA"})},
          {iop, 3_ts, mktscalar(std::vector<std::string>{"0GBM8FC 33ZVMC10I HDPZNL", "3EU8AFIIJY DPZNL1 2GE1IMHDGE7KDMBGOJ0F", "3HKHGGG7TGX8JKIFT8ETFFZ97RZRIA"})},
          {iop, 4_ts, mktscalar(std::vector<std::string>{"0GBM8FCV275 DPZNL10GBM8FCINGCKA 97RZRIA", "DPZNL132"})}},
          {
              mktscalar(std::vector<std::string>{"DPZNL1 3YTIQ", "0GBM8FC"}),
              mktscalar(std::vector<std::string>{"0GBM8FCV275 DPZNL10GBM8FCINGCKA 97RZRIA", "DPZNL132"})
          }
        }
    };

    run(data);
}

class ListI64Ctx0NullSearchTest : public CtxTest<ListI64Ctx0NullSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "li"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_LIST_INT64}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("123");
        return t_config{{"li"}, FILTER_OP_AND, {}, {term}, {{"li", SEARCHTYPE_NULL}}, {}};
    }
};

TEST_F(ListI64Ctx0NullSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar(std::vector<std::int64_t>{123, 54})},
          {iop, 1_ts, mktscalar(std::vector<std::int64_t>{-32})},
          {iop, 2_ts, mktscalar(std::vector<std::int64_t>{555, 1234, 321})},
          {iop, 3_ts, mktscalar(std::vector<std::int64_t>{54, -23, 1900})},
          {iop, 4_ts, mktscalar(std::vector<std::int64_t>{123})}},
          {}
        }
    };

    run(data);
}

class ListI64Ctx0EQSearchTest : public CtxTest<ListI64Ctx0EQSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "li"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_LIST_INT64}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("123");
        return t_config{{"li"}, FILTER_OP_AND, {}, {term}, {{"li", SEARCHTYPE_EQUALS}}, {}};
    }
};

TEST_F(ListI64Ctx0EQSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar(std::vector<std::int64_t>{123, 54})},
          {iop, 1_ts, mktscalar(std::vector<std::int64_t>{-32})},
          {iop, 2_ts, mktscalar(std::vector<std::int64_t>{555, 1234, 321})},
          {iop, 3_ts, mktscalar(std::vector<std::int64_t>{54, -23, 1900})},
          {iop, 4_ts, mktscalar(std::vector<std::int64_t>{123})}},
          {
              mktscalar(std::vector<std::int64_t>{123, 54}),
              mktscalar(std::vector<std::int64_t>{123})
          }
        }
    };

    run(data);
}

class ListI64Ctx0ContainsSearchTest : public CtxTest<ListI64Ctx0ContainsSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "li"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_LIST_INT64}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("23");
        return t_config{{"li"}, FILTER_OP_AND, {}, {term}, {{"li", SEARCHTYPE_CONTAINS}}, {}};
    }
};

TEST_F(ListI64Ctx0ContainsSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar(std::vector<std::int64_t>{123, 54})},
          {iop, 1_ts, mktscalar(std::vector<std::int64_t>{-32})},
          {iop, 2_ts, mktscalar(std::vector<std::int64_t>{555, 12434, 321})},
          {iop, 3_ts, mktscalar(std::vector<std::int64_t>{54, -23, 1900})},
          {iop, 4_ts, mktscalar(std::vector<std::int64_t>{123})}},
          {
              mktscalar(std::vector<std::int64_t>{123, 54}),
              mktscalar(std::vector<std::int64_t>{54, -23, 1900}),
              mktscalar(std::vector<std::int64_t>{123})
          }
        }
    };

    run(data);
}

class ListI64Ctx0EdgeSearchTest : public CtxTest<ListI64Ctx0EdgeSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "li"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_LIST_INT64}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("23");
        return t_config{{"li"}, FILTER_OP_AND, {}, {term}, {{"li", SEARCHTYPE_EDGE}}, {}};
    }
};

TEST_F(ListI64Ctx0EdgeSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar(std::vector<std::int64_t>{123, 54})},
          {iop, 1_ts, mktscalar(std::vector<std::int64_t>{-32})},
          {iop, 2_ts, mktscalar(std::vector<std::int64_t>{555, 12434, 23})},
          {iop, 3_ts, mktscalar(std::vector<std::int64_t>{54, -23, 1900})},
          {iop, 4_ts, mktscalar(std::vector<std::int64_t>{123})}},
          {
              mktscalar(std::vector<std::int64_t>{555, 12434, 23})
          }
        }
    };

    run(data);
}

class ListI64Ctx0EdgeStartWithTest : public CtxTest<ListI64Ctx0EdgeStartWithTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "li"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_LIST_INT64}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term1("-23");
        t_sterm term2("47");
        return t_config{{"li"}, FILTER_OP_AND, {}, {term1, term2}, {{"li", SEARCHTYPE_STARTS_WITH}}, {}};
    }
};

TEST_F(ListI64Ctx0EdgeStartWithTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar(std::vector<std::int64_t>{23, 47})},
          {iop, 1_ts, mktscalar(std::vector<std::int64_t>{-32})},
          {iop, 2_ts, mktscalar(std::vector<std::int64_t>{555, 12434, -23})},
          {iop, 3_ts, mktscalar(std::vector<std::int64_t>{54, -23, 1900, 4789})},
          {iop, 4_ts, mktscalar(std::vector<std::int64_t>{472, 23})}},
          {
              mktscalar(std::vector<std::int64_t>{54, -23, 1900, 4789})
          }
        }
    };

    run(data);
}

class ListF64Ctx0NullSearchTest : public CtxTest<ListF64Ctx0NullSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "lf"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_LIST_FLOAT64}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("54.23");
        return t_config{{"lf"}, FILTER_OP_AND, {}, {term}, {{"lf", SEARCHTYPE_NULL}}, {}};
    }
};

TEST_F(ListF64Ctx0NullSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar(std::vector<double>{54.34, 54.23})},
          {iop, 1_ts, mktscalar(std::vector<double>{-32.001})},
          {iop, 2_ts, mktscalar(std::vector<double>{555, 54, -54.23})},
          {iop, 3_ts, mktscalar(std::vector<double>{54.23, -23.23, 1900})},
          {iop, 4_ts, mktscalar(std::vector<double>{123.34})}},
          {}
        }
    };

    run(data);
}

class ListF64Ctx0EQSearchTest : public CtxTest<ListF64Ctx0EQSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "lf"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_LIST_FLOAT64}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("54.23");
        return t_config{{"lf"}, FILTER_OP_AND, {}, {term}, {{"lf", SEARCHTYPE_EQUALS}}, {}};
    }
};

TEST_F(ListF64Ctx0EQSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar(std::vector<double>{54.34, 54.23})},
          {iop, 1_ts, mktscalar(std::vector<double>{-32.001})},
          {iop, 2_ts, mktscalar(std::vector<double>{555, 54, -54.23})},
          {iop, 3_ts, mktscalar(std::vector<double>{54.23, -23.23, 1900})},
          {iop, 4_ts, mktscalar(std::vector<double>{123.34})}},
          {
              mktscalar(std::vector<double>{54.34, 54.23}),
              mktscalar(std::vector<double>{54.23, -23.23, 1900})
          }
        }
    };

    run(data);
}

class ListF64Ctx0ContainsSearchTest : public CtxTest<ListF64Ctx0ContainsSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "lf"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_LIST_FLOAT64}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("4.2");
        return t_config{{"lf"}, FILTER_OP_AND, {}, {term}, {{"lf", SEARCHTYPE_CONTAINS}}, {}};
    }
};

TEST_F(ListF64Ctx0ContainsSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar(std::vector<double>{54.34, 54.23})},
          {iop, 1_ts, mktscalar(std::vector<double>{-32.001})},
          {iop, 2_ts, mktscalar(std::vector<double>{555, 54, -54.23})},
          {iop, 3_ts, mktscalar(std::vector<double>{54.123, -23.23, 1900})},
          {iop, 4_ts, mktscalar(std::vector<double>{123.34})}},
          {
              mktscalar(std::vector<double>{54.34, 54.23}),
              mktscalar(std::vector<double>{555, 54, -54.23})
          }
        }
    };

    run(data);
}

class ListF64Ctx0EdgeSearchTest : public CtxTest<ListF64Ctx0EdgeSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "lf"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_LIST_FLOAT64}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("4.2");
        return t_config{{"lf"}, FILTER_OP_AND, {}, {term}, {{"lf", SEARCHTYPE_EDGE}}, {}};
    }
};

TEST_F(ListF64Ctx0EdgeSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar(std::vector<double>{54.34, 4.23})},
          {iop, 1_ts, mktscalar(std::vector<double>{-32.001})},
          {iop, 2_ts, mktscalar(std::vector<double>{555, 54, -54.23})},
          {iop, 3_ts, mktscalar(std::vector<double>{54.123, -23.23, 1900})},
          {iop, 4_ts, mktscalar(std::vector<double>{123.34})}},
          {
              mktscalar(std::vector<double>{54.34, 4.23})
          }
        }
    };

    run(data);
}

class ListF64Ctx0StartWithSearchTest : public CtxTest<ListF64Ctx0StartWithSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "lf"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_LIST_FLOAT64}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term1("4.2");
        t_sterm term2("-6.2");
        return t_config{{"lf"}, FILTER_OP_AND, {}, {term1, term2}, {{"lf", SEARCHTYPE_STARTS_WITH}}, {}};
    }
};

TEST_F(ListF64Ctx0StartWithSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar(std::vector<double>{54.34, 4.23, 6.2})},
          {iop, 1_ts, mktscalar(std::vector<double>{-32.001})},
          {iop, 2_ts, mktscalar(std::vector<double>{555, 54, -54.23})},
          {iop, 3_ts, mktscalar(std::vector<double>{4.23, -23.23, 1900, -6.254})},
          {iop, 4_ts, mktscalar(std::vector<double>{-6.24, 24.2})}},
          {
              mktscalar(std::vector<double>{4.23, -23.23, 1900, -6.254})
          }
        }
    };

    run(data);
}

class ListDateCtx0NullSearchTest : public CtxTest<ListDateCtx0NullSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "ld"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_LIST_DATE}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("2016-03-05");
        return t_config{{"ld"}, FILTER_OP_AND, {}, {term}, {{"ld", SEARCHTYPE_NULL}}, {}};
    }
};

TEST_F(ListDateCtx0NullSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar(std::vector<t_date>{t_date(2016, 3, 5), t_date(2015, 10, 25)})},
          {iop, 1_ts, mktscalar(std::vector<t_date>{t_date(2015, 5, 25)})},
          {iop, 2_ts, mktscalar(std::vector<t_date>{t_date(2015, 3, 5), t_date(2016, 11, 20), t_date(2000, 3, 10)})},
          {iop, 3_ts, mktscalar(std::vector<t_date>{t_date(2017, 3, 15), t_date(2001, 2, 5), t_date(2011, 12, 23)})},
          {iop, 4_ts, mktscalar(std::vector<t_date>{t_date(2015, 3, 6)})}},
          {}
        }
    };

    run(data);
}

class ListDateCtx0EQSearchTest : public CtxTest<ListDateCtx0EQSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "ld"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_LIST_DATE}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("Mar 5, 2016");
        return t_config{{"ld"}, FILTER_OP_AND, {}, {term}, {{"ld", SEARCHTYPE_EQUALS}}, {}};
    }
};

TEST_F(ListDateCtx0EQSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar(std::vector<t_date>{t_date(2016, 3, 5), t_date(2015, 10, 25)})},
          {iop, 1_ts, mktscalar(std::vector<t_date>{t_date(2015, 5, 25)})},
          {iop, 2_ts, mktscalar(std::vector<t_date>{t_date(2015, 3, 5), t_date(2016, 11, 20), t_date(2000, 3, 10)})},
          {iop, 3_ts, mktscalar(std::vector<t_date>{t_date(2017, 3, 15), t_date(2001, 2, 5), t_date(2011, 12, 23)})},
          {iop, 4_ts, mktscalar(std::vector<t_date>{t_date(2015, 3, 6)})}},
          {
              mktscalar(std::vector<t_date>{t_date(2016, 3, 5), t_date(2015, 10, 25)})
          }
        }
    };

    run(data);
}

class ListDateCtx0ContainsSearchTest : public CtxTest<ListDateCtx0ContainsSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "ld"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_LIST_DATE}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("ar 5,");
        return t_config{{"ld"}, FILTER_OP_AND, {}, {term}, {{"ld", SEARCHTYPE_CONTAINS}}, {}};
    }
};

TEST_F(ListDateCtx0ContainsSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar(std::vector<t_date>{t_date(2016, 3, 5), t_date(2015, 10, 25)})},
          {iop, 1_ts, mktscalar(std::vector<t_date>{t_date(2015, 5, 25)})},
          {iop, 2_ts, mktscalar(std::vector<t_date>{t_date(2015, 3, 5), t_date(2016, 11, 20), t_date(2000, 3, 10)})},
          {iop, 3_ts, mktscalar(std::vector<t_date>{t_date(2017, 3, 15), t_date(2001, 2, 5), t_date(2011, 12, 23)})},
          {iop, 4_ts, mktscalar(std::vector<t_date>{t_date(2015, 3, 6)})}},
          {
              mktscalar(std::vector<t_date>{t_date(2016, 3, 5), t_date(2015, 10, 25)}),
              mktscalar(std::vector<t_date>{t_date(2015, 3, 5), t_date(2016, 11, 20), t_date(2000, 3, 10)})
          }
        }
    };

    run(data);
}

class ListDateCtx0EdgeSearchTest : public CtxTest<ListDateCtx0EdgeSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "ld"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_LIST_DATE}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term1("mar");
        t_sterm term2("2016");
        return t_config{{"ld"}, FILTER_OP_AND, {}, {term1, term2}, {{"ld", SEARCHTYPE_EDGE}}, {}};
    }
};

TEST_F(ListDateCtx0EdgeSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar(std::vector<t_date>{t_date(2016, 3, 5), t_date(2015, 10, 25)})},
          {iop, 1_ts, mktscalar(std::vector<t_date>{t_date(2015, 5, 25)})},
          {iop, 2_ts, mktscalar(std::vector<t_date>{t_date(2015, 3, 5), t_date(2016, 11, 20), t_date(2000, 3, 10)})},
          {iop, 3_ts, mktscalar(std::vector<t_date>{t_date(2017, 3, 15), t_date(2001, 2, 5), t_date(2011, 12, 23)})},
          {iop, 4_ts, mktscalar(std::vector<t_date>{t_date(2015, 3, 6)})}},
          {
              mktscalar(std::vector<t_date>{t_date(2016, 3, 5), t_date(2015, 10, 25)}),
              mktscalar(std::vector<t_date>{t_date(2015, 3, 5), t_date(2016, 11, 20), t_date(2000, 3, 10)})
          }
        }
    };

    run(data);
}

class ListDateCtx0StartWithSearchTest : public CtxTest<ListDateCtx0StartWithSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "ld"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_LIST_DATE}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("Mar");
        return t_config{{"ld"}, FILTER_OP_AND, {}, {term}, {{"ld", SEARCHTYPE_STARTS_WITH}}, {}};
    }
};

TEST_F(ListDateCtx0StartWithSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar(std::vector<t_date>{t_date(2016, 5, 5), t_date(2015, 10, 25)})},
          {iop, 1_ts, mktscalar(std::vector<t_date>{t_date(2015, 5, 25)})},
          {iop, 2_ts, mktscalar(std::vector<t_date>{t_date(2015, 3, 5), t_date(2016, 11, 20), t_date(2000, 3, 10)})},
          {iop, 3_ts, mktscalar(std::vector<t_date>{t_date(2017, 3, 15), t_date(2001, 2, 5), t_date(2011, 12, 23)})},
          {iop, 4_ts, mktscalar(std::vector<t_date>{t_date(2016, 3, 6)})}},
          {
              mktscalar(std::vector<t_date>{t_date(2015, 3, 5), t_date(2016, 11, 20), t_date(2000, 3, 10)}),
              mktscalar(std::vector<t_date>{t_date(2017, 3, 15), t_date(2001, 2, 5), t_date(2011, 12, 23)}),
              mktscalar(std::vector<t_date>{t_date(2016, 3, 6)})
          }
        }
    };

    run(data);
}

class ListTimeCtx0NullSearchTest : public CtxTest<ListTimeCtx0NullSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "lt"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_LIST_TIME}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("2015-03-05 01:12:00");
        return t_config{{"lt"}, FILTER_OP_AND, {}, {term}, {{"lt", SEARCHTYPE_NULL}}, {}};
    }
};

TEST_F(ListTimeCtx0NullSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar(std::vector<t_time>{t_time(2016, 3, 5, 1, 12, 54), t_time(2015, 10, 25, 1, 12, 23)})},
          {iop, 1_ts, mktscalar(std::vector<t_time>{t_time(2015, 5, 25, 1, 12, 0)})},
          {iop, 2_ts, mktscalar(std::vector<t_time>{t_time(2015, 3, 5, 1, 12, 0), t_time(2016, 11, 20, 21, 12, 0), t_time(2000, 3, 10, 1, 12, 55)})},
          {iop, 3_ts, mktscalar(std::vector<t_time>{t_time(2017, 3, 15, 1, 22, 0), t_time(2001, 2, 5, 21, 12, 0), t_time(2011, 12, 23, 12, 12, 11)})},
          {iop, 4_ts, mktscalar(std::vector<t_time>{t_time(2015, 3, 5, 1, 12, 12)})}},
          {}
        }
    };

    run(data);
}

class ListTimeCtx0EQSearchTest : public CtxTest<ListTimeCtx0EQSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "lt"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_LIST_TIME}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("2015-03-05 01:12:00");
        return t_config{{"lt"}, FILTER_OP_AND, {}, {term}, {{"lt", SEARCHTYPE_EQUALS}}, {}};
    }
};

TEST_F(ListTimeCtx0EQSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar(std::vector<t_time>{t_time(2016, 3, 5, 1, 12, 54), t_time(2015, 10, 25, 1, 12, 23)})},
          {iop, 1_ts, mktscalar(std::vector<t_time>{t_time(2015, 5, 25, 1, 12, 0)})},
          {iop, 2_ts, mktscalar(std::vector<t_time>{t_time(2015, 3, 5, 1, 12, 0), t_time(2016, 11, 20, 21, 12, 0), t_time(2000, 3, 10, 1, 12, 55)})},
          {iop, 3_ts, mktscalar(std::vector<t_time>{t_time(2017, 3, 15, 1, 22, 0), t_time(2001, 2, 5, 21, 12, 0), t_time(2011, 12, 23, 12, 12, 11)})},
          {iop, 4_ts, mktscalar(std::vector<t_time>{t_time(2015, 3, 5, 1, 12, 12)})}},
          {
              mktscalar(std::vector<t_time>{t_time(2015, 3, 5, 1, 12, 0), t_time(2016, 11, 20, 21, 12, 0), t_time(2000, 3, 10, 1, 12, 55)}),
          }
        }
    };

    run(data);
}

class ListTimeCtx0ContainsSearchTest : public CtxTest<ListTimeCtx0ContainsSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "lt"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_LIST_TIME}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("-05 01:12");
        return t_config{{"lt"}, FILTER_OP_AND, {}, {term}, {{"lt", SEARCHTYPE_CONTAINS}}, {}};
    }
};

TEST_F(ListTimeCtx0ContainsSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar(std::vector<t_time>{t_time(2016, 3, 5, 1, 12, 54), t_time(2015, 10, 25, 1, 12, 23)})},
          {iop, 1_ts, mktscalar(std::vector<t_time>{t_time(2015, 5, 25, 1, 12, 0)})},
          {iop, 2_ts, mktscalar(std::vector<t_time>{t_time(2015, 3, 7, 1, 12, 0), t_time(2016, 11, 20, 21, 12, 0), t_time(2000, 3, 5, 1, 12, 55)})},
          {iop, 3_ts, mktscalar(std::vector<t_time>{t_time(2017, 3, 15, 1, 22, 0), t_time(2001, 2, 5, 21, 12, 0), t_time(2011, 12, 23, 12, 12, 11)})},
          {iop, 4_ts, mktscalar(std::vector<t_time>{t_time(2015, 3, 5, 1, 12, 12)})}},
          {
              mktscalar(std::vector<t_time>{t_time(2016, 3, 5, 1, 12, 54), t_time(2015, 10, 25, 1, 12, 23)}),
              mktscalar(std::vector<t_time>{t_time(2015, 3, 7, 1, 12, 0), t_time(2016, 11, 20, 21, 12, 0), t_time(2000, 3, 5, 1, 12, 55)}),
              mktscalar(std::vector<t_time>{t_time(2015, 3, 5, 1, 12, 12)})
          }
        }
    };

    run(data);
}

class ListTimeCtx0EdgeSearchTest : public CtxTest<ListTimeCtx0EdgeSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "lt"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_LIST_TIME}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term1("01:12");
        t_sterm term2("2016");
        return t_config{{"lt"}, FILTER_OP_AND, {}, {term1, term2}, {{"lt", SEARCHTYPE_EDGE}}, {}};
    }
};

TEST_F(ListTimeCtx0EdgeSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar(std::vector<t_time>{t_time(2016, 3, 5, 1, 52, 54), t_time(2015, 10, 25, 1, 12, 23)})},
          {iop, 1_ts, mktscalar(std::vector<t_time>{t_time(2015, 5, 25, 1, 12, 0)})},
          {iop, 2_ts, mktscalar(std::vector<t_time>{t_time(2015, 3, 7, 1, 12, 0), t_time(2016, 11, 20, 21, 12, 0), t_time(2000, 3, 5, 1, 12, 55)})},
          {iop, 3_ts, mktscalar(std::vector<t_time>{t_time(2017, 3, 15, 1, 22, 0), t_time(2001, 2, 5, 21, 12, 0), t_time(2011, 12, 23, 12, 12, 11)})},
          {iop, 4_ts, mktscalar(std::vector<t_time>{t_time(2015, 3, 5, 1, 12, 12)})}},
          {
              mktscalar(std::vector<t_time>{t_time(2016, 3, 5, 1, 52, 54), t_time(2015, 10, 25, 1, 12, 23)}),
              mktscalar(std::vector<t_time>{t_time(2015, 3, 7, 1, 12, 0), t_time(2016, 11, 20, 21, 12, 0), t_time(2000, 3, 5, 1, 12, 55)})
          }
        }
    };

    run(data);
}

class ListTimeCtx0StartWithSearchTest : public CtxTest<ListTimeCtx0StartWithSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "lt"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_LIST_TIME}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("2016");
        return t_config{{"lt"}, FILTER_OP_AND, {}, {term}, {{"lt", SEARCHTYPE_STARTS_WITH}}, {}};
    }
};

TEST_F(ListTimeCtx0StartWithSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar(std::vector<t_time>{t_time(2016, 3, 5, 1, 52, 54), t_time(2015, 4, 25, 1, 12, 23)})},
          {iop, 1_ts, mktscalar(std::vector<t_time>{t_time(2015, 5, 25, 1, 12, 0)})},
          {iop, 2_ts, mktscalar(std::vector<t_time>{t_time(2015, 3, 7, 1, 12, 0), t_time(2019, 11, 20, 21, 12, 0), t_time(2000, 3, 5, 1, 12, 55)})},
          {iop, 3_ts, mktscalar(std::vector<t_time>{t_time(2017, 3, 15, 1, 22, 0), t_time(2001, 2, 5, 4, 4, 0), t_time(2010, 12, 23, 12, 42, 11)})},
          {iop, 4_ts, mktscalar(std::vector<t_time>{t_time(2016, 4, 5, 1, 12, 12)})}},
          {
              mktscalar(std::vector<t_time>{t_time(2016, 3, 5, 1, 52, 54), t_time(2015, 4, 25, 1, 12, 23)}),
              mktscalar(std::vector<t_time>{t_time(2016, 4, 5, 1, 12, 12)})
          }
        }
    };

    run(data);
}

class ListDurationCtx0NullSearchTest : public CtxTest<ListDurationCtx0NullSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "ld"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_LIST_DURATION}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("1:12:00");
        return t_config{{"ld"}, FILTER_OP_AND, {}, {term}, {{"ld", SEARCHTYPE_NULL}}, {}};
    }
};

TEST_F(ListDurationCtx0NullSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar(std::vector<t_duration>{t_duration(1, 12, 54), t_duration(1, 12, 23)})},
          {iop, 1_ts, mktscalar(std::vector<t_duration>{t_duration(1, 12, 0)})},
          {iop, 2_ts, mktscalar(std::vector<t_duration>{t_duration(1, 12, 0), t_duration(21, 12, 0), t_duration(1, 12, 55)})},
          {iop, 3_ts, mktscalar(std::vector<t_duration>{t_duration(1, 22, 0), t_duration(21, 12, 0), t_duration(12, 12, 11)})},
          {iop, 4_ts, mktscalar(std::vector<t_duration>{t_duration(1, 12, 12)})}},
          {}
        }
    };

    run(data);
}

class ListDurationCtx0EQSearchTest : public CtxTest<ListDurationCtx0EQSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "ld"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_LIST_DURATION}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("01:12:10");
        return t_config{{"ld"}, FILTER_OP_AND, {}, {term}, {{"ld", SEARCHTYPE_EQUALS}}, {}};
    }
};

TEST_F(ListDurationCtx0EQSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar(std::vector<t_duration>{t_duration(1, 12, 54), t_duration(1, 12, 23)})},
          {iop, 1_ts, mktscalar(std::vector<t_duration>{t_duration(1, 12, 10)})},
          {iop, 2_ts, mktscalar(std::vector<t_duration>{t_duration(1, 12, 10), t_duration(21, 12, 0), t_duration(1, 12, 55)})},
          {iop, 3_ts, mktscalar(std::vector<t_duration>{t_duration(1, 22, 0), t_duration(21, 12, 0), t_duration(12, 12, 11)})},
          {iop, 4_ts, mktscalar(std::vector<t_duration>{t_duration(1, 12, 12)})}},
          {
              mktscalar(std::vector<t_duration>{t_duration(1, 12, 10)}),
              mktscalar(std::vector<t_duration>{t_duration(1, 12, 0), t_duration(21, 12, 0), t_duration(1, 12, 55)})
          }
        }
    };

    run(data);
}

class ListDurationCtx0ContainsSearchTest : public CtxTest<ListDurationCtx0ContainsSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "ld"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_LIST_DURATION}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("12:0");
        return t_config{{"ld"}, FILTER_OP_AND, {}, {term}, {{"ld", SEARCHTYPE_CONTAINS}}, {}};
    }
};

TEST_F(ListDurationCtx0ContainsSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar(std::vector<t_duration>{t_duration(1, 12, 54), t_duration(1, 12, 23)})},
          {iop, 1_ts, mktscalar(std::vector<t_duration>{t_duration(1, 12, 20)})},
          {iop, 2_ts, mktscalar(std::vector<t_duration>{t_duration(1, 12, 0), t_duration(21, 12, 0), t_duration(1, 12, 55)})},
          {iop, 3_ts, mktscalar(std::vector<t_duration>{t_duration(1, 22, 0), t_duration(21, 12, 3), t_duration(12, 12, 11)})},
          {iop, 4_ts, mktscalar(std::vector<t_duration>{t_duration(1, 12, 12)})}},
          {
              mktscalar(std::vector<t_duration>{t_duration(1, 12, 0), t_duration(21, 12, 0), t_duration(1, 12, 55)}),
              mktscalar(std::vector<t_duration>{t_duration(1, 22, 0), t_duration(21, 12, 3), t_duration(12, 12, 11)})
          }
        }
    };

    run(data);
}

class ListDurationCtx0EdgeSearchTest : public CtxTest<ListDurationCtx0EdgeSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "ld"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_LIST_DURATION}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("02:0");
        return t_config{{"ld"}, FILTER_OP_AND, {}, {term}, {{"ld", SEARCHTYPE_EDGE}}, {}};
    }
};

TEST_F(ListDurationCtx0EdgeSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar(std::vector<t_duration>{t_duration(1, 12, 54), t_duration(1, 12, 23)})},
          {iop, 1_ts, mktscalar(std::vector<t_duration>{t_duration(1, 12, 20)})},
          {iop, 2_ts, mktscalar(std::vector<t_duration>{t_duration(1, 12, 0), t_duration(21, 12, 0), t_duration(1, 12, 55)})},
          {iop, 3_ts, mktscalar(std::vector<t_duration>{t_duration(1, 22, 0), t_duration(21, 12, 3), t_duration(2, 2, 11)})},
          {iop, 4_ts, mktscalar(std::vector<t_duration>{t_duration(1, 12, 12)})}},
          {
              mktscalar(std::vector<t_duration>{t_duration(1, 22, 0), t_duration(21, 12, 3), t_duration(12, 2, 11)})
          }
        }
    };

    run(data);
}

class LDurationCtx0StartWithSearchTest : public CtxTest<LDurationCtx0StartWithSearchTest, t_ctx0>
{
public:
    t_schema
    get_ischema()
    {
        return t_schema{{"psp_op", "psp_pkey", "ld"},
            {DTYPE_UINT8, DTYPE_INT64, DTYPE_LIST_DURATION}, {}};
    }

    t_config
    get_config()
    {
        t_sterm term("12:");
        return t_config{{"ld"}, FILTER_OP_AND, {}, {term}, {{"ld", SEARCHTYPE_STARTS_WITH}}, {}};
    }
};

TEST_F(LDurationCtx0StartWithSearchTest, test_1) {
    t_testdata data{
        {{{iop, 0_ts, mktscalar(std::vector<t_duration>{t_duration(1, 12, 54), t_duration(1, 12, 23)})},
          {iop, 1_ts, mktscalar(std::vector<t_duration>{t_duration(2, 4, 20), t_duration(13, 12, 20)})},
          {iop, 2_ts, mktscalar(std::vector<t_duration>{t_duration(1, 12, 2), t_duration(21, 12, 32), t_duration(1, 12, 55)})},
          {iop, 3_ts, mktscalar(std::vector<t_duration>{t_duration(2, 3, 1), t_duration(21, 12, 3), t_duration(12, 2, 11)})},
          {iop, 4_ts, mktscalar(std::vector<t_duration>{t_duration(1, 12, 12)})}},
          {
              mktscalar(std::vector<t_duration>{t_duration(2, 3, 1), t_duration(21, 12, 3), t_duration(12, 2, 11)})
          }
        }
    };

    run(data);
};