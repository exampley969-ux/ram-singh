var DIM_ORDER = ['P', 'R', 'I', 'S', 'M'];
var DIMS = {
  P: { name: 'Perception', color: 'var(--P)', blurb: 'How you take in the world.', facets: {
    abstraction:   { name: 'Abstraction',   hi: ['Conceptual', 'Lives in ideas, models, and what-could-be.'],          lo: ['Concrete', 'Trusts the tangible, the literal, the proven.'] },
    curiosity:     { name: 'Curiosity',     hi: ['Explorer', 'Pulled toward the new and the unknown.'],                 lo: ['Settled', 'Content within the known and familiar.'] },
    attention:     { name: 'Attention',     hi: ['Panoramic', 'Scans wide; sees the whole field at once.'],            lo: ['Focused', 'Narrows in; one thing, fully.'] },
    intuition:     { name: 'Intuition',     hi: ['Pattern-reader', 'Reads between the lines, senses the whole.'],      lo: ['Literalist', 'Takes things at face value, as stated.'] }
  }},
  R: { name: 'Response', color: 'var(--R)', blurb: 'How you react and move.', facets: {
    tempo:         { name: 'Tempo',         hi: ['Quick', 'Decides on the move and adjusts as you go.'],               lo: ['Measured', 'Pauses, weighs, then acts.'] },
    expression:    { name: 'Expression',    hi: ['Expressive', 'Shows what is inside, openly.'],                       lo: ['Reserved', 'Keeps the inner world inner.'] },
    adaptability:  { name: 'Adaptability',  hi: ['Fluid', 'Bends with the moment, improvises.'],                       lo: ['Steady', 'Holds the plan, resists the swerve.'] },
    risk:          { name: 'Risk',          hi: ['Bold', 'Leans into the bet and the leap.'],                          lo: ['Cautious', 'Protects the downside first.'] }
  }},
  I: { name: 'Identity', color: 'var(--I)', blurb: 'Your sense of self.', facets: {
    autonomy:      { name: 'Autonomy',      hi: ['Independent', 'Steers by an inner compass.'],                        lo: ['Yielding', 'Defers to the lead and judgment of others.'] },
    conviction:    { name: 'Conviction',    hi: ['Resolute', 'Holds beliefs firmly; hard to move.'],                   lo: ['Open', 'Holds beliefs loosely; easily revised.'] },
    distinct:      { name: 'Distinctiveness', hi: ['Singular', 'Wants to stand apart, unmistakable.'],                 lo: ['Belonging', 'Wants to fit and to be of the group.'] },
    stability:     { name: 'Stability',     hi: ['Grounded', 'A stable, continuous sense of self.'],                   lo: ['Fluid', 'A self that shifts with context.'] }
  }},
  S: { name: 'Social', color: 'var(--S)', blurb: 'How you relate to others.', facets: {
    warmth:        { name: 'Warmth',        hi: ['Warm', 'Leads with care and openness.'],                            lo: ['Detached', 'Keeps a cool, measured distance.'] },
    gregarious:    { name: 'Gregariousness', hi: ['Sociable', 'Energized by people and gathering.'],                  lo: ['Solitary', 'Restored by space and solitude.'] },
    empathy:       { name: 'Empathy',       hi: ['Attuned', 'Feels what others feel, quickly.'],                       lo: ['Objective', 'Reads situations head over heart.'] },
    harmony:       { name: 'Harmony',       hi: ['Accommodating', 'Smooths friction; seeks the peace.'],               lo: ['Frank', 'Says the hard thing; holds the line.'] }
  }},
  M: { name: 'Motivation', color: 'var(--M)', blurb: 'What drives you forward.', facets: {
    drive:         { name: 'Drive',         hi: ['Striving', 'Always reaching for the next rung.'],                    lo: ['Content', 'At ease with enough.'] },
    discipline:    { name: 'Discipline',    hi: ['Structured', 'Runs on systems, plans, and order.'],                  lo: ['Spontaneous', 'Runs on impulse and the open day.'] },
    ambition:      { name: 'Ambition',      hi: ['Ambitious', 'Aims big; thinks in empires.'],                         lo: ['Modest', 'Aims true; thinks in enough.'] },
    persistence:   { name: 'Persistence',   hi: ['Relentless', 'Finishes what starts; outlasts.'],                     lo: ['Mercurial', 'Chases the spark; moves on fast.'] }
  }}
};

/* ---------------- QUESTIONS (40 · 2 per facet) ---------------- */
function Q(t, f, d) { return { t: t, f: f, d: d }; }
var QUESTIONS = [
  Q("I'd rather explore a theory than work through a checklist of facts.", 'P.abstraction', 1),
  Q("I trust what I can see and touch over what I can imagine.", 'P.abstraction', -1),
  Q("New and unfamiliar things pull me in.", 'P.curiosity', 1),
  Q("I'm happiest sticking with what I already know works.", 'P.curiosity', -1),
  Q("I naturally take in the whole situation, not just one part.", 'P.attention', 1),
  Q("I lock onto one thing and tune everything else out.", 'P.attention', -1),
  Q("I often sense the pattern before I can explain it.", 'P.intuition', 1),
  Q("I take things literally, exactly as they're said.", 'P.intuition', -1),

  Q("I decide quickly and adjust as I go.", 'R.tempo', 1),
  Q("I like to sit with a decision before I make it.", 'R.tempo', -1),
  Q("People can easily tell what I'm feeling.", 'R.expression', 1),
  Q("I keep my reactions to myself.", 'R.expression', -1),
  Q("I improvise comfortably when plans change.", 'R.adaptability', 1),
  Q("I prefer to stick to the plan once it's set.", 'R.adaptability', -1),
  Q("I'm drawn to bold bets, even risky ones.", 'R.risk', 1),
  Q("I protect against the downside before I act.", 'R.risk', -1),

  Q("I steer by my own judgment, not the crowd's.", 'I.autonomy', 1),
  Q("I usually defer to what others think is best.", 'I.autonomy', -1),
  Q("Once I believe something, I'm hard to move.", 'I.conviction', 1),
  Q("I change my mind easily when I hear a good point.", 'I.conviction', -1),
  Q("I want to stand apart from everyone else.", 'I.distinct', 1),
  Q("I'd rather blend in and belong.", 'I.distinct', -1),
  Q("Who I am stays the same across every situation.", 'I.stability', 1),
  Q("I feel like a different person depending on where I am.", 'I.stability', -1),

  Q("I lead with warmth toward people I meet.", 'S.warmth', 1),
  Q("I keep a cool distance until people earn closeness.", 'S.warmth', -1),
  Q("Being around people energizes me.", 'S.gregarious', 1),
  Q("I recharge best when I'm alone.", 'S.gregarious', -1),
  Q("I feel other people's emotions almost as my own.", 'S.empathy', 1),
  Q("I read situations with my head before my heart.", 'S.empathy', -1),
  Q("I'll smooth over conflict to keep the peace.", 'S.harmony', 1),
  Q("I'll say the hard thing even if it causes friction.", 'S.harmony', -1),

  Q("I'm always reaching for the next goal.", 'M.drive', 1),
  Q("I'm content once I have enough.", 'M.drive', -1),
  Q("I run my life on systems and plans.", 'M.discipline', 1),
  Q("I'd rather keep my days open and spontaneous.", 'M.discipline', -1),
  Q("I think big — I want to build something large.", 'M.ambition', 1),
  Q("I aim for what's enough, not what's grand.", 'M.ambition', -1),
  Q("I finish what I start, even when it drags.", 'M.persistence', 1),
  Q("I chase what excites me and move on quickly.", 'M.persistence', -1)
];

