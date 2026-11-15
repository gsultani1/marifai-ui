// packages/ai-ui/src/lib/emoji.ts
export interface Emoji {
  char: string;
  name: string;
  keywords: string;
  /** Accepts a skin-tone modifier. */
  tone: boolean;
}

export interface EmojiCategory {
  id: string;
  name: string;
  /** Emoji shown on the category tab. */
  icon: string;
  emoji: Emoji[];
}

/** Each entry: "char|name|keywords" with an optional "|t" for skin-tone support. */
const DATA: [id: string, name: string, icon: string, entries: string[]][] = [
  [
    "smileys",
    "Smileys",
    "😀",
    [
      "😀|grinning face|smile happy", "😃|grinning face with big eyes|smile happy", "😄|grinning face with smiling eyes|smile happy laugh", "😁|beaming face|grin", "😆|grinning squinting face|laugh", "😅|grinning face with sweat|relief nervous", "🤣|rolling on the floor laughing|lol rofl", "😂|face with tears of joy|lol laugh crying",
      "🙂|slightly smiling face|smile", "🙃|upside-down face|silly sarcasm", "😉|winking face|wink", "😊|smiling face with smiling eyes|blush happy", "😇|smiling face with halo|angel innocent", "🥰|smiling face with hearts|love adore", "😍|smiling face with heart-eyes|love crush", "🤩|star-struck|wow amazing",
      "😘|face blowing a kiss|kiss love", "😋|face savoring food|yum delicious", "😛|face with tongue|playful", "😜|winking face with tongue|joke playful", "🤪|zany face|crazy goofy", "😝|squinting face with tongue|playful", "🤑|money-mouth face|rich money", "🤗|smiling face with open hands|hug thanks",
      "🤭|face with hand over mouth|oops giggle", "🤫|shushing face|quiet secret", "🤔|thinking face|hmm consider", "🤐|zipper-mouth face|secret silent", "🤨|face with raised eyebrow|skeptical doubt", "😐|neutral face|meh", "😑|expressionless face|blank", "😶|face without mouth|silent speechless",
      "😏|smirking face|smug", "😒|unamused face|meh annoyed", "🙄|face with rolling eyes|eyeroll whatever", "😬|grimacing face|awkward eek", "😌|relieved face|calm content", "😔|pensive face|sad", "😪|sleepy face|tired", "🤤|drooling face|want",
      "😴|sleeping face|tired zzz", "😷|face with medical mask|sick ill", "🤒|face with thermometer|sick fever", "🤕|face with head-bandage|hurt injured", "🤢|nauseated face|sick gross", "🤮|face vomiting|sick gross", "🥵|hot face|heat sweating", "🥶|cold face|freezing",
      "🥴|woozy face|dizzy tipsy", "😵|face with crossed-out eyes|dizzy dead", "🤯|exploding head|mind blown shocked", "🤠|cowboy hat face|yeehaw", "🥳|partying face|celebrate birthday party", "😎|smiling face with sunglasses|cool", "🤓|nerd face|geek smart", "🧐|face with monocle|inspect curious",
      "😕|confused face|unsure", "😟|worried face|concerned", "🙁|slightly frowning face|sad", "😮|face with open mouth|wow surprised", "😯|hushed face|surprised", "😲|astonished face|shocked amazed", "😳|flushed face|embarrassed", "🥺|pleading face|please puppy eyes",
      "😦|frowning face with open mouth|shocked", "😧|anguished face|pain", "😨|fearful face|scared", "😰|anxious face with sweat|nervous", "😥|sad but relieved face|phew", "😢|crying face|sad tear", "😭|loudly crying face|sob sad", "😱|face screaming in fear|scared horror",
      "😖|confounded face|frustrated", "😣|persevering face|struggle", "😞|disappointed face|sad", "😓|downcast face with sweat|stress", "😩|weary face|tired frustrated", "😫|tired face|exhausted", "🥱|yawning face|bored tired", "😤|face with steam from nose|triumph frustrated",
      "😡|enraged face|angry mad", "😠|angry face|mad grumpy", "🤬|face with symbols on mouth|swearing cursing", "😈|smiling face with horns|devil mischief", "💀|skull|dead dying laughing", "💩|pile of poo|poop", "🤡|clown face|joke", "👻|ghost|boo halloween",
      "👽|alien|ufo space", "🤖|robot|bot ai machine", "😺|grinning cat|cat happy", "🙈|see-no-evil monkey|embarrassed oops", "🙉|hear-no-evil monkey|monkey", "🙊|speak-no-evil monkey|secret oops",
    ],
  ],
  [
    "people",
    "People",
    "👋",
    [
      "👋|waving hand|hello hi bye wave|t", "🤚|raised back of hand|stop|t", "✋|raised hand|stop high five|t", "🖖|vulcan salute|spock star trek|t", "👌|ok hand|okay perfect|t", "🤌|pinched fingers|italian what|t", "🤏|pinching hand|small tiny|t", "✌️|victory hand|peace|t",
      "🤞|crossed fingers|luck hope|t", "🤟|love-you gesture|ily|t", "🤘|sign of the horns|rock metal|t", "🤙|call me hand|shaka hang loose|t", "👈|backhand index pointing left|left point|t", "👉|backhand index pointing right|right point|t", "👆|backhand index pointing up|up point|t", "👇|backhand index pointing down|down point|t",
      "☝️|index pointing up|one first|t", "👍|thumbs up|like approve yes agree +1|t", "👎|thumbs down|dislike no disagree -1|t", "✊|raised fist|power solidarity|t", "👊|oncoming fist|punch bump|t", "👏|clapping hands|applause bravo congrats|t", "🙌|raising hands|celebrate hooray praise|t", "👐|open hands|hug|t",
      "🤲|palms up together|pray please|t", "🙏|folded hands|please thanks pray|t", "✍️|writing hand|write sign|t", "💪|flexed biceps|strong muscle|t", "🤝|handshake|deal agreement partner", "👀|eyes|look watching see", "🧠|brain|smart think", "🫡|saluting face|respect yes sir",
      "👶|baby|child newborn|t", "🧒|child|kid|t", "🧑|person|adult|t", "👩|woman|female|t", "👨|man|male|t", "🧓|older person|elderly senior|t", "🙋|person raising hand|question volunteer|t", "🤷|person shrugging|dunno whatever idk|t",
      "🙇|person bowing|sorry respect|t", "🤦|person facepalming|ugh disbelief|t", "🙆|person gesturing ok|yes okay|t", "🙅|person gesturing no|no stop|t", "💁|person tipping hand|info sassy|t", "🏃|person running|run exercise hurry|t", "🚶|person walking|walk|t", "🧑‍💻|technologist|developer coder programmer",
    ],
  ],
  [
    "nature",
    "Animals and nature",
    "🐶",
    [
      "🐶|dog face|puppy pet", "🐱|cat face|kitten pet", "🐭|mouse face|rodent", "🐹|hamster|pet", "🐰|rabbit face|bunny", "🦊|fox|animal", "🐻|bear|animal", "🐼|panda|animal",
      "🐨|koala|animal", "🐯|tiger face|cat", "🦁|lion|king cat", "🐮|cow face|farm", "🐷|pig face|farm", "🐸|frog|toad", "🐵|monkey face|animal", "🐔|chicken|farm bird",
      "🐧|penguin|bird", "🐦|bird|tweet", "🦅|eagle|bird", "🦉|owl|wise bird night", "🐴|horse face|animal", "🦄|unicorn|magic fantasy", "🐝|honeybee|bee buzz", "🐛|bug|caterpillar insect",
      "🦋|butterfly|insect pretty", "🐌|snail|slow", "🐞|lady beetle|ladybug", "🐢|turtle|slow tortoise", "🐍|snake|python", "🐙|octopus|sea", "🦀|crab|sea rust", "🐠|tropical fish|sea",
      "🐬|dolphin|sea", "🐳|spouting whale|sea docker", "🦈|shark|sea", "🐊|crocodile|reptile", "🐘|elephant|animal", "🦒|giraffe|animal", "🐕|dog|pet", "🐈|cat|pet",
      "🌵|cactus|desert", "🌲|evergreen tree|forest", "🌳|deciduous tree|forest", "🌴|palm tree|beach tropical", "🌱|seedling|plant grow sprout", "🌿|herb|plant leaf", "🍀|four leaf clover|luck", "🍁|maple leaf|fall autumn",
      "🍂|fallen leaf|autumn", "🌷|tulip|flower", "🌹|rose|flower love", "🌻|sunflower|flower", "🌸|cherry blossom|flower spring", "🌼|blossom|flower", "🌞|sun with face|sunny", "🌙|crescent moon|night",
      "⭐|star|favorite", "🌟|glowing star|shine", "✨|sparkles|magic shiny new", "⚡|high voltage|lightning fast power", "🔥|fire|hot lit flame", "🌈|rainbow|pride", "☀️|sun|sunny weather", "⛅|sun behind cloud|weather",
      "☁️|cloud|weather", "🌧️|cloud with rain|rain weather", "⛈️|cloud with lightning and rain|storm", "❄️|snowflake|cold winter", "☃️|snowman|winter", "💧|droplet|water", "🌊|water wave|ocean sea", "🌍|globe showing europe-africa|world earth",
    ],
  ],
  [
    "food",
    "Food and drink",
    "🍔",
    [
      "🍏|green apple|fruit", "🍎|red apple|fruit", "🍐|pear|fruit", "🍊|tangerine|orange fruit", "🍋|lemon|fruit sour", "🍌|banana|fruit", "🍉|watermelon|fruit summer", "🍇|grapes|fruit wine",
      "🍓|strawberry|fruit", "🍒|cherries|fruit", "🍑|peach|fruit", "🥭|mango|fruit", "🍍|pineapple|fruit", "🥥|coconut|fruit", "🥝|kiwi fruit|fruit", "🍅|tomato|vegetable",
      "🥑|avocado|fruit guac", "🍆|eggplant|vegetable", "🥔|potato|vegetable", "🥕|carrot|vegetable", "🌽|ear of corn|vegetable", "🌶️|hot pepper|spicy chili", "🥦|broccoli|vegetable", "🍄|mushroom|fungus",
      "🥜|peanuts|nut", "🍞|bread|loaf", "🥐|croissant|bakery", "🥖|baguette bread|french", "🥨|pretzel|snack", "🥯|bagel|bakery", "🧀|cheese wedge|cheese", "🥚|egg|breakfast",
      "🍳|cooking|fried egg breakfast", "🥞|pancakes|breakfast", "🧇|waffle|breakfast", "🥓|bacon|breakfast", "🍗|poultry leg|chicken", "🍖|meat on bone|meat", "🌭|hot dog|sausage", "🍔|hamburger|burger",
      "🍟|french fries|chips", "🍕|pizza|slice", "🥪|sandwich|lunch", "🌮|taco|mexican", "🌯|burrito|mexican", "🥗|green salad|healthy", "🍝|spaghetti|pasta", "🍜|steaming bowl|ramen noodles",
      "🍣|sushi|japanese", "🍱|bento box|japanese lunch", "🍤|fried shrimp|tempura", "🍙|rice ball|japanese", "🍚|cooked rice|rice", "🍦|soft ice cream|dessert", "🍩|doughnut|donut dessert", "🍪|cookie|dessert",
      "🎂|birthday cake|celebrate party", "🍰|shortcake|cake dessert", "🧁|cupcake|dessert", "🍫|chocolate bar|candy", "🍬|candy|sweet", "🍭|lollipop|candy", "🍿|popcorn|movie snack", "☕|hot beverage|coffee tea",
      "🍵|teacup without handle|tea matcha", "🥤|cup with straw|soda drink", "🍺|beer mug|beer drink", "🍻|clinking beer mugs|cheers", "🥂|clinking glasses|cheers celebrate champagne", "🍷|wine glass|wine drink", "🍸|cocktail glass|martini drink", "🍹|tropical drink|cocktail",
    ],
  ],
  [
    "activities",
    "Activities",
    "⚽",
    [
      "⚽|soccer ball|football sport", "🏀|basketball|sport", "🏈|american football|sport", "⚾|baseball|sport", "🎾|tennis|sport", "🏐|volleyball|sport", "🏉|rugby football|sport", "🎱|pool 8 ball|billiards",
      "🏓|ping pong|table tennis", "🏸|badminton|sport", "🥊|boxing glove|fight", "⛳|flag in hole|golf", "🎣|fishing pole|fish", "🎿|skis|ski winter", "🏂|snowboarder|winter", "🏆|trophy|win champion award",
      "🥇|1st place medal|gold first win", "🥈|2nd place medal|silver second", "🥉|3rd place medal|bronze third", "🏅|sports medal|award", "🎖️|military medal|award honor", "🎗️|reminder ribbon|awareness", "🎟️|admission tickets|event", "🎭|performing arts|theater drama",
      "🎨|artist palette|art paint design", "🎬|clapper board|movie film", "🎤|microphone|sing karaoke", "🎧|headphone|music listen", "🎼|musical score|music", "🎹|musical keyboard|piano", "🥁|drum|music", "🎷|saxophone|jazz",
      "🎺|trumpet|music", "🎸|guitar|rock music", "🎻|violin|music", "🎲|game die|dice chance", "🎯|bullseye|target goal direct hit", "🎳|bowling|sport", "🎮|video game|controller gaming", "🧩|puzzle piece|jigsaw",
      "🎉|party popper|celebrate tada congrats", "🎊|confetti ball|celebrate", "🎈|balloon|party birthday", "🎁|wrapped gift|present birthday", "🎀|ribbon|gift", "🎄|christmas tree|holiday", "🎃|jack-o-lantern|halloween pumpkin", "🎆|fireworks|celebrate",
    ],
  ],
  [
    "travel",
    "Travel and places",
    "🚗",
    [
      "🚗|automobile|car drive", "🚕|taxi|cab", "🚙|sport utility vehicle|suv car", "🚌|bus|transit", "🏎️|racing car|fast", "🚓|police car|cop", "🚑|ambulance|emergency", "🚒|fire engine|truck",
      "🚚|delivery truck|shipping", "🚜|tractor|farm", "🚲|bicycle|bike", "🛵|motor scooter|vespa", "🏍️|motorcycle|bike", "🚂|locomotive|train", "🚆|train|rail", "🚇|metro|subway",
      "✈️|airplane|flight travel", "🛫|airplane departure|takeoff", "🛬|airplane arrival|landing", "🚀|rocket|launch ship space", "🛸|flying saucer|ufo", "🚁|helicopter|fly", "⛵|sailboat|boat", "🚤|speedboat|boat",
      "🚢|ship|cruise", "⚓|anchor|ship", "⛽|fuel pump|gas", "🚧|construction|wip roadwork", "🚦|vertical traffic light|signal", "🗺️|world map|travel", "🗽|statue of liberty|new york", "🗼|tokyo tower|landmark",
      "🏰|castle|fairy tale", "🏟️|stadium|arena", "🎡|ferris wheel|fair", "🎢|roller coaster|ride", "🏖️|beach with umbrella|vacation", "🏝️|desert island|vacation", "🏔️|snow-capped mountain|peak", "⛰️|mountain|hike",
      "🏕️|camping|tent outdoors", "🏠|house|home", "🏡|house with garden|home", "🏢|office building|work", "🏬|department store|shopping", "🏭|factory|industry", "🏥|hospital|health", "🏦|bank|money",
      "🏨|hotel|stay", "🏪|convenience store|shop", "🏫|school|education", "⛪|church|religion", "🌆|cityscape at dusk|city", "🌃|night with stars|city night", "🌉|bridge at night|city", "🗻|mount fuji|mountain",
    ],
  ],
  [
    "objects",
    "Objects",
    "💡",
    [
      "⌚|watch|time", "📱|mobile phone|cell smartphone", "💻|laptop|computer", "⌨️|keyboard|type", "🖥️|desktop computer|monitor", "🖨️|printer|print", "🖱️|computer mouse|click", "💾|floppy disk|save",
      "💿|optical disk|cd", "📷|camera|photo", "📹|video camera|record", "🎥|movie camera|film", "📞|telephone receiver|call phone", "📺|television|tv", "📻|radio|broadcast", "⏰|alarm clock|time wake",
      "⏳|hourglass not done|wait loading", "⌛|hourglass done|time", "🔋|battery|power charge", "🔌|electric plug|power", "💡|light bulb|idea", "🔦|flashlight|torch", "🕯️|candle|light", "💸|money with wings|spend",
      "💵|dollar banknote|money cash", "💰|money bag|rich", "💳|credit card|payment", "💎|gem stone|diamond", "⚖️|balance scale|justice law", "🔧|wrench|tool fix", "🔨|hammer|tool build", "🛠️|hammer and wrench|tools settings",
      "🔩|nut and bolt|hardware", "⚙️|gear|settings config", "🧰|toolbox|tools", "🧲|magnet|attract", "🧪|test tube|science experiment", "🔬|microscope|science", "🔭|telescope|astronomy", "💊|pill|medicine",
      "💉|syringe|vaccine shot", "🩹|adhesive bandage|fix hurt", "🧹|broom|clean sweep", "🧺|basket|laundry", "🧻|roll of paper|toilet paper", "🚪|door|exit", "🛏️|bed|sleep", "🛋️|couch and lamp|sofa",
      "🧸|teddy bear|toy", "📦|package|box shipping", "📫|closed mailbox with raised flag|mail", "✉️|envelope|mail letter", "📧|e-mail|email", "📝|memo|note write", "📁|file folder|directory", "📂|open file folder|directory",
      "📅|calendar|date", "📆|tear-off calendar|date schedule", "📈|chart increasing|growth up trend", "📉|chart decreasing|down trend", "📊|bar chart|stats data", "📋|clipboard|list", "📌|pushpin|pin", "📍|round pushpin|location",
      "📎|paperclip|attach", "📏|straight ruler|measure", "📐|triangular ruler|measure", "✂️|scissors|cut", "🔒|locked|secure private", "🔓|unlocked|open", "🔑|key|password access", "🔍|magnifying glass tilted left|search find",
      "📚|books|library study", "📖|open book|read", "🔖|bookmark|save", "🏷️|label|tag", "🧾|receipt|invoice", "✏️|pencil|edit write", "🖊️|pen|write", "🖌️|paintbrush|art",
    ],
  ],
  [
    "symbols",
    "Symbols",
    "❤️",
    [
      "❤️|red heart|love like", "🧡|orange heart|love", "💛|yellow heart|love", "💚|green heart|love", "💙|blue heart|love", "💜|purple heart|love", "🖤|black heart|love", "🤍|white heart|love",
      "🤎|brown heart|love", "💔|broken heart|sad", "❣️|heart exclamation|love", "💕|two hearts|love", "💞|revolving hearts|love", "💖|sparkling heart|love", "💘|heart with arrow|love cupid", "💯|hundred points|100 perfect",
      "✅|check mark button|done yes complete", "☑️|check box with check|done", "✔️|check mark|done", "❌|cross mark|no wrong delete", "❎|cross mark button|no", "➕|plus|add", "➖|minus|subtract", "❓|red question mark|question",
      "❗|red exclamation mark|important", "‼️|double exclamation mark|important", "⚠️|warning|caution alert", "🚫|prohibited|forbidden no", "⛔|no entry|stop", "🔴|red circle|red", "🟠|orange circle|orange", "🟡|yellow circle|yellow",
      "🟢|green circle|green", "🔵|blue circle|blue", "🟣|purple circle|purple", "⚫|black circle|black", "⚪|white circle|white", "⬆️|up arrow|up", "⬇️|down arrow|down", "⬅️|left arrow|left",
      "➡️|right arrow|right next", "🔄|counterclockwise arrows button|refresh sync", "🔁|repeat button|loop", "▶️|play button|start", "⏸️|pause button|pause", "⏹️|stop button|stop", "🔔|bell|notification", "🔕|bell with slash|mute",
      "📣|megaphone|announce", "💬|speech balloon|comment chat", "💭|thought balloon|think", "♻️|recycling symbol|recycle", "🆗|ok button|okay", "🆕|new button|new", "🆒|cool button|cool", "ℹ️|information|info",
      "💤|zzz|sleep", "🏁|chequered flag|finish race", "🚩|triangular flag|red flag", "🏳️|white waving flag|surrender",
    ],
  ],
];

