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
  chosenCategory: 'A következő kategória',
  roundCard: (n: number) => `${n}. kérdés`,
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
      'Jó estét, és üdv a műsorban! Lássuk, ki a legokosabb a teremben!',
      'Fény, kamera, bajusz! Kezdődik az évszázad kvízműsora!',
    ],
    welcomeSolo: [
      'Jó estét! Ma egyetlen, ám annál bátrabb versenyzőnk van.',
      'Egyszemélyes műsor? Otto erre is készen áll!',
    ],
    pickCategory: ['Tiétek a döntés. Válasszatok bölcsen!', 'Mi legyen a következő?', 'Na, melyik témában vagytok otthon?'],
    lastRound: ['Utolsó kör! Most dől el minden!', 'Elérkeztünk az utolsó kérdéshez!'],
    question: ['Figyelem, jön a kérdés!', 'Ujjakat a gombokra!', 'Lássuk, ki tudja!'],
    allCorrect: ['Mindenki eltalálta! Túl könnyű? Majd teszek róla.', 'Hibátlan kör! Bravó!'],
    noneCorrect: ['Senki? Tényleg? Még egy szerencsés tipp sem?', 'Nulla találat. A bajszom csalódott.'],
    noneCorrectAgain: ['Már megint senki? Kezdek aggódni…', 'Két kör egymás után találat nélkül. Ilyet még nem láttam!'],
    streak: ['Valaki itt nagyon formában van!', 'Sorozatban talál, ez már nem véletlen!'],
    lightning: ['Villámgyors! Gondolkodás nélkül rávágta.', 'Ez gyorsabb volt, mint a saját árnyéka!'],
    fastest: ['Íme a leggyorsabb versenyző!', 'A fürge ujjak viszik a legtöbb pontot!'],
    someCorrect: ['Volt, aki tudta. És volt, aki… nem.', 'Nem rossz, egyáltalán nem rossz.'],
    soloCorrect: ['Szép munka, pontosan így kell!', 'Telitalálat!'],
    soloWrong: ['Ez most nem jött össze. Jöhet a következő!', 'Hoppá! Semmi baj, van még kérdés.'],
    newLeader: ['Új vezetőnk van!', 'Fordulat! Megvan az új listavezető!'],
    comeback: ['Nézzék csak, ki jön fel hátulról!', 'Hatalmas előrelépés!'],
    blowout: ['Valaki nagyon elhúzott, a többieknek igyekezniük kell!', 'Kényelmes előny az élen. Egyelőre.'],
    closeRace: ['Fej fej mellett az élen!', 'Szoros a verseny, bármi megtörténhet!'],
    standings: ['Így áll most a verseny.', 'Még bárki nyerhet!'],
    soloScore: ['Szépen gyűlnek a pontok. Csak így tovább!', 'Jó úton jársz!'],
    winner: ['És a bajnok nem más, mint…', 'Íme, a műsor győztese! Meghajlás!'],
    tie: ['Holtverseny az élen! Osztozzatok a dicsőségen!', 'Döntetlen! Több bajnokunk is van!'],
    soloFinalHigh: ['Ez bajnoki teljesítmény volt!', 'Lenyűgöző eredmény. Le a kalappal!'],
    soloFinalLow: ['Legközelebb még jobb lesz!', 'Vége a műsornak. Gyakorlat teszi a mestert!'],
    paused: ['Rövid reklámszünet következik…'],
  } satisfies Record<OttoLineKey, string[]>,
};

export type ErrorText = keyof typeof t.errors;

/** Number of text variants Otto has for a line. */
export function ottoVariants(key: OttoLineKey): number {
  return t.otto[key].length;
}

/** The words of one of Otto's lines. */
export function ottoText(line: Pick<OttoLine, 'key' | 'variant'>): string {
  const variants = t.otto[line.key];
  return variants[line.variant % variants.length] ?? '';
}

/** File name (without extension) of a line's pre-recorded voice clip. */
export function ottoVoiceId(line: Pick<OttoLine, 'key' | 'variant'>): string {
  return `${line.key}-${line.variant % t.otto[line.key].length}`;
}

/** Every line Otto can say, for voice generation. */
export function allOttoLines(): { id: string; text: string }[] {
  return (Object.keys(t.otto) as OttoLineKey[]).flatMap((key) =>
    t.otto[key].map((text, variant) => ({ id: ottoVoiceId({ key, variant }), text })),
  );
}
