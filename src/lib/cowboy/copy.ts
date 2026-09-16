export type Lang = "de" | "en";

export type Copy = {
  brand: { kicker: string; title: string };
  hud: { balance: string; bet: string };
  controls: { bet: string };
  buttons: {
    info: string;
    sound: string;
    maxBet: string;
    autoplay: string;
    turbo: string;
    buy: string;
    spin: string;
    paytable: string;
    close: string;
    play: string;
    gamble: string;
    collect: string;
    stop: string;
  };
  status: {
    ready: string;
    spinning: string;
    cascade: string;
    revolver: string;
    bonus: string;
    gamble: string;
    autoplay: string;
    noBalance: string;
    win: string;
    bigWin: string;
    megaWin: string;
    hugeWin: string;
    epicWin: string;
    maxWin: string;
  };
  reels: { cluster: string; rule: string };
  collector: { label: string; bullets: string };
  revolver: { shots: string };
  character: { eyebrow: string; name: string; idle: string; spin: string; win: string; big: string; shoot: string };
  footer: { rtp: string };
  modal: {
    paytableTitle: string;
    paytableIntro: string;
    symbols: string;
    features: string;
    featureText: string;
    bonuses: string;
    bonusText: string;
    gamble: string;
    gambleText: string;
    disclosure: string;
    autoplayTitle: string;
    autoplayIntro: string;
    buyTitle: string;
    buyIntro: string;
    gambleTitle: string;
    gambleIntro: string;
    upgrade: string;
    instant: string;
    playPrompt: string;
    roundComplete: string;
    cashAward: string;
  };
  bonus: {
    saloon: string;
    trail: string;
    pistols: string;
    saloonShort: string;
    trailShort: string;
    pistolsShort: string;
    start: string;
    retriggers: string;
    collectorFire: string;
    collectorReady: string;
    silverOnly: string;
  };
  buy: { hunt: string; huntDesc: string; wild: string; wildDesc: string; saloon: string; saloonDesc: string; trail: string; trailDesc: string; price: string };
  autoplay: { spins: string; running: string; done: string };
  pay: {
    royal: string;
    hat: string;
    cactus: string;
    pistols: string;
    skull: string;
    badge: string;
    wild: string;
    scatter: string;
    bronze: string;
    bronze1: string;
    silver: string;
    silver1: string;
    gold: string;
    gold1: string;
    diamond: string;
    diamond1: string;
    clover: string;
    clover1: string;
    goldclover: string;
    goldclover1: string;
    bag: string;
    bag1: string;
    reload: string;
    reload1: string;
    tierLow: string;
    tierMid: string;
    tierHigh: string;
  };
};