/* ---------------- ARCHETYPES (21) ---------------- */
function A(name, tag, desc, str, shadow, stress, growth) {
  return { name: name, tag: tag, desc: desc, strengths: str, shadow: shadow, stress: stress, growth: growth };
}
var ARCH = {
  P: {
    R: A('The Oracle', 'Perception-led · Response-driven', "You read the room before it speaks and act on what others haven't noticed yet. Insight arrives fast, and you move on it.", ['Pattern recognition', 'Fast read of people', 'Timely instinct'], "Can leap on a hunch before it's checked.", "retreats into overthinking and second-guessing.", "Slow down just enough to verify the signal."),
    I: A('The Visionary', 'Perception-led · Identity-driven', "You see futures others can't, and you're certain enough to chase them. Inner conviction turns vision into direction.", ['Big-picture sight', 'Conviction', 'Originality'], "May dismiss feedback that doesn't fit the vision.", "becomes rigid and isolated when challenged.", "Pressure-test the vision against reality."),
    S: A('The Empath', 'Perception-led · Social-driven', "You perceive what people feel before they say it, and you move to meet them there. Attunement is your instrument.", ['Emotional radar', 'Deep listening', 'Reads subtext'], "Absorbs others' states until your own blur.", "withdraws or over-gives when overwhelmed.", "Guard the line between their feelings and yours."),
    M: A('The Seeker', 'Perception-led · Motivation-driven', "You're driven by the hunt for understanding — always one question deeper. Curiosity is the engine; insight is the prize.", ['Relentless curiosity', 'Synthesis', 'Self-direction'], "Starts more threads than you finish.", "scatters across too many open questions.", "Convert questions into one finished answer.")
  },
  R: {
    P: A('The Improviser', 'Response-led · Perception-driven', "You think on your feet and read the moment to do it. Plans are optional; presence is everything.", ['Adaptability', 'Quick wit', 'Grace under change'], "Allergic to the structure that would help you.", "reacts instead of choosing.", "Build a little scaffolding before the jump."),
    I: A('The Catalyst', 'Response-led · Identity-driven', "You move first and you mean it. Action plus conviction makes you the spark others follow.", ['Initiative', 'Decisiveness', 'Momentum'], "Acts before the room is ready.", "pushes harder the moment it's resisted.", "Pair the push with a pause."),
    S: A('The Performer', 'Response-led · Social-driven', "You light up a room and feed off the exchange. Expression and people are your current.", ['Charisma', 'Expressiveness', 'Read of an audience'], "Can need the spotlight to feel real.", "performs even when you should rest.", "Find a self that exists off-stage."),
    M: A('The Striker', 'Response-led · Motivation-driven', "You convert drive into immediate action. When others deliberate, you've already started.", ['Bias to action', 'Drive', 'Execution speed'], "Moves so fast you skip the map.", "burns out chasing the next hit.", "Aim before you fire.")
  },
  I: {
    P: A('The Philosopher', 'Identity-led · Perception-driven', "You're anchored in who you are and forever examining why. Conviction meets contemplation.", ['Depth', 'Principled', 'Independent thought'], "Lives in the head, late to act.", "detaches into pure analysis.", "Let an idea touch the world."),
    R: A('The Maverick', 'Identity-led · Response-driven', "You know who you are and you act on it — rules be damned. Independence with a motor.", ['Boldness', 'Authenticity', 'Self-trust'], "Breaks things that didn't need breaking.", "doubles down when cornered.", "Pick which rules are worth the fight."),
    S: A('The Sovereign', 'Identity-led · Social-driven', "You hold a strong center and gather people around it. Self-defined, yet built to lead.", ['Presence', 'Inspires loyalty', 'Steady identity'], "Can mistake your way for the only way.", "controls rather than trusts.", "Lead by widening, not narrowing."),
    M: A('The Architect', 'Identity-led · Motivation-driven', "You build systems others end up living inside. A strong sense of self plus long-range drive — you design the future, then construct it.", ['Systems thinking', 'Long-horizon vision', 'Self-reliant drive'], "Can over-build and under-ship; perfection delays the launch.", "withdraws into the blueprint when overwhelmed.", "Ship the imperfect version — completion compounds.")
  },
  S: {
    P: A('The Diplomat', 'Social-led · Perception-driven', "You sense the currents between people and steer them gently. Harmony guided by insight.", ['Tact', 'Mediation', 'Social foresight'], "Avoids the conflict that's necessary.", "goes quiet and accommodates too much.", "Let honesty share the wheel with peace."),
    R: A('The Host', 'Social-led · Response-driven', "You bring people together and keep the energy moving. Connection is your craft, in real time.", ['Warmth', 'Brings people in', 'Lively presence'], "Finds it hard to be alone with yourself.", "over-extends to keep everyone happy.", "Host yourself sometimes, too."),
    I: A('The Anchor', 'Social-led · Identity-driven', "You're the steady one others orbit — warm, but rooted in a clear self.", ['Reliability', 'Loyalty', 'Calm in others\u2019 storms'], "Carries weight that isn't yours to carry.", "suppresses your own needs.", "Let people anchor you back."),
    M: A('The Mobilizer', 'Social-led · Motivation-driven', "You rally people toward a goal and won't let the group lose heart. Connection in service of a mission.", ['Galvanizing', 'Team drive', 'Follow-through with people'], "Pushes the group past its limits.", "takes the mission's setbacks personally.", "Pace the people, not just the goal.")
  },
  M: {
    P: A('The Strategist', 'Motivation-led · Perception-driven', "You play several moves ahead and act on the read. Ambition guided by a wide, sharp eye.", ['Foresight', 'Planning', 'Calm calculation'], "Can wait too long for the perfect moment.", "over-plans and under-commits.", "Trade some certainty for momentum."),
    R: A('The Driver', 'Motivation-led · Response-driven', "You want it and you go get it — now. Pure forward force.", ['Energy', 'Decisiveness', 'Closing power'], "Runs over nuance and people.", "equates rest with failure.", "Let the engine idle without guilt."),
    I: A('The Founder', 'Motivation-led · Identity-driven', "You're built to start things and stake your identity on them. Ambition fused with self.", ['Vision', 'Ownership', 'Resilience'], "Ties self-worth to the outcome.", "isolates under the load.", "Separate who you are from what you build."),
    S: A('The Champion', 'Motivation-led · Social-driven', "You chase big goals and bring everyone with you. Drive that lifts the room.", ['Inspiring drive', 'Generous ambition', 'Team lift'], "Overcommits to too many causes.", "depletes giving more than you have.", "Choose the few worth your fire.")
  },
  PRISM: A('The Prism', 'Evenly refracted', "No single dimension owns you — you flex across all five. Rare, versatile, and hard to pin down; your strength is range itself.", ['Versatility', 'Balance', 'Range'], "Without a clear center, focus can drift.", "spreads thin trying to be everything.", "Choose a lead dimension for each season."),

  PURE: {
    P: A('The Witness', 'Perception, undiluted', "You perceive far more than you reveal. The world moves through you as signal — noticed, weighed, understood — long before you decide whether to act on any of it.", ['Total awareness', 'Clarity under noise', 'Sees what others miss'], "Watches so long the moment to act slips past.", "disappears into observation and stops engaging.", "Awareness is only half the loop — close it with a choice."),
    R: A('The Live Wire', 'Response, undiluted', "You are pure motion. Stimulus becomes action with almost no gap between — you meet the world by moving through it, and stillness feels like static on the line.", ['Instant reaction', 'Boundless energy', 'Alive in the moment'], "Reacts to everything, chooses almost nothing.", "spins faster and faster with nowhere to land.", "Insert one breath between the spark and the strike."),
    I: A('The Compass', 'Identity, undiluted', "You are guided entirely from within. External weather barely moves your needle — you always know which way is true north, even when every voice in the room disagrees.", ['Unshakeable self', 'Inner direction', 'Immune to pressure'], "So sure of your north that other maps look wrong.", "hardens into stubbornness and stops listening.", "A compass still needs a landscape — let the world inform the self."),
    S: A('The Weaver', 'Social, undiluted', "You live in the space between people. Connection isn't something you do — it's how you exist, threading warmth and belonging into every room you enter.", ['Effortless connection', 'Deep belonging', 'Weaves people together'], "So defined by others that your own thread thins.", "loses yourself trying to hold everyone together.", "Weave a self that stands even when the room empties."),
    M: A('The Engine', 'Motivation, undiluted', "You are drive with the housing off. There is always a next goal, a next climb, a next thing to want — and the wanting itself is what carries you forward.", ['Relentless drive', 'Never coasts', 'Turns want into motion'], "Reaches the summit and can't stop to enjoy it.", "redlines and mistakes exhaustion for effort.", "A resting engine is not a broken one.")
  },

  TWIN: {
    PR: A('The Flow', 'Perception + Response, in balance', "You read and react in a single unbroken motion. There's no visible gap between noticing and doing — you meet each moment exactly as it arrives.", ['Seamless timing', 'Present and precise', 'Effortless adaptation'], "So in-the-moment that the long game slips away.", "over-reacts to every ripple in the current.", "Let some signals pass without a response."),
    PI: A('The Sage', 'Perception + Identity, in balance', "You see clearly and you know yourself — insight anchored in conviction. You understand the world and your place in it, and rarely mistake one for the other.", ['Grounded insight', 'Self-aware', 'Quiet authority'], "Certainty can calcify into knowing better than everyone.", "retreats inward and observes instead of acting.", "Wisdom unspoken helps no one — offer it."),
    PS: A('The Confidant', 'Perception + Social, in balance', "You read people deeply and hold them warmly. Others tell you things they haven't told themselves — because you see them clearly and never use it against them.", ['Reads people truly', 'Trusted deeply', 'Warm perception'], "Carries everyone's secrets and none of your own.", "absorbs others' weight until you sink under it.", "Be seen as fully as you see."),
    PM: A('The Pathfinder', 'Perception + Motivation, in balance', "You see the route and you move on it. Curiosity and drive pull the same way — you don't just understand the terrain, you cross it.", ['Sees the way through', 'Driven curiosity', 'Insight into progress'], "Always finding a new path, rarely finishing one.", "chases understanding instead of the goal.", "The best path is the one you walk to the end."),
    RI: A('The Firebrand', 'Response + Identity, in balance', "You act, and you act as yourself — no gap between conviction and motion. When you believe it, the room knows within seconds, because you're already moving.", ['Bold and authentic', 'Acts on conviction', 'Unfiltered force'], "Certainty plus speed leaves scorch marks.", "hardens and pushes when you should pause.", "Aim the fire before you light it."),
    RS: A('The Spark', 'Response + Social, in balance', "You bring the charge and the people at once. Energy and connection are the same current in you — rooms lift when you arrive, and you feel them lift you back.", ['Electric presence', 'Energizes the room', 'Connects in motion'], "Needs the buzz to feel switched on.", "performs harder the more drained you get.", "You're still lit when no one's watching."),
    RM: A('The Dynamo', 'Response + Motivation, in balance', "You are action and ambition fused — you want it and you're already doing it. Where others plan the sprint, you're a lap ahead on pure forward charge.", ['Unstoppable momentum', 'Wants it, does it', 'High output'], "Speed hides that you never chose the direction.", "equates slowing down with losing.", "Point the momentum before you spend it."),
    IS: A('The Pillar', 'Identity + Social, in balance', "You hold a strong center and hold people to it. Rooted in a clear self, yet built for belonging — others steady themselves against you without you bending.", ['Steady and warm', 'Rooted belonging', 'Others lean on you'], "Bears weight that was never yours to carry.", "props everyone up while quietly running empty.", "Let the people you hold hold you back."),
    IM: A('The Pioneer', 'Identity + Motivation, in balance', "You forge your own road and drive down it hard. Self-defined and self-propelled — you don't wait for permission or a map, you make both as you go.", ['Forges own path', 'Self-propelled', 'Fearless start'], "So self-sufficient that help feels like failure.", "isolates and shoulders the whole load.", "The frontier is less lonely with company."),
    SM: A('The Captain', 'Social + Motivation, in balance', "You drive toward the goal and carry the crew with you. Ambition and belonging pull together — you won't reach the summit alone, and you won't leave anyone at base camp.", ['Leads with heart', 'Drives the team', 'Brings everyone up'], "Takes the whole crew's outcome as your burden.", "pushes the group past where it wants to go.", "Set the pace for the people, not just the peak.")
  }
};

