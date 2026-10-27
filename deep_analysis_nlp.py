"""
deep_analysis_nlp.py — Psyche's deep-analysis NLP engine.

Generates the 9 expanded-explanation categories (Strength, Weakness,
Shadow, Emotional Side, Critical & Logical Side, Relationship Handling,
Social Side, Dark Traits, Career) plus a dynamic 20-facts list.

Design principle, matching the rest of Psyche: the ASSESSMENT (which
questions map to which score) is deterministic and never changes. The
EXPLANATION layer on top of a computed score is generative — built at
call time from templated fragments, ranked and selected by how extreme
each of the person's five dimensions actually is, so two people who land
on the same archetype but with different underlying numbers get
genuinely different, individually-grounded paragraphs, not the same
static block of text. No external API, no key, fully offline.

Architecture:
  - IMPLICATIONS: 9 categories x 5 dimensions x 3 bands (low/mid/high),
    each entry a list of 2 template sentences (fixed text, no slots —
    these are already dimension-specific, unlike the facet-level
    templates elsewhere in Psyche which fill a trait/domain slot).
  - generate_section(): ranks the 5 dimensions by distance from the
    neutral midpoint (50), takes the top 3 (the most defining ones for
    THIS person), pulls one sentence per dimension from the matching
    category+band pool (deterministic seeded pick), and assembles them
    into one paragraph with connective phrasing. Every category also
    gets one archetype-anchored opening sentence (pulled from the
    existing hand-written ARCH strengths/weakness/shadow fields, ported
    in via `anchor_*` parameters) so the generated paragraph stays tied
    to the archetype's authored voice rather than reading generic.
  - generate_20_facts(): one magnitude-aware sentence per facet (20
    total), reusing the same seeded-pick determinism as the rest of
    Psyche's facet-level generation.
"""

import hashlib
import random

DIMENSIONS = ["P", "R", "I", "S", "M"]
DIM_NAMES = {"P": "Perception", "R": "Response", "I": "Identity", "S": "Social", "M": "Motivation"}


# ---------------------------------------------------------------------------
# DETERMINISTIC SEEDING (same pattern used throughout the rest of Psyche)
# ---------------------------------------------------------------------------

def _seed(key: str) -> int:
    return int(hashlib.md5(key.encode()).hexdigest(), 16)


def _pick(options, seed):
    return options[seed % len(options)]


def _band(score: int) -> str:
    if score < 34:
        return "low"
    if score < 67:
        return "mid"
    return "high"


# ---------------------------------------------------------------------------
# IMPLICATIONS — 9 categories x 5 dimensions x 3 bands
# ---------------------------------------------------------------------------