const de: Copy = {
  brand: { kicker: "SMOKEY'S", title: "EL COWBOY" },
  hud: { balance: "GUTHABEN", bet: "EINSATZ" },
  controls: { bet: "DEIN EINSATZ" },
  buttons: {
    info: "So spielst du",
    sound: "Ton an/aus",
    maxBet: "MAX EINSATZ",
    autoplay: "AUTOPLAY",
    turbo: "TURBO",
    buy: "BONUS KAUF",
    spin: "SPIN",
    paytable: "AUSZAHLUNG & REGELN",
    close: "Schliessen",
    play: "BONUS SPIELEN",
    gamble: "GAMBLE",
    collect: "GEWINN KASSIEREN",
    stop: "STOP AUTOPLAY",
  },
  status: {
    ready: "Bereit, Cowboy?",
    spinning: "Die Walzen drehen …",
    cascade: "Der Staub legt sich …",
    revolver: "Smokey nimmt Ziel …",
    bonus: "Bonusrunde läuft!",
    gamble: "Wähle dein Gamble …",
    autoplay: "Autoplay läuft",
    noBalance: "Nicht genug Guthaben für diesen Einsatz.",
    win: "Gewinn {amount}!",
    bigWin: "BIG WIN!",
    megaWin: "MEGA WIN!",
    hugeWin: "HUGE WIN!",
    epicWin: "EPIC WIN!",
    maxWin: "MAX WIN!",
  },
  reels: { cluster: "6×5 CLUSTER WALZEN", rule: "5 VERBUNDENE GEWINNEN" },
  collector: { label: "KUGEL-SAMMLER", bullets: "{count} Kugeln bereit" },
  revolver: { shots: "SCHÜSSE" },
  character: {
    eyebrow: "DER BANDIT",
    name: "SMOKEY",
    idle: "Halt die Augen offen.",
    spin: "Auf geht's!",
    win: "Das wird passen, Partner!",
    big: "Das ist ein gesuchter Gewinn!",
    shoot: "Ziehen!",
  },
  footer: { rtp: "96.28 % RTP · MAX WIN 25 000×" },
  modal: {
    paytableTitle: "AUSZAHLUNG & REGELN",
    paytableIntro: "Verbinde fünf oder mehr gleiche Symbole waagrecht oder senkrecht. Wanted-Wilds ersetzen reguläre Symbole.",
    symbols: "SYMBOLWERTE",
    features: "FEATURES",
    featureText: "Gewinnende Wanted-Wilds werden Revolver-Zylinder mit 2–6 Schüssen. Schüsse enthüllen Münzen, Diamanten, Kleeblätter, Beutel und Reloads. Münzen können beim erneuten Treffen aufgewertet werden.",
    bonuses: "BONUS-STUFEN",
    bonusText: "3 Scatter: High Noon Saloon · 4 Scatter: Trail of Trickery · 5 Scatter: Pistols at Dawn. Jede startet mit 10 Freispielen.",
    gamble: "GAMBLE-LEITER",
    gambleText: "Nach einem Bonus-Trigger kannst du gamble: Upgrade auf die nächste Stufe oder sofortiger Bargeld-Gewinn.",
    disclosure: "Prototyp-Mathematik mit gewichteten Walzen und 25 000× Gewinn-Cap. Werte nur zur Unterhaltung.",
    autoplayTitle: "AUTOPLAY",
    autoplayIntro: "Wähle, wie viele Spins automatisch laufen sollen.",
    buyTitle: "BONUS KAUF",
    buyIntro: "Wähle einen Feature-Einstieg. Verfügbarkeit kann je nach Land variieren.",
    gambleTitle: "BONUS GAMBLE",
    gambleIntro: "Die Trommel ist geladen. Wähle deinen Zug.",
    upgrade: "UPGRADE AUF {bonus}",
    instant: "SOFORTIGER GEWINN",
    playPrompt: "Dein Bonus ist bereit. Spiele ihn oder riskiere das Upgrade.",
    roundComplete: "Runde abgeschlossen",
    cashAward: "Bargeld-Gewinn verliehen",
  },
  bonus: {
    saloon: "HIGH NOON SALOON",
    trail: "TRAIL OF TRICKERY",
    pistols: "PISTOLS AT DAWN",
    saloonShort: "SALOON",
    trailShort: "TRAIL",
    pistolsShort: "PISTOLS",
    start: "{name} beginnt – 10 Freispiele!",
    retriggers: "+{count} Freispiele!",
    collectorFire: "Der Sammler feuert {count} Kugeln!",
    collectorReady: "Sammler geladen mit {count} Kugeln.",
    silverOnly: "Silber ist in diesem Bonus die kleinste Münze.",
  },
  buy: {
    hunt: "BONUSHUNT FEATURESPINS",
    huntDesc: "Bonus 5× wahrscheinlicher",
    wild: "WILD WEST FEATURESPINS",
    wildDesc: "Garantiert mindestens 2 Wanted-Wilds",
    saloon: "HIGH NOON SALOON",
    saloonDesc: "Direkter Einstieg in den ersten Bonus",
    trail: "TRAIL OF TRICKERY",
    trailDesc: "Direkter Einstieg in den Kugel-Sammler-Bonus",
    price: "{amount}× Einsatz",
  },
  autoplay: { spins: "{count} Spins", running: "Autoplay: {remaining} übrig", done: "Autoplay fertig" },
  pay: {
    royal: "10 / J / Q / K / A",
    hat: "Cowboy-Hut",
    cactus: "Kaktus",
    pistols: "Gekreuzte Revolver",
    skull: "Totenkopf",
    badge: "Sheriff-Stern",
    wild: "Wanted Wild",
    scatter: "Freispiele",
    bronze: "Bronze-Münze (1–4×)",
    bronze1: "BRONZE",
    silver: "Silber-Münze (5–20×)",
    silver1: "SILBER",
    gold: "Gold-Münze (25–100×)",
    gold1: "GOLD",
    diamond: "Diamant (150–500×)",
    diamond1: "DIAMANT",
    clover: "Grünes Kleeblatt (2–20×)",
    clover1: "KLEEBLATT",
    goldclover: "Goldenes Kleeblatt (2–20×)",
    goldclover1: "GOLD-KLEE",
    bag: "Schatzbeutel",
    bag1: "BEUTEL",
    reload: "Reload",
    reload1: "RELOAD",
    tierLow: "TIEF",
    tierMid: "MITTEL",
    tierHigh: "HOCH",
  },
};