/* ---------------- CAREER LENS (same 36 keys as ARCH) ---------------- */
function C(domains, fit, caution) { return { domains: domains, fit: fit, caution: caution }; }
var CAREER = {
  P: {
    R: C(['Fast-cycle trading or markets', 'User research & product discovery', 'Crisis or incident response'], "You read a room and move before it finishes speaking — look for roles that reward quick, evidence-backed calls.", "Slow, consensus-heavy processes wear you down; build in one verification step so speed doesn't outrun accuracy."),
    I: C(['Founding a mission-led venture', 'R&D, foresight, or futures work', 'Creative direction with a strong point of view'], "You see where things are headed and commit hard — roles need room for you to set direction, not just execute someone else's.", "Watch for teams that need the vision bent to fit consensus; build in outside checks so conviction doesn't calcify."),
    S: C(['Therapy, coaching, or counseling-adjacent work', 'Customer or user empathy research', 'Community or people-operations leadership'], "You feel a room's mood before it's said aloud — find work that pays you for that radar, not just tolerates it.", "High-volume, low-boundary people work will drain you fast without hard stop rules."),
    M: C(['Research and applied science', 'Strategy or insight consulting', 'Independent scholarship or writing'], "You're paid best by the next open question, not the next rung — choose work structured around problems, not promotions.", "Roles that reward finishing over exploring will feel like a cage; pair with someone who closes what you open.")
  },
  R: {
    P: C(['Live production, events, or broadcast', 'Field ops / improv-heavy roles (EMT, support)', 'UX or design with fast iteration'], "You think fastest with your hands already moving — pick work where the plan is a sketch, not a contract.", "Rigid, plan-first cultures will read your adaptability as unreliability; find one where flexibility is the job spec."),
    I: C(['Founder or early-stage leadership', 'Sales or business development', 'Frontline creative direction'], "You move first and mean it — best where your conviction can set the pace for a team, not wait behind one.", "Slow-approval corporate ladders will frustrate you; look for flat structures where action is rewarded."),
    S: C(['Performing arts, hosting, or media', 'Sales and client-facing roles', 'Event or brand experience design'], "A room is your instrument — work that puts you in front of people, live, is where you're most yourself.", "Long stretches of solo, screen-only work will flatten you; build live contact into any role you take."),
    M: C(['High-velocity sales or growth roles', 'Operations under real time pressure', 'Entrepreneurship, especially early execution'], "You convert want into motion faster than most — work that pays for speed and results, not process.", "Slow-burn, multi-year strategy roles will bore you; pair with someone who holds the long map while you sprint.")
  },
  I: {
    P: C(['Independent research or philosophy-adjacent work', 'Writing, criticism, or long-form analysis', 'Specialist / expert-track roles over management'], "You need work built around depth, not headcount — a track where thinking well is the deliverable.", "Fast-turnaround, shallow-output roles will feel hollow; guard time for the depth that's actually your edge."),
    R: C(['Founding something unconventional', 'Creative fields that reward a distinct voice', 'Advocacy or reform-oriented work'], "You act on your own read of things, rules be damned — work needs to tolerate, or want, that friction.", "Highly regulated, compliance-first environments will constantly clash with your instinct; choose the fights that matter."),
    S: C(['Leadership and executive roles', 'Founding and scaling a values-led org', 'Mentorship-heavy senior positions'], "People organize around your center naturally — take roles that formalize the leading you already do informally.", "Watch for authority without accountability; build real feedback loops so leading doesn't drift into controlling."),
    M: C(['Systems architecture / engineering leadership', 'Long-horizon strategy or platform building', 'Founding infrastructure-heavy ventures'], "You design the future and then build it — work needs long runways, not quarterly resets.", "Perfectionism can stall shipping; force a deadline external to your own standards.")
  },
  S: {
    P: C(['Mediation, HR, or diplomacy-adjacent roles', 'Partnerships and stakeholder management', 'UX research reading unstated needs'], "You read the currents between people and steer gently — best where tact itself is the value delivered.", "Roles requiring blunt, fast confrontation will cost you; pair with someone who'll say the hard thing you're avoiding."),
    R: C(['Event hosting, hospitality, community management', 'Sales built on warmth over pressure', 'Live audience or community-facing media'], "Bringing people together in real time is your actual craft — look for roles built around that, not solitude.", "Constant performance without recovery time will burn you out; protect real alone-time on the calendar."),
    I: C(['Team leadership grounded in trust', 'Operations roles where reliability matters most', 'Long-tenure institutional roles'], "People orbit your steadiness — work that rewards being the calm, dependable center suits you well.", "Watch for absorbing team stress that isn't yours to carry; set an explicit line on what you'll hold."),
    M: C(['Team leadership toward a shared goal', 'Community organizing or movement building', 'People-facing growth or coaching roles'], "You rally a group and won't let them lose heart — best where morale and results are both your job.", "Overcommitting to every cause will thin you out; choose fewer missions and go deeper.")
  },
  M: {
    P: C(['Strategy consulting or corporate strategy', 'Investing, forecasting, or planning-heavy roles', 'Negotiation or competitive strategy'], "You play several moves ahead and act on the read — reward structures built around foresight, not just output.", "Waiting for the perfect setup can cost real opportunities; set a hard deadline to convert plan into move."),
    R: C(['Sales closing roles, growth, or biz-dev', 'Competitive or high-stakes execution roles', 'Entrepreneurship focused on speed to market'], "You want it and you go get it, now — work needs to reward closing, not deliberating.", "Nuance and people can get run over at your pace; build in a deliberate pause before big calls."),
    I: C(['Founding your own venture', 'Ownership-heavy roles (equity, not just salary)', 'High-stakes creative or product leadership'], "You stake identity on what you build — work needs real ownership, not just a task list.", "Tying self-worth to outcomes makes setbacks personal; separate what happened from who you are, deliberately."),
    S: C(['Team or org leadership toward ambitious goals', 'Movement-building, campaigns, growth-stage startups', 'Coaching or mentoring toward big outcomes'], "You chase big goals and bring everyone with you — best where lifting a team is as valued as hitting the number.", "Overcommitting to too many causes depletes you faster than one hard project would.")
  },
  PRISM: C(['Generalist or cross-functional roles', 'Consulting, where range is the asset', 'Early-stage startup roles needing many hats'], "No single lane owns you — work that rewards range over specialization suits you best.", "Highly specialized, single-lane roles will feel like a cage; choose a lead focus per season instead of trying to be everything."),
  PURE: {
    P: C(['Research, analysis, or intelligence work', 'Audit, review, or observation-first roles', 'Long-form writing or documentation'], "You take in more than almost anyone before deciding anything — work needs room for that runway.", "Roles demanding instant reaction will punish your process; pick ones that reward getting it right over getting it first."),
    R: C(['Live performance, sports, emergency response', 'High-tempo operational roles', 'Improvisational or reactive creative work'], "Stimulus becomes action in you with almost no gap — work that needs constant motion is where you thrive.", "Desk-bound, low-stimulus roles will feel like static; build movement and variety into whatever you take."),
    I: C(['Independent or founder-led work', 'Roles resistant to groupthink (audit, ethics, dissent)', 'Long-term personal projects with a singular vision'], "External pressure barely moves your needle — work needs someone to hold a line others won't.", "Watch for certainty hardening into not listening; deliberately invite outside maps into your process."),
    S: C(['Community building, hosting, relationship-centered work', 'HR, people ops, or culture-focused roles', 'Therapy-adjacent or deeply relational careers'], "Connection isn't something you do, it's how you exist — work should be built around people, not incidental to them.", "Losing your own thread while holding everyone together is the real risk; keep one project that's yours alone."),
    M: C(['Founder or high-growth operator roles', 'Competitive, metric-driven environments', 'Any field with a visible next level to climb'], "There's always a next goal in you — work needs a visible ladder or it'll feel static.", "Reaching a summit and not stopping to enjoy it costs you; build in deliberate, scheduled rest.")
  },
  TWIN: {
    PR: C(['Live improvisational work: performance, sports, trading floors', 'UX/product roles with tight fast-feedback loops', 'Field roles needing real-time judgment'], "You read and react in one motion — work rewarding present-moment precision over long planning fits best.", "The long game can slip away at this pace; pair with someone, or a system, that holds the multi-year view."),
    PI: C(['Advisory, mentorship, or expert-consultant roles', 'Independent scholarship or think-tank work', 'Senior strategist roles where judgment is the product'], "You combine clear sight with self-knowledge — work should pay for judgment, not just output volume.", "Quiet authority can tip into knowing better than everyone; keep actively asking, not just answering."),
    PS: C(['Therapy, counseling, or coaching', 'Executive or personal advisory roles', 'HR, mediation, or trust-heavy relationship roles'], "People tell you things they haven't told themselves — professionalize that gift rather than absorbing it for free everywhere.", "Carrying everyone's weight and none of your own catches up; build a real outlet for your own stuff."),
    PM: C(['Strategy roles that also execute, not just plan', 'R&D with a real ship deadline', 'Founder or product-lead roles'], "You don't just map the terrain, you cross it — work should combine insight with an actual finish line.", "Always finding a new path can mean rarely finishing one; force one project to completion before starting the next."),
    RI: C(['Founder or early-stage leadership under pressure', 'Advocacy, activism, or reform work', 'High-conviction sales or persuasion roles'], "When you believe it, you're already moving — work should reward speed plus conviction, not caution.", "Certainty plus speed leaves marks; aim the fire deliberately before you commit to a direction."),
    RS: C(['Live hosting, performance, or entertainment', 'High-energy sales or client-facing roles', 'Community or event leadership'], "Rooms lift when you arrive and you feed off that current — work should put you in front of people, often.", "Needing the buzz to feel switched on is a real risk; build a sense of self that holds up off-stage too."),
    RM: C(['Growth-stage startup execution roles', 'Competitive or metrics-driven operator roles', 'Fast-scaling sales or ops leadership'], "You want it and you're already doing it, a lap ahead of most plans — work should reward output, not process compliance.", "Speed can hide that you never chose the direction; force a deliberate check-in on whether the target is even right."),
    IS: C(['Team leadership grounded in long trust', 'Institutional or long-tenure roles where reliability compounds', 'Mentorship-heavy senior positions'], "People steady themselves against you without you bending — work should let steadiness itself be the value delivered.", "Bearing weight that was never yours to carry is the risk; name explicitly what you will and won't hold for others."),
    IM: C(['Founding something from zero', 'Independent or self-directed career tracks', 'Frontier work: new markets, new categories, new methods'], "You forge your own road and don't wait for a map — work needs to tolerate, or reward, going first.", "Self-sufficiency can tip into isolating with the whole load; deliberately bring in company before you need to."),
    SM: C(['Team leadership toward ambitious shared goals', 'Coaching or player-development roles', 'Campaign or movement leadership'], "You won't reach the summit alone and won't leave anyone at base camp — work should reward bringing a team up together.", "Taking the whole crew's outcome as your personal burden wears you down; separate your effort from their results.")
  }
};
function careerByKey(key) {
  if (key === 'PRISM') return CAREER.PRISM;
  if (key.indexOf('PURE_') === 0) return CAREER.PURE[key.slice(5)];
  if (key.indexOf('TWIN_') === 0) return CAREER.TWIN[key.slice(5)];
  return CAREER[key[0]][key[1]];
}

