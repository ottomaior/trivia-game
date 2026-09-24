import type { OttoLine, OttoLineKey } from './views.ts';

// All player-facing text. The game is Hungarian only.

const fmt = (n: number) => n.toLocaleString('hu');

export const t = {
  tagline: 'Az évszázad kvízműsora',
  startPrompt: 'Kattints a kezdéshez',
  start: 'Kezdés',
  clickToContinue: 'Kattints a műsor folytatásához',
  joinAt: 'Csatlakozz itt',
  roomCode: 'Szobakód',
  playersCount: (n: number, max: number) => `${n}/${max} versenyző`,
  needMorePlayers: (n: number) => `Még ${n} kell a kezdéshez`,
  vipStartsOnPhone: 'A VIP a telefonjáról indítja a műsort',
  vip: 'VIP',
  connecting: 'Csatlakozás…',
  reconnecting: 'Újracsatlakozás…',
  round: (n: number, total: number) => `${n}. kör / ${total}`,
  pickCategory: 'Válasszatok kategóriát',
  voteOnPhone: 'Szavazz a telefonodon',
  getReady: 'Figyelem…',
  answerOnPhone: 'Válaszolj a telefonodon',
  difficulty: { 1: 'Könnyű', 2: 'Közepes', 3: 'Nehéz' } as Record<number, string>,
  noAnswer: 'Nincs válasz',
  points: (n: number) => `${fmt(n)} pont`,
  plusPoints: (n: number) => `+${fmt(n)}`,
  scores: 'Állás',
  finalResults: 'Végeredmény',
  playAgainOnPhone: 'A VIP a telefonjáról indíthat új játékot',
  tvDisconnected: 'A tévé kapcsolata megszakadt — egy pillanat…',
  // phone
  enterCode: 'Szobakód',
  enterName: 'Neved',
  join: 'Belépés',
  youreIn: 'Bent vagy!',
  lookAtTv: 'Nézd a tévét',
  vipHint: 'Te vagy a VIP — te indítod a műsort.',
  waitForVip: 'A VIP indítja a műsort.',
  startShow: 'Indulhat a műsor',
  waitingForMore: (n: number) => `Még ${n} versenyzőre várunk…`,
  yourColor: 'A színed',
  newFace: 'Új arc',
  remove: 'Kiküld',
  voteTitle: 'Válaszd ki a következő kategóriát',
  voted: 'Szavaztál!',
  lockedIn: 'Beküldve!',
  waitForOthers: 'Várjuk a többieket…',
  correct: 'Helyes!',
  wrong: 'Nem egészen',
  tooSlow: 'Lejárt az idő',
  theAnswerWas: 'A helyes válasz:',
  flagQuestion: 'Valami nem stimmel a kérdéssel?',
  flagReasons: {
    wrong_answer: 'Rossz a megadott válasz',
    ambiguous: 'Nem egyértelmű',
    typo: 'Elírás',
    offensive: 'Sértő',
    other: 'Egyéb',
  },
  flagThanks: 'Köszönjük — Otto utánanéz.',
  cancel: 'Mégse',
  yourRank: (rank: number) => `${rank}. helyen állsz`,
  playAgain: 'Új játék',
  newLobby: 'Új váró',
  waitForVipNext: 'A VIP dönti el, mi jön.',
  roomClosed: 'Ez a szoba bezárt.',
  kicked: 'A VIP kiküldött a szobából.',
  playAgainHint: 'Kérj új kódot a házigazdától.',
  errors: {
    BAD_REQUEST: 'Valami nem stimmel. Ellenőrizd a kódot és a nevet.',
    NOT_FOUND: 'Nincs ilyen kódú szoba.',
    ROOM_FULL: 'Ez a szoba megtelt.',
    NAME_TAKEN: 'Ez a név már foglalt.',
    IN_PROGRESS: 'Ez a játék már elindult.',
    NOT_ALLOWED: 'Ezt csak a VIP teheti meg.',
    TOO_FEW_PLAYERS: 'Legalább 2 játékos kell.',
    NO_QUESTIONS: 'Most nincs elérhető kérdés.',
    COLOR_TAKEN: 'Ezt a színt már más választotta.',
  },
  otto: {
    welcome: [
      'Jó estét, és üdv a műsorban! Ma este {n} bátor versenyzőnk van.',
      'Fény, kamera, bajusz! Üdv, {n} versenyző!',
    ],
    pickCategory: ['Tiétek a döntés. Válasszatok bölcsen!', 'Mi legyen a következő?'],
    question: ['{category}! Ujjakat a gombokra…', 'Jöjjön egy kérdés: {category}…'],
    allCorrect: ['Mindenki eltalálta! Túl könnyű? Majd teszek róla.', 'Hibátlan kör! Bravó!'],
    noneCorrect: ['Senki? Tényleg? Még egy szerencsés tipp sem?', 'Nulla találat. A bajszom csalódott.'],
    fastest: ['{name} villámgyors volt!', 'A fürge {name} viszi a legtöbb pontot!'],
    someCorrect: ['Volt, aki tudta. És volt, aki… nem.', 'Nem rossz, egyáltalán nem rossz.'],
    newLeader: ['{name} átveszi a vezetést!', 'Új vezető: {name}!'],
    standings: ['{name} áll az élen — egyelőre.', 'Még bárki nyerhet!'],
    winner: ['{name} nyeri a műsort! Meghajlás!', 'És a bajnok nem más, mint… {name}!'],
    tie: ['Holtverseny az élen! {name} osztozik a dicsőségen!'],
    paused: ['Rövid reklámszünet következik…'],
  } satisfies Record<OttoLineKey, string[]>,
};

export type ErrorText = keyof typeof t.errors;

/** Number of text variants Otto has for a line. */
export function ottoVariants(key: OttoLineKey): number {
  return t.otto[key].length;
}

/** Fills {placeholders} in one of Otto's lines. */
export function ottoText(line: OttoLine): string {
  const variants = t.otto[line.key];
  const template = variants[line.variant % variants.length] ?? '';
  return template.replace(/\{(\w+)\}/g, (_, k: string) => line.vars[k] ?? '');
}