const en: Copy = {
  brand: { kicker: "SMOKEY'S", title: "EL COWBOY" },
  hud: { balance: "BALANCE", bet: "BET" },
  controls: { bet: "YOUR BET" },
  buttons: {
    info: "How to play",
    sound: "Toggle sound",
    maxBet: "MAX BET",
    autoplay: "AUTOPLAY",
    turbo: "TURBO",
    buy: "BUY BONUS",
    spin: "SPIN",
    paytable: "PAYTABLE & RULES",
    close: "Close",
    play: "PLAY BONUS",
    gamble: "GAMBLE",
    collect: "COLLECT WIN",
    stop: "STOP AUTOPLAY",
  },
  status: {
    ready: "Ready when you are, cowboy.",
    spinning: "Riding the reels…",
    cascade: "The dust is settling…",
    revolver: "Smokey is taking aim…",
    bonus: "Bonus round in progress!",
    gamble: "Pick your gamble…",
    autoplay: "Autoplay is running",
    noBalance: "Not enough balance for that bet.",
    win: "You won {amount}!",
    bigWin: "BIG WIN!",
    megaWin: "MEGA WIN!",
    hugeWin: "HUGE WIN!",
    epicWin: "EPIC WIN!",
    maxWin: "MAX WIN!",
  },
  reels: { cluster: "6×5 CLUSTER REELS", rule: "5 CONNECTED TO WIN" },
  collector: { label: "BULLET COLLECTOR", bullets: "{count} bullets ready" },
  revolver: { shots: "SHOTS" },
  character: {
    eyebrow: "THE BANDIT",
    name: "SMOKEY",
    idle: "Keep your eyes peeled.",
    spin: "Let 'er rip!",
    win: "That'll do, partner!",
    big: "Now that's a wanted win!",
    shoot: "Draw!",
  },
  footer: { rtp: "96.28% RTP · MAX WIN 25,000×" },
  modal: {
    paytableTitle: "PAYTABLE & RULES",
    paytableIntro: "Connect five or more matching symbols side-to-side or up-and-down. Wild posters substitute for regular symbols.",
    symbols: "SYMBOL VALUES",
    features: "FEATURES",
    featureText: "Winning Wild Posters become Revolver Cylinders with 2–6 shots. Shots reveal coins, diamonds, clovers, bags, and reloads. Coins can upgrade when hit again.",
    bonuses: "BONUS TIERS",
    bonusText: "3 scatters: High Noon Saloon · 4 scatters: Trail of Trickery · 5 scatters: Pistols at Dawn. Each starts with 10 free spins.",
    gamble: "GAMBLE LADDER",
    gambleText: "After a bonus trigger, gamble for a chance to upgrade to the next tier or collect an instant cash prize.",
    disclosure: "Prototype math uses weighted reels and a 25,000× win cap. Values are for entertainment only.",
    autoplayTitle: "AUTOPLAY",
    autoplayIntro: "Choose how many spins to play automatically.",
    buyTitle: "BONUS BUY",
    buyIntro: "Choose a feature entry. Bonus buy availability may vary by jurisdiction.",
    gambleTitle: "BONUS GAMBLE",
    gambleIntro: "The chamber is loaded. Choose your next move.",
    upgrade: "UPGRADE TO {bonus}",
    instant: "INSTANT PRIZE",
    playPrompt: "Your bonus is ready. Play it or risk it for an upgrade.",
    roundComplete: "Round complete",
    cashAward: "Cash prize awarded",
  },
  bonus: {
    saloon: "HIGH NOON SALOON",
    trail: "TRAIL OF TRICKERY",
    pistols: "PISTOLS AT DAWN",
    saloonShort: "SALOON",
    trailShort: "TRAIL",
    pistolsShort: "PISTOLS",
    start: "{name} begins – 10 free spins!",
    retriggers: "+{count} free spins!",
    collectorFire: "The collector fires {count} bullets!",
    collectorReady: "Collector primed with {count} bullets.",
    silverOnly: "Silver is the lowest coin in this bonus.",
  },
  buy: {
    hunt: "BONUSHUNT FEATURESPINS",
    huntDesc: "5× more likely to trigger a bonus",
    wild: "WILD WEST FEATURESPINS",
    wildDesc: "Guarantees at least 2 Wild Posters",
    saloon: "HIGH NOON SALOON",
    saloonDesc: "Direct entry to the first bonus",
    trail: "TRAIL OF TRICKERY",
    trailDesc: "Direct entry to the bullet collector bonus",
    price: "{amount}× bet",
  },
  autoplay: { spins: "{count} spins", running: "Autoplay: {remaining} left", done: "Autoplay finished" },
  pay: {
    royal: "10 / J / Q / K / A",
    hat: "Cowboy Hat",
    cactus: "Cactus",
    pistols: "Crossed Pistols",
    skull: "Skull",
    badge: "Sheriff Badge",
    wild: "Wanted Wild",
    scatter: "Free Spins",
    bronze: "Bronze Coin (1–4×)",
    bronze1: "BRONZE",
    silver: "Silver Coin (5–20×)",
    silver1: "SILVER",
    gold: "Gold Coin (25–100×)",
    gold1: "GOLD",
    diamond: "Diamond (150–500×)",
    diamond1: "GEM",
    clover: "Green Clover (2–20×)",
    clover1: "4LEAF",
    goldclover: "Gold Clover (2–20×)",
    goldclover1: "GOLD",
    bag: "Loot Bag",
    bag1: "BAG",
    reload: "Reload",
    reload1: "RLD",
    tierLow: "LOW",
    tierMid: "MID",
    tierHigh: "HIGH",
  },
};

export function getCopy(lang: Lang): Copy {
  return lang === "de" ? de : en;
}

export function fill(template: string, values: Record<string, string | number> = {}): string {
  return String(template).replace(/\{(\w+)\}/g, (_, name: string) => (name in values ? String(values[name]) : `{${name}}`));
}