/* ---------------- RELATIONSHIP LENS (same 36 keys as ARCH) ---------------- */
function L(style, needs, friction) { return { style: style, needs: needs, friction: friction }; }
var RELATE = {
  P: {
    R: L("You read your partner's unspoken shifts fast and respond to what's underneath the words, not just the words themselves.", "Space to verify a read before acting on it — don't make you decide in the heat of the moment.", "You can over-interpret silence as a bigger problem than it is; say the read out loud and check it instead of acting on it alone."),
    I: L("You love with conviction — once you're in, you're building a shared future, not just spending time together.", "A partner who can be pressure-tested without you hearing it as rejection of the whole vision.", "You can dismiss feedback that doesn't fit the story you're already telling about the relationship; let it in before deciding it's wrong."),
    S: L("You feel your partner's moods before they name them and move to meet them there.", "A partner who checks in on how you're doing, since you're usually busy tracking them.", "You can absorb their stress until it's indistinguishable from your own; name whose feeling it actually is."),
    M: L("You love through curiosity — asking, learning, going deeper into who someone is, indefinitely.", "A partner who doesn't need every question resolved to feel secure.", "You can keep circling the same relationship question instead of landing on an answer; pick a conclusion and act on it.")
  },
  R: {
    P: L("You show up fully present, adapting to whatever the relationship needs moment to moment.", "A partner who doesn't mistake your flexibility for lack of commitment.", "You can avoid the structure — plans, defined labels — that would actually help; agree to a little scaffolding, even loosely."),
    I: L("You move a relationship forward decisively — you'll say the hard thing or make the first move without waiting.", "A partner who can hold their ground so momentum doesn't become one-sided.", "You can push before the other person's ready; pair the push with a pause and check timing."),
    S: L("You bring energy and expressiveness into a relationship — affection shown loud and often.", "A partner who gives you real, unscripted connection, not just an audience.", "You can perform even in private moments that should be unguarded; practice being witnessed at rest, not just in motion."),
    M: L("You show love through action — fixing things, making plans happen, converting care into doing.", "A partner who can name when they just want presence, not a solution.", "You can rush past a feeling to the next task; slow down long enough to just sit in it with them.")
  },
  I: {
    P: L("You love slowly and deeply, examining the relationship as much as living inside it.", "A partner who doesn't need constant verbal affirmation — your care shows in attention, not volume.", "You can retreat into analysis instead of showing up; let a feeling touch the relationship before you've fully worked it out."),
    R: L("You love on your own terms — authentic, unconventional, allergic to relationship 'shoulds.'", "A partner who doesn't need the relationship to look a certain way from the outside.", "You can break agreements that didn't actually need breaking, just to prove independence; pick which rules matter."),
    S: L("You lead a relationship with a strong, steady center that others naturally organize around.", "A partner who'll push back, since you can mistake your way for the only way.", "You can control rather than trust when unsettled; widen the circle instead of narrowing it."),
    M: L("You build a relationship like a long-term structure — deliberate, systems-minded, built to last.", "A partner patient with your need to plan before committing to change.", "You can over-build the 'perfect' relationship in your head and under-invest in the messy real one; ship the imperfect version.")
  },
  S: {
    P: L("You keep a relationship's peace, sensing friction early and smoothing it before it grows.", "A partner who invites your honest, harder opinions, not just your agreeable ones.", "You can avoid a conflict that actually needs having; let honesty share the wheel with peace-keeping."),
    R: L("You bring people and warmth into the relationship constantly — connection in real time is your love language.", "Real alone time protected, even though your instinct is to always be reaching out.", "You can over-extend keeping everyone, including your partner, happy at your own expense; host yourself sometimes too."),
    I: L("You're the steady, reliable one — loyal, warm, and rooted, someone others can lean on without you wavering.", "A partner who checks in on your needs, since you rarely lead with them.", "You can carry weight in the relationship that isn't yours; let them anchor you back sometimes."),
    M: L("You rally a relationship or family toward shared goals, keeping morale up even through setbacks.", "A partner who paces you, since you can push the relationship harder than it's ready for.", "You can take their setbacks personally, as if their struggle is your failure; separate their pace from your responsibility.")
  },
  M: {
    P: L("You approach a relationship with foresight — thinking ahead about where it's going, not just where it is.", "A partner who can pull you into the present moment, not just the planned one.", "You can wait too long for the 'right time' to be vulnerable; trade some certainty for actually showing up."),
    R: L("You pursue what you want in a relationship directly and decisively, without much hesitation.", "A partner who can slow your pace without you reading it as rejection.", "You can run over nuance in pursuit of resolution; let the other person's timing matter as much as yours."),
    I: L("You build a relationship the way you build anything — full ownership, full investment, identity on the line.", "A partner who reminds you the relationship's ups and downs aren't a referendum on your worth.", "You can isolate under relational strain instead of asking for help; let someone in before you're overwhelmed."),
    S: L("You love expansively — championing your partner's goals as hard as your own, bringing out their best.", "A partner who tells you plainly when your ambition for them feels like pressure.", "You can overcommit to lifting everyone around you and running low yourself; choose the few worth your fire.")
  },
  PRISM: L("You flex your relationship style to whoever you're with — no single fixed way of loving, which makes you easy to be with across very different partners.", "A partner who doesn't need you to be the same every day to trust you.", "Without a clear center, a relationship can drift without deliberate direction; choose what you're building together on purpose."),
  PURE: {
    P: L("You notice everything about your partner long before you say anything — deep, quiet attentiveness.", "A partner who invites your observations out loud instead of waiting for them.", "You can watch a relationship problem so long the moment to address it passes; close the loop with an actual conversation."),
    R: L("You're fully present and reactive in a relationship — alive, responsive, rarely still.", "A partner who gives you room to just be in motion without needing constant meaning from it.", "You can react to every small relationship ripple as if it's a crisis; insert a breath before responding."),
    I: L("You stay entirely yourself inside a relationship — grounded, unmoved by pressure to be different.", "A partner who doesn't need to change your direction to feel heard.", "You can hold your read of the relationship so firmly that theirs stops registering; let their map inform yours."),
    S: L("Connection is how you exist — you thread warmth into every interaction, effortlessly close.", "A partner who checks that you still have a self outside the relationship, since you can lose it in the weave.", "You can define yourself entirely through the relationship; keep one thread of identity that's yours alone."),
    M: L("You bring relentless energy into a relationship — always working toward the next shared milestone.", "A partner who can get you to actually stop and enjoy where you already are.", "You can treat the relationship like a project with a next goal instead of a place to rest; schedule real, goal-free time together.")
  },
  TWIN: {
    PR: L("You and a relationship move together in real time — high presence, seamless adjusting to each other.", "A partner who'll occasionally name the long-term picture, since you both live in the moment.", "The long game can slip away amid constant in-the-moment adjusting; deliberately name where this is headed."),
    PI: L("You bring grounded insight to a relationship — you see clearly and know yourself, which makes you a calm, steady partner.", "A partner who challenges your read sometimes, since quiet authority can tip into always being 'right.'", "Certainty can calcify into knowing better than your partner; ask more than you conclude."),
    PS: L("Your partner tells you things they haven't told themselves — you read them deeply and hold it warmly, never using it against them.", "A partner who's equally curious about you, not just grateful to be understood.", "You can be seen less than you see; let yourself be known as fully as you know them."),
    PM: L("You navigate a relationship's direction actively — not just understanding where it's headed, but steering it there.", "A partner who trusts the path even when it's not fully mapped yet.", "You can keep finding new relationship 'directions' without settling into one; commit to walking one path to the end."),
    RI: L("You act on relational conviction the moment you feel it — no gap between what you believe about the relationship and what you do.", "A partner who can hold steady when your certainty moves fast.", "Certainty plus speed can leave scorch marks in a relationship; aim the conviction before you act on it."),
    RS: L("You and your partner feed off shared energy — the relationship lifts you and you lift it right back.", "A partner okay with quieter, lower-energy stretches too, not just the highs.", "You can need the buzz to feel connected; practice being close in stillness, not just charge."),
    RM: L("You move a relationship forward fast — wanting and doing are nearly the same motion for you.", "A partner who can ask 'why this direction' without you hearing it as a brake.", "Speed can hide that you never chose the direction together; pause to actually choose it, out loud, with them."),
    IS: L("You're rooted and warm at once — a strong center that others, including a partner, can lean on without you bending.", "A partner who checks what you're carrying, since you rarely volunteer it.", "You can bear relational weight that isn't yours; let the people you hold, hold you back sometimes."),
    IM: L("You build a relationship your own way — self-defined, self-propelled, not waiting for a template.", "A partner who can join the frontier with you instead of needing the map drawn first.", "Self-sufficiency can isolate a relationship instead of building it together; let the frontier be less lonely with company."),
    SM: L("You lead a relationship toward shared goals with real heart — ambition and belonging pulling the same direction.", "A partner who tells you when the pace toward 'the goal' has outrun what they actually want.", "You can take the whole relationship's outcome as your personal burden; set the pace for both of you, not just for the peak.")
  }
};
function relateByKey(key) {
  if (key === 'PRISM') return RELATE.PRISM;
  if (key.indexOf('PURE_') === 0) return RELATE.PURE[key.slice(5)];
  if (key.indexOf('TWIN_') === 0) return RELATE.TWIN[key.slice(5)];
  return RELATE[key[0]][key[1]];
}

/* CAREER_IMPL / RELATE_IMPL — dimension-level, score-magnitude-aware
   elaboration, layered ON TOP of the hand-written archetype-level fit/style
   text below. The archetype text answers "which archetype are you"; this
   answers "specifically, what do YOUR numbers on this dimension mean for
   work / for a relationship" — grounded in the actual score, not just the
   36-way archetype key. Same seeded-pick determinism as Engine.facetDescription. */
var CAREER_IMPL = {
  P: {
    low: ["With Perception this concrete, you'll do better in roles measured by tangible output than by open-ended strategy — ambiguity that never resolves into something checkable will wear on you faster than the workload itself.",
          "A concrete-leaning Perception score means you tend to trust what you can verify directly; work that rewards visible, checkable progress will suit you more than work that's mostly judgment calls."],
    mid: ["Your Perception sits in the middle, which in practice means you can do detail work and big-picture thinking in the same week without either one draining you — flexibility here is a real asset, not indecision.",
          "A mid-range Perception score means neither pure execution nor pure strategy roles will feel like a mismatch — you can move between them as the job actually requires."],
    high: ["With Perception this high, roles that reward spotting patterns before they're obvious — strategy, research, systems design — will use what you're actually good at; heavily procedural work will underuse you and it'll show.",
           "A strongly conceptual Perception score means you'll get more out of ambiguous, open-ended problems than tightly scripted ones — look for roles that pay for the insight, not just the hours."],
  },
  R: {
    low: ["A slower, more deliberate Response score means work with hard, fast deadlines and no room to think will cost you more than the difficulty itself — look for roles that reward getting it right over getting it first.",
          "With Response this deliberate, you'll want some real say over your own pace; environments built entirely around instant turnaround will fight your actual working style."],
    mid: ["Your Response score sits in the middle, meaning you can move fast when something's genuinely urgent and slow down when it actually matters — this adaptability is worth naming explicitly in how you describe your working style.",
          "A balanced Response score means you're not defined by either speed or caution — you calibrate to the situation, which most roles will actually reward."],
    high: ["With Response this fast, roles that reward quick calls under real pressure — sales, trading, live operations — fit your actual instinct; heavily bureaucratic, slow-approval environments will frustrate you structurally, not just occasionally.",
           "A high Response score means you're built for environments where hesitating costs more than moving; look for work that measures you by outcomes, not by how carefully you deliberated."],
  },
  I: {
    low: ["With Identity still actively forming, roles that let you try on different working styles — rotational programs, varied early-career paths — will serve you better right now than one narrow lane too early.",
          "A lower, still-forming Identity score means feedback genuinely reshapes how you see your own work; environments with real mentorship will compound that faster than ones that leave you to figure it out alone."],
    mid: ["Your Identity is settled enough to hold steady under normal pressure while still leaving room to grow — roles that expect some evolution over time will suit you better than ones expecting you to be a finished product on day one.",
          "A mid-range Identity score means you know your general shape without every detail being fixed — good for roles with real room to develop, not just execute."],
    high: ["With Identity this settled, you can hold a position under real pushback without it costing you — leadership, ownership-heavy, or high-scrutiny roles will suit you better than ones where consensus is the whole job.",
           "A firmly settled Identity score means external pressure won't easily move you off a well-reasoned position — that's a real asset in any role where someone needs to hold the line."],
  },
  S: {
    low: ["With Social this low, roles built around solo deep work will genuinely energize you rather than isolate you — open-plan, constant-meeting environments will cost you more focus than the actual work justifies.",
          "A more solitary Social score means your best output often comes from uninterrupted stretches alone; protect that in how you negotiate a role, not just how you cope with it."],
    mid: ["Your Social score sits in the middle, meaning you can do solid solo work and solid collaborative work without either one draining you disproportionately — flexibility here is a genuine asset in most team structures.",
          "A balanced Social score means you're not purely a collaborator or purely a solo operator — most modern roles that mix both will actually fit you fine."],
    high: ["With Social this high, roles with real day-to-day human contact — client-facing work, team leadership, collaborative building — will energize you in a way solo, heads-down roles structurally can't.",
           "A high Social score means isolation, not workload, is what actually burns you out; look for roles built around people, not just ones that occasionally include them."],
  },
  M: {
    low: ["With Motivation running on internal standards rather than external metrics, roles with unclear or absent recognition will still work for you as long as the work itself matters — but say so explicitly, since managers often assume everyone needs the same kind of visible praise.",
          "A more internally-driven Motivation score means a scoreboard isn't what keeps you going — meaning is. Roles that are meaningful but low-visibility will suit you better than most people expect."],
    mid: ["Your Motivation blends internal drive with real interest in visible progress — roles that offer both purpose and a way to actually track results will sustain you longer than ones offering only one or the other.",
          "A balanced Motivation score means pure mission-driven work and pure metrics-driven work can both wear thin eventually — look for roles that genuinely offer both."],
    high: ["With Motivation this externally driven, roles with a visible scoreboard — commission, rankings, clear promotion tracks — will pull real performance out of you that vaguer, harder-to-measure roles won't.",
           "A high Motivation score means unclear or invisible progress will cost you more than difficulty will; negotiate for explicit, trackable goals wherever you land."],
  },
};

