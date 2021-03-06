import {CstParser} from "chevrotain";
import {PerspectiveParserErrorMessage} from "./error";

export class ExpressionParser extends CstParser {
    constructor(vocabulary) {
        super(vocabulary, {
            errorMessageProvider: PerspectiveParserErrorMessage
        });

        /**
         * The overarching rule - required so that one single array of
         * parsed computed columns can be maintained across multiple operator,
         * functional, and parenthetical expressions.
         */
        this.RULE("SuperExpression", () => {
            this.SUBRULE(this.Expression);
        });

        /**
         * The `base rule` for all expressions, except that the state of the
         * computed column array can be changed between each invocation of
         * this rule.
         */
        this.RULE("Expression", () => {
            this.SUBRULE(this.OperatorComputedColumn);
        });

        /**
         * A computed column in `x + y` notation. Because it appears earlier,
         * it has lower precedence compared to the rules that are to follow.
         */
        this.RULE("OperatorComputedColumn", () => {
            this.SUBRULE(this.AdditionOperatorComputedColumn, {LABEL: "left"});

            // 0...n operators and right-hand expressions are available here.
            // Though a single column name is syntactically valid, it does
            // not actually generate any computed columns. However, this
            // rule must allow for 0...n and not 1...n as it allows for
            // a function-only expression (`sqrt("a")`) without a right
            // hand side of the expression.
            this.MANY(() => {
                this.SUBRULE(this.Operator);
                this.SUBRULE2(this.AdditionOperatorComputedColumn, {LABEL: "right"});
                this.OPTION(() => {
                    this.SUBRULE(this.As, {LABEL: "as"});
                });
            });
        });

        /**
         * A computed column in `x + y` or `x - y` notation. To maintain a
         * notion of operator precedence, different rules must be created for
         * add/subtract and multiply/divide operators, even if the actual
         * evaluator logic is the same.
         */
        this.RULE("AdditionOperatorComputedColumn", () => {
            this.SUBRULE(this.MultiplicationOperatorComputedColumn, {LABEL: "left"});
            this.MANY(() => {
                this.SUBRULE(this.AdditionOperator);
                this.SUBRULE2(this.MultiplicationOperatorComputedColumn, {LABEL: "right"});
                this.OPTION(() => {
                    this.SUBRULE(this.As, {LABEL: "as"});
                });
            });
        });

        /**
         * A computed column in `x * y` or `x / y` notation. Because it is
         * defined after the addition and generic operators, it is evaluated
         * before the addition/generic operators - hence satisfying precedence.
         */
        this.RULE("MultiplicationOperatorComputedColumn", () => {
            this.SUBRULE(this.ExponentOperatorComputedColumn, {LABEL: "left"});
            this.MANY(() => {
                this.SUBRULE(this.MultiplicationOperator);
                this.SUBRULE2(this.ExponentOperatorComputedColumn, {LABEL: "right"});
                this.OPTION(() => {
                    this.SUBRULE(this.As, {LABEL: "as"});
                });
            });
        });

        /**
         * A computed column in `x ^ y` notation. Exponents are evaluated before
         * multiplication/division and addition/subtraction, so it is defined
         * after those rules to give itself precedence.
         */
        this.RULE("ExponentOperatorComputedColumn", () => {
            this.SUBRULE(this.ColumnName, {LABEL: "left"});
            this.MANY(() => {
                this.SUBRULE(this.ExponentOperator);
                this.SUBRULE2(this.ColumnName, {LABEL: "right"});
                this.OPTION(() => {
                    this.SUBRULE(this.As, {LABEL: "as"});
                });
            });
        });

        /**
         * A computed column in `f(x)` notation. It is evaluated before all
         * operator computed columns.
         */
        this.RULE("FunctionComputedColumn", () => {
            this.SUBRULE(this.Function);
            this.CONSUME(vocabulary["leftParen"]);

            this.AT_LEAST_ONE_SEP({
                SEP: vocabulary["comma"],
                DEF: () => {
                    // Allow for arbitary expressions inside functions without
                    // use of parentheses.
                    this.SUBRULE(this.Expression, {LABEL: "param"});
                }
            });
            this.CONSUME(vocabulary["rightParen"]);
            this.OPTION(() => {
                this.SUBRULE(this.As, {LABEL: "as"});
            });
        });

        this.RULE("Function", () => {
            this.OR([
                {ALT: () => this.CONSUME(vocabulary["sqrt"])},
                {ALT: () => this.CONSUME(vocabulary["pow2"])},
                {ALT: () => this.CONSUME(vocabulary["abs"])},
                {ALT: () => this.CONSUME(vocabulary["invert"])},
                {ALT: () => this.CONSUME(vocabulary["log"])},
                {ALT: () => this.CONSUME(vocabulary["exp"])},
                {ALT: () => this.CONSUME(vocabulary["bin1000th"])},
                {ALT: () => this.CONSUME(vocabulary["bin1000"])},
                {ALT: () => this.CONSUME(vocabulary["bin100th"])},
                {ALT: () => this.CONSUME(vocabulary["bin100"])},
                {ALT: () => this.CONSUME(vocabulary["bin10th"])},
                {ALT: () => this.CONSUME(vocabulary["bin10"])},
                {ALT: () => this.CONSUME(vocabulary["length"])},
                {ALT: () => this.CONSUME(vocabulary["uppercase"])},
                {ALT: () => this.CONSUME(vocabulary["lowercase"])},
                {ALT: () => this.CONSUME(vocabulary["concat_comma"])},
                {ALT: () => this.CONSUME(vocabulary["concat_space"])},
                {ALT: () => this.CONSUME(vocabulary["hour_of_day"])},
                {ALT: () => this.CONSUME(vocabulary["day_of_week"])},
                {ALT: () => this.CONSUME(vocabulary["month_of_year"])},
                {ALT: () => this.CONSUME(vocabulary["second_bucket"])},
                {ALT: () => this.CONSUME(vocabulary["minute_bucket"])},
                {ALT: () => this.CONSUME(vocabulary["hour_bucket"])},
                {ALT: () => this.CONSUME(vocabulary["day_bucket"])},
                {ALT: () => this.CONSUME(vocabulary["week_bucket"])},
                {ALT: () => this.CONSUME(vocabulary["month_bucket"])},
                {ALT: () => this.CONSUME(vocabulary["year_bucket"])}
            ]);
        });

        /**
         * Consume an addition or subtraction symbol. Rules for operators with
         * defined precedence rules are separated from the general
         * `Operator` rule.
         */
        this.RULE("AdditionOperator", () => {
            this.OR([{ALT: () => this.CONSUME(vocabulary["add"])}, {ALT: () => this.CONSUME(vocabulary["subtract"])}]);
        });

        this.RULE("MultiplicationOperator", () => {
            this.OR([{ALT: () => this.CONSUME(vocabulary["multiply"])}, {ALT: () => this.CONSUME(vocabulary["divide"])}]);
        });

        this.RULE("ExponentOperator", () => {
            this.CONSUME(vocabulary["pow"]);
        });

        this.RULE("Operator", () => {
            this.OR([
                {ALT: () => this.CONSUME(vocabulary["percent_of"])},
                {ALT: () => this.CONSUME(vocabulary["equals"])},
                {ALT: () => this.CONSUME(vocabulary["not_equals"])},
                {ALT: () => this.CONSUME(vocabulary["greater_than"])},
                {ALT: () => this.CONSUME(vocabulary["less_than"])},
                {ALT: () => this.CONSUME(vocabulary["is"])}
            ]);
        });

        /**
         * A special rule for column names used as alias after `as` to prevent
         * further evaluation of possible expressions.
         */
        this.RULE("TerminalColumnName", () => {
            this.CONSUME(vocabulary["columnName"]);
        });

        /**
         * A rule for aliasing computed columns - placed at the top so that it
         * is evaluated after everything else.
         *
         * TODO: make AS left evaluative by default: an expression like
         * x + y + z as "abc" currently breaks to abc + z, when it should be
         * x + abc.
         */
        this.RULE("As", () => {
            this.CONSUME(vocabulary["as"]);
            this.SUBRULE(this.TerminalColumnName);
        });

        /**
         * A column name, which can evaluate to a parenthetical expression,
         * a functional column, or a literal column name - a string
         * wrapped in double or single quotes.
         */
        this.RULE("ColumnName", () => {
            this.OR([
                {ALT: () => this.SUBRULE(this.ParentheticalExpression)}, 
                {ALT: () => this.SUBRULE(this.FunctionComputedColumn)}, 
                {ALT: () => this.CONSUME(vocabulary["numberValue"])}, 
                {ALT: () => this.CONSUME(vocabulary["stringValue"])}, 
                {ALT: () => this.CONSUME(vocabulary["columnName"])}
            ], {
                ERR_MSG: "Expected a column name (wrapped in double quotes) or a parenthesis-wrapped expression."
            });
        });

        /**
         * The rule for parenthetical expressions, which consume parentheses
         * and resolve to this.Expression. Because it is lowest in the
         * tree, it is evaluated before everything else.
         */
        this.RULE("ParentheticalExpression", () => {
            this.CONSUME(vocabulary["leftParen"]);
            this.SUBRULE(this.Expression);
            this.CONSUME(vocabulary["rightParen"]);
        });

        this.performSelfAnalysis();
    }
}
