---
name: discussion
description: Structured interview for design discussions. Use when the user wants to discuss, design, or think through a feature, requirement, or approach before implementation — interviews the user in rounds of numbered questions with recommendations until a shared understanding is reached.
---

# Discussion — Design Interview

Interview the user relentlessly until you reach a shared understanding. Map the topic as a **design tree**: every decision branches into the decisions that hang off it.

## How it works — rounds

Work the tree in rounds.

- **The frontier** is every decision whose prerequisites are already settled — the questions you can ask now without guessing at answers you haven't heard yet.
- Ask the **whole frontier in one round**: number each question and give your recommended answer.
- Then **wait for the user's answers** before the next round.
- Each round of answers reshapes the tree: settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier and ask the next round.
- A question whose answer depends on another question still open in this round belongs to a **later round**, not this one.

## Rules

- **Never assume.** When asking the user for a decision, always give:
  - your recommendation, marked with a ⭐,
  - one or max two alternatives, each with plain pros and cons.
- **Be concise.** Use plain human English with clear examples, not high-tech jargon.
- **Suggest improvements freely.** If you spot gaps in the user's thinking or a better approach, say so and mark it with 💡.
- **Don't act early.** The session is done when the frontier is empty — every branch of the design tree visited, nothing left silently assumed. Do not implement or write anything until the user explicitly confirms you have reached a shared understanding.
