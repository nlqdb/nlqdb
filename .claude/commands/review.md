# /review — PR review + merge loop

Your review criteria: security (including sql injection), readability, scalability, consistency, reusability, developer experience and most importantly user experience (minimum actions for maximum value and minimum user-regretted-seconds like interruptions / spam etc), observability (non-spammy), robustness, 1-sentence judicious comments (not-spammy), docs kept in-sync, and the design-for-leverage skill.

If we have open PRs from me (omer hochman) that are not draft, start a background agent for each of these PR  - the agent should review based on the above criteria, should fix any findings, rebase and carefully resolve any conflicts, and make sure CI is green. if any fixes were applied then you should spin up another background agent to review that PR rigorously and thoroughly again. if the review resulted with 0 fixable issues then please merge it. yes, you can merge it.

Before merging any PR - always make sure to have a "docs/blocked-by-human.md" file (previous open-questions)  and create one if we dont have one. - its the only file that I read and there must be very short bullet points of actions that can only be done by a human, or decisions that you could not disambiguate using the guidelines markdown, unless you manage to disambiguate all decisions.
An action bullet point must be one of the following - either a human action must be taken (new env var creation, some clicks on a website, something with legal/bank/etc..) OR a human approval is needed to apply suggestion to improve/simplify/disambiguate/append to the guidelines doc that would unblock you from taking a specific decision.
also keep main readme up-to-date with the new changes

feel free bumping packages versions and fixing vulnerabilities (just make sure that everything still builds successfully of course) and these kind of decisions can be taken off blocked-by-human file