var RELATE_IMPL = {
  P: {
    low: ["A more concrete Perception style in a relationship means you show love through tangible, checkable things — remembering specifics, following through on stated plans — more naturally than through abstract reassurance.",
          "With Perception this concrete, you'll connect faster with a partner who says what they mean plainly; reading between the lines for unstated needs isn't your strongest channel, and that's fine to name directly."],
    mid: ["A mid-range Perception style means you can meet a partner in the specifics of a bad day or the bigger picture of where things are headed, depending on what they actually need in the moment.",
          "Your balanced Perception means you're not locked into either literal or abstract as your only mode of understanding a partner — you can shift depending on what's needed."],
    high: ["With Perception this conceptual, you likely pick up on unstated shifts in a relationship before your partner says anything outright — that's a real strength, as long as you check your read against their words rather than assuming it's correct.",
           "A high Perception score means you connect patterns across a relationship's history quickly; the risk is over-interpreting a single moment as part of a pattern that isn't actually there."],
  },
  R: {
    low: ["A slower Response style means you process relationship friction internally before responding — which reads as calm to some partners and as distant to others; naming that you're processing, not withdrawing, closes that gap fast.",
          "With Response this deliberate, you're unlikely to say something in a relationship you'll regret in the heat of the moment — the tradeoff is a partner may want a faster reaction than you naturally give."],
    mid: ["A balanced Response style means you can match a partner's urgency in a real crisis and still take your time on things that don't need an immediate answer — most partners will read this as genuinely responsive.",
          "Your mid-range Response score means neither impulsive reaction nor total withdrawal is your default in a relationship — you tend to meet the moment at roughly its actual size."],
    high: ["With Response this fast, you likely address relationship friction the moment you notice it rather than letting it sit — a real strength, as long as speed doesn't come at the cost of actually hearing your partner's side first.",
           "A high Response score means you move toward resolution quickly in a relationship; a partner who needs more time to process may need you to explicitly slow down and wait for them."],
  },
  I: {
    low: ["With Identity still forming, a relationship can genuinely reshape parts of who you are — which is healthy in the right relationship, and worth watching for in the wrong one, where you might lose more of yourself than you gain.",
          "A still-forming Identity score means a partner's opinion of you can carry outsized weight right now; a partner who's aware of that and doesn't exploit it matters more to you than it would to someone with a more settled sense of self."],
    mid: ["Your Identity is settled enough to hold up through a relationship's rough patches while still leaving room for a partner to genuinely influence how you grow — a real middle ground most people actually want.",
          "A mid-range Identity score means you can compromise on real things without it costing you your sense of self, as long as the core of who you are stays respected."],
    high: ["With Identity this settled, you bring real stability into a relationship — a partner going through their own uncertain stretch can lean on that without you being destabilized by it.",
           "A firmly settled Identity score means you're unlikely to lose yourself in a relationship, even a very close one — the risk instead is a partner sometimes wanting more visible need from you than you naturally show."],
  },
  S: {
    low: ["A more solitary Social style means real closeness for you doesn't require constant contact — a partner who reads quiet time as distance rather than as your normal baseline will misread you often.",
          "With Social this low, you likely recharge away from your partner sometimes, not away from the relationship — worth stating plainly, since it's an easy thing for a partner to take personally if unexplained."],
    mid: ["A balanced Social style means you can enjoy real togetherness and still want independent time without either one signaling something's wrong — most partners will find this genuinely easy to be with.",
          "Your mid-range Social score means neither constant contact nor a lot of separate space defines the relationship for you — you flex based on the week, not a fixed rule."],
    high: ["With Social this high, you likely want more shared time and shared activity than the average partner expects by default — naming that directly avoids a partner mistaking your wanting closeness for neediness.",
           "A high Social score means real distance, not just a quiet evening, is what actually costs you in a relationship — regular real connection matters more to you than most partners will assume unprompted."],
  },
  M: {
    low: ["An internally-driven Motivation style means you don't need constant relationship milestones to feel like things are going well — a partner who needs frequent external markers of progress may read your steadiness as a lack of investment, when it isn't.",
          "With Motivation running on your own internal sense of how things are going, you're less likely to compare your relationship to others' — genuinely useful, as long as you still check in rather than assuming things are fine by default."],
    mid: ["A balanced Motivation style means you want a relationship that feels meaningful day-to-day AND is visibly moving somewhere — pure contentment with no sense of growth will eventually feel as stagnant to you as pure milestone-chasing with no present-tense happiness.",
          "Your mid-range Motivation score means you'll want both real closeness in the present and a sense the relationship is actually going somewhere — neither alone will fully satisfy you long-term."],
    high: ["With Motivation this externally driven, visible relationship milestones — moving in together, explicit commitments, shared goals with a timeline — matter more to you than they might to a partner who's content to let things unfold.",
           "A high Motivation score means an undefined, directionless relationship will bother you more than most people; being explicit about wanting a visible next step isn't impatience, it's how you're actually built."],
  },
};

/* ---------------- DEEP COMPATIBILITY CONTENT ----------------
   Trait-by-trait template grammar for Engine.deepCompatibility, one
   entry per dimension x relational state (bothHigh / bothLow / split /
   aligned), 2 phrasing variants each so repeat pairs don't read
   identically. %HI%/%LO% resolve to whichever person scores higher/
   lower on that dimension; %A%/%B% resolve to the two people in the
   order they were passed in (used where the state is symmetric). */
