import type { OttoLine, OttoLineKey } from './views.ts';

// All player-facing text. The game is Hungarian only.

const fmt = (n: number) => n.toLocaleString('hu');

export const t = {
  tagline: 'Az évszázad kvízműsora',
  startPrompt: 'Kattints a kezdéshez',
  start: 'Kezdés',
  clickToContinue: 'Kattints a műsor folytatásához',
  soundOn: 'Hang bekapcsolása',
  soundOff: 'Hang némítása',
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
    TOO_FEW_PLAYERS: 'Nincs elég csatlakozott játékos.',
    NO_QUESTIONS: 'Most nincs elérhető kérdés.',
    COLOR_TAKEN: 'Ezt a színt már más választotta.',
  },
  otto: {
    welcome: [
      'Jó estét, és üdv a műsorban! Ma este {n} bátor versenyzőnk van.',
      'Fény, kamera, bajusz! Üdv, {n} versenyző!',
    ],
    welcomeSolo: [
      'Jó estét! Ma egyetlen, ám annál bátrabb versenyzőnk van.',
      'Egyszemélyes műsor? Otto erre is készen áll!',
    ],
    pickCategory: ['Tiétek a döntés. Válasszatok bölcsen!', 'Mi legyen a következő?'],
    lastRound: ['Utolsó kör! Most dől el minden!', 'Elérkeztünk az utolsó kérdéshez!'],
    question: ['{category}! Ujjakat a gombokra…', 'Jöjjön egy kérdés: {category}…'],
    allCorrect: ['Mindenki eltalálta! Túl könnyű? Majd teszek róla.', 'Hibátlan kör! Bravó!'],
    noneCorrect: ['Senki? Tényleg? Még egy szerencsés tipp sem?', 'Nulla találat. A bajszom csalódott.'],
    noneCorrectAgain: ['Már megint senki? Kezdek aggódni…', 'Két kör egymás után találat nélkül. Ilyet még nem láttam!'],
    streak: ['{name} már {n} kérdést talált el sorban!', '{n} egymás után! {name} lángol!'],
    lightning: ['Villámgyors! {name} gondolkodás nélkül rávágta.', '{name} gyorsabb volt, mint a saját árnyéka!'],
    fastest: ['{name} volt a leggyorsabb!', 'A fürge {name} viszi a legtöbb pontot!'],
    someCorrect: ['Volt, aki tudta. És volt, aki… nem.', 'Nem rossz, egyáltalán nem rossz.'],
    soloCorrect: ['Szép munka, pontosan így kell!', 'Telitalálat!'],
    soloWrong: ['Ez most nem jött össze. Jöhet a következő!', 'Hoppá! Semmi baj, van még kérdés.'],
    newLeader: ['{name} átveszi a vezetést!', 'Új vezető: {name}!'],
    comeback: ['{name} hatalmasat lépett előre!', 'Nézzék csak, {name} feljön hátulról!'],
    blowout: ['{name} elhúzott, a többieknek igyekezniük kell!', '{name} kényelmes előnyben van. Egyelőre.'],
    closeRace: ['Fej fej mellett: {a} és {b}!', 'Szoros a verseny {a} és {b} között!'],
    standings: ['{name} áll az élen — egyelőre.', 'Még bárki nyerhet!'],
    soloScore: ['Eddig {score} pont. Csak így tovább!', '{score} pont a számládon. Szép!'],
    winner: ['{name} nyeri a műsort! Meghajlás!', 'És a bajnok nem más, mint… {name}!'],
    tie: ['Holtverseny az élen! {name} osztozik a dicsőségen!', 'Döntetlen! {name} együtt állhat a dobogó tetején!'],
    soloFinalHigh: ['{score} pont! Ez bajnoki teljesítmény!', 'Lenyűgöző: {score} pont. Le a kalappal!'],
    soloFinalLow: ['{score} pont. Legközelebb még jobb lesz!', 'Vége a műsornak: {score} pont. Gyakorlat teszi a mestert!'],
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