IMPLICATIONS = {

    # ---------------------------------------------------------------- STRENGTH
    "strength": {
        "P": {
            "low": ["A concrete-first Perception means your strength is trustworthy execution — what you say is checkable is checkable, every time.",
                    "You build credibility through consistency: people learn quickly that your read of a situation matches what's actually there."],
            "mid": ["A balanced Perception lets you shift between detail and big picture on demand, which makes you genuinely useful in rooms that need both.",
                    "You're rarely the wrong tool for the job here — you can zoom in or out as the moment actually requires."],
            "high": ["A strongly conceptual Perception means you spot the shape of a problem before most people have finished describing it.",
                     "You connect distant dots quickly, which lets you see risks and openings that a narrower view would miss entirely."],
        },
        "R": {
            "low": ["A deliberate Response style means your calls hold up under scrutiny — you'd rather be right a beat later than fast and wrong.",
                    "Your strength is resistance to panic: pressure rarely rushes you into a decision you haven't actually thought through."],
            "mid": ["A balanced Response means you can move fast when it's warranted and slow down when it matters, without defaulting to either extreme.",
                    "You read the actual stakes of a moment accurately, which is rarer than it sounds."],
            "high": ["A fast Response style is a genuine edge in anything time-sensitive — you're already acting while others are still weighing options.",
                     "You convert intent into motion almost immediately, which compounds heavily over a long enough timeline."],
        },
        "I": {
            "low": ["A still-forming Identity is a strength in disguise: you stay genuinely open to feedback that would bounce off someone more fixed.",
                    "You adapt your self-concept faster than most, which means growth periods actually change you instead of just informing you."],
            "mid": ["Your Identity is settled enough to hold steady, with enough flexibility left that you're not defending a version of yourself that's stopped being true.",
                    "You can take real criticism without it costing you your footing, while still updating on what's actually correct."],
        },
        "S": {
            "high": ["A high Social score is a real strength in anything that runs through people — you build the kind of trust that makes collaboration actually work instead of just happen on paper.",
                     "You read a room accurately and adjust in real time, which makes you genuinely effective in group settings most people find draining."],
            "low": ["A more solitary Social style is a strength where deep, uninterrupted focus matters more than constant coordination — your best output often comes from stretches nobody else is managing.",
                    "You form fewer but realer connections, and the depth there tends to outlast the breadth other people accumulate."],
        },
        "M": {
            "high": ["A high Motivation score means you sustain effort past the point most people quit, especially once there's a visible way to track the progress.",
                     "You convert ambition into consistent output rather than just talk, which compounds heavily over time."],
            "low": ["An internally-driven Motivation is a real strength in unglamorous, long-haul work — you don't need applause to keep going, which most sustained work actually requires."],
        },
    },
    "weakness": {
        "P": {
            "low": ["A concrete-only lens can blind you to a real risk that hasn't shown up as a fact yet — by the time it's checkable, it may be too late to act on cheaply.",
                    "You can under-credit a colleague's hunch simply because it isn't backed by data yet, even when the hunch is right."],
            "mid": ["Your flexibility between detail and big-picture can tip into indecision about which lens a given moment actually calls for.",
                    "Without a forcing function, you can drift between modes rather than committing to the one the situation needs."],
            "high": ["A strongly conceptual lens can lead you to act on a pattern before it's actually confirmed, mistaking a plausible story for a proven one.",
                     "You can lose people who need the concrete version of your idea before they'll trust the abstract one."],
        },
        "R": {
            "low": ["Deliberation has a real cost: opportunities with a short window will sometimes close while you're still confirming.",
                    "People who need a fast answer can read your careful pace as reluctance or disinterest, even when it's neither."],
            "high": ["Speed can outrun judgment — you're at real risk of acting on the first workable idea instead of the best one.",
                     "You can leave people behind who process at a normal pace, making them feel steamrolled rather than led."],
        },
        "I": {
            "low": ["An unsettled Identity means outside opinions can carry more weight than they should, especially from people who don't have your interests in mind.",
                    "You can end up shaped more by whoever spoke last than by your own considered view."],
            "high": ["A firmly settled Identity can calcify into defensiveness when a genuinely good counter-argument shows up.",
                     "You can mistake consistency for correctness, holding a position past the point where it stopped being the right one."],
        },
        "S": {
            "high": ["A strong pull toward people can become a dependency on their approval — decisions start bending toward what keeps the room comfortable rather than what's actually right.",
                     "You can over-index on group harmony, avoiding a necessary disagreement specifically because it would create friction."],
            "low": ["A strong pull toward solitude can tip into isolating yourself right when support would genuinely help, mistaking independence for the healthier option by default.",
                    "You can under-communicate simply because reaching out doesn't occur to you as the obvious move, even when it would clearly help."],
        },
        "M": {
            "high": ["A strong external drive can mean the work stops feeling worthwhile the moment the metric disappears, even if the underlying work hasn't changed at all.",
                     "You can chase the next visible milestone at the cost of depth, moving on before something is actually finished well."],
            "low": ["An internally-driven Motivation can mean you undersell real progress to other people, since you were never tracking it the way they expect to see it tracked.",
                    "You can stay in something past the point it's serving you, because the internal sense of meaning is slower to update than an external metric would be."],
        },
    },

    # ---------------------------------------------------------------- SHADOW
    "shadow": {
        "P": {
            "high": ["Under real stress, the conceptual gift can invert into paranoia-adjacent pattern-seeking — connecting dots that aren't actually related and treating the story as fact.",
                     "The shadow side of insight is certainty without verification; unchecked, this becomes conviction built on nothing but a compelling narrative."],
            "low": ["Under stress, concreteness can collapse into rigid literalism — refusing any interpretation beyond the strictly provable, even when nuance is exactly what's needed.",
                    "The shadow here is willful blindness to anything that can't be immediately proven, used as an excuse to avoid an uncomfortable but real possibility."],
        },
        "R": {
            "high": ["Under pressure, fast Response can shadow into impulsivity that actively damages what patience would have protected — burning a relationship or a deal to avoid the discomfort of waiting.",
                     "The shadow side of speed is using motion to avoid feeling — staying busy specifically so there's no room left to sit with something difficult."],
            "low": ["Under stress, deliberation can shadow into paralysis dressed up as diligence — endlessly gathering more information as a way to avoid ever having to decide.",
                    "The shadow here is using caution as cover for avoidance, letting 'not enough information yet' become a permanent excuse."],
        },
        "I": {
            "high": ["Under threat, a settled Identity can shadow into rigid superiority — treating disagreement as an attack rather than information, and needing to win rather than needing to be right.",
                     "The shadow side of a strong self is contempt for people who seem less certain, mistaking their openness for weakness."],
            "low": ["Under stress, a forming Identity can shadow into chameleon behavior — becoming whoever the room seems to reward, with no throughline left to call a self.",
                    "The shadow here is losing track of what you actually think once enough people have disagreed with you."],
        },
        "S": {
            "low": ["Under real stress, self-sufficiency can shadow into a kind of quiet contempt for people who need more support than you do, mistaking your tolerance for pain as a standard everyone should meet.",
                    "The shadow side of independence is disappearing exactly when someone needed you present, and calling it self-reliance instead of what it is."],
            "high": ["Under real stress, a strong pull toward people can shadow into using the group as an escape from something that actually needs to be faced alone first.",
                     "The shadow side of connection-seeking is difficulty tolerating your own company long enough to hear what you actually think."],
        },
        "M": {
            "high": ["Under real stress, strong drive can shadow into treating rest as failure, running yourself down specifically because slowing down feels like losing.",
                     "The shadow side of high Motivation is tying your worth entirely to output, so a bad week starts to feel like a referendum on you."],
            "low": ["Under real stress, internal motivation can shadow into quiet resignation — a story that nothing you do matters much, dressed up as being above needing recognition.",
                    "The shadow side here is using 'I don't need external validation' as cover for having stopped caring, rather than genuine equanimity."],
        },
    },

    # ---------------------------------------------------------------- EMOTIONAL
    "emotional": {
        "P": {
            "high": ["Emotionally, a conceptual lens means feelings often arrive already wrapped in a story about what they mean, which can put real distance between you and the raw feeling itself.",
                     "You process emotion by understanding it first — naming what's happening is often the doorway into actually feeling it."],
            "low": ["Emotionally, a concrete lens means feelings register as physical, immediate facts before they register as ideas — you know something's wrong in your body before you can explain why.",
                    "You trust an emotion more once you can point to what caused it; free-floating feelings with no clear source are the hardest for you to sit with."],
        },
        "R": {
            "high": ["Emotionally, you tend to discharge feeling through action — moving, doing, fixing — rather than sitting still with it, which works until the feeling is one action can't resolve.",
                     "You feel most in control of an emotion once you've done something about it, even if the something is small."],
            "low": ["Emotionally, you process by turning inward first, which means people can misread your quiet as absence of feeling when it's actually the opposite.",
                    "You need real time alone with a feeling before you can talk about it usefully — being pushed to respond early often produces a worse answer than waiting would."],
        },
        "S": {
            "high": ["Emotionally, connection with other people is a genuine regulator for you — talking something through with someone is often how the feeling actually resolves, not just how it gets described.",
                     "Isolation during a hard stretch costs you more than the hard stretch itself; you're built to co-regulate, not to white-knuckle it alone."],
            "low": ["Emotionally, you regulate best in solitude — a room full of well-meaning support can actually slow down your process rather than speed it up.",
                    "You need to metabolize a feeling privately before you're ready to let anyone else see it, and that's not avoidance, it's your actual order of operations."],
        },
        "I": {
            "high": ["Emotionally, a settled Identity means feelings rarely destabilize your sense of who you are — you can be upset without that upset becoming a crisis of self.",
                     "You tend to metabolize hard emotions without losing your footing, which makes you a genuinely steady presence for people going through something you're not."],
            "low": ["Emotionally, a still-forming Identity means feelings can carry outsized weight in shaping how you see yourself — a hard week can genuinely shift your self-concept, not just your mood.",
                    "You're unusually responsive to how other people's reactions make you feel about yourself, for better and worse."],
        },
        "M": {
            "high": ["Emotionally, high Motivation means frustration tends to show up as restlessness — an itch to do something about the feeling rather than simply have it.",
                     "You feel most settled once there's visible movement toward a goal; stagnation registers as a genuinely uncomfortable emotional state, not just an inconvenience."],
            "low": ["Emotionally, internal drive means your mood is less tied to external wins than most people's — a quiet, unremarkable day doesn't threaten your sense of things being okay.",
                    "You're less prone to the emotional swings that come from chasing visible milestones, since your sense of okay was never built on them."],
        },
    },

    # --------------------------------------------------------- CRITICAL & LOGICAL
    "logical": {
        "P": {
            "high": ["Your reasoning style favors synthesis over sequence — you often arrive at a correct conclusion before you can fully articulate the steps that got you there.",
                     "You're strongest in ambiguous, underspecified problems where the pattern matters more than a clean procedure."],
            "low": ["Your reasoning style is procedural and verifiable — you can show your work, and that work holds up, because each step is checked against something real.",
                    "You're strongest in well-defined problems where a clear method exists and following it correctly is what actually matters."],
        },
        "R": {
            "high": ["Logically, you test ideas by trying them rather than fully modeling them first — real-world feedback corrects your thinking faster than more analysis would.",
                     "You reason iteratively: a rough answer now, refined by what actually happens, rather than a perfect answer arrived at slowly."],
            "low": ["Logically, you model a problem thoroughly before acting on it, which catches errors a faster thinker would only discover the expensive way.",
                    "You reason by elimination — ruling out what's wrong before committing to what's right — which is slower but more reliable under complexity."],
        },
        "I": {
            "high": ["Your critical thinking holds a stable frame under pressure — you don't abandon a sound argument just because it's unpopular in the room.",
                     "You're resistant to social proof as a substitute for evidence; a claim doesn't get more true because more people believe it."],
            "low": ["Your critical thinking stays genuinely open to revision — you update on new evidence faster than someone more anchored to their prior conclusions would.",
                    "You're unusually willing to be wrong out loud, which makes your reasoning process more honest even when it's less polished."],
        },
        "S": {
            "high": ["Your reasoning sharpens when it's done out loud with someone else — talking through a problem often surfaces the flaw in it faster than thinking alone would.",
                     "You reason better with a sounding board; a second perspective mid-thought catches errors your own momentum would carry past."],
            "low": ["Your reasoning is strongest in solitude — an interruption mid-thought costs you more than most people, since you were building something that needed the whole thread intact.",
                    "You think most clearly with no audience at all, since the presence of another person changes what you're willing to consider out loud."],
        },
        "M": {
            "high": ["Your reasoning is outcome-oriented — you evaluate an argument partly by what it would mean to act on it, not just by whether it's internally consistent.",
                     "You're impatient with analysis that doesn't eventually cash out into a decision; reasoning for its own sake holds less appeal than reasoning toward a move."],
            "low": ["Your reasoning tolerates open-endedness well — you can sit with an unresolved question far longer than someone who needs analysis to end in action.",
                    "You're comfortable concluding 'more evidence is needed' and actually stopping there, rather than forcing a premature decision."],
        },
    },

    # --------------------------------------------------------- RELATIONSHIP HANDLING
    "relationship_handling": {
        "R": {
            "high": ["In practice, you handle relationship friction by addressing it the moment you notice it — which resolves things quickly but can outpace a partner who needs more time to find their words.",
                     "You default to fixing a relationship problem fast; the risk is treating 'resolved' and 'actually understood' as the same thing when they aren't."],
            "mid": ["In practice, you can match a partner's urgency in a real crisis and still take your time on things that don't need an immediate answer — which most partners read as genuinely responsive rather than either rushed or distant.",
                    "You handle relationship friction by roughly matching its actual size — small things get a quick word, bigger things get real time, rather than defaulting to one pace for everything."],
            "low": ["In practice, you handle relationship friction by processing it internally first, then bringing a considered response — which reads as calm to some people and as distant to others until you say so out loud.",
                    "You rarely say something in a close relationship you'll regret, because you rarely say anything before you've actually thought it through."],
        },
        "I": {
            "high": ["You handle closeness from a stable center — a partner or friend in a hard patch can lean on you without your own footing being at risk.",
                     "Your consistency is a real asset in long relationships; people know which version of you they're getting, every time."],
            "mid": ["You handle closeness from a settled-enough sense of self that you can be genuinely influenced by someone you love without losing your footing — real compromise without self-erasure.",
                    "You can let a relationship change you in the ways that matter while staying recognizably yourself in the ways that matter more."],
            "low": ["You handle closeness with real permeability — the people you're close to visibly shape who you're becoming, for better or worse depending on who they are.",
                    "A relationship can meaningfully change you right now, which is a strength with the right person and a real risk with the wrong one."],
        },
        "S": {
            "high": ["You handle relationships through frequent, active engagement — regular contact isn't optional maintenance for you, it's the actual substance of the bond.",
                     "Distance reads as a real signal to you, sometimes more than it was meant to; you notice a gap in contact faster than most people intend one to be noticed."],
            "mid": ["You handle contact flexibly — comfortable with a busy, connected stretch and equally comfortable with a quieter one, without reading either as a sign something's wrong.",
                    "Neither constant contact nor a lot of separate space defines a relationship for you; you adjust to what the week actually allows without much friction either way."],
            "low": ["You handle relationships with real trust in the quiet stretches — you don't need constant contact to feel the bond is intact.",
                    "You show care through consistency over time rather than through frequency, which the right partner reads correctly and the wrong one reads as distance."],
        },
        "P": {
            "high": ["you read unstated needs quickly \u2014 you often notice what a partner needs before they've said it, which is a real gift as long as you check the read rather than acting on assumption alone.",
                     "you pick up on the emotional subtext of a relationship fast, sometimes faster than the other person has consciously registered it themselves."],
            "mid": ["you read a relationship's unstated currents reasonably well without over-relying on inference — you'll pick up on a real shift, but you're not prone to constructing a story from a single ambiguous moment.",
                    "you balance what's said with what's implied fairly evenly, checking a hunch against the actual words rather than treating either alone as the full picture."],
            "low": ["you take a partner's words at face value rather than reading between the lines \u2014 plain, direct communication works far better for you than expecting either of you to intuit the unsaid.",
                    "you build trust through concrete follow-through rather than emotional intuition, and you connect best with people who operate the same way."],
        },
        "M": {
            "high": ["you bring a real pull toward shared forward motion \u2014 a relationship that feels static, with no sense of building toward something, wears on you faster than most people.",
                     "you tend to bring goals into close relationships, whether shared plans or mutual growth, and a partner who doesn't want that framing can feel like friction to you."],
            "mid": ["you want a relationship that feels good day-to-day AND has some sense of shared direction \u2014 pure stasis and pure milestone-chasing would both eventually feel incomplete to you.",
                    "you hold shared goals loosely enough that a relationship without a fixed trajectory still feels worthwhile, as long as it isn't going nowhere entirely."],
            "low": ["you're comfortable with a relationship simply being good day to day, without needing a visible trajectory to prove it's working \u2014 presence matters more to you than momentum."],
        },
    },

    # ---------------------------------------------------------------- SOCIAL
    "social": {
        "S": {
            "high": ["Socially, you're energized by groups rather than drained by them — a full room is fuel, not a tax on your attention.",
                     "You read group dynamics quickly and tend to become a natural connector, introducing people who should know each other before anyone asks you to."],
            "low": ["Socially, your real strength shows in one-on-one or small settings — depth with a few people matters more to you than reach across many.",
                    "You conserve social energy deliberately, which means the time you do spend with people tends to be genuinely present rather than performed."],
        },
        "R": {
            "high": ["Socially, you tend to set the pace of a group — conversations and plans move at your tempo more often than you probably realize.",
                     "You're usually the one who turns a stalled group decision into forward motion, for better or worse depending on whether the group was ready."],
            "low": ["Socially, you let a group find its own rhythm rather than pushing it — which builds real trust over time, even if it means you're rarely the loudest voice in the room."],
        },
        "I": {
            "high": ["Socially, you hold your position in a group without needing the room's approval to feel steady, which tends to make you a stabilizing presence when a group is under strain.",
                     "You're comfortable being the dissenting voice when the group consensus seems wrong, which not everyone in a room can afford to be."],
            "low": ["Socially, you're genuinely responsive to a group's mood and norms, adapting quickly — which makes you easy to be around, sometimes at the cost of your own stated preferences."],
        },
        "P": {
            "high": ["Socially, you're often the one who notices the undercurrent in a group before anyone names it — tension, excitement, fatigue — which makes you useful in reading a room's real state.",
                     "You pick up on social dynamics quickly, which can make you a natural mediator even when nobody asked you to fill that role."],
            "low": ["Socially, you take people at their word rather than reading subtext into every interaction, which makes you refreshingly direct to be around, if occasionally less attuned to what's unsaid."],
        },
        "M": {
            "high": ["Socially, you tend to pull a group toward a shared goal rather than just shared time — hangouts with no purpose can feel less satisfying to you than most people.",
                     "You're the one who turns a group's vague intention into an actual plan, which people rely on you for whether or not it's asked of you directly."],
            "low": ["Socially, you're genuinely content with unstructured time together — a group doesn't need a purpose for you to value being in it."],
        },
    },

    # ------------------------------------------------------------ DARK TRAITS
    # Framed descriptively and cautionarily, not as a badge — this section
    # names real tendencies people can carry without acting on them, so
    # someone can recognize and manage a pattern rather than being blindsided
    # by it later. Not present at all bands; only genuinely relevant ranges
    # get an entry, since not everyone has a strong dark-trait signal.
    "dark_traits": {
        "I": {
            "high": ["At the far end, a very settled sense of self can tip into a genuine unwillingness to be told you're wrong by anyone, which in group settings can look like quiet control rather than confidence.",
                     "Worth naming plainly: strong self-certainty, left unchecked, can shade into dismissing other people's reality when it conflicts with your own."],
        },
        "R": {
            "high": ["At the far end, very fast Response can tip into using urgency as a tool — creating pressure in other people to get a decision made before they've had room to think it through.",
                     "Worth naming plainly: speed can be used, consciously or not, to out-pace someone else's ability to object."],
        },
        "S": {
            "low": ["At the far end, strong self-sufficiency can tip into using distance as leverage — withdrawing attention or contact as a way to influence someone rather than as genuine need for space.",
                     "Worth naming plainly: the ability to disengage cleanly is a real strength, and a real risk if it's ever used to punish rather than to recover."],
        },
        "P": {}, "M": {},
    },

    # ------------------------------------------------------- AT YOUR BEST
    # Distinct from "strength" (capability) — this is about the CONDITIONS
    # under which a dimension gets to express itself well, not what you're
    # good at in the abstract.
    "at_best": {
        "P": {
            "high": ["At your best, you're given a genuinely open problem and enough runway to follow a pattern before it's fully provable — that's when the conceptual gift actually pays off instead of just generating noise.",
                     "You're at your best when someone trusts your read on a situation before it's fully confirmed, and lets you act on it early."],
            "mid": ["At your best, you're moving fluidly between the concrete and the conceptual as the moment actually calls for it, without anyone forcing you into one mode.",
                    "You're at your best in a role that genuinely needs both close attention to detail and a sense of the bigger picture, in the same week."],
            "low": ["At your best, you're handed something real and checkable, with a clear way to verify you got it right — that's when concreteness turns into visible, trusted output.",
                    "You're at your best when the work rewards getting the details exactly right, and someone actually notices when you do."],
        },
        "R": {
            "high": ["At your best, the stakes are real and the moment calls for someone to move first — that's when fast Response stops looking like impulsiveness and starts looking like leadership.",
                     "You're at your best under time pressure that's genuine, not manufactured — real urgency brings out your sharpest decision-making."],
            "mid": ["At your best, you're trusted to set your own pace — fast on the small stuff, careful on the big stuff — without someone imposing a single tempo on everything.",
                    "You're at your best when the environment doesn't force you into constant urgency or constant caution, and lets the situation actually decide."],
            "low": ["At your best, you're given real time to think before a decision is locked in — that's when deliberation turns into a genuinely better outcome instead of looking like hesitation.",
                    "You're at your best in high-stakes moments where being right matters more than being first."],
        },
        "I": {
            "high": ["At your best, you're holding a position that's actually being tested — real pushback, real stakes — because that's when a settled sense of self turns into visible steadiness other people can lean on.",
                     "You're at your best as the stable point in a group that's under real strain."],
            "mid": ["At your best, you're in a stretch of real growth with people who challenge you constructively — settled enough to not be shaken, open enough to actually change.",
                    "You're at your best when you're neither defending an old version of yourself nor losing yourself to please the room."],
            "low": ["At your best, you're in an environment with real mentorship and honest feedback — that's when a still-forming Identity turns into fast, genuine growth instead of just instability.",
                    "You're at your best when you're actively becoming someone, surrounded by people who are rooting for who that turns out to be."],
        },
        "S": {
            "high": ["At your best, you're in a room full of people, actively building something together — that's when high Social stops being just sociability and starts being real momentum.",
                     "You're at your best when connection is the actual medium of the work, not a distraction from it."],
            "mid": ["At your best, you get real solo focus AND real connection in the same week, in a ratio that actually fits what you need that week.",
                    "You're at your best when nobody's forcing you to pick a permanent lane between social and solitary."],
            "low": ["At your best, you're given long, uninterrupted stretches to work alone, with contact on your terms rather than on a schedule — that's when solitude turns into your best output.",
                    "You're at your best deep in focused, independent work, re-emerging when there's something real to share."],
        },
        "M": {
            "high": ["At your best, there's a visible way to track progress and a real reason to keep pushing — that's when high Motivation turns into sustained, compounding output instead of burnout.",
                     "You're at your best chasing something with a clear finish line you can actually see getting closer."],
            "mid": ["At your best, the work is both meaningful to you and has something to show for it — that combination is what actually sustains you, more than either alone.",
                    "You're at your best when purpose and visible progress are both present, even in modest amounts."],
            "low": ["At your best, you're doing work that matters to you regardless of who's watching — that's when internal drive turns into the kind of quiet consistency that outlasts everyone else's motivation.",
                    "You're at your best in long, unglamorous stretches where nobody's checking in, because you were never waiting on that anyway."],
        },
    },

    # -------------------------------------------------- UNDER PROLONGED STRESS
    # Distinct from "shadow" (acute crisis behavior under threat) — this is
    # about what happens over WEEKS of sustained, ordinary pressure, not a
    # single breaking point.
    "under_stress": {
        "P": {
            "high": ["Under sustained stress, the conceptual gift starts running without enough real input — you keep generating plausible stories, but fewer and fewer of them are actually being checked against reality.",
                     "Weeks of pressure tend to make your pattern-seeking more confident and less accurate at the same time, which is a genuinely dangerous combination if nobody's checking your work."],
            "low": ["Under sustained stress, concreteness tightens into tunnel vision — you keep executing on the checklist even after the checklist has stopped being the right one.",
                    "Prolonged pressure makes you less willing to consider anything that isn't already proven, right when flexibility is what's actually needed."],
        },
        "R": {
            "high": ["Under sustained stress, fast Response turns into reactivity — you're making more decisions per day but the average quality of each one quietly drops.",
                     "Weeks of pressure tend to compress your timeline further and further, until 'move fast' becomes 'move first, regret later, repeat.'"],
            "low": ["Under sustained stress, deliberation slows further into something closer to avoidance — 'I need more information' becomes a permanent state rather than a real request.",
                    "Prolonged pressure makes even small decisions start to feel like they need the same careful process as big ones, and everything backs up."],
        },
        "I": {
            "high": ["Under sustained stress, a settled Identity can harden into rigidity — you stop updating on new information not because you've checked it, but because checking would mean admitting the pressure is getting to you.",
                     "Weeks of pressure tend to make you defend positions you'd normally reconsider, simply because reconsidering feels like one more thing you don't have bandwidth for."],
            "low": ["Under sustained stress, a still-forming Identity gets buffeted harder than usual — you can end up several different versions of yourself across a single stressful week, depending on who you spoke to last.",
                    "Prolonged pressure makes outside opinions carry even more weight than usual, right when you can least afford to be steered by whoever's loudest."],
        },
        "S": {
            "high": ["Under sustained stress, the need for people can tip into using company to avoid processing anything alone — you're rarely by yourself, which starts to look like connection but functions like avoidance.",
                     "Weeks of pressure tend to make you seek reassurance more often than the situation actually calls for, which can wear down the people closest to you."],
            "low": ["Under sustained stress, self-sufficiency can tip into disappearing exactly when support would help — you keep handling it alone well past the point where alone stopped working.",
                    "Prolonged pressure makes you pull back from contact right when reaching out would cost you the least and help you the most."],
        },
        "M": {
            "high": ["Under sustained stress, high Motivation stops being fuel and starts being the thing burning you — you keep pushing past the signals that would normally tell you to stop.",
                     "Weeks of pressure tend to turn your relationship with progress adversarial: rest starts to feel like falling behind, which makes actual rest harder to take."],
            "low": ["Under sustained stress, internal drive can quietly slide into resignation — the absence of external pressure to perform can start to look, from the outside, like the absence of caring at all.",
                    "Prolonged pressure makes it harder to tell the difference between genuine equanimity and having quietly given up, even for you."],
        },
    },

    # ------------------------------------------------------- MISUNDERSTOOD AS
    # "High X often reads as Y to others, but is actually Z" — a real
    # perception-gap format, one of the most-requested angles in any
    # personality framework because it's the part people actually want to
    # show other people.
    "misunderstood": {
        "P": {
            "high": ["A strongly conceptual Perception often reads as vague or impractical to people who need the concrete version first — but it's not vagueness, it's that you're several steps ahead and haven't backfilled the explanation yet.",
                     "People sometimes read your pattern-spotting as overthinking — but you're not inventing complexity, you're noticing complexity that was already there and hadn't been named yet."],
            "low": ["A concrete-first Perception often reads as unimaginative to people who think in bigger abstractions — but it's not a lack of vision, it's a refusal to commit to an idea before it's actually earned that commitment.",
                    "People sometimes mistake your need for specifics as being closed-minded — but you're not rejecting the idea, you're asking it to prove itself first."],
        },
        "R": {
            "high": ["A fast Response style often reads as impulsive to people who process more slowly — but it's not recklessness, it's a genuinely different, faster relationship with the same information.",
                     "People sometimes read your quick decisions as not caring enough to deliberate — but the deliberation happened, it just happened faster than theirs does."],
            "low": ["A deliberate Response style often reads as indecisive or uninterested to people expecting a quick answer — but it's not disinterest, it's that you refuse to answer before you've actually thought it through.",
                    "People sometimes mistake your pause for reluctance — but it's process, not hesitation, and the answer that eventually comes is usually the better one for the wait."],
        },
        "I": {
            "high": ["A firmly settled Identity often reads as stubborn or closed-off to people who expect visible uncertainty as a sign of openness — but you can update your view without it costing you your footing; you just don't perform the wobble.",
                     "People sometimes read your consistency as inflexibility — but holding steady and refusing to reconsider are not the same thing, even if they can look identical from outside."],
            "low": ["A still-forming Identity often reads as inconsistent or people-pleasing to those who expect a fixed self — but it's not a lack of character, it's a self that's still honestly under construction rather than prematurely locked in.",
                    "People sometimes mistake your openness to influence as having no real opinions — but you have opinions, they're just still being tested rather than defended."],
        },
        "S": {
            "high": ["A high Social score often reads as needing constant company for its own sake — but it's not dependency, it's that connection is genuinely where your best thinking and your real energy happen.",
                     "People sometimes read your enjoyment of groups as an inability to be alone — but you can be alone fine, you just don't default to it because it's not where you do your best living."],
            "low": ["A more solitary Social style often reads as cold or uninterested in people — but it's not indifference, it's that your care shows up as depth with a few rather than warmth toward many, and that's just as real.",
                    "People sometimes mistake your need for space as rejection — but stepping back from a group is not the same as stepping back from the people in it."],
        },
        "M": {
            "high": ["A high, externally-driven Motivation often reads as competitive or status-obsessed — but it's not about beating anyone, it's that visible progress is genuinely what keeps the effort feeling real to you.",
                     "People sometimes read your drive for milestones as never being satisfied — but it's not dissatisfaction, it's that stillness reads to you as stalling, even when things are actually fine."],
            "low": ["An internally-driven Motivation often reads as a lack of ambition to people who measure drive by visible external wins — but it's not low ambition, it's that your ambition was never running on an audience in the first place.",
                    "People sometimes mistake your calm about recognition as not caring about the outcome — but you care plenty; you just don't need anyone else to confirm that you did."],
        },
    },
}


