# v0.1.0
# { "Depends": "py-genlayer:latest" }

from genlayer import gl
import json
import hashlib

# Static list of fun cat facts (English)
CAT_FACTS = [
    "Cats can jump up to six times their length.",
    "A group of cats is called a clowder.",
    "Cats sleep for around 70% of their lives.",
    "Each cat’s nose print is unique, like a human fingerprint.",
    "Cats can make over 100 different vocal sounds.",
    "The first cat in space was a French cat named Félicette in 1963.",
    "Most cats have 18 toes: five on each front paw and four on each back paw.",
    "Cats can rotate their ears 180 degrees using over 30 different muscles.",
    "Domestic cats share about 95% of their DNA with tigers.",
    "Cats use their whiskers to judge whether they can fit through a space.",
]

def pick_cat_fact(fact: str) -> str:
    h = hashlib.sha256(fact.encode("utf-8")).hexdigest()
    idx = int(h, 16) % len(CAT_FACTS)
    return CAT_FACTS[idx]

class CatFactChecker(gl.Contract):
    last_verdict: str

    def __init__(self):
        self.last_verdict = ""

    @gl.public.write
    def verify_fact(self, fact: str) -> str:
        """
        Uses leader/validator pattern for AI-generated explanations.
        Validators verify verdict/confidence match, but accept semantic variations in explanation.
        """

        # Leader function: generates full response with AI explanation
        def leader_fn():
            prompt = f"""
You are a strict JSON API for checking facts about cats.

User statement (answer in the same language):
"{fact}"

RULES:

1) LANGUAGE
- Detect the language of the user statement.
- Answer in the SAME language as the user statement.

2) TOPIC FILTER (cats only)
- If the statement is NOT about cats (cats, tomcats, kittens, feline animals),
  then respond with this JSON and NOTHING ELSE:
  {{
    "verdict": "unknown",
    "confidence": 0,
    "explanation": "the question is not about cats"
  }}

3) SUBJECTIVE / NON-FACTUAL STATEMENTS
- If the statement is about beliefs, opinions, religion, philosophy,
  or other claims that cannot be verified as factual (for example: "Cats are divine beings"),
  then respond with this JSON and NOTHING ELSE:
  {{
    "verdict": "unknown",
    "confidence": 0,
    "explanation": "this statement is a matter of belief or opinion and cannot be checked as a factual claim"
  }}

4) NORMAL FACT-CHECK (cats only)
- If the statement IS about cats AND can be checked as a factual claim,
  respond with a JSON object:
  {{
    "verdict": "true" or "false" or "partial",
    "confidence": an integer from 0 to 100,
    "explanation": 1–2 short sentences explaining your verdict, in the same language as the statement
  }}

5) JSON FORMAT
- Output MUST be valid JSON.
- Do NOT add markdown, backticks, or extra text.
- Do NOT escape letters as \\u0411\\u043e... etc. Use normal human-readable text.
"""
            raw_response = gl.nondet.exec_prompt(prompt)
            cleaned = raw_response.replace("```json", "").replace("```", "").strip()
            try:
                data = json.loads(cleaned)
                return data
            except Exception:
                return {
                    "verdict": "unknown",
                    "confidence": 0,
                    "explanation": "Failed to parse response",
                }

        # Treat "false" and "partial" as equivalent "not_true" verdicts
        def verdict_close(a: str, b: str) -> bool:
            """
            Returns True if two verdicts are considered equivalent.

            Rules:
            - Exact matches are always equivalent.
            - "false" and "partial" are treated as the same bucket ("not_true").
            """
            if a == b:
                return True

            # Treat "false" and "partial" as equivalent "not_true" verdicts
            if {a, b} == {"false", "partial"}:
                return True

            return False

        # Validator function: checks only verdict and confidence (with tolerance)
        def validator_fn(leader_result):
            if not isinstance(leader_result, gl.vm.Return):
                return False

            leader_data = leader_result.calldata
            validator_data = leader_fn()

            leader_conf = leader_data.get("confidence")
            validator_conf = validator_data.get("confidence")

            # Allow ±20 points tolerance (e.g., 75 and 85 are "close enough")
            confidence_close = (
                isinstance(leader_conf, (int, float))
                and isinstance(validator_conf, (int, float))
                and abs(leader_conf - validator_conf) <= 20
            )

            # Soft verdict comparison
            same_verdict = verdict_close(
                leader_data.get("verdict"),
                validator_data.get("verdict"),
            )

            return same_verdict and confidence_close

        # Run non-deterministic consensus
        result_data = gl.vm.run_nondet(leader_fn, validator_fn)

        verdict = result_data.get("verdict", "unknown")
        confidence = result_data.get("confidence", 0)
        explanation = result_data.get("explanation", "")

        # Detect off-topic questions (not about cats) based on AI explanation
        explanation_lower = explanation.lower()

        is_off_topic = (
            verdict == "unknown"
            and confidence == 0
            and (
                "the question is not about cats" in explanation_lower
            )
        )

        if is_off_topic:
            random_fact = pick_cat_fact(fact)
            explanation = (
                "Mochi cannot answer your question about this topic, "
                f"but here is an interesting fact about cats: {random_fact}"
            )

        # Add key_evidence field for consistency with frontend
        final_data = {
            "verdict": verdict,
            "confidence": confidence,
            "explanation": explanation,
        }

        # Ensure human-readable non-ASCII characters
        final_json = json.dumps(final_data, ensure_ascii=False)
        self.last_verdict = final_json
        return final_json

    @gl.public.view
    def get_last_verdict(self) -> str:
        return (
            self.last_verdict
            if self.last_verdict
            else '{"verdict":"unknown","confidence":0,"explanation":"No facts checked yet"}'
        )
