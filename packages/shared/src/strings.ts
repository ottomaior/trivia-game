import type { CharacterId, GameMode, Lifeline } from './rules.ts';
import type { OttoLine, OttoLineKey } from './views.ts';

// All player-facing text. The game is Hungarian only.

const fmt = (n: number) => n.toLocaleString('hu');
/** A banked ladder rung; zero means still at the bottom. */
const rungText = (n: number) => (n === 0 ? 'Start' : `${n}. lépcső`);

/** The game modes as the lobby's section cards name them; the four party ones double as their in-game titles. */
const modeNames: Record<GameMode, string> = {
  classic: 'Kvíz',
  ladder: 'Milliomos-létra',
  bluff: 'Blöffölő',
  timeline: 'Időrend',
  guess: 'Tippelj!',
};

export const t = {
  tagline: 'Az évszázad kvízműsora',
  voiceCredit: (by: string) => `Ottó hangja: ${by}`,
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
  modePickOnPhone: 'A VIP a telefonján választ játékmódot',
  packVoteOnPhone: 'Szavazzatok csomagra a telefonotokon',
  vipPicksCategories: 'A VIP válogatja a kategóriákat',
  packQuestions: (n: number) => `${fmt(n)} kérdés`,
  packCategories: (n: number) => `${n} kategória`,
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
  modeTitle: 'Mit játszunk?',
  modeNames,
  modeTaglines: {
    classic: 'Tíz kérdés, négy válasz, témacsomag szavazásra.',
    ladder: 'Tizenöt egyre nehezebb kérdés, biztos pontokkal és segítségekkel.',
    bluff: 'Írj hihető kamut, és találd meg az igazat a hazugságok között.',
    timeline: 'Öt dolog, egy kérdés: mi volt előbb? Rakd sorba!',
    guess: 'Tippelj egy számot, és tegyél zsetont a legjobb tippekre.',
  } satisfies Record<GameMode, string>,
  modePacks: (n: number) => `${n} csomag`,
  vipPicksMode: 'A VIP választja a játékmódot…',
  packsTitle: 'Melyik csomag legyen?',
  packsLoading: 'Csomagok betöltése…',
  noPacks: 'Most nincs játszható csomag.',
  lockPack: 'Tovább',
  categoriesTitle: 'Kategóriák',
  categoriesHint: 'Kapcsold ki, ami nem kell.',
  enabledQuestions: (n: number) => `${fmt(n)} kérdés van bekapcsolva`,
  vipPicking: 'A VIP válogatja a kategóriákat…',
  waitingForMore: (n: number) => `Még ${n} versenyzőre várunk…`,
  /** The host's name as it appears on the set (his podium). */
  ottoName: 'Ottó',
  yourCharacter: 'A szereplőd',
  characters: {
    gomboc: 'Gombóc',
    kocka: 'Kocka',
    bab: 'Bab',
    csepp: 'Csepp',
    csillag: 'Csillag',
    felho: 'Felhő',
    szellem: 'Szellem',
    bogyo: 'Bogyó',
  } satisfies Record<CharacterId, string>,
  remove: 'Kiküld',
  voteTitle: 'Válaszd ki a következő kategóriát',
  chosenCategory: 'A következő kategória',
  roundCard: (n: number) => `${n}. kérdés`,
  doublePoints: 'Dupla pont!',
  voted: 'Szavaztál!',
  // power plays
  powerNames: { freeze: 'Jégcsapda', slime: 'Trutyibomba' } as Record<string, string>,
  powerHelp: {
    freeze: 'Jégbe zárja a válaszgombjait: koppintással kell feltörnie.',
    slime: 'Trutyi borítja a képernyőjét: az ujjával kell letörölnie.',
  } as Record<string, string>,
  powerTitle: 'Bevetsz egy csapdát?',
  powerKeep: 'Nem most, megtartom',
  powerPickTarget: 'Kire küldöd?',
  back: 'Vissza',
  powerSent: (power: string, target: string) => `${power} úton ${target} felé!`,
  powerKept: 'A csapdád megvár a következő körre.',
  powerHitYou: (by: string, power: string) => `${by} ${power === 'freeze' ? 'jégcsapdát' : 'trutyibombát'} küldött rád!`,
  powerTapToBreak: (left: number) => `Koppints! Még ${left}`,
  powerWipe: 'Töröld le az ujjaddal!',
  powerOnPhone: 'Csapdák a telefonokon',
  powerHasOne: 'Van nála csapda',
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
  flagThanks: 'Köszönjük — Ottó utánanéz.',
  // Milliomos-létra
  ladderTitle: modeNames.ladder,
  rungOf: (n: number, total: number) => `${n}. lépcső / ${total}`,
  rung: rungText,
  safeRung: 'Biztos pont',
  stay: 'Maradok',
  walk: 'Megállok',
  walkQuestion: 'Mész tovább, vagy megállsz?',
  walkKeeps: (n: number) => `Ha most megállsz, ${n}. lépcsővel zársz.`,
  firstRung: 'Indul a létra! Az első lépcsőn még nincs mit megtartani.',
  staying: 'Marad',
  walking: 'Megáll',
  seatStatus: { in: 'Mászik', out: 'Leesett', walked: 'Megállt', top: 'Csúcs!' } as Record<string, string>,
  climbed: 'Feljebb léptél!',
  fell: 'Leestél a létráról',
  reachedTop: 'Tiéd a csúcs!',
  youWalked: 'Megálltál',
  // "az első", "az ötödik", otherwise "a" (rungs only go up to fifteen).
  youKeep: (n: number) => (n === 0 ? 'Most nem viszel haza semmit.' : `${n === 1 || n === 5 ? 'Az' : 'A'} ${n}. lépcső a tiéd.`),
  audienceMode: 'Te most a közönség vagy: tippelj, a versenyzők ebből kérhetnek segítséget!',
  lifelinesLabel: 'Segítségek',
  lifelines: { fifty: 'Felezés', audience: 'Közönség', phone: 'Telefon' } as Record<Lifeline, string>,
  noAudienceYet: 'Még nincs közönség',
  audienceSays: 'A közönség szavazata:',
  pickFriend: 'Kit hívsz fel?',
  friendThinking: (name: string) => `${name} még gondolkodik…`,
  friendSays: (name: string) => `${name} tippje:`,
  cancel: 'Mégse',
  // Blöffölő
  bluffTitle: modeNames.bluff,
  bluffWriteTitle: 'Írj egy hihető hazugságot!',
  bluffWriteHint: 'Ha a többiek bedőlnek neki, pontot kapsz.',
  bluffLiePlaceholder: 'A te kamu válaszod',
  bluffSubmit: 'Beküldöm',
  bluffYourLie: 'A hazugságod:',
  bluffPickTitle: 'Melyik az igazság?',
  bluffOwnLie: 'Ez a tiéd',
  bluffWriting: 'Írják a hazugságokat',
  bluffPicking: 'Keresd az igazságot a telefonodon',
  bluffFoundTruth: 'Megtaláltad az igazságot!',
  bluffFooledBy: (names: string) => (names ? `Bedőltél: ${names} kamujának` : 'Bedőltél a ház kamujának'),
  bluffMissed: 'Nem választottál',
  bluffFooled: (n: number) => `${n} embert átvertél`,
  bluffTruthWas: 'Az igazság:',
  bluffTruthTag: 'Igazság',
  bluffHouseLie: 'A ház kamuja',
  bluffWroteIt: (names: string) => `Írta: ${names}`,
  // Időrend
  orderTitle: modeNames.timeline,
  orderHint: 'Húzd sorba: legfelül a legkorábbi.',
  orderHintArrows: 'Rendezd sorba a nyilakkal: legfelül a legkorábbi.',
  orderDone: 'Kész',
  orderEarliest: 'Legkorábbi',
  orderLatest: 'Legkésőbbi',
  orderMoveUp: 'Feljebb',
  orderMoveDown: 'Lejjebb',
  orderOnPhone: 'Rakd időrendbe a telefonodon',
  orderRight: (n: number, total: number) => `${n} / ${total} a helyén`,
  orderPerfect: 'Tökéletes sorrend!',
  orderCorrectWas: 'A helyes sorrend:',
  // Tippelj!
  guessTitle: modeNames.guess,
  guessHint: 'Írd be a tipped: a legközelebbi nyer.',
  guessPlaceholder: 'A tipped',
  guessSubmit: 'Tippelek',
  guessInvalid: 'Ez nem szám.',
  guessOnPhone: 'Tippelj a telefonodon',
  betTitle: 'Kinek a tippje a legközelebbi?',
  betHint: (n: number) => (n === 0 ? 'Zsetonok letéve!' : `Tegyél fel még ${n} zsetont`),
  betOnPhone: 'Tegyétek fel a zsetonokat',
  noGuessNoBet: 'Nem tippeltél, így most nem fogadhatsz. Nézd a tévét!',
  yourGuess: 'A tipped:',
  guessClosest: 'A tiéd a legközelebbi!',
  guessNotClosest: 'Nem a tiéd lett a legközelebbi',
  guessAnswerWas: 'A pontos válasz:',
  guessOff: (d: string) => `Eltérés: ${d}`,
  guessSpotOn: 'Telitalálat!',
  guessExactLabel: 'A pontos válasz',
  bluffFellFor: 'Bedőlt:',
  bluffFound: 'Megtalálta:',
  bluffNobodyFell: 'Senki sem dőlt be',
  chipsWon: (n: number) => `${n} nyerő zseton`,
  betChips: (n: number) => `${n} zseton`,
  mineTag: (name: string) => `${name} (te)`,
  number: (n: number) => n.toLocaleString('hu', { maximumFractionDigits: 3 }),
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
    TOO_FEW_QUESTIONS: 'Így túl kevés kérdés maradna.',
    CHARACTER_TAKEN: 'Ezt a szereplőt már más választotta.',
    TOO_CLOSE: 'Ez túl közel van az igazsághoz. Írj mást!',
  },
  /**
   * Otto's lines. Bracketed cues ("[excited]") tell the voice how to perform
   * a line; screens show the text without them (ottoText). No names or
   * numbers: every line is pre-recorded, and `focus` says whom it's about.
   */
  otto: {
    welcome: [
      '[warmly] Jó estét, és üdv a műsorban! [excited] Lássuk, ki a legokosabb itt!',
      '[excited] Fény, kamera, bajusz! Kezdődik az évszázad kvízműsora!',
      '[warmly] Üdvözlöm a versenyzőket és a kanapén ülő nagyérdeműt!',
      '[proudly] Jó estét! Frissen fésült bajusszal várom a mai versenyzőket.',
      '[mischievously] Telefonokat elő, szerénységet félre! [excited] Kezdünk!',
      '[excited] Megérkeztek a mai hőseink! [warmly] Tapsot kérek!',
    ],
    welcomeSolo: [
      '[warmly] Jó estét! [playfully] Ma egyetlen, ám annál bátrabb versenyzőnk van.',
      '[chuckles] Egyszemélyes műsor? [proudly] Ottó erre is készen áll!',
      '[playfully] Csak ketten vagyunk: te meg én. [chuckles] Meg a bajszom.',
      '[excited] Magányos hős a stúdióban! [mischievously] A dicsőség csak a tiéd.',
      '[warmly] Egy versenyző, egy bajusz, és rengeteg kérdés. [excited] Kezdjük!',
    ],
    lastRound: [
      '[dramatically] Utolsó kör, és most minden pont duplán számít!',
      '[suspenseful] Elérkeztünk az utolsó kérdéshez! Dupla pont a tét.',
      '[excited] Az utolsó kör dupla pontot ér. [dramatically] Most dől el minden!',
      '[dramatically] Hölgyeim és uraim, utolsó kör, dupla pontért!',
      '[suspenseful] Még egy kérdés, dupla pontért. [whispers] A bajszom izzad.',
    ],
    powerGranted: [
      '[mischievously] Mindenki kapott egy csapdát! [whispers] Szavazás után bevethetitek.',
      '[excited] Szabotázs jön! A telefonokon vár a jég és a trutyi.',
      '[mischievously] Kiosztottam a csapdákat. [chuckles] Ki kap jeget, ki trutyit?',
      '[playfully] Csapda a telefonokon! [mischievously] Bölcsen használjátok. Vagy gonoszul.',
      '[whispers] Psszt! Mindenkinek jár egy csapda. [excited] Szavazás után élesíthető!',
      '[dramatically] Élesedik a játék! Jég és trutyi vár bevetésre.',
    ],
    powerFreeze: [
      '[gasps] Valakit jégbe zártak! [chuckles] Van nála jégcsákány?',
      '[playfully] Brrr! Itt valakinek hideg lesz.',
      '[mischievously] Egy kis jég! [chuckles] Kopogj csak, majd kiolvadsz.',
      '[dramatically] Lefagyott egy versenyző! És nem a telefonja.',
      '[chuckles] Jégkorszak a stúdióban! Aki fázik, kopogjon.',
      '[whispers] Hallják a ropogást? [playfully] Jégtörés jön.',
    ],
    powerSlime: [
      '[disgusted] Fúj, trutyi! [chuckles] Ezt bizony le kell törölni.',
      '[laughs] Telibe talált a trutyibomba!',
      '[playfully] Ragacsos lesz a képernyő. [whispers] Nem én takarítok.',
      '[mischievously] Trutyi repült! [chuckles] A bajszomat elkerülte.',
      '[disgusted] Micsoda ragacs! Gyorsan törölgess!',
      '[chuckles] Zöld eső a stúdióban! Kell egy zsebkendő?',
    ],
    powerMany: [
      '[excited] Repül a jég, fröccsen a trutyi!',
      '[laughs] Micsoda csatatér! Pedig ez kvízműsor.',
      '[dramatically] Csapdák mindenhol! [chuckles] Senki sincs biztonságban.',
      '[playfully] Nahát, itt mindenki bosszút forral! [mischievously] Imádom.',
      '[excited] Csata a stúdióban! Ki ússza meg ép bőrrel?',
    ],
    powerGangUp: [
      '[gasps] Összefogtak ellene! [sympathetically] Kitartás!',
      '[dramatically] Egy célpont, több csapda! Összeesküvés!',
      '[laughs] Aki jól játszik, arra céloznak. [mischievously] Így megy ez.',
      '[sympathetically] Mindenki őt vette célba. [whispers] Drukkolok neki.',
      '[chuckles] Közös ellenség a stúdióban! Ez fájni fog.',
    ],
    allCorrect: [
      '[amazed] Mindenki eltalálta! [mischievously] Túl könnyű volt?',
      '[excited] Hibátlan kör! Bravó!',
      '[suspicious] Mindenki tudta! Valaki súgott?',
      '[playfully] Csupa helyes válasz! Jöhet a nehezebb.',
      '[cheerfully] Egytől egyig telitalálat!',
      '[warmly] Ilyen okos közönségem még nem volt!',
      '[cheerfully] Tökéletes összhang, mint egy kórus!',
      '[mischievously] Ez túl könnyű volt. A következő nem lesz!',
    ],
    noneCorrect: [
      '[surprised] Senki? Tényleg? [chuckles] Még egy szerencsés tipp sem?',
      '[sighs] Nulla találat. [playfully] A bajszom csalódott.',
      '[chuckles] Senki sem tudta. [whispers] Én sem tudtam volna.',
      '[sighs] Ez senkinek sem jött be. [playfully] Felejtsük el!',
      '[dramatically] Egyetlen helyes válasz sem? A kérdés győzött.',
      '[sighs] A kérdés mindenkit legyőzött. [whispers] Néma csend.',
      '[surprised] Senki? [playfully] Visszaküldöm a szerkesztőknek.',
      '[dramatically] Sötétség! [chuckles] Ki kapcsolja fel a villanyt?',
    ],
    noneCorrectAgain: [
      '[sighs] Már megint senki? [worried] Kezdek aggódni…',
      '[amazed] Megint senki? Ilyet még nem láttam!',
      '[sighs] Újabb teljes sötétség. [playfully] Hozzak zseblámpát?',
      '[sighs] Már megint? A bajszom lassan lekonyul.',
      '[whispers] A kérdések összebeszéltek ellenetek.',
    ],
    onlyOne: [
      '[amazed] Egyetlen okos fej! [playfully] A többiek tanuljanak.',
      '[excited] Csak egyvalaki tudta! Tapsot neki!',
      '[proudly] Egy helyes válasz, egy hős!',
      '[suspicious] Egyedül tudta a választ! Ez már-már gyanús.',
      '[whispers] Egy találat! Valaki titokban lexikont olvas.',
    ],
    streak: [
      '[impressed] Valaki itt nagyon formában van!',
      '[excited] Sorozatban talál, ez már nem véletlen!',
      '[amazed] Megállíthatatlan! [playfully] Valaki fogja már le!',
      '[chuckles] Már megint ő! Kezdek féltékeny lenni.',
      '[dramatically] Ez a sorozat már műsortörténelem!',
      '[playfully] Valaki ma reggel lexikont reggelizett!',
    ],
    lightning: [
      '[amazed] Villámgyors! Gondolkodás nélkül rávágta.',
      '[amazed] Ez gyorsabb volt, mint a saját árnyéka!',
      '[amazed] Egy szempillantás alatt megvolt!',
      '[impressed] Ilyen gyors ujjakat még nem láttam!',
      '[playfully] Hé, lassabban! A kamera sem tudta követni!',
      '[suspicious] Villámválasz! Előre tudta a kérdést?',
    ],
    soloCorrect: [
      '[warmly] Szép munka, pontosan így kell!',
      '[excited] Telitalálat!',
      '[cheerfully] Helyes! A bajszom elégedetten rezeg.',
      '[excited] Így kell ezt! A közönség tombol.',
      '[proudly] Pontosan! Ezt még a szerkesztők is irigylik.',
      '[playfully] Talált, süllyedt!',
      '[impressed] Bravó! Ezt nem lehetett jobban.',
      '[chuckles] Helyes válasz! Kezdek komolyan tartani tőled.',
    ],
    soloWrong: [
      '[sympathetic] Ez most nem jött össze. [cheerfully] Jöhet a következő!',
      '[chuckles] Hoppá! [warmly] Semmi baj, van még kérdés.',
      '[playfully] Majdnem! [chuckles] Na jó, nem majdnem.',
      '[sighs] Ez most mellément. [warmly] A bajszom megbocsát.',
      '[mischievously] Rossz válasz, de legalább határozott!',
      '[whispers] Rossz válasz! De ezt senki sem látta.',
      '[playfully] Tévedni emberi dolog. [mischievously] Kétszer is?',
      '[cheerfully] Sebaj! A következő kérdés már a tiéd lesz.',
    ],
    newLeader: [
      '[excited] Új vezetőnk van!',
      '[dramatically] Fordulat! Megvan az új listavezető!',
      '[dramatically] Trónfosztás! Új név áll a lista élén.',
      '[excited] Változás az élen! [playfully] A régi király megbukott.',
      '[amazed] Csere a csúcson! Ez aztán a műsor!',
      '[proudly] Új éllovas! A korona gazdát cserélt.',
    ],
    comeback: [
      '[amazed] Nézzék csak, ki jön fel hátulról!',
      '[excited] Hatalmas előrelépés!',
      '[amazed] Micsoda feltámadás!',
      '[excited] Ez igen, rakétaként tört előre!',
      '[dramatically] Hátulról támad a sötét ló!',
    ],
    blowout: [
      '[playfully] Valaki nagyon elhúzott!',
      '[mischievously] Kényelmes előny az élen. Egyelőre.',
      '[chuckles] Az éllovas már a távolból integet.',
      '[dramatically] Nagy az előny, de a műsornak még nincs vége!',
      '[playfully] Valaki már a győzelmi beszédét írja.',
    ],
    closeRace: [
      '[suspenseful] Fej fej mellett az élen!',
      '[excited] Szoros a verseny, bármi megtörténhet!',
      '[playfully] Hajszálnyi különbség, mint a bajszom szálai!',
      '[amazed] Egy papírlap sem férne közéjük!',
      '[suspenseful] Idegtépő izgalom az élen!',
      '[whispers] Ez a verseny most egy hajszálon függ.',
    ],
    winner: [
      '[suspenseful] És a bajnok nem más, mint…',
      '[excited] Íme, a műsor győztese! [laughs] Meghajlás!',
      '[dramatically] Hölgyeim és uraim, a ma esti bajnok!',
      '[excited] Győztesünk van! [playfully] Meséld el holnap mindenkinek!',
      '[proudly] A korona gazdára talált! Gratulálok a bajnoknak!',
    ],
    tie: [
      '[surprised] Holtverseny az élen! [cheerfully] Osztozzatok a dicsőségen!',
      '[laughs] Döntetlen! Több bajnokunk is van!',
      '[amazed] Holtverseny! Ilyet a bajszom is ritkán lát.',
      '[playfully] Egyforma pontszám az élen! Több trón kell.',
    ],
    soloFinalHigh: [
      '[proudly] Ez bajnoki teljesítmény volt!',
      '[amazed] Lenyűgöző eredmény. Le a kalappal!',
      '[excited] Kiváló játék! Ezt keretezd be.',
      '[laughs] Micsoda műsor volt! A bajszom tapsol.',
    ],
    soloFinalLow: [
      '[warmly] Legközelebb még jobb lesz!',
      '[warmly] Vége a műsornak. Gyakorlat teszi a mestert!',
      '[sympathetic] Nem ez volt a csúcs, [warmly] de hiszek benned.',
      '[playfully] A lényeg a részvétel. [chuckles] Meg a pontok.',
    ],
    paused: [
      '[playfully] Rövid reklámszünet következik…',
      '[calmly] Egy pillanat, technikai szünet. [playfully] Addig megigazítom a bajszomat.',
      '[dramatically] Megszakadt az adás! [whispers] Ne kapcsoljanak el!',
    ],
    // Milliomos-létra. The ladder is never named: pack names stay on screen.
    ladderWelcome: [
      '[dramatically] Üdv a létra alján! Minden lépcső egy kérdés.',
      '[excited] Indul a létra! Minél feljebb, annál szédítőbb.',
      '[mischievously] Ma létrát mászunk. [whispers] Csak ne nézzenek le.',
      '[warmly] Jó estét! Ma lépcsőről lépcsőre a csúcsra törünk.',
      '[suspenseful] Egy rossz válasz, és vége a mászásnak.',
    ],
    ladderFirst: [
      '[cheerfully] Az első lépcső. Ez még bemelegítés.',
      '[warmly] Kezdjük lent, szépen óvatosan.',
      '[excited] Lábat a létrára! Indulunk!',
    ],
    ladderSafeAhead: [
      '[excited] Biztos pont következik!',
      '[suspenseful] A következő lépcső biztos pont.',
      '[playfully] Egy kérdésnyire a biztonsági hálótól!',
    ],
    ladderLastRung: [
      '[dramatically] Az utolsó lépcső! Innen a csúcs jön.',
      '[suspenseful] Egy kérdés választ el a csúcstól.',
      '[excited] Az utolsó kérdés! Ki ér fel a csúcsra?',
    ],
    ladderSafe: [
      '[excited] Biztos pont! Ezt már senki sem veheti el.',
      '[proudly] Megvan a biztos pont! Szép munka.',
      '[cheerfully] Kifeszítettük a biztonsági hálót!',
    ],
    ladderFell: [
      '[sympathetic] Valaki megcsúszott a létrán.',
      '[dramatically] Zuhanás! A létra nem kegyelmez.',
      '[surprised] Hoppá! Valaki lecsúszott.',
      '[sympathetic] Ez most nem jött össze.',
      '[dramatically] Megingott a létra! Nem mindenki bírta.',
    ],
    ladderAllFell: [
      '[sighs] Mindenki lecsúszott. Kiürült a létra.',
      '[surprised] Senki sem maradt a létrán!',
      '[dramatically] Teljes zuhanás! A létra ma győzött.',
    ],
    ladderTop: [
      '[excited] Fent van a csúcson! Micsoda mászás!',
      '[amazed] A létra teteje! Ez maga a legenda!',
      '[dramatically] A csúcsra ért! Tapsot kérek!',
    ],
    // Blöffölő
    bluffWelcome: [
      '[mischievously] Ma este hazudni fogunk. Minél hihetőbben, annál jobb!',
      '[whispers] Jó estét, kedves hazudozók! [excited] Kezdődik a blöff!',
      '[playfully] Egy igazság, sok kamu. Ki talál rá, és ki ver át kit?',
      '[excited] Üdv a Blöffölőben! Ma a hihető hazugság aranyat ér.',
    ],
    bluffNobodyFooled: [
      '[surprised] Senki sem dőlt be semminek! Kemény közönség.',
      '[sighs] Ezeket a kamukat messziről kiszúrták.',
      '[playfully] Átlátszó hazugságok. Próbálják meg jobban!',
      '[amused] Ennyi blöff, és egy áldozat sincs!',
    ],
    bluffAllFooled: [
      '[gasps] Az igazságot senki sem találta meg!',
      '[dramatically] Mindenki bedőlt valaminek. Micsoda kör!',
      '[laughs] Az igazság ott volt, és senki sem hitte el.',
      '[amused] Ma a hazugság győzött. Szép munka, csalók!',
    ],
    bluffBigLie: [
      '[laughs] Ezt a kamut többen is elhitték!',
      '[impressed] Mesteri hazugság! Többen is bedőltek neki.',
      '[mischievously] Ügyes! Erre a blöffre sokan ráharaptak.',
      '[amazed] Micsoda szemfényvesztés! Többen is bevették.',
    ],
    bluffAllTruth: [
      '[impressed] Mindenki kiszúrta az igazságot! Éles szemek.',
      '[surprised] Itt senkit sem lehetett átverni.',
      '[warmly] Mindenki megtalálta! Bravó, detektívek!',
      '[sighs] Az igazság győzött. A hazugok most sírnak.',
    ],
    // Időrend
    timelineWelcome: [
      '[excited] Üdv az Időrendben! Ma mindent a helyére teszünk.',
      '[warmly] Jó estét! Ma az időgépé a főszerep. Mi volt előbb?',
      '[playfully] Ma kiderül, kinek jár pontosan a fejében a naptár!',
      '[dramatically] Múlt, jelen, sorrend! Kezdődik az Időrend.',
    ],
    timelinePerfect: [
      '[impressed] Tökéletes sorrend! Ez egy élő naptár.',
      '[excited] Hibátlan! Mintha ott lett volna mindennél.',
      '[amazed] Minden a helyén! Micsoda időérzék!',
      '[proudly] Tiszta sor! Szebben én sem raktam volna.',
    ],
    timelineChaos: [
      '[laughs] Ebben a sorrendben nagy kavarodás van.',
      '[sighs] Az idő ma nem a barátunk.',
      '[playfully] Összekeveredtek az évszázadok, látom.',
      '[amused] Ez inkább időzavar, mint időrend.',
    ],
    timelineAllPerfect: [
      '[amazed] Mindenki hibátlan! Ez egy történészklub?',
      '[excited] Mind tökéletes sorrendet raktak ki!',
      '[impressed] Senki sem hibázott. Le a kalappal!',
      '[warmly] Mind a helyén, mindenkinél. Csodás!',
    ],
    // Tippelj!
    guessWelcome: [
      '[excited] Kezdődik a Tippelj! Ma a számoké a főszerep.',
      '[playfully] Nem kell tudni, elég jól tippelni. Kezdjük!',
      '[warmly] Jó estét! Ma az nyer, aki a legközelebb jár.',
      '[mischievously] Ma tippelünk, és fogadunk is. Zsetonokat elő!',
    ],
    guessExact: [
      '[amazed] Telitalálat! Pontosan ennyi!',
      '[gasps] Hajszálpontos tipp! Ez már varázslat.',
      '[excited] Pontosan eltalálta! Tapsot kérek!',
      '[impressed] Pontosan annyi! Ez már nem tipp, ez tudás.',
    ],
    guessWayOff: [
      '[laughs] Hát, ezek a tippek messze jártak.',
      '[sighs] A valóság egészen máshol volt.',
      '[amused] Bátor tippek. Nagyon bátrak.',
      '[playfully] Szép tippek, csak épp másik kérdésre.',
    ],
    guessBetsWin: [
      '[mischievously] Aki jól fogad, annak nem kell jól tippelnie!',
      '[impressed] Ügyes fogadás! A zsetonok jó helyre mentek.',
      '[playfully] Nem tudta, de tudta, kire kell tenni!',
      '[excited] Nyerő zsetonok! Remek szimat.',
    ],
  } satisfies Record<OttoLineKey, string[]>,
};