# Archetype-anchored openings per category — a short lead-in that stays in
# the archetype's authored voice before the generated, score-specific
# sentences follow. `anchor` is one of the existing ARCH fields
# (strengths list, weakness sentence, shadow sentence).
def _anchor_line(category, anchor_text):
    if not anchor_text:
        return ""
    prefixes = {
        "strength": "Your archetype's core strength is already named plainly: ",
        "weakness": "The known blind spot for this archetype: ",
    }
    prefix = prefixes.get(category, "")
    return prefix + anchor_text if prefix else anchor_text


CATEGORY_SYNTHESIS_LABEL = {
    "strength": "strengths", "weakness": "blind spots", "shadow": "shadow pattern",
    "emotional": "emotional processing", "logical": "reasoning style", "social": "social functioning",
    "dark_traits": "dark-trait risk", "at_best": "peak conditions", "under_stress": "stress pattern",
    "misunderstood": "perception gap",
}


def generate_section(category, scores, seed_key, anchor_text=None):
    """
    category: one of the IMPLICATIONS keys
    scores: dict {"P":0-100, "R":0-100, "I":0-100, "S":0-100, "M":0-100}
    seed_key: a string unique to (person, category) for deterministic variety
    anchor_text: optional archetype-authored sentence to open the section
    Returns: a multi-sentence string (large paragraph, not a one-liner).

    v3: draws from ALL 5 dimensions that have content for this category
    (previously capped at 4), and for each dimension pulls BOTH template
    variants where the pool has 2+ (previously picked only 1) — this
    roughly doubles paragraph length over v2 using zero new hand-authored
    content, since every sentence used already existed in IMPLICATIONS.
    Still closes with a synthesis sentence naming the top 2 driving
    dimensions.
    """
    table = IMPLICATIONS.get(category, {})
    ranked = sorted(DIMENSIONS, key=lambda d: -abs(scores[d] - 50))

    sentences = []
    opener = _anchor_line(category, anchor_text)
    if opener:
        sentences.append(opener)

    used = 0
    used_dims = []
    for d in ranked:
        band = _band(scores[d])
        pool = table.get(d, {}).get(band)
        if not pool:
            continue
        # Pull every variant in the pool (not just one) — every sentence in
        # a pool describes the same real pattern from a slightly different
        # angle, so using both is added depth, not repetition.
        seed = _seed(f"{seed_key}:{category}:{d}:{band}")
        ordered = sorted(pool, key=lambda s: _seed(f"{seed_key}:{category}:{d}:{band}:{s[:12]}"))
        for variant in ordered:
            sentences.append(variant)
        used_dims.append(d)
        used += 1

    if used == 0:
        if category == "dark_traits":
            return ("No strong dark-trait signal showed up across your most defining dimensions. That's a real finding, "
                    "not an omission \u2014 dark traits in this framework are only named where a genuine, well-established pattern exists "
                    "at the extremes of a specific dimension, and yours don't currently sit at those extremes. Worth noting this can "
                    "shift if your scores move significantly on a retake.")
        return "Your scores here sit close enough to the middle that no single dimension dominates this category — it reads as genuinely situational rather than fixed."

    if used >= 2 and category in CATEGORY_SYNTHESIS_LABEL:
        label = CATEGORY_SYNTHESIS_LABEL[category]
        drivers = [DIM_NAMES[d] for d in used_dims[:2]]
        seed = _seed(f"{seed_key}:{category}:synthesis")
        synth_templates = [
            f"If you're looking for the short version: this {label} read comes mainly from {drivers[0]} and {drivers[1]} \u2014 the other dimensions play a smaller supporting role.",
            f"Practically, {drivers[0]} and {drivers[1]} are doing most of the work behind this {label} read; the rest of your profile shapes it only at the margins.",
        ]
        sentences.append(_pick(synth_templates, seed))

    return " ".join(sentences)


