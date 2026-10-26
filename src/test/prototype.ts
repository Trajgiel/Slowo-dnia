// Test harness: runs the prototype's own code (src/test/prototype-domain.txt, verbatim lines of
// materials/project/index.html in the workspace) with stubbed DOM, storage, clock and randomness, so
// the domain layer can be compared with the reference on the same inputs.
import fixture from './prototype-domain.txt?raw'

const STARTUP_HEADER = /^\/\/### startup.*$/m
const [body = '', startup = ''] = fixture.split(STARTUP_HEADER)

export type RawTheme = readonly [string, readonly (readonly unknown[])[]]

export interface ProtoWord {
  pl: string
  ru: string
  tr: string
  ti: number
  theme: string
}

interface ProtoEl {
  innerHTML: string
  textContent: string
  hidden: boolean
  onclick: (() => void) | null
}

export interface Proto {
  loadState(): void
  nextIdx(): number
  /** "Выучили" on word `i` (prototype `done.onclick` with `cur = i`). */
  toggle(i: number): void
  /** Re-renders the quiz tab and returns its markup. */
  renderQuiz(): { box: string; below: string }
  /** Clicks a button rendered by the last `renderQuiz`; `false` if it is not there. */
  click(id: string): boolean
  setCourse(course: 'kids' | 'adult', themes: readonly RawTheme[]): void
  streak(): { n: number; today: boolean }
  renderStreak(): ProtoEl
  deckState(deck: unknown): { total: number; right: number; wrong: number; next?: number }
  startCourse(): unknown
  speak(text: string): void
  readonly toasts: string[]
  readonly spoken: string[]
  readonly vars: {
    done: Set<number>
    weak: Record<string, number>
    days: string[]
    DAYS: ProtoWord[]
    N: number
    quiz: {
      mode: string
      dir: string
      free: { idx: number | null; dir: string; recent: number[] }
    }
  }
}

export interface ProtoEnv {
  themes: readonly RawTheme[]
  boy?: Record<string, readonly unknown[]>
  boyTheme?: Record<string, string>
  storage: MemoryStorage
  /** Current time, read by every `new Date()` without arguments in the prototype. */
  now: () => number
  /** Replaces `Math.random`. */
  random: () => number
}

export class MemoryStorage {
  readonly map = new Map<string, string>()
  getItem(k: string): string | null {
    return this.map.get(k) ?? null
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v)
  }
  removeItem(k: string): void {
    this.map.delete(k)
  }
}

const PRELUDE = `
const els=new Map();
const mkEl=()=>({innerHTML:"",textContent:"",hidden:false,inert:false,onclick:null,setAttribute(){},
  classList:{toggle(){},add(){},remove(){},contains(){return false}},querySelectorAll(){return[]}});
// buttons of the quiz card (qYes, qShow, …) exist only while the rendered markup contains them
const rendered=id=>[...els.values()].some(e=>e.innerHTML.includes('id="'+id+'"'));
const $=id=>{if(/^q[A-Z]/.test(id)&&!rendered(id))return null;let e=els.get(id);if(!e){e=mkEl();els.set(id,e)}return e};
const toasts=[];
function toast(t){toasts.push(t)}
function show(){}
function progress(){}
function twoStep(btn,label,armedLabel,action){btn.onclick=action}
`

const EPILOGUE = `
const doneClick=$("done").onclick;
function startCourse(){${startup}
  return c}
return {
  loadState, nextIdx:()=>nextIdx(), toggle(i){cur=i;doneClick()},
  renderQuiz(){els.clear();renderQuiz();return{box:$("quizBox").innerHTML,below:$("quizBelow").innerHTML}},
  click(id){const e=$(id);if(!e||!e.onclick)return false;e.onclick();return true},
  setCourse(c,cw){course=c;CW=cw},
  streak, renderStreak(){renderStreak();return $("streak")}, deckState, startCourse,
  speak(t){speak(t,null)}, toasts,
  vars:{get done(){return done},get weak(){return weak},get days(){return days},get DAYS(){return DAYS},
    get N(){return N},get quiz(){return quiz}},
};
`

// eslint-disable-next-line @typescript-eslint/no-implied-eval -- runs the prototype's code verbatim
const factory = new Function(
  'W',
  'BOY',
  'BOY_THEME',
  'localStorage',
  'Date',
  'Math',
  'window',
  'SpeechSynthesisUtterance',
  PRELUDE + body + EPILOGUE,
) as (...args: unknown[]) => Omit<Proto, 'spoken'>

/** A fresh prototype instance; `loadState()` is already called, as at page start. */
export function createProto(env: ProtoEnv): Proto {
  const RealDate = Date
  class FakeDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(env.now())
      else super(...(args as [number]))
    }
  }
  const math = Object.create(Math) as Math
  math.random = env.random
  const spoken: string[] = []
  const speechSynthesis = {
    cancel: () => undefined,
    getVoices: () => [{ lang: 'pl-PL' }],
    speak: (u: { text: string }) => spoken.push(u.text),
  }
  class Utterance {
    readonly text: string
    constructor(text: string) {
      this.text = text
    }
  }
  const proto = factory(
    env.themes,
    env.boy ?? {},
    env.boyTheme ?? {},
    env.storage,
    FakeDate,
    math,
    { speechSynthesis },
    Utterance,
  )
  proto.loadState()
  return Object.assign(proto, { spoken })
}

/** Seeded PRNG (mulberry32): the same seed gives the same stream for the prototype and the domain. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
