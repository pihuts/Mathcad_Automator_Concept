"""
Smart mapping suggestion and expression validation module.

Provides fuzzy name matching for output-to-input mapping suggestions
and safe expression evaluation for conditional and aggregation expressions.

SECURITY: Uses simpleeval for expression evaluation (not Python's eval()).
simpleeval provides built-in safeguards:
- MAX_POWER limit (4,000,000) prevents excessive computation attacks
- MAX_STRING_LENGTH (100,000) prevents memory exhaustion
- No attribute access for names starting with '_'
- No file I/O, imports, or dangerous builtins
"""

from rapidfuzz import process, fuzz
from simpleeval import simple_eval, EvalWithCompoundTypes
from typing import List, Tuple, Dict, Any, Optional
from dataclasses import dataclass


@dataclass
class MappingSuggestion:
    """A suggested mapping from source to target with confidence score."""
    source_alias: str
    target_alias: str
    confidence: float  # 0-100
    reason: str        # Human-readable explanation


class MappingSuggester:
    """
    Provides intelligent mapping suggestions and expression validation.

    Uses rapidfuzz for fuzzy string matching to suggest likely output-to-input
    mappings based on name similarity. Uses simpleeval for safe evaluation of
    conditional and aggregation expressions.
    """

    SIMILARITY_THRESHOLD = 60  # Minimum score to suggest a match (0-100)

    def suggest_for_target(
        self,
        target_alias: str,
        source_aliases: List[str],
        top_n: int = 3
    ) -> List[dict]:
        """
        Suggest mappings for a single target input alias.

        Args:
            target_alias: The input alias to find matches for
            source_aliases: List of available output aliases
            top_n: Maximum number of suggestions to return

        Returns:
            List of dicts with keys: source_alias, target_alias, confidence, reason
            Only includes matches with confidence >= SIMILARITY_THRESHOLD
        """
        matches = process.extract(
            target_alias,
            source_aliases,
            scorer=fuzz.token_sort_ratio,
            limit=top_n
        )

        suggestions = []
        for source, score, _ in matches:
            if score >= self.SIMILARITY_THRESHOLD:
                suggestions.append({
                    "source_alias": source,
                    "target_alias": target_alias,
                    "confidence": float(score),
                    "reason": f"Name similarity: {score:.0f}%"
                })

        return suggestions

    def suggest_all(
        self,
        source_aliases: List[str],
        target_aliases: List[str]
    ) -> List[dict]:
        """
        Suggest mappings for all target input aliases.

        Args:
            source_aliases: List of available output aliases
            target_aliases: List of input aliases to find matches for

        Returns:
            List of all suggestions sorted by confidence descending
        """
        all_suggestions = []

        for target in target_aliases:
            suggestions = self.suggest_for_target(target, source_aliases)
            all_suggestions.extend(suggestions)

        # Sort by confidence (highest first)
        return sorted(all_suggestions, key=lambda s: s["confidence"], reverse=True)

    def validate_expression(
        self,
        expression: str,
        available_vars: List[str]
    ) -> Tuple[bool, str]:
        """
        Validate an expression against available variables.

        Tests if the expression can be evaluated with the given variables.
        Provides helpful error messages for typos (suggests similar variable names).

        Args:
            expression: The expression to validate (e.g., "(stress > 50000) and (deflection < 2)")
            available_vars: List of variable names that will be available

        Returns:
            Tuple of (is_valid, error_message)
            is_valid: True if expression is valid, False otherwise
            error_message: Empty string if valid, error description if invalid
        """
        # Create dummy context with all vars = 1.0 for validation
        dummy_context = {var: 1.0 for var in available_vars}

        try:
            simple_eval(expression, names=dummy_context)
            return True, ""
        except NameError as e:
            # Handle Python's built-in NameError (not from simpleeval)
            error_str = str(e)
            return False, f"Invalid expression: {error_str}"
        except Exception as e:
            # Handle simpleeval errors (NameNotDefined, etc.)
            error_str = str(e)
            # Error format: "'undefined_var' is not defined for expression '...'"
            if "is not defined" in error_str:
                try:
                    # Extract undefined variable name from quotes
                    undefined = error_str.split("'")[1]
                except IndexError:
                    return False, f"Invalid expression: {error_str}"

                # Suggest similar variable using fuzzy matching
                matches = process.extract(undefined, available_vars, limit=1)
                if matches and matches[0][1] >= 60:
                    suggestion = matches[0][0]
                    return False, f"Undefined variable '{undefined}'. Did you mean '{suggestion}'?"
                return False, f"Undefined variable '{undefined}'"
            return False, f"Invalid expression: {error_str}"

    def evaluate_condition(
        self,
        expression: str,
        outputs: Dict[str, Any]
    ) -> bool:
        """
        Evaluate a conditional expression against workflow outputs.

        Args:
            expression: Boolean expression (e.g., "stress > 50000 and deflection < 2")
            outputs: Dictionary of variable names to values

        Returns:
            Boolean result of the expression

        Raises:
            ValueError: If expression cannot be evaluated
        """
        try:
            result = simple_eval(expression, names=outputs)
            return bool(result)
        except Exception as e:
            raise ValueError(f"Failed to evaluate condition: {e}")

    def evaluate_aggregation(
        self,
        expression: str,
        outputs: Dict[str, Any]
    ) -> float:
        """
        Evaluate an aggregation expression against workflow outputs.

        Supports functions: max, min, sum, avg, average

        Args:
            expression: Aggregation expression (e.g., "max(stress_A, stress_B, stress_C)")
            outputs: Dictionary of variable names to values

        Returns:
            Float result of the aggregation

        Raises:
            ValueError: If expression cannot be evaluated
        """
        evaluator = EvalWithCompoundTypes()

        # Add aggregation functions
        evaluator.functions.update({
            "max": max,
            "min": min,
            "sum": sum,
            "avg": lambda *args: sum(args) / len(args) if args else 0,
            "average": lambda *args: sum(args) / len(args) if args else 0
        })

        # Set the names (variables) on the evaluator
        evaluator.names = outputs

        try:
            result = evaluator.eval(expression)
            return float(result)
        except Exception as e:
            raise ValueError(f"Failed to evaluate aggregation: {e}")


# Singleton instance for easy import
suggester = MappingSuggester()