# Sub-theme label per dimension, specifically for the deep relationship-
# handling breakdown — each dimension governs a genuinely distinct part of
# how someone operates in a close relationship, so rather than picking the
# top-3 most extreme dimensions (as every other category does), this one
# uses all 5, labeled, so nothing about how a person handles closeness gets
# skipped just because that particular dimension wasn't their most extreme.
RELATIONSHIP_SUBTHEMES = {
    "R": "Conflict style",
    "I": "Commitment & stability",
    "S": "Closeness & contact",
    "P": "Reading unstated needs",
    "M": "Shared direction",
}
RELATIONSHIP_DIM_ORDER = ["R", "I", "S", "P", "M"]  # conflict first — usually the most concrete entry point


def _cap_first(s):
    return s[0].upper() + s[1:] if s else s


def generate_relationship_handling_deep(scores, anchor_text, seed_key):
    """
    Returns a dict: {"intro": str, "sections": [{"label": str, "dim": str,
    "score": int, "text": str}, ...], "synthesis": str}
    so the caller can render this as its own labeled sub-breakdown rather
    than a single flat paragraph — this is the one category explicitly
    asked to go deeper than the rest.
    """
    intro = anchor_text or ""
    sections = []
    for d in RELATIONSHIP_DIM_ORDER:
        band = _band(scores[d])
        pool = IMPLICATIONS["relationship_handling"].get(d, {}).get(band)
        if not pool:
            continue
        ordered = sorted(pool, key=lambda s: _seed(f"{seed_key}:relationship_deep:{d}:{band}:{s[:12]}"))
        text = " ".join(_cap_first(v) if i == 0 else v for i, v in enumerate(ordered))
        sections.append({"label": RELATIONSHIP_SUBTHEMES[d], "dim": d, "score": scores[d], "text": text})

    ranked = sorted(DIMENSIONS, key=lambda d: -abs(scores[d] - 50))
    top2 = ranked[:2]
    top2_labels = [RELATIONSHIP_SUBTHEMES[d] for d in top2 if d in RELATIONSHIP_SUBTHEMES]
    if len(top2_labels) == 2:
        synthesis = (
            f"Across all five, {top2_labels[0]} and {top2_labels[1]} are the two areas that will actually define how a "
            f"relationship with you tends to feel from the other side \u2014 the other three matter, but these two are "
            f"where a partner will notice the pattern first, for better or worse."
        )
    else:
        synthesis = "No single relational dimension dominates here \u2014 how you handle closeness reads as genuinely balanced across conflict, commitment, contact, attunement, and direction."

    return {"intro": intro, "sections": sections, "synthesis": synthesis}