var DIM_COMPAT_CONTENT = {
  P: {
    bothHigh: [
      "You both read situations conceptually rather than literally \u2014 quick to spot the pattern under the surface, both pulled toward the new and untested. That gives you a wide-open, idea-rich shared space, but with nobody instinctively grounding the conversation in what's actually, concretely true right now, plans can drift into possibility without a landing point.",
      "Perception runs high for both of you: intuitive, panoramic, drawn to what's novel. Conversations move fast and associatively, which is genuinely fun \u2014 the risk is that you can both talk your way into an exciting idea neither of you has actually checked against the facts."
    ],
    bothLow: [
      "You both stay close to the concrete and the literal \u2014 trusting what's tangible and proven over what's merely possible. That's real common ground: plans stay grounded, expectations stay stated rather than implied. The trade-off is you can share the same blind spot, missing a subtext or a pattern neither of you was oriented to look for.",
      "Perception runs low for both of you: practical, literal, skeptical of the untested. You'll rarely talk each other into something ungrounded \u2014 but you can also both take a situation at face value when there was more going on underneath it."
    ],
    split: [
      "%HI% tends to read between the lines and sense where a situation is heading; %LO% wants the plain, stated facts before drawing any conclusion. The same conversation can genuinely land as two different realities \u2014 but paired well, %HI% catches what's coming while %LO% keeps things anchored to what's actually true.",
      "There's a real Perception gap here: %HI% moves in patterns and possibility, %LO% moves in what's concretely in front of them. That's a frequent source of talking past each other, though it also means one of you rarely misses the practical detail the other would have skipped."
    ],
    aligned: [
      "Perception sits close enough for both of you that neither the conceptual nor the concrete dominates \u2014 you'll each bring a bit of grounding and a bit of pattern-reading, without either style having to carry the whole conversation.",
      "Your Perception styles are moderate and reasonably matched \u2014 no strong pull toward pure abstraction or pure literalism on either side, so this dimension is unlikely to be where friction shows up."
    ]
  },
  R: {
    bothHigh: [
      "You both decide fast and act \u2014 quick, bold, comfortable adjusting on the move rather than planning it all out first. Momentum comes easily between you; the real risk is that nobody is instinctively the one who says \"wait\" before a decision that actually needed it.",
      "Response runs high on both sides: tempo and risk-tolerance both lean toward quick and bold. Things happen between you \u2014 plans, decisions, changes \u2014 but with neither of you naturally playing brake, a bad call can move just as fast as a good one."
    ],
    bothLow: [
      "You both pause, weigh, and protect the downside before acting \u2014 decisions get made carefully, rarely carelessly. That's real stability, but it can also mean things stall: if you're both waiting to be sure, waiting can become the default instead of a step toward deciding.",
      "Response runs low for both of you: measured, steady, cautious. Nothing gets rushed between you \u2014 which is a strength until a decision that actually needed speed sits unmade because neither of you moved first."
    ],
    split: [
      "%HI% wants to decide and move; %LO% wants to pause and weigh it first. Left unnamed, this reads as recklessness to one side and slowness to the other \u2014 but paired deliberately, %HI% supplies forward motion while %LO% catches what speed would have missed.",
      "There's a real tempo mismatch: %HI% acts on the move and adjusts as they go, %LO% wants to think it through before committing. It's one of the more common flashpoints in a pairing like this \u2014 and also one of the more fixable ones, once the pace gap is named out loud rather than just felt."
    ],
    aligned: [
      "Your pace and risk tolerance are reasonably matched \u2014 neither of you is consistently the one pushing to move faster or slower than the other feels comfortable with.",
      "Response sits in similar territory for both of you \u2014 tempo and risk appetite are close enough that this dimension is unlikely to be a recurring source of friction."
    ]
  },
  I: {
    bothHigh: [
      "You both hold a strong, independent sense of self and firm convictions \u2014 two people who steer by their own compass rather than deferring easily. That can mean real mutual respect, since neither of you is looking to be led. It can also mean two centers of gravity in the same room, so disagreement needs room to be aired rather than won.",
      "Identity runs high for both of you: autonomous, resolute, self-directed. Neither of you is naturally the one who yields \u2014 which protects you both from being talked out of what you actually think, but means a real disagreement needs deliberate handling instead of assuming one side will simply give way."
    ],
    bothLow: [
      "You both hold your views loosely and defer relatively easily \u2014 low friction, high accommodation. That makes day-to-day coordination easy, but it also means neither of you may naturally step up to make the call when one of you actually needs to.",
      "Identity runs low for both of you: flexible, open to influence, not fixed on being the one who's right. Disagreements rarely escalate \u2014 the risk is closer to drift, where decisions get made by default rather than by either of you actually deciding."
    ],
    split: [
      "%HI% holds a firm, self-directed center; %LO% is more fluid and open to influence. This can settle into a workable anchor-and-adapter dynamic \u2014 or, if it goes unexamined, into %HI% doing most of the deciding simply because %LO% doesn't push back, whether or not that's what either of you actually wants.",
      "There's a real Identity gap: %HI% moves from firm inner conviction, %LO% moves with more flexibility and openness to being persuaded. Worth checking, periodically, whether that's a comfortable division of labor or one side quietly going along more than they'd choose to."
    ],
    aligned: [
      "Your sense of self and conviction levels are reasonably matched \u2014 neither of you is consistently the immovable one or the one who yields, so influence likely moves in both directions depending on the topic.",
      "Identity sits in similar territory for both of you \u2014 close enough that this dimension is unlikely to produce a lopsided power dynamic on its own."
    ]
  },
  S: {
    bothHigh: [
      "You both lead with warmth and read each other's states quickly \u2014 an emotionally attuned, high-empathy pairing. That's real closeness, but it also carries a shared risk: both of you may be quicker to smooth over real friction than to name it, which lets small things go unspoken for longer than they should.",
      "Social runs high for both of you: warm, attuned, oriented toward harmony. Connection comes easily \u2014 the thing to watch is that a conflict-avoidant pair can both prioritize the peace over the honest conversation that would actually resolve something."
    ],
    bothLow: [
      "You both keep a cooler, more measured distance \u2014 low drama, clear-eyed, not driven by needing constant emotional check-ins. That's genuinely stable, though from the outside (or even to each other, at times) it can read as under-invested when it's really just how you both operate.",
      "Social runs low for both of you: detached, objective, self-sufficient. Neither of you needs the other to carry emotional weight for you \u2014 which is a real strength, as long as it doesn't drift into actual distance neither of you notices building."
    ],
    split: [
      "%HI% needs friction named and talked through in the open; %LO% processes more internally and can read open conflict as unsafe rather than useful. The same disagreement can escalate for one of you and shut the other down \u2014 a stated signal for \"I need space, and here's when I'll be back\" tends to help more than either pure confrontation or pure silence.",
      "There's a real gap in how you handle closeness and conflict: %HI% leads with warmth and wants things talked out; %LO% keeps more internal and needs room to process alone first. Neither instinct is wrong \u2014 the friction comes from expecting the other to default to yours."
    ],
    aligned: [
      "Your social styles are reasonably matched \u2014 similar comfort with warmth, similar instincts around handling friction, so this dimension is unlikely to be where the two of you misread each other.",
      "Social sits in close territory for both of you \u2014 neither the need for constant openness nor the pull toward distance dominates either side."
    ]
  },
  M: {
    bothHigh: [
      "You're both reaching for the next thing \u2014 striving, ambitious, rarely content to simply stay where things are. That can be genuinely accelerating, each of you pulling the other forward. It can also tip into quiet competition, or two people running hard enough that neither one notices burnout building in the other.",
      "Motivation runs high for both of you: driven, ambitious, always oriented toward more. Momentum compounds between you \u2014 worth occasionally checking whether you're both still choosing the pace, or just matching each other's speed."
    ],
    bothLow: [
      "You're both genuinely at ease with enough \u2014 low pressure, low striving, comfortable where things already are. That makes for a calm, undemanding dynamic. The trade-off is that neither of you naturally supplies the push when a push is actually what's needed.",
      "Motivation runs low for both of you: content, modest in what you're chasing, unhurried. Nobody's dragging anybody toward a goal they don't want \u2014 but a shared lack of urgency can also mean things that need momentum simply don't get it."
    ],
    split: [
      "%HI% is pulled toward the next goal and can read a pause as stalling; %LO% is genuinely content with where things are and can read %HI%'s drive as pressure. This is workable \u2014 one dreams forward while the other savors the present \u2014 but only if the gap gets named instead of felt as one of you always pushing and the other always resisting.",
      "There's a real ambition gap: %HI% keeps reaching, %LO% is at ease with enough. Left unspoken, this tends to surface as quiet resentment on both sides \u2014 %HI% feeling held back, %LO% feeling never allowed to just arrive. Named early, it's just two different definitions of \"enough.\""
    ],
    aligned: [
      "Your drive levels are reasonably close \u2014 neither of you is consistently the one pushing for more while the other resists, so ambition is unlikely to be a recurring fault line between you.",
      "Motivation sits in similar territory for both of you \u2014 close enough that this dimension is more likely to feel like shared pacing than a source of tension."
    ]
  }
};

