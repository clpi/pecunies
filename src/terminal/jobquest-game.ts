/**
 * Text adventure: "Signal Hunt" — a tongue-in-cheek job search in the terminal.
 * Choices: type 1–9, or the first word of a choice (e.g. "coffee", "apply").
 */

export type JobQuestFlags = Record<string, boolean>;

export type JobQuestState = {
  nodeId: string;
  /** 0–100 "signal" — good moves raise it; some endings key off it */
  signal: number;
  turns: number;
  flags: JobQuestFlags;
};

type Choice = {
  /** Shown as [1] … user may type 1 or this token (lowercase) */
  token: string;
  label: string;
  next: string;
  signalDelta?: number;
  setFlag?: string;
};

type Node = {
  id: string;
  title: string;
  body: string;
  choices: Choice[];
  /** If set, game ends after showing this node (no choices) */
  ending?: 'win' | 'lose';
};

const NODES: Record<string, Node> = {
  start: {
    id: 'start',
    title: 'Seattle · pre-market coffee',
    body: `You are a software engineer hunting for the next role. The rain is polite; the job market less so.
Your calendar shows two "quick intro" calls that somehow overlap, and your inbox has seventeen variants of "We received your application."

The laptop fan sounds like judgement. What first?`,
    choices: [
      { token: 'coffee', label: 'Walk out for coffee and sunlight', next: 'coffee', signalDelta: 3 },
      { token: 'apply', label: 'Apply to one role with a tailored note', next: 'tailored', signalDelta: 8 },
      { token: 'spray', label: 'Fire ten easy-apply clicks into the void', next: 'ats_void', signalDelta: -5 },
    ],
  },
  coffee: {
    id: 'coffee',
    title: 'Caffeine and small talk',
    body: `At the counter you overhear someone venting about Kubernetes quotas. You nod sympathetically — wrong move, they think you're hiring.
They apologize, mention their team is actually staffing a platform role, and slide you a card: "Email me something short; no PDF novels."

You pocket the card like contraband.`,
    choices: [
      { token: 'email', label: 'Send a tight email tonight', next: 'warm_intro', signalDelta: 10, setFlag: 'has_warm_lead' },
      { token: 'linkedin', label: 'Connect only and vanish', next: 'linkedin_only', signalDelta: -2 },
    ],
  },
  tailored: {
    id: 'tailored',
    title: 'One good application',
    body: `You rewrite two paragraphs so they mirror the job description without sounding like a Markov chain.
The submit button feels heavier than production deploys.

Two days later: a calendar invite titled "Recruiter screen — 30m".`,
    choices: [
      { token: 'prep', label: 'Prep talking points and salary band', next: 'recruiter_screen', signalDelta: 5 },
      { token: 'wing', label: 'Wing it; you have charisma (probably)', next: 'recruiter_screen', signalDelta: -3 },
    ],
  },
  ats_void: {
    id: 'ats_void',
    title: 'The ATS dimension',
    body: `Ten applications vanish into parsers that crave keywords you refuse to stuff.
A rejection arrives before you finish your tea — an automated "not moving forward" with your name misspelled.

You can still course-correct.`,
    choices: [
      { token: 'tailor', label: 'Pick one company and tailor properly', next: 'tailored', signalDelta: 6 },
      { token: 'network', label: 'DM a former coworker instead', next: 'slack_dm', signalDelta: 4 },
    ],
  },
  linkedin_only: {
    id: 'linkedin_only',
    title: 'Connections without context',
    body: `Your invite sits pending. The algorithm shows you posts about "hustle culture" and ten-step morning routines.
You close the tab before it damages your soul.`,
    choices: [
      { token: 'coffee', label: 'Try the coffee shop lead again', next: 'coffee', signalDelta: 2 },
      { token: 'apply', label: 'Commit to one serious application', next: 'tailored', signalDelta: 5 },
    ],
  },
  warm_intro: {
    id: 'warm_intro',
    title: 'The warm thread',
    body: `Your email is four sentences: who you are, what you shipped last quarter, one link, gratitude.
The reply arrives in hours: "Looping in hiring manager — can you do Thursday?"`,
    choices: [
      { token: 'yes', label: 'Block focus time and prep system design', next: 'hm_screen', signalDelta: 8 },
      { token: 'panic', label: 'Panic-read blogs until 2am', next: 'hm_screen', signalDelta: -4 },
    ],
  },
  recruiter_screen: {
    id: 'recruiter_screen',
    title: 'Recruiter screen',
    body: `Video on. You explain your last role without trashing the old org — growth mindset, etc.
They ask timeline and comp; you give a range that doesn't undersell you.

They say the team loved your GitHub activity on that WASM side project.`,
    choices: [
      { token: 'technical', label: 'Schedule the technical round', next: 'technical', signalDelta: 6 },
    ],
  },
  slack_dm: {
    id: 'slack_dm',
    title: 'Slack archaeology',
    body: `You find a former teammate in #random from 2019. You draft a humble-brag-free ping.
They answer with a thumbs-up and an internal referral link that actually works.`,
    choices: [
      { token: 'referral', label: 'Submit through referral portal', next: 'technical', signalDelta: 9 },
    ],
  },
  hm_screen: {
    id: 'hm_screen',
    title: 'Hiring manager call',
    body: `No riddles — they want stories about incidents, trade-offs, and how you disagree with product.
You describe a rollback that saved a launch. They lean in.

"We're doing onsite next week — small panel, no whiteboard hazing."`,
    choices: [
      { token: 'onsite', label: 'Accept and study their architecture blog', next: 'onsite', signalDelta: 7 },
    ],
  },
  technical: {
    id: 'technical',
    title: 'Technical round',
    body: `Live coding is pair-style: extend a small service, add tests, talk through edge cases.
You forget one import, laugh, fix it. The interviewer says "happens in prod too."

They want you to meet the team for culture fit — which here means "do you communicate when things burn."`,
    choices: [
      { token: 'onsite', label: 'Book the onsite / panel', next: 'onsite', signalDelta: 5 },
    ],
  },
  onsite: {
    id: 'onsite',
    title: 'Onsite (actually on-site)',
    body: `Panel asks how you'd split a monolith, how you learn a new codebase, and the hardest bug you shipped.
You draw one diagram on the board — legible boxes, not cosmic spaghetti.

You walk out knowing you didn't embarrass yourself. That counts.`,
    choices: [
      { token: 'followup', label: 'Send thank-you notes same evening', next: 'verdict', signalDelta: 10 },
      { token: 'wait', label: 'Wait silently for a week', next: 'verdict', signalDelta: 0 },
    ],
  },
  verdict: {
    id: 'verdict',
    title: 'The verdict',
    body: '', // filled dynamically in formatJobQuestScene
    choices: [{ token: 'continue', label: 'Open the thread — see the outcome', next: '__resolve_verdict__' }],
  },
  win_signed: {
    id: 'win_signed',
    title: 'Offer · signed',
    body: `The comp is fair, the tech stack doesn't require sacrificing pets to a legacy god, and PTO is written in human language.
You sign digitally while the espresso machine screams victory.

THE END — You found the job. Reality will still be weird, but today you won.`,
    choices: [],
    ending: 'win',
  },
  almost: {
    id: 'almost',
    title: 'Close, not closed',
    body: `They loved the panel — then the role went on hold, or an internal transfer ate the headcount, or "we went another direction" with no usable detail.

THE END (this round). You had real signal; the dice were just weighted. Log what you learned, sleep, then one warm thread beats fifty cold applies.`,
    choices: [],
    ending: 'lose',
  },
  lose_burnout: {
    id: 'lose_burnout',
    title: 'Burnout alley',
    body: `You stop sleeping, mainline comparison threads, and treat every rejection as a referendum on your worth.
The terminal cursor blinks like a metronome of doom.

THE END — for now. The market is a season, not a verdict. Type n for a new run when you're ready.`,
    choices: [],
    ending: 'lose',
  },
};