def generate_deep_career(scores, career_fit_text, career_domains, career_caution, seed_key):
    """
    Expands the existing (already real, already role-specific) career_fit_text
    / career_domains / career_caution into one large, organized deep-career
    paragraph, adding score-driven reasoning on top rather than replacing
    the hand-authored role list.
    """
    strength_para = generate_section("strength", scores, seed_key + ":career")
    logical_para = generate_section("logical", scores, seed_key + ":career")
    parts = [
        career_fit_text,
        "Roles worth specifically looking at: " + ", ".join(career_domains) + ".",
        "The reasoning underneath that fit: " + strength_para,
        "How you'll actually reason through the work day to day: " + logical_para,
        "Where this can go wrong if unmanaged: " + career_caution,
    ]
    return " ".join(parts)


# ---------------------------------------------------------------------------
# 20 DYNAMIC FACTS
# ---------------------------------------------------------------------------

FACT_FRAMES = {
    "low": ["You consistently lean toward {lo} over {hi} in {domain}.",
            "{lo_cap} is your default in {domain}, far more often than {hi}.",
            "When it comes to {domain}, {lo} describes you far more reliably than {hi} does."],
    "mid": ["In {domain}, you sit genuinely between {lo} and {hi} \u2014 neither one describes you fully.",
            "{domain_cap} is one of the more situational parts of your profile \u2014 it shifts with context rather than holding a fixed default.",
            "Neither {lo} nor {hi} dominates in {domain}; this is a case where the honest answer is 'it depends'."],
    "high": ["You consistently lean toward {hi} over {lo} in {domain}.",
             "{hi_cap} is your default in {domain}, far more often than {lo}.",
             "When it comes to {domain}, {hi} describes you far more reliably than {lo} does."],
}