/* ---------------- ENGINE ---------------- */
var Engine = {
  facetKeys: function () {
    var out = [];
    DIM_ORDER.forEach(function (d) { Object.keys(DIMS[d].facets).forEach(function (f) { out.push(d + '.' + f); }); });
    return out;
  },
  score: function (answers) {
    var facets = {};
    Engine.facetKeys().forEach(function (key) {
      var qs = QUESTIONS.filter(function (q) { return q.f === key; });
      var raw = 0;
      qs.forEach(function (q) { var v = answers[QUESTIONS.indexOf(q)]; if (v == null) v = 3; raw += (v - 3) * q.d; });
      var max = qs.length * 2;
      facets[key] = Math.round(((raw + max) / (2 * max)) * 100);
    });
    var dims = {};
    DIM_ORDER.forEach(function (d) {
      var fk = Object.keys(DIMS[d].facets).map(function (f) { return d + '.' + f; });
      var sum = fk.reduce(function (a, k) { return a + facets[k]; }, 0);
      dims[d] = Math.round(sum / fk.length);
    });
    return { dims: dims, facets: facets };
  },
  quality: function (answers) {
    var vals = QUESTIONS.map(function (q, i) { var v = answers[i]; return v == null ? 3 : v; });
    var n = vals.length;
    var mean = vals.reduce(function (a, b) { return a + b; }, 0) / n;
    var engagement = vals.reduce(function (a, v) { return a + Math.abs(v - 3); }, 0) / n / 2;
    var spread = Math.sqrt(vals.reduce(function (a, v) { return a + (v - mean) * (v - mean); }, 0) / n);
    // Consistency (quality v2): the two items of a facet are keyed in opposite directions, so agreement
    // is measured on direction-aligned answers ((v - 3) * d), not on raw answers. v1 compared raw answers,
    // which scored a fully coherent respondent as 0 and agree-with-everything as 1 (DEFECTS D14).
    var fvars = [];
    Engine.facetKeys().forEach(function (key) {
      var qs = QUESTIONS.filter(function (q) { return q.f === key; });
      var fa = qs.map(function (q) { var v = answers[QUESTIONS.indexOf(q)]; if (v == null) v = 3; return (v - 3) * q.d; });
      var fm = fa.reduce(function (a, b) { return a + b; }, 0) / fa.length;
      fvars.push(fa.reduce(function (a, v) { return a + (v - fm) * (v - fm); }, 0) / fa.length);
    });
    var consistency = Math.max(0, Math.min(1, 1 - (fvars.reduce(function (a, b) { return a + b; }, 0) / fvars.length) / 4));
    return { engagement: engagement, spread: spread, consistency: consistency, straightLining: engagement < 0.12 || spread < 0.35 };
  },
  match: function (dims, quality) {
    var ranked = DIM_ORDER.slice().sort(function (a, b) { return dims[b] - dims[a]; });
    var hi = dims[ranked[0]], lo = dims[ranked[4]], spread = hi - lo;
    var primary = ranked[0], secondary = ranked[1], gap = dims[primary] - dims[secondary];
    var key, arche;
    if (spread < 10) { key = 'PRISM'; arche = ARCH.PRISM; }
    else if (gap >= 18) { key = 'PURE_' + primary; arche = ARCH.PURE[primary]; }
    else if (gap <= 6) {
      var pr = (DIM_ORDER.indexOf(primary) < DIM_ORDER.indexOf(secondary)) ? primary + secondary : secondary + primary;
      key = 'TWIN_' + pr; arche = ARCH.TWIN[pr];
    }
    else { key = primary + secondary; arche = ARCH[primary][secondary]; }
    var sep = gap / 100, spr = spread / 100;
    var cons = quality && typeof quality.consistency === 'number' ? quality.consistency : 0.7, eng = quality ? quality.engagement : 0.6;
    var base = (0.45 * sep + 0.25 * spr + 0.30 * cons) * (0.4 + 0.6 * eng);
    if (quality && quality.straightLining) base *= 0.35;
    var conf = Math.max(5, Math.min(99, Math.round(base * 100)));
    return { key: key, arche: arche, primary: primary, secondary: secondary, code: archeMeta(key).code, confidence: conf, lowSignal: !!(quality && quality.straightLining) };
  },
  signatureTraits: function (facets) {
    var out = [];
    Engine.facetKeys().forEach(function (key) {
      var parts = key.split('.'), dim = parts[0], fk = parts[1];
      var s = facets[key], dev = s - 50, fac = DIMS[dim].facets[fk];
      if (Math.abs(dev) >= 14) out.push({ dim: dim, fk: fk, color: DIMS[dim].color, name: (dev > 0 ? fac.hi[0] : fac.lo[0]), dev: Math.abs(dev), score: s });
    });
    out.sort(function (a, b) { return b.dev - a.dev; });
    return out.slice(0, 6);
  },
  /* signatureNarrative — weaves the top 3 signature facets (already
     computed by signatureTraits) into ONE organized paragraph instead of
     bare pills with no explanation. Reuses the already-tested
     facetDescription() generator per facet, so no new content had to be
     hand-authored to make this real: it's the existing per-facet
     generative text, connected into a synthesized "what stands out most"
     read, ranked by how defining each trait actually is for this person. */
  signatureNarrative: function (sig) {
    var top = sig.slice(0, 3);
    if (!top.length) return "No single trait stands out sharply here — your profile reads as genuinely balanced across all 20 facets.";
    var CONNECT = ['Most defining: ', 'What stands out first: ', 'The clearest signal: '];
    var BRIDGE = ['Close behind, ', 'Almost as defining, ', 'Right alongside that, '];
    var parts = top.map(function (t, i) {
      var desc = Engine.facetDescription(t.dim, t.fk, t.score);
      var lead = i === 0 ? Engine._facetPick(CONNECT, Engine._facetSeed('sig:lead', t.score)) : Engine._facetPick(BRIDGE, Engine._facetSeed('sig:bridge:' + i, t.score));
      return lead + desc;
    });
    return parts.join(' ');
  },
  /* dimensionElaboration — ranks the 5 dimensions by distance from the
     midpoint, picks the top 2 (the most defining ones for THIS person), and
     builds a short generated paragraph from the given implication table
     (CAREER_IMPL or RELATE_IMPL, defined above Engine). Deterministic per
     (dims, table-name) via the same _facetSeed/_facetPick pattern used by
     facetDescription, so it's stable across repeat views of the same reading. */
  dimensionElaboration: function (dims, table, tableName) {
    var ranked = DIM_ORDER.slice().sort(function (a, b) {
      return Math.abs(dims[b] - 50) - Math.abs(dims[a] - 50);
    });
    var top = ranked.slice(0, 2);
    var sentences = top.map(function (d) {
      var s = dims[d], bucket = s < 34 ? 'low' : (s < 67 ? 'mid' : 'high');
      var seed = Engine._facetSeed(tableName + ':' + d + ':' + bucket, s);
      return Engine._facetPick(table[d][bucket], seed);
    });
    return sentences.join(' ');
  },
  careerElaboration: function (dims) { return Engine.dimensionElaboration(dims, CAREER_IMPL, 'career'); },
  relationshipElaboration: function (dims) { return Engine.dimensionElaboration(dims, RELATE_IMPL, 'relate'); },
  /* facetDescription — generates the facet line from BOTH the score and its
     distance from the midpoint, instead of a static hi/lo binary pick.
     Previously: `s >= 50 ? fac.hi[1] : fac.lo[1]` — a 3 and a 47 (both "lo")
     rendered the identical sentence, and a 51 read as confidently one-sided
     as a 98. This keeps the hand-written pole copy intact (it's good) and
     wraps it with an intensity-appropriate frame:
       44-56  -> too close to call; blends both poles rather than picking one
       34-43 / 57-66 -> a real but mild lean; pole text + a softening tail
       17-33 / 67-83 -> unchanged (this is the range the original copy was
                        actually tuned for, so it's left exactly as-is)
       0-16  / 84-100 -> a strong lean; pole text + an intensifying tail
     Deterministic per (facet key, score) via a seeded pick, same pattern as
     psyche_reasoning.py's _pick/_sub_seed, so a given reading always renders
     the same wording rather than re-rolling on every view. */
  _facetSeed: function (key, s) {
    var str = key + ':' + s, h = 0;
    for (var i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) & 0xFFFFFFFF; }
    return Math.abs(h);
  },
  _facetPick: function (list, seed) { return list[seed % list.length]; },
  facetDescription: function (dim, fk, s) {
    var fac = DIMS[dim].facets[fk], dev = Math.abs(s - 50), seed = Engine._facetSeed(dim + '.' + fk, s);
    var pole = s >= 50 ? fac.hi : fac.lo, other = s >= 50 ? fac.lo : fac.hi;

    if (dev <= 6) {
      var blends = [
        'Sits close to the midpoint between ' + pole[0].toLowerCase() + ' and ' + other[0].toLowerCase() + ' \u2014 context decides which shows up on a given day.',
        'A genuine mix of ' + pole[0].toLowerCase() + ' and ' + other[0].toLowerCase() + ', without a strong lean either way.',
        'Neither ' + pole[0].toLowerCase() + ' nor ' + other[0].toLowerCase() + ' dominates here; this one is closer to a coin flip.'
      ];
      return Engine._facetPick(blends, seed);
    }
    if (dev <= 16) {
      var softTails = [' Only mildly, though \u2014 not a defining pull.', ' A light lean, not a consistent one.', ' This shows up sometimes, not reliably.'];
      return pole[1] + Engine._facetPick(softTails, seed);
    }
    if (dev <= 32) {
      return pole[1]; // the range the original copy was written for \u2014 left unchanged
    }
    var strongTails = [' This is one of the more defining traits in the profile.', ' This shows up reliably, not just occasionally.', ' A strong, consistent pull in this direction.'];
    return pole[1] + Engine._facetPick(strongTails, seed);
  },
  compatibility: function (a, b, an, bn) {
    var diffs = {}, sum = 0;
    DIM_ORDER.forEach(function (d) { diffs[d] = Math.abs(a[d] - b[d]); sum += diffs[d]; });
    var avg = sum / 5;
    var score = Math.round(Math.max(32, Math.min(97, 100 - avg * 0.72)));
    var notes = [];
    // shared strength
    var shared = DIM_ORDER.filter(function (d) { return a[d] >= 60 && b[d] >= 60; })
      .sort(function (x, y) { return (a[y] + b[y]) - (a[x] + b[x]); });
    if (shared.length) notes.push({ t: 'Shared ground', p: 'You both run high on ' + DIMS[shared[0]].name + '. It\u2019s easy, instinctive territory between you.' });
    // complement
    var comp = DIM_ORDER.slice().sort(function (x, y) { return diffs[y] - diffs[x]; })[0];
    if (diffs[comp] >= 22) {
      var hi = a[comp] >= b[comp] ? an : bn, loN = a[comp] >= b[comp] ? bn : an;
      notes.push({ t: 'Natural division', p: hi + ' leads in ' + DIMS[comp].name + ' where ' + loN + ' steps back — complementary, if you let it be.' });
    }
    // friction
    if (a.I >= 66 && b.I >= 66) notes.push({ t: 'Watch: two centers', p: 'Strong identities on both sides — give each other room to lead.' });
    else if (a.S < 42 && b.S < 42) notes.push({ t: 'Watch: distance', p: 'Neither of you reaches out first. Someone has to make the call.' });
    else if (diffs.R >= 26) notes.push({ t: 'Watch: pace', p: 'One moves fast, one moves measured. Name the tempo gap early.' });
    if (notes.length < 2) notes.push({ t: 'Quiet balance', p: 'No loud clashes here — the work is keeping it from going flat.' });
    var synthesis = score >= 80
      ? 'Numerically, this is a strong match \u2014 the real risk at this score is coasting on ease instead of still doing the work.'
      : score >= 60
      ? 'Numerically, this sits in solid territory \u2014 good enough that the notes above are worth acting on, not just noting.'
      : score >= 45
      ? 'Numerically, this is workable but not automatic \u2014 the gaps above will need real, ongoing attention rather than resolving themselves.'
      : 'Numerically, this is a genuinely wide gap \u2014 not a verdict on the relationship, but a sign the notes above deserve direct conversation, not assumption.';
    return { score: score, notes: notes.slice(0, 3), synthesis: synthesis, conflict: Engine.conflictDecode(diffs, a, b, an, bn) };
  },
  /* Conflict Style Decoder — takes the single biggest fault line between two profiles
     and explains the mechanism (why it produces friction) plus a concrete bridge. */
  conflictDecode: function (diffs, a, b, an, bn) {
    var CB = {
      P: { why: function (hi, lo) { return hi + ' processes a situation by scanning wide and reading between the lines, while ' + lo + ' wants the concrete, stated facts first \u2014 so the same conversation can land as two different realities.'; },
           bridge: 'Before problem-solving, spend two minutes each just describing how you\u2019re seeing the situation \u2014 no fixing yet, just laying both readings on the table.' },
      R: { why: function (hi, lo) { return hi + ' wants to decide and move, while ' + lo + ' wants to pause and weigh it \u2014 so one of you reads the other as reckless, or slow, before either has actually explained why.'; },
           bridge: 'Agree on a shared pace in advance: a small decision gets minutes, a big one gets a set number of hours or a day \u2014 name which kind it is before reacting to the tempo.' },
      I: { why: function (hi, lo) { return hi + ' holds convictions firmly and moves from a strong inner sense of self, while ' + lo + ' holds beliefs more loosely \u2014 disagreement can feel like a threat to one and a normal update to the other.'; },
           bridge: 'Separate the stance from the person: ask "is this about what happened, or about who\u2019s right?" before the conversation escalates into a standoff.' },
      S: { why: function (hi, lo) { return hi + ' needs the friction named and talked through in the open, while ' + lo + ' processes more internally and reads out loud conflict as unsafe \u2014 so the same disagreement escalates for one and shuts down the other.'; },
           bridge: 'Agree on a signal for "I need to step back and think" that isn\u2019t read as stonewalling \u2014 and a return time, so space doesn\u2019t become avoidance.' },
      M: { why: function (hi, lo) { return hi + ' is pulled toward the next goal and reads pauses as stalling, while ' + lo + ' is content with where things are \u2014 so ambition on one side can feel like pressure on the other.'; },
           bridge: 'Name the goal each of you is actually optimizing for out loud \u2014 often the real conflict is two different definitions of "enough," not the plan itself.' }
    };
    var comp = DIM_ORDER.slice().sort(function (x, y) { return diffs[y] - diffs[x]; })[0];
    if (diffs[comp] < 15) return { dim: null, why: 'No dimension shows a strong fault line here \u2014 friction, if it comes, will likely be situational rather than a recurring pattern.', bridge: 'When something does spark tension, check whether it\u2019s really about the moment, not a deeper mismatch \u2014 because the data doesn\u2019t point to one.' };
    var hiN = a[comp] >= b[comp] ? an : bn, loN = a[comp] >= b[comp] ? bn : an;
    return { dim: comp, dimName: DIMS[comp].name, why: CB[comp].why(hiN, loN), bridge: CB[comp].bridge };
  },
  /* deepCompatibility — a full trait-by-trait NLP pass across all 5
     dimensions (not just the top 1-3 fault lines used by compatibility()
     above). For every dimension, classifies the pair into one of four
     relational states — bothHigh / bothLow / split / aligned — and pulls
     a template-grammar paragraph for that exact state, seeded off both
     people's actual scores so it's deterministic but varies phrasing
     across pairs. This is the "expanded" layer: where compatibility()
     gives you the 2-3 headline notes, this gives you the full five-
     dimension narrative underneath them. */
  _dcSeed: function (key) {
    var str = String(key), h = 0;
    for (var i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) & 0xFFFFFFFF; }
    return Math.abs(h);
  },
  _dcPick: function (list, seed) { return list[seed % list.length]; },
  deepCompatibility: function (a, b, an, bn) {
    var out = DIM_ORDER.map(function (d) {
      var av = a[d], bv = b[d], diff = Math.abs(av - bv);
      var state = diff >= 24 ? 'split' : (av >= 62 && bv >= 62 ? 'bothHigh' : (av <= 38 && bv <= 38 ? 'bothLow' : 'aligned'));
      var hiN = av >= bv ? an : bn, loN = av >= bv ? bn : an;
      var seed = Engine._dcSeed(d + ':' + state + ':' + av + ':' + bv);
      var pool = DIM_COMPAT_CONTENT[d][state];
      var raw = Engine._dcPick(pool, seed);
      var text = raw.replace(/%HI%/g, hiN).replace(/%LO%/g, loN).replace(/%A%/g, an).replace(/%B%/g, bn);
      return { dim: d, name: DIMS[d].name, color: DIMS[d].color, state: state, aScore: av, bScore: bv,
        harmony: Math.max(0, 100 - Math.round(diff * 1.15)), text: text };
    });
    var byHarmony = out.slice().sort(function (x, y) { return y.harmony - x.harmony; });
    return { dims: out, mostAligned: byHarmony[0], mostDivergent: byHarmony[byHarmony.length - 1] };
  },
  /* groupAnalysis — takes 2+ decoded members ({name, dims}) and computes
     a full team-level read: average profile, per-dimension variance
     (spots where the group is unusually aligned or scattered), the full
     pairwise compatibility matrix (reusing Engine.compatibility for every
     pair, no duplicated logic), the single strongest and weakest pair,
     and a synthetic "team archetype" run through the same Engine.match
     used for individuals, applied to the group's average scores. */
  groupAnalysis: function (members) {
    var n = members.length;
    var avg = {}, variance = {};
    DIM_ORDER.forEach(function (d) {
      var mean = members.reduce(function (s, m) { return s + m.dims[d]; }, 0) / n;
      avg[d] = Math.round(mean);
      variance[d] = Math.round(members.reduce(function (s, m) { return s + (m.dims[d] - mean) * (m.dims[d] - mean); }, 0) / n);
    });
    var byVar = DIM_ORDER.slice().sort(function (x, y) { return variance[x] - variance[y]; });
    var aligned = byVar[0], divergent = byVar[byVar.length - 1];
    var pairs = [];
    for (var i = 0; i < n; i++) {
      for (var j = i + 1; j < n; j++) {
        var c = Engine.compatibility(members[i].dims, members[j].dims, members[i].name, members[j].name);
        pairs.push({ a: members[i].name, b: members[j].name, score: c.score, conflict: c.conflict });
      }
    }
    pairs.sort(function (x, y) { return y.score - x.score; });
    var avgPairScore = Math.round(pairs.reduce(function (s, p) { return s + p.score; }, 0) / pairs.length);
    var teamMatch = Engine.match(avg, { engagement: 0.6, spread: 0.5, consistency: 0.7, straightLining: false });
    return { n: n, avg: avg, variance: variance, aligned: aligned, divergent: divergent, pairs: pairs,
      best: pairs[0], worst: pairs[pairs.length - 1], avgPairScore: avgPairScore, teamMatch: teamMatch };
  },
  exemplar: function (archKey) {
    var dims = { P: 45, R: 45, I: 45, S: 45, M: 45 };
    if (archKey === 'PRISM') { DIM_ORDER.forEach(function (d) { dims[d] = 55; }); return dims; }
    if (archKey.indexOf('PURE_') === 0) { dims[archKey.slice(5)] = 90; return dims; }
    if (archKey.indexOf('TWIN_') === 0) { dims[archKey[5]] = 80; dims[archKey[6]] = 77; return dims; }
    dims[archKey[0]] = 84; dims[archKey[1]] = 70;
    return dims;
  }
};
function archeMeta(key) {
  if (key === 'PRISM') return { lead: null, code: 'BALANCED' };
  if (key.indexOf('PURE_') === 0) { var d = key.slice(5); return { lead: d, code: d + ' · pure' }; }
  if (key.indexOf('TWIN_') === 0) return { lead: key[5], code: key[5] + ' = ' + key[6] };
  return { lead: key[0], code: key[0] + '·' + key[1] };
}
function archeByKey(key) {
  if (key === 'PRISM') return ARCH.PRISM;
  if (key.indexOf('PURE_') === 0) return ARCH.PURE[key.slice(5)];
  if (key.indexOf('TWIN_') === 0) return ARCH.TWIN[key.slice(5)];
  return ARCH[key[0]][key[1]];
}

