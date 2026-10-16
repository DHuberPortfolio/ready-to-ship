# Method

How the checklist was built, why each choice was made, and where it can be wrong. The
[page](https://dhuberportfolio.github.io/ready-to-ship/) is the short version; this is the long one.
Plain words come first, and the technical term follows the first time it matters. A glossary is at
the end.

This is version 2. Version 1 was put through an adversarial review: an AI model was asked to act as
a thesis committee (a statistician, a human-factors researcher, an ML-evaluation researcher and a
survey methodologist) and attack it, and a second review attacked the code. Section 13 lists what
they found and what changed. Their statistical claims were re-derived exactly before being used.

## 1. What "ready to ship" means here

A workflow is ready to ship when **it has earned the amount of independence you plan to give it.**
You can show four things:

1. **What counts as a mistake, and how many are acceptable**, decided by someone who answers for
   the consequences (questions 1 and 2).
2. **Evidence that the mistakes nobody will see are fewer than that**, honest about small tests,
   tuning and lucky runs (questions 3, 4 and 5).
3. **That the worst case can't happen, doubtful outputs reach a person who really looks, and nothing
   slips out the side** (questions 6 to 10).
4. **That you'll find out when any of this stops being true** (questions 11 and 12).

Every question is about a *silent* failure: one that nobody would notice from using the workflow.
Loud failures, such as a crash, a slow response or a large bill, announce themselves and are left
out on purpose (section 3).

It is a do-confirm checklist, in Gawande's terms: you do the work your own way, then stop and
confirm that nothing critical was skipped (Gawande, 2009). It is not a maturity model and it does
not give a percentage. Gawande, drawing on Boeing's checklist designers, argues for short lists of
the "killer items": the steps most dangerous to skip and still sometimes skipped. The best-known
evidence for checklists of that kind is medical: across eight hospitals, deaths after surgery fell
from 1.5% to 0.8%, and complications from 11.0% to 7.0%, after a surgical safety checklist was
introduced (Haynes et al., 2009). That was a before-and-after study, not a randomized trial, so it
shows an association rather than proof; it is the reason to keep this list short, not evidence that
this list works.

### Scope

**In:** whether the outputs of an AI workflow are right often enough, for any tool that builds it:
n8n, Zapier, custom code, an API.

**Out:** whether you may use the data at all (privacy, contracts), security testing beyond basic
prompt injection, legal compliance (for example, an EU AI Act conformity assessment), fairness
between groups of people, and cost and speed. Each of these matters and each needs its own review by
someone qualified to give it. Prompt injection is in because it changes outputs: an injected
instruction is a way for a wrong output to go out looking normal. Question 9's tests catch careless
failures; they are not a security test against a determined attacker.

## 2. Where the questions come from

Candidate questions came from three places:

- **Failures found by measuring two real AI workflows** with an answer key: a compliance reviewer for
  law-firm advertising and a news-metadata tagger, both built in n8n and measured with
  [workflow-eval-harness](https://github.com/DHuberPortfolio/workflow-eval-harness) (Huber, 2026).
  Section 8 walks through what the checklist says about each.
- **Risk frameworks**: the NIST AI Risk Management Framework (NIST, 2023) and its generative-AI
  profile (NIST, 2024), the EU AI Act's articles on record-keeping, human oversight and post-market
  monitoring (European Union, 2024), and the OWASP Top 10 for LLM applications (OWASP, 2024). The EU
  articles bind only high-risk systems; they are cited for the idea, not as obligations.
- **Research and practice** on production readiness for machine learning (Breck et al., 2017;
  Sculley et al., 2015), human supervision of automation (Bainbridge, 1983; Parasuraman & Manzey,
  2010; Wolfe et al., 2005), evaluation (Cawley & Talbot, 2010; Dwork et al., 2015) and the
  statistics of small samples (Wilson, 1927; Hanley & Lippman-Hand, 1983).

The closest precedent is Google's ML Test Score (Breck et al., 2017): 28 tests for production
readiness of machine-learning systems, scored per section. It was written for teams that train their
own models, so most of its tests (feature pipelines, training reproducibility) don't apply to a
workflow that calls someone else's model. This checklist borrows its central scoring idea
(section 5.1) and asks about the parts a workflow builder does control: the answer key, the routing,
the review, and the watching.

## 3. How the twelve were chosen

A candidate became a question only if it passed all four tests:

1. **Silent.** Skipping it lets a failure through that nobody would notice from ordinary use.
2. **Answerable.** One builder can answer it with evidence, without special tools.
3. **Distinct.** No other question's yes implies it, except as a prerequisite (section 5.3).
4. **Telling.** A real workflow could plausibly fail it. A question everyone passes makes the list
   longer without making it more informative.

Considered and left out:

| Candidate | Why it isn't a question |
|---|---|
| An off switch | Fails test 4: in n8n and Zapier, switching a workflow off is one click, so nearly everyone passes. Question 11's stop rule is where switching off is planned. |
| Logs of every run | A means, not an end. Questions 10 and 11 can't be a yes without them. |
| Running the answer key more than once | Folded into question 5: its bar fixes which run counts (the first), and its "go further" covers repeats. |
| The rate for each kind of input | Folded into question 3's "go further". Important, but it refines the rate rather than replacing it. |
| Whether confidence scores are calibrated | A means. On the answer key, question 3's rate shows whether the scores separate right from wrong; models' stated confidence is known to run high (Xiong et al., 2024). When inputs shift, question 11's spot checks and daily signals are what notice. |
| Cost, speed | Loud. |
| Documentation, model cards | Valuable (Mitchell et al., 2019), but they don't change what goes out. |
| Privacy, fairness, legal compliance | Out of scope (section 1). |

The order follows the moments a builder would stop and check (pause points), as in aviation and
surgical checklists (Degani & Wiener, 1993): before testing, during testing, before shipping, and the
plans for after launch.

## 4. How the questions are written

- **One thing per question.** A question that asks two things at once (double-barreled) gets a yes
  when only one is true; "ask about one thing at a time" is among the most settled rules of question
  design (Krosnick & Presser, 2010). A test rejects any question containing "and" or "or", the usual
  sign of it.
- **A bar of ticks.** Under each question is its bar: one to three conditions, each with its own
  tick. The answer is worked out: every tick is a yes, anything less is a no, and a question can also
  be marked no outright. Version 1 had a single yes button under a bar of several conditions, which
  invited a yes when three of four were true, the double-barreled problem moved one line down.
- **Yes or no, nothing in between.** These are questions of fact with a stated bar, not opinions on
  a scale, and a bar is either cleared or not, so "partly" is a no. Survey research draws a useful
  line here. For opinions, a middle point on a scale can improve answers (Krosnick & Presser, 2010).
  But an explicit way out, such as "don't know" or "no opinion", invites people to take it instead of
  thinking the question through (satisficing; Krosnick, 1991; Krosnick et al., 2002). On this
  checklist, "not sure" means there's no evidence, and no evidence means no.
- **No "not applicable" button.** Whether a question applies is worked out from the design you
  choose (section 5.2), not declared question by question, so "N/A" can't become a way around a
  hard question.
- **Prerequisites come first.** Every question a yes rests on has a smaller number, so the number
  order is also a safe order to fix things in. A test checks this.
- **Plain words, real cases.** Each "why" uses a real failure where one exists, and every number it
  quotes from the statistics is recomputed by a test.

## 5. How answers become a verdict

### 5.1 One gap is enough

The score is not a sum. Adding up yes answers would let strength on one question make up for a
missing one (a compensatory rule), as if a tested off switch could stand in for an answer key. Each
question guards a different failure, so the rule is conjunctive: every question that counts must be a
yes (Einhorn, 1970). The ML Test Score takes the minimum of its section scores for the same reason
(Breck et al., 2017). The page shows "9 of 12 met" so you can see progress, but the verdict is
"not ready" until it is 12 of 12, and a "ready" verdict names the design it applies to.

### 5.2 Ready for what?

How much a workflow does on its own is a choice, made function by function, between a person doing
everything and the system acting alone (levels of automation; Parasuraman et al., 2000). The
checklist asks for that choice first, as one of three designs, and only counts the questions that
design needs:

<!-- generated:applicability -->
| # | Question | Automatic | Gated | Supervised |
|---|---|---|---|---|
| 1 | A limit, set by the owner | counts | counts | optional |
| 2 | An answer key | counts | counts | optional |
| 3 | The silent error rate | counts | counts | optional |
| 4 | Tested on records it hasn’t seen | counts | counts | optional |
| 5 | A big enough test | counts | counts | optional |
| 6 | A hard stop on the worst case | counts | counts | counts |
| 7 | Review that really waits | – | counts | counts |
| 8 | Reviewers who catch mistakes | – | counts | counts |
| 9 | Strange inputs are held back | counts | counts | optional |
| 10 | Nothing goes missing | counts | counts | counts |
| 11 | Regular spot checks | counts | counts | optional |
| 12 | Every change re-tested | counts | counts | optional |
| | **Questions that count** | **10** | **12** | **4** |
<!-- /generated:applicability -->

- **Automatic** means nothing ever waits for a person: each output goes out or is blocked. If any
  path sends work to a person, even only errors or strange inputs, the design is gated, and the
  review questions apply to that path.
- **Supervised** needs four. When every output waits for a person, nothing goes out unseen, so the
  silent failures left are an output that takes effect before review (question 7), a review that
  misses mistakes (8), a record that never reaches review (10), and the worst case, which routine
  review can't be trusted to stop (6). Question 8 measures the reviewers rather than trusting them:
  people supervising automation tend to over-rely on it, and training or instructions don't prevent
  that (Parasuraman & Manzey, 2010); and the rarer mistakes are, the more get missed (Wolfe et al.,
  2005). Question 6 can't be met by the routine review: it asks for a rule or a permission limit,
  not judgment. The other eight questions are what it takes to let outputs go out alone. In a
  supervised design they're asked, marked optional, and listed as the next step.

When the planned design isn't ready, the scorecard lists what a supervised design would need, so the
work can start while the gaps are closed. It is careful about what it knows. Questions 6 and 10 mean
the same in every design, so their answers carry over. Questions 7 and 8 don't: a review step built
for the doubtful share has to be rebuilt in front of every output, and reviewers tested at that
share's volume and mix of mistakes haven't been tested at the new one. Those two are always marked
"to check".

### 5.3 A yes needs its foundations

Some yes answers can't be true unless another one is. A silent error rate measured without an
answer key was measured against nothing, and a rate from records the workflow was tuned on is no
evidence of anything.

<!-- generated:dependencies -->
| This yes | rests on |
|---|---|
| 3. The silent error rate | 2. An answer key |
| 4. Tested on records it hasn’t seen | 3. The silent error rate |
| 5. A big enough test | 1. A limit, set by the owner; 3. The silent error rate; 4. Tested on records it hasn’t seen |
| 11. Regular spot checks | 1. A limit, set by the owner |
| 12. Every change re-tested | 1. A limit, set by the owner; 2. An answer key |
<!-- /generated:dependencies -->

A yes resting on a gap counts as a gap, and the page says why rather than silently changing the
answer. The scorecard lists gaps in number order, marks the ones nothing else depends on as "start
here", says which later gaps each one unblocks, and lists the ticks still missing.

### 5.4 Numbers over opinions

Question 5 can only be a yes when the limit (question 1) and the counts (question 3) are filled in
and the top of the likely range is under the limit. Its two ticks cover what the arithmetic can't
see: that the counts come from the first run, and from a test whose size was fixed in advance.
Question 11 gets a spot-check plan worked out from the limit. These are the places where
self-report can be replaced by arithmetic, and the ones people most often get wrong by eye.

## 6. The arithmetic

**The silent error rate** is the share wrong among the outputs that went out with nobody checking.
In the research on models that can abstain (selective prediction), this is the *selective risk*, and
the share that goes out unchecked is the *coverage* (Chow, 1970; Geifman & El-Yaniv, 2017). Raising
the confidence bar usually lowers both together: fewer outputs go out alone, and fewer of those are
wrong. The limit in question 1 is set on this rate, rather than on wrong outputs per 100 inputs
(coverage × selective risk), because it is the promise the people receiving unchecked outputs can
rely on: of what reaches you without review, at most this share is wrong. The per-input figure
follows from it once coverage is known, and is the one to use for the total cost of mistakes.
Mistakes a reviewer misses are not in this rate; question 8 measures them separately.

**The likely range** is the 95% Wilson score interval (Wilson, 1927), the same one
[error-rate-calculator](https://github.com/DHuberPortfolio/error-rate-calculator) and
workflow-eval-harness use, so all three tools agree to the decimal. The textbook interval,
rate ± 1.96 × √(rate × (1 − rate) / n), says 0 mistakes in 20 is "0% to 0%"; it is known to perform
badly at small counts and rates near zero, where Wilson's holds up (Newcombe, 1998; Brown et al., 2001).

**The test in question 5** is: top of the two-sided 95% range < limit. In principle that is a
one-sided test at 97.5%, a little stricter than the usual one-sided 95%; it was chosen so the
checklist, the calculator and the harness give one answer, not three. For 0 mistakes in 20, the
one-sided 95% top would be 11.9% rather than 16.1%; the verdict for a 5% limit is the same. Because
counts are whole numbers, the real chance of a wrong yes wobbles around 2.5% with the sample size.
The first table below gives its worst case, worked out exactly.

**Zero mistakes is not zero.** With no mistakes in n records, an approximate one-sided 95% upper
bound on the real rate is 3 ÷ n (the rule of three; Hanley & Lippman-Hand, 1983); the top of Wilson's
two-sided 95% range is 3.84 ÷ (n + 3.84), slightly more cautious. So showing "under 5%" takes 73 clean
records, "under 1%" takes 381, and "under 0.1%" takes 3,838. That last figure is why question 6
exists: for an outcome you can't afford once, testing can't get you there, and a hard stop has to.

**Test once, at a size fixed in advance.** Adding records until the range dips under the limit gives
the workflow many chances to get lucky, and each look is another chance (Armitage et al., 1969). With
a 5% limit and a real rate of exactly 5%, ten looks of 100 records turn a 2% chance of a wrong yes
into 7% (second table). So question 5's bar asks for a test whose size was set before the results
were seen, and the page's advice after a no is a new test of a planned size on unused records,
judged on its own.

**Three runs are not three times the evidence, and neither are ten retellings.** Wilson's range
assumes each record is an independent piece of evidence. Running the same records again tests the
same hard cases again; ten articles retelling one story, or a hundred records from one customer,
tend to be right or wrong together. Records like these are clustered, and the effective sample size
shrinks toward the number of independent clusters (the design effect; Kish, 1965, p. 162). Adding
them up makes the range look narrower than it is. Question 5 asks for the counts from one run, and
its "go further" asks for each story, customer or case to be counted once.

**A trap-heavy answer key measures robustness, not the real rate.** If hard cases make up 40% of the
answer key and 5% of the real inputs, the rate on the key is not the rate the world will see.
Estimating the real rate from such a sample needs each kind of input weighted by its real share
(stratified estimation; Cochran, 1977, ch. 5). Question 2's answer key is a random sample, and the
traps are a separate set with their own rate.

**The reviewer screen in question 8** is deliberately simple: plant at least 20 mistakes at about
the rate real ones occur, and require every one caught. Catching 20 of 20 says the reviewers' miss
rate is likely under about 16%: enough to expose rubber-stamping, not enough to promise a low rate
(third table). The share of outputs that go out wrong through review is about the share of reviewed
outputs that are wrong times the miss rate, so a workflow that sends many mistakes to review needs a
tighter screen, which means planting more. Planting at a realistic rate matters because reviewers
miss far more when mistakes are rare: in one lab study, from 7% at half the items to 30% at 1 in 100
(Wolfe et al., 2005).

<!-- generated:operating -->
**One test, at the limit.** The chance of a yes when the real rate is exactly the limit, at the worst sample size from 20 to 1,000:

| Limit | Worst chance of a wrong yes |
|---|---|
| 1% | 2.43% (at 878 records) |
| 2% | 2.49% (at 980 records) |
| 5% | 2.55% (at 587 records) |
| 10% | 2.64% (at 84 records) |

**Testing until it passes** (5% limit, real rate exactly 5%):

| How it was tested | Chance of a wrong yes |
|---|---|
| One test of 1,000 | 2.1% |
| 10 looks of 100, added up | 6.7% |
| 20 looks of 50, added up | 8.3% |

**The reviewer screen** (question 8: every one of 20 planted mistakes caught):

| Reviewer’s real miss rate | Chance they pass anyway |
|---|---|
| 1% | 82% |
| 5% | 36% |
| 10% | 12% |
| 16% | 3.1% |
| 30% | 0.08% |
<!-- /generated:operating -->

**The spot checks in question 11** keep the same burden of proof after launch as before: the
workflow keeps its independence only while weekly samples stay consistent with the limit. Version 1
said to stop when the low end of a running total's range rose above the limit. That waited for proof
of failure, and a running total hides a recent change behind months of good weeks. Version 2 judges
each week on its own: check n outputs a week, and stop if c or more are wrong. The page works out n
and c from the limit, as the smallest weekly sample that meets two targets: a real rate of twice the
limit trips the rule within four weeks at least 9 times in 10, and at half the limit it trips by bad
luck no more than once a year on average. Both targets are choices, made to be argued with; they are
set in one place (`PLAN` in `score.js`). The weekly checks are repeated looks too (Armitage et al.,
1969), which is why the false-stop target is stated per year, not per check. For faster detection
of a change, a CUSUM chart is the standard tool (Page, 1954).

<!-- generated:plans -->
| Limit | Check each week | Stop at | Catches a doubled rate within 4 weeks | False stops a year at half the limit | Weekly chance of a stop exactly at the limit |
|---|---|---|---|---|---|
| 1% | 169 | 4 or more | 90 in 100 | 0.56 | 9% |
| 2% | 85 | 4 or more | 90 in 100 | 0.55 | 9% |
| 5% | 34 | 4 or more | 91 in 100 | 0.52 | 9% |
| 10% | 17 | 4 or more | 91 in 100 | 0.46 | 8% |
| 20% | 6 | 3 or more | 91 in 100 | 0.82 | 10% |
<!-- /generated:plans -->

A workflow running exactly at its limit trips the rule about one week in eleven. That is intended:
at the limit, there is no margin left, and a stop means a look, not a verdict. If fewer than n
outputs go out unchecked in a week, use batches of n instead of weeks.

## 7. Each question, the failure it prevents, and its sources

<!-- generated:traceability -->
| # | Question | The silent failure it prevents | Frameworks and practice | Research |
|---|---|---|---|---|
| 1 | A limit, set by the owner | Shipping a risk nobody accepted | NIST, 2023, MAP 1.5, GOVERN 2.1; Beyer et al., 2016, ch. 3 | – |
| 2 | An answer key | Judging it by “it looks right” | NIST, 2023, MEASURE 2.3; Huber, 2026, README | Berzak et al., 2016; Fort & Sagot, 2010; Ribeiro et al., 2020 |
| 3 | The silent error rate | Measuring the wrong thing: accuracy per tag, or notes counted as catches | Huber, 2026, docs/SILENT_ERRORS.md | Geifman & El-Yaniv, 2017; Oakden-Rayner et al., 2020 |
| 4 | Tested on records it hasn’t seen | A rate flattered by tuning on the records it’s measured on | NIST, 2023, MEASURE 2.5 | Cawley & Talbot, 2010; Dwork et al., 2015 |
| 5 | A big enough test | Trusting a rate from too few records, or from the luckiest run | NIST, 2024, MS-2.5-001 | Wilson, 1927; Hanley & Lippman-Hand, 1983; Armitage et al., 1969; Atıl et al., 2025 |
| 6 | A hard stop on the worst case | Relying on a rate, or a tired reviewer, for an outcome you can’t afford even once | OWASP, 2024, LLM06 | Reason, 2000; Hanley & Lippman-Hand, 1983 |
| 7 | Review that really waits | A review that doesn’t stop anything | NIST, 2023, MAP 3.5; OWASP, 2024, LLM06; Huber, 2026, README; n8n, n.d.-b; Zapier, n.d.-b | – |
| 8 | Reviewers who catch mistakes | Reviews that are rubber stamps | European Union, 2024, Art. 14(4)(b) | Parasuraman & Manzey, 2010; Wolfe et al., 2005; Bainbridge, 1983 |
| 9 | Strange inputs are held back | Garbage, or injected instructions, going out as normal | OWASP, 2024, LLM01 | Greshake et al., 2023 |
| 10 | Nothing goes missing | Records that vanish without an error | European Union, 2024, Art. 12; n8n, n.d.-a; Zapier, n.d.-a | – |
| 11 | Regular spot checks | Drift that nobody notices | NIST, 2023, MEASURE 2.4, MANAGE 2.4, MANAGE 4.1; European Union, 2024, Art. 72 | Page, 1954; Rabanser et al., 2019 |
| 12 | Every change re-tested | A change, or a model update, that breaks what worked | NIST, 2023, MANAGE 4.1 | Chen et al., 2024; Sculley et al., 2015; Dwork et al., 2015 |
<!-- /generated:traceability -->

## 8. Worked examples: two real workflows

Both were built in n8n and measured with workflow-eval-harness; the figures are from its
[README](https://github.com/DHuberPortfolio/workflow-eval-harness#readme).

**A compliance reviewer for law-firm advertising** (gated: copy the model flags with enough
confidence is held for a person; below the threshold, a finding becomes a note and the copy goes out).

- *Question 7, review that really waits:* **no**. A note did not stop the copy. The workflow's own
  scorecard counted those notes as catches and reported catching 100% of violations; of the copy
  that actually went out unseen, 6 of 20 needed a person (likely 15% to 52%).
- *Question 3, the silent error rate:* **no** at first, because the scorecard measured catches, not
  what went out unseen. Measured after a prompt fix, on a 500-document key: 9.8% (25 of the 256 that
  went out unchecked).
- *Question 2, an answer key:* that key was built to cover the reviewer's traps: 112 of its 257 clean
  documents were written to look like violations. So 9.8% is a stress-test rate, not the rate real
  copy would see (section 6), and by this checklist's bar the key is a trap set, not a random sample:
  a **no** until a random sample of real copy is scored beside it. By section 5.3, questions 3 to 5
  then can't count as a yes either.
- *Question 5, enough evidence:* on that key, the likely range for 25 of 256 is 6.7% to 14.0%, and
  the rate seen is already over a 5% limit, so more records from the same key won't change the
  answer. Only a random sample of real copy can say whether the real rate is under it.
- *Question 3's "go further":* 15 of the 25 silent errors were award claims, a single kind of claim
  the model rated just under every client's threshold.

**A news-metadata tagger** (gated: articles with confident tags are published; the rest go to an editor).

- *Question 5, enough evidence:* on the first, 24-article key, three runs sent 7, 8 and 8 articles
  out unchecked, none with an error, and they were the same 8 articles each time. No errors in 8 has
  a likely range of 0% to 32.4%, so against any limit under 32% the answer is **no**: the small key
  could never have shown the tagger was good enough. (Added up, the three runs look like 0 of 23, or
  0% to 14.3%: three times the evidence that isn't there.)
- *Question 2:* a 500-article key built to include the tagger's known traps found errors in 27% of
  what it published unchecked. The 24 articles had missed the hard cases. The 500, which
  over-represent them, overstate the real rate. Neither is a random sample; a random sample of real
  articles is what would say where between them the real rate sits.
- *Question 4, measured on records it wasn't tuned on:* the method was right. A new guard's threshold
  was chosen on half of the 500 articles and checked on the other half. By section 5.3 it still can't
  count as a yes while question 2 is a no.
- *Question 5's ticks:* three runs of identical code gave 6.3%, 6.5% and 8.6%. Adding them together
  (44 of 615) gives a likely range of 5.4% to 9.5%; the worst run on its own (18 of 210) gives 5.5% to
  13.1%. The runs send out the same articles again (their 615 outputs are 254 articles), so the
  added-up range claims more certainty than the evidence holds (section 6).
- *Found and fixed:* the harness's own README used to quote those added-up figures, for both the
  24-article and the 500-article runs. Writing this checklist exposed it, and the harness now quotes
  the worst single run and labels the 500-record rates as stress-test rates, as questions 2 and 5
  ask. The checklist caught a mistake in the tool it was built beside.

**What these examples do and don't show.** They show the questions are concrete enough to answer for
real workflows, and that the answers point at the failures that were really there. They are not
evidence that the checklist works: the questions were written knowing about these failures, so of
course they find them (hindsight). Section 10 says what real evidence would take.

## 9. Where it can be wrong

- **Answers are self-reported.** Someone can tick without doing the work. The checklist makes that
  harder (a tick for each condition, no middle option, question 5 decided by the numbers, yes answers
  checked against their prerequisites, and a count of yes answers with evidence written down) but
  can't make it impossible.
- **Every question is worded so that yes is the good answer.** People tend to agree with statements
  put to them (acquiescence, one of the satisficing strategies in Krosnick, 1991), so the wording
  leans toward yes. Reversing some items would counter that, at the cost of a checklist that's harder
  to read; ticking each condition separately, with evidence, is the compromise.
- **The questions rest on one builder's experience and on published frameworks.** No panel of other
  practitioners has rated them yet (section 10).
- **There's no evidence yet that passing it predicts fewer failures.**
- **Yes or no loses detail.** "We have an answer key of 40 records" and "of 4,000" are both a yes to
  question 2; question 5 is where the size is judged.
- **The limit is set by people.** A loose limit makes everything pass. The checklist makes the limit
  explicit and owned; it can't make it wise.
- **The thresholds are choices.** 20 planted mistakes, 95% ranges, a doubled rate caught within four
  weeks 9 times in 10, one false stop a year at half the limit. Each is stated, with what it buys,
  so a team can tighten it; none is a law.
- **Reviewers are measured coarsely.** Question 8's screen catches rubber-stamping, not a 5% miss
  rate (section 6).
- **A likely range covers chance, not bias.** If the answer key is unrepresentative or its answers are
  wrong, the range around the rate is precise about the wrong number. Even new test data collected by
  the same process as the old can score differently: ImageNet models lost 11 to 14 points of accuracy
  on a fresh test set built to match the original (Recht et al., 2019).
- **It fits outputs that can be marked right or wrong.** For open-ended text, "wrong" needs a rubric,
  and if a model does the grading, the grader has its own errors to measure (Zheng et al., 2023).

## 10. How it could be validated

1. **Content validity.** A panel of practitioners rates each question as essential, useful or
   unnecessary; questions below the critical agreement level are cut or rewritten (Lawshe, 1975),
   using corrected critical values, since the original table has known errors (Ayre & Scally, 2014).
2. **Agreement between people.** Two people answer for the same workflow; agreement beyond chance per
   tick (Cohen, 1960) shows which conditions are sharp and which need rewording.
3. **Predictive validity.** Record each workflow's answers at launch, then the silent errors its spot
   checks find in the first 90 days. Workflows that passed should show fewer.
4. **Use.** Time to finish, and which ticks are most often misread.

## 11. How the code is checked

```bash
npm test          # every test: scoring rules, the questions' own rules, docs in sync
npm run mutants   # breaks the rules on purpose and checks that the tests notice
npm run docs      # rebuilds CHECKLIST.md and the generated tables in this file and the README
```

- **The scoring rules** (`test/score.test.js`): every rule in section 5; the Wilson figures against
  Newcombe (1998) Table I and the sibling tools' published figures; the spot-check plans against a
  separate exact search, and that each plan is the smallest that works; the link format, including
  hostile and out-of-date links; and that typed text can't format, link, embed or inject anything
  in the Markdown copy.
- **The questions' own rules** (`test/checklist.test.js`): twelve, numbered in order, one thing each,
  short enough, prerequisites first, no design counting a question whose prerequisite it doesn't
  count, every source real, and every number quoted from the statistics recomputed.
- **The docs** (`test/docs.test.js`): the generated tables, including every figure in section 6,
  match the shipped code; every reference is cited and every citation has a reference; every local
  link resolves; no file holds a stray control character; and the README's test count is right.
- **The tests themselves** (`audit/mutants.js`): each deliberate bug in the scoring or the
  questions' wiring has to make at least one test fail.

GitHub Actions runs the tests on Linux and Windows on Node 18, 22 and 24, and the deliberate-bug
check once, on every push.

## 12. Glossary

| Plain words here | Technical term |
|---|---|
| answer key | gold-standard labelled test set, golden set |
| tick | one condition of a do-confirm checklist item |
| silent error | an error in an output released without human review |
| silent error rate | selective risk at the operating threshold |
| share that goes out unchecked | coverage, straight-through rate |
| likely range | 95% Wilson score confidence interval |
| limit | risk tolerance, error budget |
| hard stop | guardrail, interlock, mistake-proofing |
| records it wasn't tuned on | held-out test set |
| planted mistakes | known-positive probes, a seeded-error audit of reviewers |
| spot checks with a stop rule | post-deployment monitoring by acceptance sampling |
| inputs drift | distribution shift |
| one gap is enough | conjunctive (non-compensatory) decision rule |
| design | level of automation |

## 13. What the review of version 1 changed

| Finding | Change |
|---|---|
| A supervised "ready" contained no measurement: it assumed reviewers never miss. | Question 8 now plants mistakes and requires reviewers to catch them, with its limits stated in section 6. "Safely run" is gone from the page. |
| The designs contradicted the bars: routine review could satisfy the hard stop, and an "automatic" design could send work to a person. | Question 6 asks for a rule or permission limit, not judgment. "Automatic" means nothing ever waits for a person. |
| The stop rule rarely fired, and a running total hid drift. | Weekly samples with a stop count, sized from the limit to two stated targets (section 6). |
| Testing until it passes inflated the chance of a wrong yes. | Question 5's bar asks for a test size fixed in advance and the first run; the advice after a no is a new, planned test. The inflation is quantified in section 6. |
| Records aren't independent; runs could be cherry-picked. | Section 6 covers clustering; question 5 asks for the first run and for each story or case counted once. |
| Bars with several conditions invited a yes when most were met. | Every condition has its own tick; the yes is worked out. |
| The evidence question could be answered yes by hand, and didn't rest on the hold-out question. | It is now question 5, after the hold-out question it rests on, and can only be a yes when the numbers pass. |
| Review steps could carry on by themselves on a timeout; a review nobody answers could vanish. | Question 7 asks that a timeout stops the record; question 10 counts an unanswered review as needing an alert. |
| Worked examples broke the checklist's own rules. | Section 8 re-scored with the dependency rule applied. |
| A find-and-replace had corrupted text on the page. | Fixed, with a test that no file holds a control character. |

## References

<!-- generated:references -->
- Armitage, P., McPherson, C. K., & Rowe, B. C. (1969). Repeated significance tests on accumulating data. *Journal of the Royal Statistical Society: Series A (General), 132*(2), 235–244. https://doi.org/10.2307/2343787
- Atıl, B., Aykent, S., Chittams, A., Fu, L., Passonneau, R. J., Radcliffe, E., Rajagopal, G. R., Sloan, A., Tudrej, T., Ture, F., Wu, Z., Xu, L., & Baldwin, B. (2025). Non-determinism of “deterministic” LLM system settings in hosted environments. In *Proceedings of the 5th Workshop on Evaluation and Comparison of NLP Systems (Eval4NLP)* (pp. 135–148). Association for Computational Linguistics. https://doi.org/10.18653/v1/2025.eval4nlp-1.12
- Ayre, C., & Scally, A. J. (2014). Critical values for Lawshe’s content validity ratio: Revisiting the original methods of calculation. *Measurement and Evaluation in Counseling and Development, 47*(1), 79–86. https://doi.org/10.1177/0748175613513808
- Bainbridge, L. (1983). Ironies of automation. *Automatica, 19*(6), 775–779. https://doi.org/10.1016/0005-1098(83)90046-8
- Berzak, Y., Huang, Y., Barbu, A., Korhonen, A., & Katz, B. (2016). Anchoring and agreement in syntactic annotations. In *Proceedings of the 2016 Conference on Empirical Methods in Natural Language Processing* (pp. 2215–2224). Association for Computational Linguistics. https://doi.org/10.18653/v1/D16-1239
- Beyer, B., Jones, C., Petoff, J., & Murphy, N. R. (Eds.). (2016). *Site reliability engineering: How Google runs production systems*. O’Reilly Media. Chapter 3, “Embracing risk.” https://sre.google/sre-book/embracing-risk/
- Breck, E., Cai, S., Nielsen, E., Salib, M., & Sculley, D. (2017). The ML test score: A rubric for ML production readiness and technical debt reduction. In *2017 IEEE International Conference on Big Data* (pp. 1123–1132). IEEE. https://doi.org/10.1109/BigData.2017.8258038
- Brown, L. D., Cai, T. T., & DasGupta, A. (2001). Interval estimation for a binomial proportion. *Statistical Science, 16*(2), 101–133. https://doi.org/10.1214/ss/1009213286
- Cawley, G. C., & Talbot, N. L. C. (2010). On over-fitting in model selection and subsequent selection bias in performance evaluation. *Journal of Machine Learning Research, 11*, 2079–2107. https://jmlr.org/papers/v11/cawley10a.html
- Chen, L., Zaharia, M., & Zou, J. (2024). How is ChatGPT’s behavior changing over time? *Harvard Data Science Review, 6*(2). https://doi.org/10.1162/99608f92.5317da47
- Chow, C. K. (1970). On optimum recognition error and reject tradeoff. *IEEE Transactions on Information Theory, 16*(1), 41–46. https://doi.org/10.1109/TIT.1970.1054406
- Cochran, W. G. (1977). *Sampling techniques* (3rd ed.). Wiley. <https://openlibrary.org/books/OL4534980M>
- Cohen, J. (1960). A coefficient of agreement for nominal scales. *Educational and Psychological Measurement, 20*(1), 37–46. https://doi.org/10.1177/001316446002000104
- Degani, A., & Wiener, E. L. (1993). Cockpit checklists: Concepts, design, and use. *Human Factors, 35*(2), 345–359. https://doi.org/10.1177/001872089303500209
- Dwork, C., Feldman, V., Hardt, M., Pitassi, T., Reingold, O., & Roth, A. (2015). The reusable holdout: Preserving validity in adaptive data analysis. *Science, 349*(6248), 636–638. https://doi.org/10.1126/science.aaa9375
- Einhorn, H. J. (1970). The use of nonlinear, noncompensatory models in decision making. *Psychological Bulletin, 73*(3), 221–230. https://doi.org/10.1037/h0028695
- European Union. (2024). Regulation (EU) 2024/1689 of the European Parliament and of the Council of 13 June 2024 laying down harmonised rules on artificial intelligence (Artificial Intelligence Act). *Official Journal of the European Union*, L, 12.7.2024. http://data.europa.eu/eli/reg/2024/1689/oj
- Fort, K., & Sagot, B. (2010). Influence of pre-annotation on POS-tagged corpus development. In *Proceedings of the Fourth Linguistic Annotation Workshop* (pp. 56–63). Association for Computational Linguistics. https://aclanthology.org/W10-1807/
- Gawande, A. (2009). *The checklist manifesto: How to get things right*. Metropolitan Books. <https://openlibrary.org/books/OL23944743M>
- Geifman, Y., & El-Yaniv, R. (2017). Selective classification for deep neural networks. In *Advances in Neural Information Processing Systems 30* (pp. 4878–4887). https://proceedings.neurips.cc/paper/2017/hash/4a8423d5e91fda00bb7e46540e2b0cf1-Abstract.html
- Greshake, K., Abdelnabi, S., Mishra, S., Endres, C., Holz, T., & Fritz, M. (2023). Not what you’ve signed up for: Compromising real-world LLM-integrated applications with indirect prompt injection. In *Proceedings of the 16th ACM Workshop on Artificial Intelligence and Security* (pp. 79–90). ACM. https://doi.org/10.1145/3605764.3623985
- Hanley, J. A., & Lippman-Hand, A. (1983). If nothing goes wrong, is everything all right? Interpreting zero numerators. *JAMA, 249*(13), 1743–1745. https://doi.org/10.1001/jama.1983.03330370053031
- Haynes, A. B., Weiser, T. G., Berry, W. R., Lipsitz, S. R., Breizat, A.-H. S., Dellinger, E. P., Herbosa, T., Joseph, S., Kibatala, P. L., Lapitan, M. C. M., Merry, A. F., Moorthy, K., Reznick, R. K., Taylor, B., & Gawande, A. A. (2009). A surgical safety checklist to reduce morbidity and mortality in a global population. *New England Journal of Medicine, 360*(5), 491–499. https://doi.org/10.1056/NEJMsa0810119
- Huber, D. (2026). *workflow-eval-harness* [Computer software]. GitHub. https://github.com/DHuberPortfolio/workflow-eval-harness
- Kish, L. (1965). *Survey sampling*. Wiley. <https://openlibrary.org/books/OL5947497M>
- Krosnick, J. A. (1991). Response strategies for coping with the cognitive demands of attitude measures in surveys. *Applied Cognitive Psychology, 5*(3), 213–236. https://doi.org/10.1002/acp.2350050305
- Krosnick, J. A., Holbrook, A. L., Berent, M. K., Carson, R. T., Hanemann, W. M., Kopp, R. J., Mitchell, R. C., Presser, S., Ruud, P. A., Smith, V. K., Moody, W. R., Green, M. C., & Conaway, M. (2002). The impact of “no opinion” response options on data quality: Non-attitude reduction or an invitation to satisfice? *Public Opinion Quarterly, 66*(3), 371–403. https://doi.org/10.1086/341394
- Krosnick, J. A., & Presser, S. (2010). Question and questionnaire design. In P. V. Marsden & J. D. Wright (Eds.), *Handbook of survey research* (2nd ed., pp. 263–313). Emerald. <https://web.stanford.edu/dept/communication/faculty/krosnick/docs/2010/2010%20Handbook%20of%20Survey%20Research.pdf>
- Lawshe, C. H. (1975). A quantitative approach to content validity. *Personnel Psychology, 28*(4), 563–575. https://doi.org/10.1111/j.1744-6570.1975.tb01393.x
- Mitchell, M., Wu, S., Zaldivar, A., Barnes, P., Vasserman, L., Hutchinson, B., Spitzer, E., Raji, I. D., & Gebru, T. (2019). Model cards for model reporting. In *Proceedings of the Conference on Fairness, Accountability, and Transparency* (pp. 220–229). ACM. https://doi.org/10.1145/3287560.3287596
- n8n. (n.d.-a). *Handle errors gracefully*. n8n Docs. Retrieved October 15, 2026, from https://docs.n8n.io/build/flow-logic/handle-errors-gracefully
- n8n. (n.d.-b). *Human-in-the-loop for AI tool calls*. n8n Docs. Retrieved October 15, 2026, from https://docs.n8n.io/build/integrate-ai/ai-examples/human-in-the-loop-for-tools
- National Institute of Standards and Technology. (2023). *Artificial intelligence risk management framework (AI RMF 1.0)* (NIST AI 100-1). U.S. Department of Commerce. https://doi.org/10.6028/NIST.AI.100-1
- National Institute of Standards and Technology. (2024). *Artificial intelligence risk management framework: Generative artificial intelligence profile* (NIST AI 600-1). U.S. Department of Commerce. https://doi.org/10.6028/NIST.AI.600-1
- Newcombe, R. G. (1998). Two-sided confidence intervals for the single proportion: Comparison of seven methods. *Statistics in Medicine, 17*(8), 857–872. <https://pubmed.ncbi.nlm.nih.gov/9595616/>
- Oakden-Rayner, L., Dunnmon, J., Carneiro, G., & Ré, C. (2020). Hidden stratification causes clinically meaningful failures in machine learning for medical imaging. In *Proceedings of the ACM Conference on Health, Inference, and Learning* (pp. 151–159). ACM. https://doi.org/10.1145/3368555.3384468
- OWASP GenAI Security Project. (2024). *OWASP top 10 for LLM applications 2025* (Version 2025, November 18, 2024). OWASP Foundation. https://genai.owasp.org/resource/owasp-top-10-for-llm-applications-2025/
- Page, E. S. (1954). Continuous inspection schemes. *Biometrika, 41*(1/2), 100–115. https://doi.org/10.1093/biomet/41.1-2.100
- Parasuraman, R., & Manzey, D. H. (2010). Complacency and bias in human use of automation: An attentional integration. *Human Factors, 52*(3), 381–410. https://doi.org/10.1177/0018720810376055
- Parasuraman, R., Sheridan, T. B., & Wickens, C. D. (2000). A model for types and levels of human interaction with automation. *IEEE Transactions on Systems, Man, and Cybernetics, Part A: Systems and Humans, 30*(3), 286–297. https://doi.org/10.1109/3468.844354
- Rabanser, S., Günnemann, S., & Lipton, Z. C. (2019). Failing loudly: An empirical study of methods for detecting dataset shift. In *Advances in Neural Information Processing Systems 32* (pp. 1396–1408). https://proceedings.neurips.cc/paper/2019/hash/846c260d715e5b854ffad5f70a516c88-Abstract.html
- Reason, J. (2000). Human error: Models and management. *BMJ, 320*(7237), 768–770. https://doi.org/10.1136/bmj.320.7237.768
- Recht, B., Roelofs, R., Schmidt, L., & Shankar, V. (2019). Do ImageNet classifiers generalize to ImageNet? In *Proceedings of the 36th International Conference on Machine Learning* (PMLR 97, pp. 5389–5400). https://proceedings.mlr.press/v97/recht19a.html
- Ribeiro, M. T., Wu, T., Guestrin, C., & Singh, S. (2020). Beyond accuracy: Behavioral testing of NLP models with CheckList. In *Proceedings of the 58th Annual Meeting of the Association for Computational Linguistics* (pp. 4902–4912). Association for Computational Linguistics. https://doi.org/10.18653/v1/2020.acl-main.442
- Sculley, D., Holt, G., Golovin, D., Davydov, E., Phillips, T., Ebner, D., Chaudhary, V., Young, M., Crespo, J.-F., & Dennison, D. (2015). Hidden technical debt in machine learning systems. In *Advances in Neural Information Processing Systems 28* (pp. 2503–2511). https://proceedings.neurips.cc/paper/2015/hash/86df7dcfd896fcaf2674f757a2463eba-Abstract.html
- Wilson, E. B. (1927). Probable inference, the law of succession, and statistical inference. *Journal of the American Statistical Association, 22*(158), 209–212. https://doi.org/10.1080/01621459.1927.10502953
- Wolfe, J. M., Horowitz, T. S., & Kenner, N. M. (2005). Rare items often missed in visual searches. *Nature, 435*(7041), 439–440. https://doi.org/10.1038/435439a
- Xiong, M., Hu, Z., Lu, X., Li, Y., Fu, J., He, J., & Hooi, B. (2024). Can LLMs express their uncertainty? An empirical evaluation of confidence elicitation in LLMs. In *The Twelfth International Conference on Learning Representations*. https://openreview.net/forum?id=gjeQKFxFpZ
- Zapier. (n.d.-a). *Manage notifications when errors occur in Zap workflows*. Zapier Help Center. Retrieved October 15, 2026, from https://help.zapier.com/hc/en-us/articles/8496289225229
- Zapier. (n.d.-b). *Use Human in the Loop to pause Zap workflows pending human review*. Zapier Help Center. Retrieved October 15, 2026, from https://help.zapier.com/hc/en-us/articles/38733184458765
- Zheng, L., Chiang, W.-L., Sheng, Y., Zhuang, S., Wu, Z., Zhuang, Y., Lin, Z., Li, Z., Li, D., Xing, E. P., Zhang, H., Gonzalez, J. E., & Stoica, I. (2023). Judging LLM-as-a-judge with MT-Bench and Chatbot Arena. In *Advances in Neural Information Processing Systems 36* (Datasets and Benchmarks Track, pp. 46595–46623). https://doi.org/10.52202/075280-2020
<!-- /generated:references -->