# Categories borrowed from, per facet, to build the deep description below —
# each ties the facet back into the broader dimension-level analysis that
# already exists, rather than requiring 20 new hand-authored facet-specific
# pools. Real, tested content, recombined at a finer grain.
_FACET_DEEP_SOURCES = ["strength", "misunderstood", "at_best"]


def generate_deep_facet_description(dim, score, fact_text, seed_key):
    """
    Builds a genuinely large (roughly 90-160 word) paragraph for one facet
    by combining its short generated fact with tie-in sentences pulled from
    the dimension-level strength / misunderstood / at_best pools for that
    facet's parent dimension and score band — the same real, tested content
    used elsewhere in Deep Analysis, recombined at the facet level so the
    20 Facts section isn't just one short line each.
    """
    band = _band(score)
    parts = [fact_text]
    for category in _FACET_DEEP_SOURCES:
        pool = IMPLICATIONS.get(category, {}).get(dim, {}).get(band)
        if not pool:
            continue
        seed = _seed(f"{seed_key}:facetdeep:{category}:{dim}:{band}")
        parts.append(_pick(pool, seed))
    return " ".join(parts)


def generate_20_facts(facet_defs, facet_scores, seed_key):
    """
    facet_defs: {"P.abstraction": {"domain": str, "hi": [label, desc], "lo": [label, desc]}, ...}
                (mirrors the structure already used for facets elsewhere in Psyche)
    facet_scores: {"P.abstraction": 0-100, ...} — all 20 facet keys
    Returns: list of 20 dicts {dim, facet_key, label, score, band, domain,
             fact, deep} — 'fact' is the short one-line generated fact,
             'deep' is a large, dynamic, multi-sentence NLP description
             built from real dimension-level content, not a static block.
    """
    facts = []
    for key, fac in facet_defs.items():
        dim = key.split(".")[0]
        s = facet_scores.get(key, 50)
        band = _band(s)
        seed = _seed(f"{seed_key}:{key}:{band}")
        frame = _pick(FACT_FRAMES[band], seed)
        fact_text = frame.format(
            domain=fac["domain"], domain_cap=fac["domain"][0].upper() + fac["domain"][1:],
            lo=fac["lo"][0].lower(), hi=fac["hi"][0].lower(),
            lo_cap=fac["lo"][0], hi_cap=fac["hi"][0],
        )
        pole_label = fac["hi"][0] if s >= 50 else fac["lo"][0]
        deep_text = generate_deep_facet_description(dim, s, fact_text, seed_key + ":" + key)
        facts.append({
            "dim": dim, "facet_key": key, "label": pole_label, "score": s,
            "band": band, "domain": fac["domain"], "fact": fact_text, "deep": deep_text,
        })
    return facts