/* ---------------- ARCHETYPE-PAIR NARRATIVE (Compatibility) ----------------
   Rather than hand-writing a narrative for every one of the 36x36 possible
   archetype pairings, this builds one from each archetype's own existing
   fields (name, tag, strengths, shadow/weakness, stress) \u2014 the same
   fields already used everywhere else in the app \u2014 so it stays
   consistent with what each archetype's own page says about it. */
function archPairNarrative(keyA, keyB, an, bn) {
  var archA = archeByKey(keyA), archB = archeByKey(keyB);
  if (!archA || !archB) return null;
  if (keyA === keyB) {
    return an + ' and ' + bn + ' landed on the exact same archetype \u2014 ' + archA.name + '. ' +
      'That means the same headline strengths on both sides (' + archA.strengths.slice(0, 2).map(function (s) { return s.toLowerCase(); }).join(' and ') + '), which is genuine common ground. ' +
      'It also means the same blind spot on both sides: ' + archA.shadow.charAt(0).toLowerCase() + archA.shadow.slice(1) + ' When one of you falls into that pattern, the other isn\u2019t naturally positioned to catch it \u2014 you\u2019re not different there, so neither of you is the built-in check on it. Under real pressure, both of you tend toward behavior that ' + archA.stress;
  }
  var s1 = archA.strengths[0].toLowerCase(), s2 = archB.strengths[0].toLowerCase();
  return an + ' carries ' + archA.name + ' energy (' + archA.tag + '); ' + bn + ' carries ' + archB.name + ' (' + archB.tag + '). ' +
    archA.name + 's tend to lead with ' + s1 + '; ' + archB.name + 's lead with ' + s2 + ' \u2014 two different entry points into the same situation, which is real complementary range if you let each one actually contribute rather than compete for which approach is \u201cright.\u201d ' +
    'Each side carries its own known risk: for ' + an + ', ' + archA.shadow.charAt(0).toLowerCase() + archA.shadow.slice(1) + ' For ' + bn + ', ' + archB.shadow.charAt(0).toLowerCase() + archB.shadow.slice(1) + ' ' +
    'Under real pressure, ' + an + ' tends toward behavior that ' + archA.stress + ' ' + bn + ' tends toward behavior that ' + archB.stress;
}

/* ---------------- GROUP ROLES & SUBGROUPS (Group screen) ----------------
   Heuristic, not a formal instrument: each member's two highest dimensions
   are mapped to a short "natural role" label purely as a tendency-level
   read, using the same 5 dimensions as everything else \u2014 no new data
   collected, no separate scoring system. */
var GROUP_ROLE_MAP = {
  'R,M': 'Decision-driver', 'M,R': 'Decision-driver',
  'S,I': 'Mediator', 'I,S': 'Mediator',
  'S,R': 'Connector', 'R,S': 'Connector',
  'M,I': 'Steady executor', 'I,M': 'Steady executor',
  'P,I': 'Deep thinker', 'I,P': 'Deep thinker',
  'P,M': 'Strategist', 'M,P': 'Strategist',
  'P,S': 'Insight-sharer', 'S,P': 'Insight-sharer',
  'P,R': 'Quick reader', 'R,P': 'Quick reader',
  'S,M': 'Momentum-builder', 'M,S': 'Momentum-builder',
  'I,R': 'Independent driver', 'R,I': 'Independent driver'
};
function suggestGroupRole(dims) {
  var ranked = DIM_ORDER.slice().sort(function (x, y) { return dims[y] - dims[x]; });
  var key = ranked[0] + ',' + ranked[1];
  var role = GROUP_ROLE_MAP[key] || 'Balanced generalist';
  return { role: role, lead: ranked[0], second: ranked[1] };
}

var FACILITATION_PROMPTS = {
  P: 'Ask the group: when we last disagreed on a plan, was it really about the facts, or about how differently we each read the situation underneath them?',
  R: 'Ask the group: do we actually agree on how fast decisions here should get made \u2014 or has that just never been said out loud?',
  I: 'Ask the group: when someone pushes back on a group decision, does the group make room for that, or does it quietly expect people to fall in line?',
  S: 'Ask the group: when something is bothering someone here, does it usually get said directly, or do people wait for it to surface on its own?',
  M: 'Ask the group: are we all actually chasing the same definition of "done," or has everyone quietly set their own bar?'
};

/* subgroupSuggestions \u2014 for larger groups (5+), surfaces which few people
   the numbers suggest leaning on for two different modes. This is a
   transparent heuristic over the same dimension scores already shown
   elsewhere on the screen, explicitly labeled as illustrative, not a
   verdict on who should actually be picked for anything. */
function subgroupSuggestions(members) {
  var k = Math.min(3, Math.max(2, Math.floor(members.length / 2)));
  var byFast = members.slice().sort(function (x, y) { return ((y.dims.R + y.dims.M) - (x.dims.R + x.dims.M)); });
  var byCareful = members.slice().sort(function (x, y) { return ((y.dims.P + (100 - y.dims.R)) - (x.dims.P + (100 - x.dims.R))); });
  return {
    fast: byFast.slice(0, k).map(function (m) { return m.name; }),
    careful: byCareful.slice(0, k).map(function (m) { return m.name; })
  };
}


/* ---------------- ARCHETYPE EMOJIS (one per archetype key) ---------------- */
var ARCH_EMOJI = {
  PRISM: '\u{1F308}',
  PURE_P: '\u{1F441}\uFE0F', PURE_R: '\u26A1', PURE_I: '\u{1F9ED}', PURE_S: '\u{1F9F5}', PURE_M: '\u2699\uFE0F',
  TWIN_PR: '\u{1F30A}', TWIN_PI: '\u{1F989}', TWIN_PS: '\u{1F91D}', TWIN_PM: '\u{1F5FA}\uFE0F', TWIN_RI: '\u{1F525}',
  TWIN_RS: '\u2728', TWIN_RM: '\u{1F680}', TWIN_IS: '\u{1F3DB}\uFE0F', TWIN_IM: '\u{1F9D7}', TWIN_SM: '\u{1F396}\uFE0F',
  PR: '\u{1F52E}', PI: '\u{1F52D}', PS: '\u{1F49E}', PM: '\u{1F50D}',
  RP: '\u{1F3B7}', RI: '\u{1F4A5}', RS: '\u{1F3A4}', RM: '\u{1F3AF}',
  IP: '\u{1F4DA}', IR: '\u{1F3CD}\uFE0F', IS: '\u{1F451}', IM: '\u{1F4D0}',
  SP: '\u{1F54A}\uFE0F', SR: '\u{1F3E1}', SI: '\u2693', SM: '\u{1F4E3}',
  MP: '\u265F\uFE0F', MR: '\u{1F3CE}\uFE0F', MI: '\u{1F3D7}\uFE0F', MS: '\u{1F3C6}'
};
function archEmoji(key) { return ARCH_EMOJI[key] || '\u2728'; }