let cache: EmojiCategory[] | undefined;

/** The curated emoji set, grouped by category. */
export function emojiCategories(): EmojiCategory[] {
  cache ??= DATA.map(([id, name, icon, entries]) => ({
    id,
    name,
    icon,
    emoji: entries.map((entry) => {
      const [char = "", emojiName = "", keywords = "", tone] = entry.split("|");
      return { char, name: emojiName, keywords, tone: tone === "t" };
    }),
  }));
  return cache;
}

/** Looks up an emoji by its character, ignoring skin tone. */
export function findEmoji(char: string): Emoji | undefined {
  const base = stripSkinTone(char);
  for (const category of emojiCategories()) {
    const match = category.emoji.find((emoji) => emoji.char === base || emoji.char.replace("️", "") === base);
    if (match) return match;
  }
  return undefined;
}

/** Every emoji whose name or keywords contain each word of the query. */
export function searchEmoji(query: string, limit = 120): Emoji[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const results: Emoji[] = [];
  for (const category of emojiCategories()) {
    for (const emoji of category.emoji) {
      const haystack = `${emoji.name} ${emoji.keywords}`.toLowerCase();
      if (words.every((word) => haystack.includes(word))) results.push(emoji);
      if (results.length >= limit) return results;
    }
  }
  return results;
}

export type SkinTone = 0 | 1 | 2 | 3 | 4 | 5;

export const SKIN_TONES: { tone: SkinTone; name: string }[] = [
  { tone: 0, name: "Default" },
  { tone: 1, name: "Light" },
  { tone: 2, name: "Medium-light" },
  { tone: 3, name: "Medium" },
  { tone: 4, name: "Medium-dark" },
  { tone: 5, name: "Dark" },
];

const TONE_PATTERN = /[\u{1F3FB}-\u{1F3FF}]/gu;

export function stripSkinTone(char: string): string {
  return char.replace(TONE_PATTERN, "");
}

/** Adds a Fitzpatrick modifier after the base character, dropping the emoji presentation selector it replaces. */
export function withSkinTone(emoji: Emoji, tone: SkinTone): string {
  if (!emoji.tone || tone === 0) return emoji.char;
  const [base = ""] = [...emoji.char];
  return base + String.fromCodePoint(0x1f3fa + tone);
}
