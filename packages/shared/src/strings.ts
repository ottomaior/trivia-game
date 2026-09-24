import type { OttoLine, OttoLineKey } from './views.ts';

// All player-facing text. The game is Hungarian only.

const fmt = (n: number) => n.toLocaleString('hu');

export const t = {
  tagline: 'Az évszázad kvízműsora',
  voiceCredit: (by: string) => `Otto hangja: ${by}`,
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
  /**
   * Otto's lines. Bracketed cues ("[excited]") tell the voice how to perform
   * a line; screens show the text without them (ottoText). No names or
   * numbers: every line is pre-recorded, and `focus` says whom it's about.
   */
  otto: {
    welcome: [
      '[warmly] Jó estét, és üdv a műsorban! [excited] Lássuk, ki a legokosabb a teremben!',
      '[excited] Fény, kamera, bajusz! Kezdődik az évszázad kvízműsora!',
      '[warmly] Üdvözlöm a kedves versenyzőket, és a kanapén ülő nagyérdeműt!',
      '[proudly] Jó estét! Frissen fésült bajusszal várom a mai versenyzőket.',
      '[mischievously] Kapcsolják be a telefonjukat, és kapcsolják ki a szerénységüket. [excited] Kezdünk!',
      '[excited] Megérkeztek a mai hőseink! [whispers] Tapsot kérek, és egy kis csendet a gondolkodáshoz.',
    ],
    welcomeSolo: [
      '[warmly] Jó estét! [playfully] Ma egyetlen, ám annál bátrabb versenyzőnk van.',
      '[chuckles] Egyszemélyes műsor? [proudly] Otto erre is készen áll!',
      '[playfully] Csak ketten vagyunk: te meg én. [short pause] Meg a bajszom. Hárman vagyunk.',
      '[excited] Magányos hős a stúdióban! [mischievously] Legalább a dicsőségen nem kell osztozni.',
      '[warmly] Egy versenyző, egy bajusz, és rengeteg kérdés. [excited] Kezdjük!',
    ],
    firstRound: [
      '[excited] Az első kérdés mindig a legizgalmasabb. [chuckles] Na jó, a második is.',
      '[warmly] Kezdjük könnyedén! Lássuk, milyen témával indítunk.',
      '[playfully] Bemelegítésnek jöjjön egy kategória, ami szívünknek kedves.',
      '[excited] Az első kör! [whispers] A bajszom már remeg az izgalomtól.',
      '[cheerfully] Ugorjunk fejest! Melyik témával kezdünk?',
    ],
    pickCategory: [
      '[curious] Mi legyen a következő?',
      '[cheerfully] Jöhet a következő témakör. Bölcs döntést kérek!',
      '[playfully] Ideje kategóriát választani. [mischievously] Bármit, csak ne a bajuszápolást!',
      '[whispers] Kérem a következő témát! A stúdió visszafojtott lélegzettel vár.',
      '[cheerfully] Na, merre tovább? A szavazófülkék nyitva!',
      '[mischievously] Válasszunk témát! Ügyes taktikázással sokat lehet nyerni.',
      '[excited] Új kör, új esély! Melyik kategória legyen?',
      '[playfully] Döntés előtt állunk. [whispers] Otto nem súg, de figyel.',
      '[curious] Témaválasztás! Itt dől el, ki érzi magát otthon.',
    ],
    halfway: [
      '[dramatically] Félidő! [mischievously] Aki eddig lemaradt, most kezdhet igazán aggódni. Vagy reménykedni.',
      '[excited] Túl vagyunk a műsor felén. A bajszom szerint most jön a java!',
      '[dramatically] Félidőhöz értünk! Innen még bármi megtörténhet.',
      '[cheerfully] A műsor fele mögöttünk. Ideje rákapcsolni!',
    ],
    lastRound: [
      '[dramatically] Utolsó kör, és most minden pont duplán számít!',
      '[suspenseful] Elérkeztünk az utolsó kérdéshez! Dupla pont a tét.',
      '[excited] Az utolsó kör dupla pontot ér. [dramatically] Most dől el minden!',
      '[dramatically] Hölgyeim és uraim, utolsó kör! Dupla pontért megy a játék.',
      '[suspenseful] Még egy kérdés, és dupla pont jár érte. [whispers] A bajszom izzad.',
    ],
    categoryPicked: [
      '[curious] Megvan a kategória! Lássuk, mit tartogat.',
      '[dramatically] Eldőlt! Ez lesz a következő téma.',
      '[mischievously] Remek választás! Vagy szörnyű. Mindjárt kiderül.',
    ],
    catTortenelem: [
      '[playfully] Történelem! Porolja le mindenki a régi tankönyveket.',
      '[chuckles] Történelem! Én még emlékszem, amikor ez volt a hírekben.',
      '[excited] Irány a múlt! Remélem, mindenki bepakolt egy időgépet.',
    ],
    catFoldrajz: [
      '[excited] Földrajz! Kapaszkodjanak, körbeutazzuk a világot.',
      '[playfully] Földrajz! Előkerül a földgömb, amit utoljára az iskolában pörgettetek.',
      '[cheerfully] Földrajz! Ne aggódjanak, útlevél nem kell hozzá.',
    ],
    catTudomany: [
      '[mischievously] Tudomány és természet! Most kiderül, ki figyelt fizikaórán.',
      '[excited] Tudomány! Fel a laborköpennyel, fel a védőszemüveggel!',
      '[proudly] Természettudomány! Még a bajszom is a kémia csodája.',
    ],
    catFilm: [
      '[excited] Film és tévé! Pattogatott kukoricát mindenkinek!',
      '[proudly] Film és tévé! Végre egy téma, amiben én is szerepeltem.',
      '[playfully] Irány a mozi! [whispers] Csak most az egyszer ne némítsák le a telefonjukat.',
    ],
    catZene: [
      '[cheerfully] Zene! Remélem, mindenki hozta a hallását.',
      '[playfully] Zene! Otto most szívesen dalra fakadna, [sighs] de a producer nem engedi.',
      '[mischievously] Zenei kör! Dúdolni szabad, súgni tilos.',
    ],
    catSport: [
      '[excited] Sport! Bemelegítés nem kell, csak egy gyors hüvelykujj.',
      '[dramatically] Sport! Izzasztó kérdések következnek.',
      '[playfully] Sport! Most az agyunk fut maratont.',
    ],
    catGasztro: [
      '[curious] Étel és ital! Remélem, senki sem érkezett éhesen.',
      '[warmly] Gasztronómia! A bajszom már érzi az illatokat.',
      '[cheerfully] Étel és ital! Jó étvágyat a kérdésekhez!',
    ],
    catMagyarorszag: [
      '[proudly] Magyarország! Hazai pálya, itt nincs kifogás.',
      '[mischievously] Magyarország! Most kiderül, ki ismeri igazán a hazáját.',
      '[playfully] Hazai témák! Ezt illik tudni, kérem szépen.',
    ],
    powerGranted: [
      '[mischievously] Mindenki kapott egy kis meglepetést! [whispers] Szavazás után jeget vagy trutyit küldhettek egymásra.',
      '[excited] Itt az idő egy kis szabotázsra! A telefonokon ott lapul a jégcsapda és a trutyibomba.',
      '[mischievously] Kiosztottam a csapdákat. [chuckles] Vajon ki kapja a jeget, és ki a trutyit?',
      '[playfully] Új játékszer a telefonokon! [mischievously] Használjátok bölcsen. Vagy gonoszul.',
      '[whispers] Psszt! Mindenkinek jár egy csapda. [excited] Szavazás után lehet élesíteni!',
      '[dramatically] Hölgyeim és uraim, élesedik a játék! Jég és trutyi vár bevetésre.',
    ],
    powerFreeze: [
      '[gasps] Valakit jégbe zártak! [chuckles] Remélem, van nála jégcsákány.',
      '[playfully] Brrr! Itt valakinek nagyon hideg lesz a válaszadásnál.',
      '[mischievously] Egy kis jég a lelkesedésre! [chuckles] Kopogtass csak, majd kiolvadsz.',
      '[dramatically] Lefagyott egy versenyző! És most nem a telefonja hibája.',
      '[chuckles] Jégkorszak a stúdióban! Aki fázik, kopogjon.',
      '[whispers] Hallják ezt a ropogást? [playfully] Valaki most jégtörőnek áll.',
    ],
    powerSlime: [
      '[disgusted] Fúj, trutyi! [chuckles] Ezt bizony le kell törölni.',
      '[laughs] Telibe talált a trutyibomba! Jöhet a nagytakarítás.',
      '[playfully] Valakinek ragacsos lesz a képernyője. [whispers] Nem én takarítok.',
      '[mischievously] Trutyi repült! [chuckles] A bajszomat szerencsére elkerülte.',
      '[disgusted] Micsoda ragacs! Gyorsan törölgessen, aki kapta.',
      '[chuckles] Zöld eső a stúdióban! Remélem, a kedves versenyzőnél van zsebkendő.',
    ],
    powerMany: [
      '[excited] Repül a jég, fröccsen a trutyi! Ez aztán a baráti társaság!',
      '[laughs] Micsoda csatatér! Pedig ez egy békés kvízműsor lenne.',
      '[dramatically] Egyszerre több csapda is élesedett! [chuckles] Senki sincs biztonságban.',
      '[playfully] Nahát, itt mindenki bosszút forral! [mischievously] Imádom.',
      '[excited] Csapdák mindenfelé! Vajon ki ússza meg ép bőrrel?',
    ],
    powerGangUp: [
      '[gasps] Összefogtak ellene! [sympathetically] Kitartás, kedves versenyző!',
      '[dramatically] Egy célpont, több csapda! Ezt hívom összeesküvésnek.',
      '[laughs] Úgy látom, valaki túl jól teljesített. [mischievously] A többiek nem felejtenek.',
      '[sympathetically] Mindenki ugyanarra a szegény lélekre célzott. [whispers] Drukkolok neki.',
      '[chuckles] Közös ellenség lett a stúdióban! Ez most fájni fog.',
    ],
    allCorrect: [
      '[amazed] Mindenki eltalálta! [mischievously] Túl könnyű? Majd teszek róla.',
      '[excited] Hibátlan kör! Bravó!',
      '[suspicious] Mindenki tudta! Kezdek gyanakodni, hogy valaki súgott.',
      '[playfully] Mindenki helyesen válaszolt! Ezt a kérdést legközelebb nehezebbre kérem.',
      '[chuckles] Egytől egyig telitalálat! A szerkesztőknek ez nem fog tetszeni.',
      '[warmly] Mindenki eltalálta! Ilyen okos közönségem még nem volt.',
      '[cheerfully] Tökéletes összhang! Mint egy jól begyakorolt kórus.',
      '[mischievously] Ez túl könnyű volt nektek. A következő nem lesz ilyen kedves.',
    ],
    noneCorrect: [
      '[surprised] Senki? Tényleg? [chuckles] Még egy szerencsés tipp sem?',
      '[sighs] Nulla találat. [playfully] A bajszom csalódott.',
      '[chuckles] Senki sem találta el. [whispers] Megnyugtatom önöket: én sem tudtam volna.',
      '[sighs] Hát ez nem jött be senkinek. [playfully] Tegyünk úgy, mintha meg sem történt volna.',
      '[dramatically] Egyetlen helyes válasz sem? A kérdés győzött.',
      '[sighs] Ez a kérdés most mindenkit legyőzött. [whispers] Egy perc néma csend.',
      '[surprised] Senki? [playfully] Na jó, ezt a kérdést visszaküldöm a szerkesztőségnek.',
      '[dramatically] Teljes sötétség. [chuckles] Valaki kapcsolja fel a villanyt!',
    ],
    noneCorrectAgain: [
      '[sighs] Már megint senki? [worried] Kezdek aggódni…',
      '[amazed] Megint senki? Ilyet még nem láttam!',
      '[sighs] Újabb teljes sötétség. [playfully] Hozzak zseblámpát?',
      '[sighs] Már megint? A bajszom lassan lekonyul.',
      '[whispers] Szerintem a kérdések összebeszéltek ellenetek.',
    ],
    onlyOne: [
      '[amazed] Egyetlen okos fej a teremben! [playfully] Mindenki más figyeljen és tanuljon.',
      '[excited] Csak egyvalaki tudta! Tapsot a magányos zseninek!',
      '[proudly] Egy helyes válasz, egy hős. [mischievously] A többiek most szégyenkezhetnek.',
      '[suspicious] Egyedül tudta a választ! Ez már-már gyanús.',
      '[whispers] Egyetlen találat! Valaki itt titokban lexikont olvas esténként.',
    ],
    streak: [
      '[impressed] Valaki itt nagyon formában van!',
      '[excited] Sorozatban talál, ez már nem véletlen!',
      '[amazed] Megállíthatatlan! [playfully] Valaki fogja már le!',
      '[chuckles] Újabb találat ugyanattól a zsenitől. Kezdek féltékeny lenni.',
      '[dramatically] Ez a sorozat már a műsor történelmébe is bekerülhet!',
      '[playfully] Valaki ma reggel lexikont reggelizett!',
    ],
    lightning: [
      '[amazed] Villámgyors! Gondolkodás nélkül rávágta.',
      '[amazed] Ez gyorsabb volt, mint a saját árnyéka!',
      '[surprised] Még be sem fejeztem a kérdést, és már megvolt a válasz!',
      '[impressed] Ilyen gyors ujjakat még nem láttam. [chuckles] Pedig láttam már sok mindent.',
      '[playfully] Hé, lassabban! A kamera sem tudta követni!',
      '[suspicious] Villámválasz! Valaki itt előre tudta a kérdést?',
    ],
    fastest: [
      '[proudly] Íme a leggyorsabb versenyző!',
      '[cheerfully] A fürge ujjak viszik a legtöbb pontot!',
      '[impressed] Gyors és pontos, ahogy azt a nagykönyv megírta.',
      '[warmly] A leggyorsabb helyes válasz ide érkezett. Gratulálok!',
      '[playfully] Aki gyorsan gondolkodik, az többet nyer. Ilyen egyszerű.',
      '[excited] Gyorsaságban ma verhetetlen!',
    ],
    someCorrect: [
      '[playfully] Volt, aki tudta. [chuckles] És volt, aki… nem.',
      '[warmly] Nem rossz, egyáltalán nem rossz.',
      '[chuckles] A csapat egyik fele ünnepel, a másik fele magyarázkodik.',
      '[mischievously] Megoszlottak a vélemények. Az igazság viszont nem.',
      '[playfully] Volt, aki fejből tudta, és volt, aki csak reménykedett.',
      '[cheerfully] Szép volt! [mischievously] Legalábbis néhányatoknak.',
      '[dramatically] A tudás győzött. [short pause] Részben.',
      '[warmly] Akinek nem sikerült, ne csüggedjen. [playfully] A bajszom sem nőtt ki elsőre.',
    ],
    soloCorrect: [
      '[warmly] Szép munka, pontosan így kell!',
      '[excited] Telitalálat!',
      '[cheerfully] Helyes! A bajszom elégedetten rezeg.',
      '[excited] Így kell ezt! A közönség tombol.',
      '[proudly] Pontosan! Erre még a szerkesztők is büszkék lennének.',
      '[playfully] Talált, süllyedt!',
      '[impressed] Bravó! Ezt nem lehetett volna jobban csinálni.',
      '[chuckles] Helyes válasz! Kezdek komolyan tartani tőled.',
    ],
    soloWrong: [
      '[sympathetic] Ez most nem jött össze. [cheerfully] Jöhet a következő!',
      '[chuckles] Hoppá! [warmly] Semmi baj, van még kérdés.',
      '[playfully] Majdnem! [chuckles] Na jó, nem majdnem, de a szándék szép volt.',
      '[sighs] Ez most mellément. [warmly] A bajszom megbocsát.',
      '[mischievously] Nem ez volt a helyes válasz, de legalább határozottan tévedtél.',
      '[whispers] Rossz válasz! De ne aggódj, ezt senki sem látta. [short pause] Csak a kamerák.',
      '[playfully] Tévedni emberi dolog. [mischievously] Kétszer tévedni… majd meglátjuk.',
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
      '[amazed] Micsoda feltámadás! [playfully] Valaki nagyon nem akar lemaradni.',
      '[excited] Ez igen, rakétaként tört előre!',
      '[dramatically] Hátulról támad a sötét ló!',
    ],
    blowout: [
      '[playfully] Valaki nagyon elhúzott, a többieknek igyekezniük kell!',
      '[mischievously] Kényelmes előny az élen. [short pause] Egyelőre.',
      '[chuckles] Az élen álló már a távolból integet a többieknek.',
      '[dramatically] Nagy az előny, de a műsornak még nincs vége!',
      '[playfully] Valaki már a győzelmi beszédét fogalmazza. [whispers] Ne siessük el!',
    ],
    closeRace: [
      '[suspenseful] Fej fej mellett az élen!',
      '[excited] Szoros a verseny, bármi megtörténhet!',
      '[playfully] Hajszálnyi különbség! Mint a bajszom szálai között.',
      '[amazed] Az élen olyan szoros a verseny, hogy egy papírlap sem férne közéjük.',
      '[suspenseful] Fej fej mellett! Idegtépő izgalom a stúdióban.',
      '[whispers] Ez a verseny most egy hajszálon függ.',
    ],
    standings: [
      '[cheerfully] Így áll most a verseny.',
      '[playfully] Még bárki nyerhet!',
      '[mischievously] Íme az állás! Aki elöl van, ne bízza el magát.',
      '[curious] Nézzük a táblát! Vannak meglepetések.',
      '[warmly] Az állás egyelőre ez, de a műsor még tart.',
      '[cheerfully] Frissültek a pontok! Az izgalom a régi.',
      '[playfully] Lássuk, hol tartunk. [whispers] Otto figyel, és jegyzetel.',
      '[warmly] Íme a tabella. A sereghajtó se csüggedjen!',
    ],
    soloScore: [
      '[warmly] Szépen gyűlnek a pontok. Csak így tovább!',
      '[cheerfully] Jó úton jársz!',
      '[cheerfully] A pontszámláló pörög, a bajszom elégedett.',
      '[playfully] Egyedül versenyzel, de a saját csúcsodat még megdöntheted.',
      '[warmly] Így állunk! Van még hová fejlődni. [chuckles] Mindig van.',
      '[proudly] Szép gyűjtemény! A pontjaidból már kiállítást is rendezhetnénk.',
    ],
    winner: [
      '[suspenseful] És a bajnok nem más, mint…',
      '[excited] Íme, a műsor győztese! [laughs] Meghajlás!',
      '[dramatically] Hölgyeim és uraim, a ma esti bajnok!',
      '[excited] Győztesünk van! [playfully] Holnap mindenki ezt mesélje a munkahelyén.',
      '[proudly] A korona gazdára talált! Gratulálok a bajnoknak!',
    ],
    tie: [
      '[surprised] Holtverseny az élen! [cheerfully] Osztozzatok a dicsőségen!',
      '[laughs] Döntetlen! Több bajnokunk is van!',
      '[amazed] Holtverseny! Ilyet a bajszom is ritkán lát.',
      '[playfully] Egyforma pontszám az élen! Ma több trónt kell behoznunk.',
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
      '[sympathetic] Nem ez volt a legfényesebb estéd, [warmly] de a bajszom hisz benned.',
      '[playfully] A lényeg a részvétel. [chuckles] Meg a pontok, de főleg a részvétel.',
    ],
    paused: [
      '[playfully] Rövid reklámszünet következik…',
      '[calmly] Egy pillanat, technikai szünet. [playfully] Addig megigazítom a bajszomat.',
      '[dramatically] Megszakadt az adás! [whispers] Ne kapcsoljanak el!',
    ],
  } satisfies Record<OttoLineKey, string[]>,
};

export type ErrorText = keyof typeof t.errors;

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