export type ErrorText = keyof typeof t.errors;

/** A player's score as the mode counts it: points, or the ladder rung they hold. */
export function scoreText(mode: GameMode, score: number): string {
  return mode === 'ladder' ? t.rung(score) : t.points(score);
}

/** Round counter: "3. kör / 10", or on the ladder "3. lépcső / 15". */
export function roundText(mode: GameMode, round: number, total: number): string {
  return mode === 'ladder' ? t.rungOf(round, total) : t.round(round, total);
}

/**
 * Longest a line may be, in characters shown (cues excluded; about 13 are
 * spoken per second). Otto keeps it snappy: greetings and the power-play
 * explanation get a little more room, reactions the least.
 */
export function ottoMaxChars(key: OttoLineKey): number {
  if (
    key === 'welcome' ||
    key === 'welcomeSolo' ||
    key === 'powerGranted' ||
    key === 'ladderWelcome' ||
    key === 'bluffWelcome' ||
    key === 'timelineWelcome' ||
    key === 'guessWelcome'
  ) {
    return 60;
  }
  if (key === 'lastRound' || key === 'winner' || key === 'tie' || key === 'soloFinalHigh' || key === 'soloFinalLow') return 50;
  return 45;
}

/** Number of text variants Otto has for a line. */
export function ottoVariants(key: OttoLineKey): number {
  return t.otto[key].length;
}

/** A line without its bracketed performance cues: what screens show. */
export function stripCues(text: string): string {
  return text.replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** The words of one of Otto's lines, as shown on screen. */
export function ottoText(line: Pick<OttoLine, 'key' | 'variant'>): string {
  const variants = t.otto[line.key];
  return stripCues(variants[line.variant % variants.length] ?? '');
}

/** File name (without extension) of a line's pre-recorded voice clip. */
export function ottoVoiceId(line: Pick<OttoLine, 'key' | 'variant'>): string {
  return `${line.key}-${line.variant % t.otto[line.key].length}`;
}

/** Every line Otto can say, with its cues, for voice generation. */
export function allOttoLines(): { id: string; text: string }[] {
  return (Object.keys(t.otto) as OttoLineKey[]).flatMap((key) =>
    t.otto[key].map((text, variant) => ({ id: ottoVoiceId({ key, variant }), text })),
  );
}