export function createJobQuestState(): JobQuestState {
  return { nodeId: 'start', signal: 50, turns: 0, flags: {} };
}

function clampSignal(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function buildVerdictBody(state: JobQuestState): string {
  const s = state.signal;
  if (s >= 78) {
    return `The email subject is short: "Offer."

They went with you — signal beat noise. Time to negotiate start date and buy slightly worse coffee out of celebration.`;
  }
  if (s >= 55) {
    return `They want you — with one more exec alignment. You're basically there; keep the thread warm and don't invent new worries.`;
  }
  return `They loved the conversation but "timing shifted." Translation: budget, headcount, or a finalist with an internal champion.

Not a mirror of your skills. Regroup: warm intros beat spray-and-pray.`;
}

export function formatJobQuestScene(state: JobQuestState): string {
  const node = NODES[state.nodeId];
  if (!node) {
    return '(adventure state lost — type n for new game)';
  }

  let body = node.body;
  if (node.id === 'verdict') {
    body = buildVerdictBody(state);
  }

  const lines = [
    `══ ${node.title} ══`,
    '',
    body,
    '',
    `signal: ${state.signal}/100   turns: ${state.turns}`,
  ];

  if (node.choices.length) {
    lines.push('', '— What do you do? —');
    node.choices.forEach((c, i) => {
      lines.push(`  [${i + 1}] ${c.label}  (${c.token})`);
    });
    lines.push('', 'Type a number (1–9) or a choice keyword.  help  repeats.  q  quits.');
  }

  return lines.join('\n');
}

export function processJobQuestInput(
  state: JobQuestState,
  raw: string,
): { state: JobQuestState; lines: string[]; gameOver: boolean; won: boolean } {
  const input = raw.trim().toLowerCase();
  const lines: string[] = [];

  if (!input) {
    lines.push('(type a choice or help)');
    return { state, lines, gameOver: false, won: false };
  }

  if (input === 'help' || input === 'look' || input === 'l') {
    lines.push(formatJobQuestScene(state));
    return { state, lines, gameOver: false, won: false };
  }

  if (input === 'i' || input === 'inv' || input === 'inventory') {
    const inv = Object.keys(state.flags).filter((k) => state.flags[k]);
    lines.push(inv.length ? `You carry: ${inv.join(', ')}.` : 'You carry: grit, caffeine, and one decent README.');
    return { state, lines, gameOver: false, won: false };
  }

  const node = NODES[state.nodeId];
  if (!node || node.ending) {
    lines.push('Game already ended — n for new, q to quit.');
    return { state, lines, gameOver: false, won: false };
  }

  const n = Number.parseInt(input, 10);
  let choice: Choice | undefined;
  if (Number.isFinite(n) && n >= 1 && n <= node.choices.length) {
    choice = node.choices[n - 1];
  } else {
    choice = node.choices.find(
      (c) => c.token === input || c.label.toLowerCase().startsWith(input) || input.startsWith(c.token),
    );
  }

  if (!choice) {
    lines.push(`Unknown choice "${raw.trim()}". Try 1–${node.choices.length} or help.`);
    return { state, lines, gameOver: false, won: false };
  }

  let nextSignal = clampSignal(state.signal + (choice.signalDelta ?? 0));
  const nextFlags = { ...state.flags };
  if (choice.setFlag) {
    nextFlags[choice.setFlag] = true;
  }

  let nextId = choice.next;

  if (nextId === '__resolve_verdict__') {
    const rolled: JobQuestState = {
      nodeId: 'verdict',
      signal: nextSignal,
      turns: state.turns + 1,
      flags: nextFlags,
    };
    if (rolled.signal >= 78) {
      nextId = 'win_signed';
    } else if (rolled.signal < 40) {
      nextId = 'lose_burnout';
    } else {
      nextId = 'almost';
    }
  }

  const nextState: JobQuestState = {
    nodeId: nextId,
    signal: nextSignal,
    turns: state.turns + 1,
    flags: nextFlags,
  };

  const nextNode = NODES[nextState.nodeId];
  if (!nextNode) {
    lines.push('(broken link in story graph — n for new)');
    return { state, lines, gameOver: false, won: false };
  }

  lines.push(formatJobQuestScene(nextState));

  if (nextNode.ending === 'win') {
    return { state: nextState, lines, gameOver: true, won: true };
  }
  if (nextNode.ending === 'lose') {
    return { state: nextState, lines, gameOver: true, won: false };
  }

  return { state: nextState, lines, gameOver: false, won: false };
}

/** Used by the shell so real commands (e.g. ls) still exit the game session. */
export function jobQuestWouldHandleAsGameInput(state: JobQuestState, raw: string): boolean {
  const input = raw.trim().toLowerCase();
  if (!input) {
    return false;
  }
  if (['q', 'quit', 'n', 'new', 'help', 'look', 'l', 'i', 'inv', 'inventory'].includes(input)) {
    return true;
  }
  const node = NODES[state.nodeId];
  if (!node || node.ending) {
    return false;
  }
  const n = Number.parseInt(input, 10);
  if (Number.isFinite(n) && n >= 1 && n <= node.choices.length) {
    return true;
  }
  return node.choices.some(
    (c) => c.token === input || c.label.toLowerCase().startsWith(input) || input.startsWith(c.token),
  );
}

/** Score for leaderboard: signal + bonus for fewer turns on win */
export function jobQuestScore(state: JobQuestState, won: boolean): number {
  if (!won) {
    return state.signal + state.turns;
  }
  return state.signal * 2 + Math.max(0, 80 - state.turns * 3);
}