# ---------------------------------------------------------------------------
# FULL PROFILE ASSEMBLY
# ---------------------------------------------------------------------------

def generate_full_deep_profile(scores, archetype_key, arch_strengths, arch_weakness, arch_shadow,
                                career_fit_text, career_domains, career_caution, seed_key):
    """
    scores: {"P":.., "R":.., "I":.., "S":.., "M":..}
    archetype_key: e.g. "PI" — used only as part of the seed, not for lookup here
    arch_strengths: list[str] from ARCH (e.g. ['Pattern recognition', 'Fast read of people', ...])
    arch_weakness / arch_shadow: str from ARCH
    Returns: dict with 12 category entries — 10 are large paragraphs,
    'relationship_handling' is a structured {intro, sections, synthesis} dict.
    """
    strength_anchor = "Named strengths include " + ", ".join(s.lower() for s in arch_strengths) + "."
    return {
        "strength": generate_section("strength", scores, seed_key, strength_anchor),
        "weakness": generate_section("weakness", scores, seed_key, arch_weakness),
        "shadow": generate_section("shadow", scores, seed_key, ("Under real pressure, this archetype tends toward behavior that " + arch_shadow) if arch_shadow else None),
        "emotional": generate_section("emotional", scores, seed_key),
        "logical": generate_section("logical", scores, seed_key),
        "relationship_handling": generate_relationship_handling_deep(scores, None, seed_key),
        "social": generate_section("social", scores, seed_key),
        "dark_traits": generate_section("dark_traits", scores, seed_key),
        "at_best": generate_section("at_best", scores, seed_key),
        "under_stress": generate_section("under_stress", scores, seed_key),
        "misunderstood": generate_section("misunderstood", scores, seed_key),
        "career": generate_deep_career(scores, career_fit_text, career_domains, career_caution, seed_key),
    }
